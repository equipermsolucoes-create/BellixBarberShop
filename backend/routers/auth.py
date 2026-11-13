from fastapi import APIRouter, Depends, HTTPException, Response

from lib.auth import check_pw, clear_session, current_user, hash_pw, set_session
from lib.core import ensure_member, new_id, now_iso
from lib.db import db
from models.schemas import LoginIn, RegisterIn, UserOut

router = APIRouter(prefix="/auth")


async def user_out(u: dict) -> UserOut:
    slug = None
    if u.get("shop_id"):
        s = await db.shops.find_one({"id": u["shop_id"]}, {"slug": 1})
        slug = s["slug"] if s else None
    return UserOut(**u, shop_slug=slug)


@router.post("/register", response_model=UserOut)
async def register(body: RegisterIn, resp: Response):
    email = body.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "E-mail já cadastrado. Faça login.")
    user = {"id": new_id(), "name": body.name.strip(), "email": email, "phone": "".join(c for c in body.phone if c.isdigit()),
            "password_hash": hash_pw(body.password), "role": "client", "shop_id": None, "barber_id": None, "created_at": now_iso()}
    await db.users.insert_one(dict(user))
    if body.shop_slug:
        shop = await db.shops.find_one({"slug": body.shop_slug})
        if shop:
            await ensure_member(shop["id"], user, body.ref_code)
    set_session(resp, user["id"])
    return await user_out(user)


@router.post("/login", response_model=UserOut)
async def login(body: LoginIn, resp: Response):
    user = await db.users.find_one({"email": body.email.strip().lower()}, {"_id": 0})
    if not user or not check_pw(body.password, user["password_hash"]):
        raise HTTPException(401, "E-mail ou senha inválidos")
    if user["role"] in ("admin", "barber"):
        shop = await db.shops.find_one({"id": user["shop_id"]})
        if not shop or not shop.get("active"):
            raise HTTPException(403, "Acesso da barbearia suspenso. Contate o suporte da plataforma.")
    set_session(resp, user["id"])
    return await user_out(user)


@router.post("/logout")
async def logout(resp: Response):
    clear_session(resp)
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(current_user)):
    return await user_out(user)
