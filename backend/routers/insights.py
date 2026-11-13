"""Relationship panel: tomorrow's reminders, subscriptions due this week, loyal-client ranking (scoped by shop)."""
from datetime import timedelta

from fastapi import APIRouter, Depends

from lib.auth import admin_user
from lib.core import now_br, refresh_subscription
from lib.db import db
from models.schemas import Appointment, ClientRank, InsightsOut, Subscription

router = APIRouter(prefix="/admin/insights")


@router.get("", response_model=InsightsOut)
async def insights(user: dict = Depends(admin_user)):
    sid = user["shop_id"]
    today = now_br().date()
    tomorrow = (today + timedelta(days=1)).isoformat()
    week_end = (today + timedelta(days=7)).isoformat()

    reminders = await db.appointments.find({"shop_id": sid, "date": tomorrow, "status": "agendado"}, {"_id": 0}).sort("start", 1).to_list(500)

    expiring: list[Subscription] = []
    for s in await db.subscriptions.find({"shop_id": sid, "status": "ativa"}, {"_id": 0}).to_list(2000):
        s = await refresh_subscription(s)
        if s["status"] == "ativa" and today.isoformat() <= s.get("cycle_end", "") <= week_end:
            expiring.append(Subscription(**s))
    expiring.sort(key=lambda x: x.cycle_end)

    pipeline = [
        {"$match": {"shop_id": sid, "status": "concluido"}},
        {"$group": {"_id": {"$ifNull": ["$client_id", "$client_name"]}, "name": {"$last": "$client_name"},
                    "phone": {"$last": "$client_phone"}, "visits": {"$sum": 1}, "spent": {"$sum": "$total"},
                    "last_visit": {"$max": "$date"}, "registered": {"$max": {"$cond": [{"$ifNull": ["$client_id", False]}, True, False]}}}},
        {"$sort": {"visits": -1, "spent": -1}},
        {"$limit": 20},
    ]
    ranking = [ClientRank(key=str(r["_id"]), name=r["name"], phone=r.get("phone") or "", visits=r["visits"],
                          spent=round(r["spent"], 2), last_visit=r["last_visit"], registered=bool(r["registered"]))
               async for r in db.appointments.aggregate(pipeline)]

    return InsightsOut(today=today.isoformat(), tomorrow=tomorrow, reminders=[Appointment(**a) for a in reminders],
                       expiring=expiring, ranking=ranking)
