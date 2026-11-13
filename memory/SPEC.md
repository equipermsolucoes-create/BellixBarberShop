# BellixBarberShop — SPEC
Multi-tenant SaaS (pt-BR, dark/gold PWA) for barbershop booking & management.

## Roles
- superadmin: /super — create/suspend/activate shops, SaaS plans, platform metrics.
- admin (shop): /painel — agenda, Clientes (lembretes de amanhã via WhatsApp, mensalidades vencendo em 7 dias, ranking de clientes fiéis — GET /api/admin/insights), finance (xlsx/pdf export), services, products/stock, team (barbers + commission), plans/subscriptions, gallery (file upload), "Logo e dados" (upload/troca/remoção da logo, nome, slug, whatsapp, maps, cancel policy, referral reward, loyalty target).
- barber: /painel — own agenda + gallery only.
- client: /b/:slug (public page, chatbot rule-based, WhatsApp links), /b/:slug/agendar (booking), /b/:slug/cliente (history, cancel/reschedule, review, plans, referral code, loyalty).
Auth: httpOnly cookie session, /api/auth/{register,login,logout,me}. All admin/finance data scoped by user's shop_id; suspended shops are hidden publicly.

## Data (Mongo collections)
users, shops, barbers, services, products, plans, subscriptions (single|recurring, pending/active/cancelled; admin activates, cancels, converts billing), appointments (payment method recorded only — Pix/cartão/dinheiro paid in person; plan credits consumed on completion), blocks, gallery, files (uploads served at /api/files/{id}), reviews on appointments, saas_plans.

## Key flows
Client books service+barber+slot → admin/barber sees in agenda → completes with payment method & products → finance/commission. Client subscribes plan (single or recurring) → admin activates.
No real payment gateway; no LLM.
PWA: manifest + /sw.js + install prompt on /b/:slug (Android native prompt, iOS hint; dismissal stored in localStorage).
