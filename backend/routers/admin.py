"""Barbershop panel. Every query is scoped by user['shop_id'] (from the session, never the request)."""
import re

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from bson import Binary

from lib.auth import admin_user, hash_pw, staff_user
from lib.core import activate_cycle, barber_ratings, ensure_member, new_id, now_iso, parse_date, refresh_subscription
from lib.db import db
from models.schemas import (AdjustIn, AgendaOut, Appointment, Barber, BarberIn, BillingIn, Block, BlockIn, CompleteIn,
                            FileOut, GalleryIn, GalleryItem, Plan, PlanIn, Product, ProductIn, Service, ServiceIn, Shop,
                            ShopUpdate, Subscription, WalkInIn)

router = APIRouter(prefix="/admin")


def _barber_scope(user: dict, barber_id: str | None) -> str | None:
    """Barbers only ever see their own agenda."""
    if user["role"] == "barber":
        return user["barber_id"]
    return barber_id


# ---------- shop settings ----------
@router.get("/shop", response_model=Shop)
async def get_shop(user: dict = Depends(staff_user)):
    return Shop(**await db.shops.find_one({"id": user["shop_id"]}, {"_id": 0}))


@router.put("/shop", response_model=Shop)
async def update_shop(body: ShopUpdate, user: dict = Depends(admin_user)):
    slug = body.slug.strip().lower()
    if not re.fullmatch(r"[a-z0-9-]{2,60}", slug):
        raise HTTPException(422, "Slug inválido: use letras minúsculas, números e hífen")
    if await db.shops.find_one({"slug": slug, "id": {"$ne": user["shop_id"]}}):
        raise HTTPException(400, "Este link já está em uso")
    data = body.model_dump()
    data["slug"] = slug
    data["whatsapp"] = "".join(c for c in body.whatsapp if c.isdigit())
    await db.shops.update_one({"id": user["shop_id"]}, {"$set": data})
    return Shop(**await db.shops.find_one({"id": user["shop_id"]}, {"_id": 0}))


# ---------- uploads ----------
@router.post("/files", response_model=FileOut)
async def upload(file: UploadFile = File(...), user: dict = Depends(staff_user)):
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(400, "Envie uma imagem")
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(400, "Imagem muito grande (máx 8MB)")
    fid = new_id()
    await db.files.insert_one({"id": fid, "shop_id": user["shop_id"], "content_type": file.content_type, "data": Binary(data), "created_at": now_iso()})
    return FileOut(id=fid, url=f"/api/files/{fid}")


# ---------- generic CRUD (services, products, plans) ----------
def _crud(name: str, coll: str, Model, ModelIn):
    @router.get(f"/{name}", response_model=list[Model], name=f"list_{name}")
    async def _list(user: dict = Depends(staff_user)):
        return [Model(**d) for d in await db[coll].find({"shop_id": user["shop_id"]}, {"_id": 0}).sort("name", 1).to_list(500)]

    @router.post(f"/{name}", response_model=Model, name=f"create_{name}")
    async def _create(body: ModelIn, user: dict = Depends(admin_user)):
        doc = {"id": new_id(), "shop_id": user["shop_id"], **body.model_dump()}
        await db[coll].insert_one(dict(doc))
        return Model(**doc)

    @router.put(f"/{name}/{{item_id}}", response_model=Model, name=f"update_{name}")
    async def _update(item_id: str, body: ModelIn, user: dict = Depends(admin_user)):
        r = await db[coll].update_one({"id": item_id, "shop_id": user["shop_id"]}, {"$set": body.model_dump()})
        if not r.matched_count:
            raise HTTPException(404, "Não encontrado")
        return Model(**await db[coll].find_one({"id": item_id}, {"_id": 0}))

    @router.delete(f"/{name}/{{item_id}}", name=f"delete_{name}")
    async def _delete(item_id: str, user: dict = Depends(admin_user)):
        r = await db[coll].delete_one({"id": item_id, "shop_id": user["shop_id"]})
        if not r.deleted_count:
            raise HTTPException(404, "Não encontrado")
        return {"ok": True}


_crud("services", "services", Service, ServiceIn)
_crud("products", "products", Product, ProductIn)
_crud("plans", "plans", Plan, PlanIn)


# ---------- team ----------
@router.get("/barbers", response_model=list[Barber])
async def list_barbers(user: dict = Depends(staff_user)):
    ratings = await barber_ratings(user["shop_id"])
    out = []
    for b in await db.barbers.find({"shop_id": user["shop_id"]}, {"_id": 0}).sort("name", 1).to_list(100):
        r = ratings.get(b["id"], (0, 0))
        out.append(Barber(**{**b, "rating": r[0], "rating_count": r[1]}))
    return out


