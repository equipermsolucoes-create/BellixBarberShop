"""Shared business helpers: ids, time math, slot availability, subscription renewal, member records."""
import os
import random
import string
import uuid
from datetime import date as Date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException

from lib.db import db

TZ = ZoneInfo(os.environ.get("APP_TZ", "America/Sao_Paulo"))
STEP = 15


def new_id() -> str:
    return str(uuid.uuid4())


def now_br() -> datetime:
    return datetime.now(TZ)


def now_iso() -> str:
    return now_br().isoformat()


def to_min(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def to_hhmm(m: int) -> str:
    return f"{m // 60:02d}:{m % 60:02d}"


def parse_date(d: str) -> Date:
    try:
        return Date.fromisoformat(d)
    except ValueError:
        raise HTTPException(422, "Data inválida")


def appt_dt(d: str, t: str) -> datetime:
    return datetime.fromisoformat(f"{d}T{t}").replace(tzinfo=TZ)


def add_month(d: Date) -> Date:
    y, m = (d.year + 1, 1) if d.month == 12 else (d.year, d.month + 1)
    day = min(d.day, 28)
    return Date(y, m, day)


async def get_shop_by_slug(slug: str, require_active: bool = True) -> dict:
    shop = await db.shops.find_one({"slug": slug}, {"_id": 0})
    if not shop:
        raise HTTPException(404, "Barbearia não encontrada")
    if require_active and not shop.get("active"):
        raise HTTPException(403, "Barbearia temporariamente suspensa")
    return shop


async def compute_slots(shop_id: str, barber: dict, day: str, duration: int, exclude_id: str | None = None) -> list[str]:
    d = parse_date(day)
    if d.weekday() not in barber.get("work_days", []):
        return []
    today = now_br().date()
    if d < today:
        return []
    busy: list[tuple[int, int]] = []
    if barber.get("lunch_start") and barber.get("lunch_end"):
        busy.append((to_min(barber["lunch_start"]), to_min(barber["lunch_end"])))
    async for b in db.blocks.find({"shop_id": shop_id, "barber_id": barber["id"], "date": day}):
        if not b.get("start") or not b.get("end"):
            return []
        busy.append((to_min(b["start"]), to_min(b["end"])))
    q = {"shop_id": shop_id, "barber_id": barber["id"], "date": day, "status": {"$ne": "cancelado"}}
    if exclude_id:
        q["id"] = {"$ne": exclude_id}
    async for a in db.appointments.find(q):
        busy.append((to_min(a["start"]), to_min(a["end"])))
    start, end = to_min(barber["start"]), to_min(barber["end"])
    min_start = -1
    if d == today:
        n = now_br()
        min_start = n.hour * 60 + n.minute
    out = []
    t = start
    while t + duration <= end:
        if t > min_start and all(t + duration <= bs or t >= be for bs, be in busy):
            out.append(to_hhmm(t))
        t += STEP
    return out


async def refresh_subscription(sub: dict) -> dict:
    """Lazy monthly cycle: recurring subs renew credits, single ones expire."""
    if sub.get("status") != "ativa" or not sub.get("cycle_end"):
        return sub
    today = now_br().date()
    end = Date.fromisoformat(sub["cycle_end"])
    if today <= end:
        return sub
    if sub["billing"] == "recorrente":
        start = end + timedelta(days=1)
        while add_month(start) - timedelta(days=1) < today:
            start = add_month(start)
        new_end = add_month(start) - timedelta(days=1)
        upd = {"cycle_start": start.isoformat(), "cycle_end": new_end.isoformat(), "credits_left": sub["credits_total"]}
        await db.sub_payments.insert_one(
            {"id": new_id(), "shop_id": sub["shop_id"], "subscription_id": sub["id"], "amount": sub["price"], "date": start.isoformat()}
        )
    else:
        upd = {"status": "expirada"}
    await db.subscriptions.update_one({"id": sub["id"]}, {"$set": upd})
    sub.update(upd)
    return sub


async def activate_cycle(sub: dict) -> dict:
    start = now_br().date()
    end = add_month(start) - timedelta(days=1)
    upd = {"status": "ativa", "cycle_start": start.isoformat(), "cycle_end": end.isoformat(),
           "credits_left": sub["credits_total"], "request": None}
    await db.subscriptions.update_one({"id": sub["id"]}, {"$set": upd})
    await db.sub_payments.insert_one(
        {"id": new_id(), "shop_id": sub["shop_id"], "subscription_id": sub["id"], "amount": sub["price"], "date": start.isoformat()}
    )
    sub.update(upd)
    return sub


def _code(name: str) -> str:
    base = "".join(c for c in name.split()[0].upper() if c.isalpha())[:6] or "CLIENTE"
    return base + "".join(random.choices(string.digits, k=4))


async def ensure_member(shop_id: str, user: dict, ref_code: str | None = None) -> dict:
    m = await db.members.find_one({"shop_id": shop_id, "client_id": user["id"]}, {"_id": 0})
    if m:
        return m
    referred_by = None
    if ref_code:
        ref = await db.members.find_one({"shop_id": shop_id, "referral_code": ref_code.strip().upper()})
        if ref and ref["client_id"] != user["id"]:
            referred_by = ref["client_id"]
    code = _code(user["name"])
    while await db.members.find_one({"shop_id": shop_id, "referral_code": code}):
        code = _code(user["name"])
    m = {"id": new_id(), "shop_id": shop_id, "client_id": user["id"], "referral_code": code,
         "referred_by": referred_by, "referral_rewarded": False, "loyalty_stamps": 0}
    await db.members.insert_one(dict(m))
    return m


async def barber_ratings(shop_id: str) -> dict[str, tuple[float, int]]:
    out: dict[str, tuple[float, int]] = {}
    pipe = [{"$match": {"shop_id": shop_id}}, {"$group": {"_id": "$barber_id", "avg": {"$avg": "$rating"}, "n": {"$sum": 1}}}]
    async for r in db.reviews.aggregate(pipe):
        out[r["_id"]] = (round(r["avg"], 1), r["n"])
    return out
