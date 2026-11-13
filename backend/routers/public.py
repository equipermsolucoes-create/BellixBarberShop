from fastapi import APIRouter, HTTPException, Query, Response

from lib.core import barber_ratings, compute_slots, get_shop_by_slug
from lib.dates import today_iso
from lib.db import db
from models.schemas import BarberPublic, GalleryItem, Plan, Review, Service, Shop, ShopPublic

router = APIRouter()


@router.get("/public/today")
async def today():
    return {"date": today_iso()}


@router.get("/public/shops", response_model=list[Shop])
async def list_shops():
    return [Shop(**s) for s in await db.shops.find({"active": True}, {"_id": 0}).sort("name", 1).to_list(200)]


@router.get("/public/shops/{slug}", response_model=ShopPublic)
async def shop_page(slug: str):
    shop = await get_shop_by_slug(slug, require_active=False)
    sid = shop["id"]
    ratings = await barber_ratings(sid)
    barbers = []
    for b in await db.barbers.find({"shop_id": sid, "active": True}, {"_id": 0}).to_list(100):
        r = ratings.get(b["id"], (0, 0))
        barbers.append(BarberPublic(**{**b, "rating": r[0], "rating_count": r[1]}))
    return ShopPublic(
        shop=Shop(**shop),
        services=[Service(**s) for s in await db.services.find({"shop_id": sid, "active": True}, {"_id": 0}).sort("price", 1).to_list(200)],
        barbers=barbers,
        plans=[Plan(**p) for p in await db.plans.find({"shop_id": sid, "active": True}, {"_id": 0}).sort("price", 1).to_list(50)],
        gallery=[GalleryItem(**g) for g in await db.gallery.find({"shop_id": sid}, {"_id": 0}).sort("created_at", -1).to_list(60)],
        reviews=[Review(**r) for r in await db.reviews.find({"shop_id": sid}, {"_id": 0}).sort("created_at", -1).to_list(10)],
    )


@router.get("/public/shops/{slug}/slots", response_model=list[str])
async def slots(slug: str, barber_id: str, date: str, duration: int = Query(gt=0), exclude_id: str | None = None):
    shop = await get_shop_by_slug(slug)
    barber = await db.barbers.find_one({"id": barber_id, "shop_id": shop["id"], "active": True}, {"_id": 0})
    if not barber:
        raise HTTPException(404, "Barbeiro não encontrado")
    return await compute_slots(shop["id"], barber, date, duration, exclude_id)


@router.get("/files/{file_id}")
async def get_file(file_id: str):
    f = await db.files.find_one({"id": file_id})
    if not f:
        raise HTTPException(404, "Arquivo não encontrado")
    return Response(content=bytes(f["data"]), media_type=f["content_type"], headers={"Cache-Control": "public, max-age=31536000"})