async def _barber_login(barber_id: str, shop_id: str, name: str, email: str | None, password: str | None) -> str | None:
    if not email:
        return None
    email = email.strip().lower()
    existing = await db.users.find_one({"email": email})
    if existing and existing.get("barber_id") != barber_id:
        raise HTTPException(400, "E-mail já utilizado por outro usuário")
    if existing:
        upd = {"name": name}
        if password:
            upd["password_hash"] = hash_pw(password)
        await db.users.update_one({"id": existing["id"]}, {"$set": upd})
        return existing["id"]
    if not password or len(password) < 6:
        raise HTTPException(400, "Informe uma senha (mín. 6 caracteres) para o acesso do barbeiro")
    uid = new_id()
    await db.users.insert_one({"id": uid, "name": name, "email": email, "phone": "", "password_hash": hash_pw(password),
                               "role": "barber", "shop_id": shop_id, "barber_id": barber_id, "created_at": now_iso()})
    return uid


@router.post("/barbers", response_model=Barber)
async def create_barber(body: BarberIn, user: dict = Depends(admin_user)):
    bid = new_id()
    data = body.model_dump(exclude={"email", "password"})
    uid = await _barber_login(bid, user["shop_id"], body.name, body.email, body.password)
    doc = {"id": bid, "shop_id": user["shop_id"], "user_id": uid, **data}
    await db.barbers.insert_one(dict(doc))
    return Barber(**doc)


