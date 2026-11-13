import re

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import hash_pw, super_user
from lib.core import new_id, now_iso
from lib.db import db
from models.schemas import SaasPlan, SaasPlanIn, Shop, ShopCreateIn, ShopStatusIn, SuperMetrics, SuperShop

router = APIRouter(prefix="/super")


@router.get("/shops", response_model=list[SuperShop])
async def shops(user: dict = Depends(super_user)):
    out = []
    for s in await db.shops.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000):
        admin = await db.users.find_one({"shop_id": s["id"], "role": "admin"}, {"email": 1})
        out.append(SuperShop(shop=Shop(**s), admin_email=admin["email"] if admin else "",
                             appointments=await db.appointments.count_documents({"shop_id": s["id"]}),
                             barbers=await db.barbers.count_documents({"shop_id": s["id"], "active": True})))
    return out


@router.post("/shops", response_model=Shop)
async def create_shop(body: ShopCreateIn, user: dict = Depends(super_user)):
    slug = body.slug.strip().lower()
    if not re.fullmatch(r"[a-z0-9-]{2,60}", slug):
        raise HTTPException(422, "Slug inválido: use letras minúsculas, números e hífen")
    if await db.shops.find_one({"slug": slug}):
        raise HTTPException(400, "Slug já está em uso")
    email = body.admin_email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "E-mail do administrador já cadastrado")
    sid, uid, bid = new_id(), new_id(), new_id()
    shop = {"id": sid, "name": body.name.strip(), "slug": slug, "logo_url": None, "address": "", "maps_url": "",
            "whatsapp": "".join(c for c in body.whatsapp if c.isdigit()), "hours_text": "Seg a Sáb, 09h às 19h",
            "cancel_min_hours": 2, "active": True, "referral_reward_type": "valor", "referral_reward_value": 15,
            "loyalty_target": 10, "saas_plan": body.saas_plan, "created_at": now_iso()}
    await db.shops.insert_one(dict(shop))
    await db.users.insert_one({"id": uid, "name": body.admin_name.strip(), "email": email, "phone": shop["whatsapp"],
                               "password_hash": hash_pw(body.admin_password), "role": "admin", "shop_id": sid,
                               "barber_id": bid, "created_at": now_iso()})
    await db.barbers.insert_one({"id": bid, "shop_id": sid, "user_id": uid, "name": body.admin_name.strip(), "photo_url": None,
                                 "specialties": [], "work_days": [0, 1, 2, 3, 4, 5], "start": "09:00", "end": "19:00",
                                 "lunch_start": "12:00", "lunch_end": "13:00", "commission": 100, "active": True})
    return Shop(**shop)


@router.patch("/shops/{shop_id}", response_model=Shop)
async def set_status(shop_id: str, body: ShopStatusIn, user: dict = Depends(super_user)):
    upd: dict = {"active": body.active}
    if body.saas_plan:
        upd["saas_plan"] = body.saas_plan
    r = await db.shops.update_one({"id": shop_id}, {"$set": upd})
    if not r.matched_count:
        raise HTTPException(404, "Barbearia não encontrada")
    return Shop(**await db.shops.find_one({"id": shop_id}, {"_id": 0}))


@router.get("/metrics", response_model=SuperMetrics)
async def metrics(user: dict = Depends(super_user)):
    plans = {p["name"]: p["price"] for p in await db.saas_plans.find().to_list(100)}
    shops = await db.shops.find({}, {"active": 1, "saas_plan": 1}).to_list(5000)
    active = [s for s in shops if s.get("active")]
    return SuperMetrics(total_shops=len(shops), active_shops=len(active), suspended_shops=len(shops) - len(active),
                        total_appointments=await db.appointments.count_documents({"status": {"$ne": "cancelado"}}),
                        total_clients=await db.users.count_documents({"role": "client"}),
                        mrr=round(sum(plans.get(s.get("saas_plan", ""), 0) for s in active), 2))


@router.get("/saas-plans", response_model=list[SaasPlan])
async def saas_plans(user: dict = Depends(super_user)):
    return [SaasPlan(**p) for p in await db.saas_plans.find({}, {"_id": 0}).sort("price", 1).to_list(100)]


@router.post("/saas-plans", response_model=SaasPlan)
async def add_saas_plan(body: SaasPlanIn, user: dict = Depends(super_user)):
    doc = {"id": new_id(), **body.model_dump()}
    await db.saas_plans.insert_one(dict(doc))
    return SaasPlan(**doc)


@router.delete("/saas-plans/{plan_id}")
async def del_saas_plan(plan_id: str, user: dict = Depends(super_user)):
    if not (await db.saas_plans.delete_one({"id": plan_id})).deleted_count:
        raise HTTPException(404, "Plano não encontrado")
    return {"ok": True}
