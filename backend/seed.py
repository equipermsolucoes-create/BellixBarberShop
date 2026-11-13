"""Idempotent seed: super admin, SaaS plans, Barbearia Ferreira (Nandão admin+barber), services, products, plans."""
import asyncio

from lib.auth import hash_pw
from lib.core import new_id, now_iso
from lib.db import db, ensure_indexes

SUPER_EMAIL, SUPER_PW = "assembleiasaaemg@gmail.com", "Saaemg@2026"
NANDAO_EMAIL, NANDAO_PW = "nandao@barbeariaferreira.com", "nandao123@"


async def main():
    await ensure_indexes()
    if not await db.users.find_one({"email": SUPER_EMAIL}):
        await db.users.insert_one({"id": new_id(), "name": "Super Admin", "email": SUPER_EMAIL, "phone": "", "password_hash": hash_pw(SUPER_PW),
                                   "role": "superadmin", "shop_id": None, "barber_id": None, "created_at": now_iso()})
    if not await db.saas_plans.count_documents({}):
        await db.saas_plans.insert_many([{"id": new_id(), "name": n, "price": p} for n, p in [("Básico", 49.9), ("Pro", 99.9), ("Premium", 149.9)]])

    shop = await db.shops.find_one({"slug": "barbearia-ferreira"})
    if shop:
        print("Barbearia Ferreira já existe")
        return
    sid, uid, bid = new_id(), new_id(), new_id()
    await db.shops.insert_one({
        "id": sid, "name": "Barbearia Ferreira", "slug": "barbearia-ferreira", "logo_url": None,
        "address": "Rua Principal, 100 - Centro, Belo Horizonte - MG", "maps_url": "https://maps.google.com/?q=Barbearia+Ferreira+Belo+Horizonte",
        "whatsapp": "5531980214974", "hours_text": "Seg a Sex 09h–19h • Sáb 08h–17h", "cancel_min_hours": 2, "active": True,
        "referral_reward_type": "valor", "referral_reward_value": 15, "loyalty_target": 10, "saas_plan": "Pro", "created_at": now_iso()})
    await db.users.insert_one({"id": uid, "name": "Nandão", "email": NANDAO_EMAIL, "phone": "5531980214974", "password_hash": hash_pw(NANDAO_PW),
                               "role": "admin", "shop_id": sid, "barber_id": bid, "created_at": now_iso()})
    await db.barbers.insert_one({"id": bid, "shop_id": sid, "user_id": uid, "name": "Nandão", "photo_url": None,
                                 "specialties": ["Degradê", "Barboterapia", "Platinado"], "work_days": [0, 1, 2, 3, 4, 5],
                                 "start": "09:00", "end": "19:00", "lunch_start": "12:00", "lunch_end": "13:00", "commission": 100, "active": True})
    services = [("Corte Masculino", 30, 45), ("Barba Completa / Barboterapia", 30, 40), ("Sobrancelha na Navalha / Pinça", 15, 20),
                ("Combo Corte + Barba", 50, 75), ("Combo Completo: Corte + Barba + Sobrancelha", 60, 90),
                ("Luzes / Reflexo Masculino", 90, 120), ("Platinado / Nevou Global", 120, 180), ("Hidratação / Selagem Capilar", 40, 60)]
    await db.services.insert_many([{"id": new_id(), "shop_id": sid, "name": n, "duration": d, "price": p, "active": True} for n, d, p in services])
    products = [("Pomada Modeladora", 45, 20), ("Óleo para Barba", 38, 15), ("Cerveja", 10, 48), ("Refrigerante", 6, 36)]
    await db.products.insert_many([{"id": new_id(), "shop_id": sid, "name": n, "price": p, "stock": s, "active": True} for n, p, s in products])
    plans = [
        ("Plano Corte Mensal", "4 cortes no mês com valor fixo.", 140, 4, [], False),
        ("Plano Combo VIP", "4 cortes + 4 barbas + sobrancelha no mês.", 260, 9, [], False),
        ("Plano Pai & Filho", "Cortes mensais para o titular e um dependente (4 + 4).", 240, 8, [], True),
        ("Plano Dias Úteis", "Desconto especial: 4 serviços válidos de segunda a quarta-feira.", 110, 4, [0, 1, 2], False),
    ]
    await db.plans.insert_many([{"id": new_id(), "shop_id": sid, "name": n, "description": d, "price": p, "credits": c, "weekdays": w,
                                 "allows_dependent": dep, "active": True} for n, d, p, c, w, dep in plans])
    print("Seed concluído")


if __name__ == "__main__":
    asyncio.run(main())