@router.put("/barbers/{barber_id}", response_model=Barber)
async def update_barber(barber_id: str, body: BarberIn, user: dict = Depends(admin_user)):
    b = await db.barbers.find_one({"id": barber_id, "shop_id": user["shop_id"]}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Barbeiro não encontrado")
    data = body.model_dump(exclude={"email", "password"})
    uid = await _barber_login(barber_id, user["shop_id"], body.name, body.email, body.password) or b.get("user_id")
    data["user_id"] = uid
    await db.barbers.update_one({"id": barber_id}, {"$set": data})
    await db.appointments.update_many({"barber_id": barber_id, "status": "agendado"}, {"$set": {"barber_name": body.name}})
    return Barber(**{**b, **data})


@router.delete("/barbers/{barber_id}")
async def delete_barber(barber_id: str, user: dict = Depends(admin_user)):
    b = await db.barbers.find_one({"id": barber_id, "shop_id": user["shop_id"]})
    if not b:
        raise HTTPException(404, "Barbeiro não encontrado")
    if b.get("user_id") == user["id"]:
        raise HTTPException(400, "Você não pode remover a si mesmo; desative-o")
    await db.barbers.update_one({"id": barber_id}, {"$set": {"active": False}})
    if b.get("user_id"):
        await db.users.delete_one({"id": b["user_id"], "role": "barber"})
    return {"ok": True}


# ---------- agenda ----------
@router.get("/agenda", response_model=AgendaOut)
async def agenda(date: str, barber_id: str | None = None, user: dict = Depends(staff_user)):
    parse_date(date)
    sid = user["shop_id"]
    bid = _barber_scope(user, barber_id)
    q: dict = {"shop_id": sid, "date": date}
    bq: dict = {"shop_id": sid, "active": True}
    if bid:
        q["barber_id"] = bid
        bq["id"] = bid
    return AgendaOut(
        date=date,
        barbers=[Barber(**b) for b in await db.barbers.find(bq, {"_id": 0}).sort("name", 1).to_list(100)],
        appointments=[Appointment(**a) for a in await db.appointments.find(q, {"_id": 0}).sort("start", 1).to_list(500)],
        blocks=[Block(**b) for b in await db.blocks.find(q, {"_id": 0}).sort("start", 1).to_list(200)],
    )


async def _staff_appt(appt_id: str, user: dict) -> dict:
    q = {"id": appt_id, "shop_id": user["shop_id"]}
    if user["role"] == "barber":
        q["barber_id"] = user["barber_id"]
    a = await db.appointments.find_one(q, {"_id": 0})
    if not a:
        raise HTTPException(404, "Agendamento não encontrado")
    return a


@router.post("/appointments", response_model=Appointment)
async def walk_in(body: WalkInIn, user: dict = Depends(staff_user)):
    sid = user["shop_id"]
    bid = _barber_scope(user, body.barber_id)
    barber = await db.barbers.find_one({"id": bid, "shop_id": sid}, {"_id": 0})
    if not barber:
        raise HTTPException(400, "Barbeiro inválido")
    services = await db.services.find({"shop_id": sid, "id": {"$in": body.service_ids}}, {"_id": 0}).to_list(50)
    if not services:
        raise HTTPException(400, "Selecione ao menos um serviço")
    parse_date(body.date)
    duration = sum(s["duration"] for s in services)
    price = round(sum(s["price"] for s in services), 2)
    end_min = int(body.start[:2]) * 60 + int(body.start[3:]) + duration
    phone = "".join(c for c in body.client_phone if c.isdigit())
    client = await db.users.find_one({"phone": phone, "role": "client"}, {"_id": 0}) if phone else None
    appt = {"id": new_id(), "shop_id": sid, "client_id": client["id"] if client else None, "client_name": body.client_name.strip(),
            "client_phone": phone, "barber_id": barber["id"], "barber_name": barber["name"],
            "service_ids": [s["id"] for s in services], "service_names": [s["name"] for s in services], "date": body.date,
            "start": body.start, "end": f"{end_min // 60:02d}:{end_min % 60:02d}", "duration": duration, "price": price,
            "discount": 0, "products": [], "products_total": 0, "total": price,
            "payment_method": "pix" if body.payment_method == "plano" else body.payment_method, "status": "agendado",
            "walk_in": True, "subscription_id": None, "coupon_id": None, "rated": False, "created_at": now_iso()}
    await db.appointments.insert_one(dict(appt))
    return Appointment(**appt)


@router.post("/appointments/{appt_id}/cancel", response_model=Appointment)
async def staff_cancel(appt_id: str, user: dict = Depends(staff_user)):
    a = await _staff_appt(appt_id, user)
    if a["status"] != "agendado":
        raise HTTPException(400, "Agendamento não está ativo")
    await db.appointments.update_one({"id": appt_id}, {"$set": {"status": "cancelado"}})
    if a.get("coupon_id"):
        await db.coupons.update_one({"id": a["coupon_id"]}, {"$set": {"used": False}})
    a["status"] = "cancelado"
    return Appointment(**a)


@router.post("/appointments/{appt_id}/complete", response_model=Appointment)
async def complete(appt_id: str, body: CompleteIn, user: dict = Depends(staff_user)):
    a = await _staff_appt(appt_id, user)
    if a["status"] != "agendado":
        raise HTTPException(400, "Atendimento já finalizado ou cancelado")
    sid = user["shop_id"]
    shop = await db.shops.find_one({"id": sid}, {"_id": 0})
    # products / stock
    items, products_total = [], 0.0
    for it in body.products:
        p = await db.products.find_one({"id": it.product_id, "shop_id": sid}, {"_id": 0})
        if not p:
            raise HTTPException(400, "Produto inválido")
        if p["stock"] < it.qty:
            raise HTTPException(400, f"Estoque insuficiente de {p['name']}")
        items.append({"product_id": p["id"], "name": p["name"], "qty": it.qty, "price": p["price"]})
        products_total += p["price"] * it.qty
    # plan balance
    sub_id, discount = a.get("subscription_id"), a.get("discount", 0)
    if body.payment_method == "plano":
        sub = None
        if sub_id:
            sub = await db.subscriptions.find_one({"id": sub_id, "shop_id": sid}, {"_id": 0})
        elif a.get("client_id"):
            sub = await db.subscriptions.find_one({"shop_id": sid, "client_id": a["client_id"], "status": "ativa"}, {"_id": 0})
        if sub:
            sub = await refresh_subscription(sub)
        if not sub or sub["status"] != "ativa" or sub["credits_left"] < 1:
            raise HTTPException(400, "Cliente sem assinatura ativa com saldo")
        await db.subscriptions.update_one({"id": sub["id"]}, {"$inc": {"credits_left": -1}})
        sub_id, discount = sub["id"], a["price"]
    else:
        if a["payment_method"] == "plano":
            discount = 0
        sub_id = None
    for it in items:
        await db.products.update_one({"id": it["product_id"]}, {"$inc": {"stock": -it["qty"]}})
    total = round(a["price"] - discount + products_total, 2)
    upd = {"status": "concluido", "payment_method": body.payment_method, "products": items, "products_total": round(products_total, 2),
           "discount": discount, "subscription_id": sub_id, "total": total, "completed_at": now_iso()}
    await db.appointments.update_one({"id": appt_id}, {"$set": upd})
    a.update(upd)
    # loyalty + referral
    if a.get("client_id"):
        client = await db.users.find_one({"id": a["client_id"]}, {"_id": 0})
        if client:
            member = await ensure_member(sid, client)
            if body.payment_method != "plano":
                stamps = member.get("loyalty_stamps", 0) + 1
                if stamps >= shop.get("loyalty_target", 10):
                    stamps = 0
                    corte = await db.services.find_one({"shop_id": sid, "name": {"$regex": "^Corte"}}) or {"price": 50}
                    await db.coupons.insert_one({"id": new_id(), "shop_id": sid, "client_id": client["id"], "kind": "valor",
                                                 "value": corte["price"], "used": False, "origin": "Cartão fidelidade: corte grátis",
                                                 "created_at": now_iso()})
                await db.members.update_one({"id": member["id"]}, {"$set": {"loyalty_stamps": stamps}})
            if member.get("referred_by") and not member.get("referral_rewarded"):
                await db.members.update_one({"id": member["id"]}, {"$set": {"referral_rewarded": True}})
                await db.coupons.insert_one({"id": new_id(), "shop_id": sid, "client_id": member["referred_by"],
                                             "kind": shop.get("referral_reward_type", "valor"), "value": shop.get("referral_reward_value", 15),
                                             "used": False, "origin": f"Indicação de {client['name']}", "created_at": now_iso()})
    return Appointment(**a)


# ---------- blocks ----------
@router.post("/blocks", response_model=Block)
async def create_block(body: BlockIn, user: dict = Depends(staff_user)):
    bid = _barber_scope(user, body.barber_id)
    if not await db.barbers.find_one({"id": bid, "shop_id": user["shop_id"]}):
        raise HTTPException(400, "Barbeiro inválido")
    parse_date(body.date)
    if bool(body.start) != bool(body.end) or (body.start and body.start >= body.end):
        raise HTTPException(422, "Intervalo inválido")
    doc = {"id": new_id(), "shop_id": user["shop_id"], **body.model_dump(), "barber_id": bid}
    await db.blocks.insert_one(dict(doc))
    return Block(**doc)


@router.delete("/blocks/{block_id}")
async def delete_block(block_id: str, user: dict = Depends(staff_user)):
    q = {"id": block_id, "shop_id": user["shop_id"]}
    if user["role"] == "barber":
        q["barber_id"] = user["barber_id"]
    if not (await db.blocks.delete_one(q)).deleted_count:
        raise HTTPException(404, "Bloqueio não encontrado")
    return {"ok": True}


# ---------- gallery ----------
@router.post("/gallery", response_model=GalleryItem)
async def add_gallery(body: GalleryIn, user: dict = Depends(staff_user)):
    doc = {"id": new_id(), "shop_id": user["shop_id"], "url": body.url, "caption": body.caption, "created_at": now_iso()}
    await db.gallery.insert_one(dict(doc))
    return GalleryItem(**doc)


@router.delete("/gallery/{item_id}")
async def del_gallery(item_id: str, user: dict = Depends(admin_user)):
    if not (await db.gallery.delete_one({"id": item_id, "shop_id": user["shop_id"]})).deleted_count:
        raise HTTPException(404, "Foto não encontrada")
    return {"ok": True}


# ---------- subscriptions ----------
async def _sub(sub_id: str, user: dict) -> dict:
    s = await db.subscriptions.find_one({"id": sub_id, "shop_id": user["shop_id"]}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Assinatura não encontrada")
    return s


@router.get("/subscriptions", response_model=list[Subscription])
async def list_subs(user: dict = Depends(admin_user)):
    subs = await db.subscriptions.find({"shop_id": user["shop_id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Subscription(**await refresh_subscription(s)) for s in subs]


@router.post("/subscriptions/{sub_id}/activate", response_model=Subscription)
async def activate(sub_id: str, user: dict = Depends(admin_user)):
    """Activates a pending sub or renews the monthly cycle (credits reset, payment recorded)."""
    s = await _sub(sub_id, user)
    return Subscription(**await activate_cycle(s))


@router.post("/subscriptions/{sub_id}/cancel", response_model=Subscription)
async def cancel_sub(sub_id: str, user: dict = Depends(admin_user)):
    s = await _sub(sub_id, user)
    await db.subscriptions.update_one({"id": sub_id}, {"$set": {"status": "cancelada", "request": None}})
    s.update({"status": "cancelada", "request": None})
    return Subscription(**s)


@router.post("/subscriptions/{sub_id}/billing", response_model=Subscription)
async def set_billing(sub_id: str, body: BillingIn, user: dict = Depends(admin_user)):
    s = await _sub(sub_id, user)
    await db.subscriptions.update_one({"id": sub_id}, {"$set": {"billing": body.billing, "request": None}})
    s.update({"billing": body.billing, "request": None})
    return Subscription(**s)


@router.post("/subscriptions/{sub_id}/adjust", response_model=Subscription)
async def adjust(sub_id: str, body: AdjustIn, user: dict = Depends(admin_user)):
    s = await _sub(sub_id, user)
    await db.subscriptions.update_one({"id": sub_id}, {"$set": {"credits_left": body.credits_left}})
    s["credits_left"] = body.credits_left
    return Subscription(**s)
