"""Cookie-JWT auth + tenant-scoping dependencies. Tenant (shop_id) always comes from the user record, never the request."""
import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, Response

from lib.db import db

COOKIE = "session"
SECRET = os.environ.get("JWT_SECRET", "dev-secret")


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def check_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except ValueError:
        return False


def set_session(resp: Response, user_id: str) -> None:
    token = jwt.encode(
        {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=30)}, SECRET, algorithm="HS256"
    )
    resp.set_cookie(COOKIE, token, httponly=True, samesite="lax", max_age=60 * 60 * 24 * 30, path="/")


def clear_session(resp: Response) -> None:
    resp.delete_cookie(COOKIE, path="/")


async def current_user(request: Request) -> dict:
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(401, "Não autenticado")
    try:
        sub = jwt.decode(token, SECRET, algorithms=["HS256"])["sub"]
    except jwt.PyJWTError:
        raise HTTPException(401, "Sessão inválida")
    user = await db.users.find_one({"id": sub}, {"_id": 0})
    if not user:
        raise HTTPException(401, "Usuário não encontrado")
    return user


async def staff_user(user: dict = Depends(current_user)) -> dict:
    """Admin or barber of an ACTIVE shop."""
    if user["role"] not in ("admin", "barber") or not user.get("shop_id"):
        raise HTTPException(403, "Acesso restrito à equipe")
    shop = await db.shops.find_one({"id": user["shop_id"]}, {"_id": 0, "active": 1})
    if not shop or not shop.get("active"):
        raise HTTPException(403, "Barbearia suspensa")
    return user


async def admin_user(user: dict = Depends(staff_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(403, "Apenas o administrador da barbearia")
    return user


async def super_user(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "superadmin":
        raise HTTPException(403, "Apenas o super administrador")
    return user


async def client_user(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "client":
        raise HTTPException(403, "Área exclusiva para clientes")
    return user
