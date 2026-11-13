// Hand-written mirrors of backend/models/schemas.py — keep in sync.
export type PaymentMethod = "pix" | "credito" | "debito" | "plano";
export type Role = "superadmin" | "admin" | "barber" | "client";

export interface UserOut {
  id: string; name: string; email: string; phone: string; role: Role;
  shop_id: string | null; barber_id: string | null; shop_slug: string | null;
}

export interface Shop {
  id: string; name: string; slug: string; logo_url: string | null; address: string; maps_url: string;
  whatsapp: string; hours_text: string; cancel_min_hours: number; active: boolean;
  referral_reward_type: "valor" | "percent"; referral_reward_value: number; loyalty_target: number;
  saas_plan: string; created_at: string;
}
export type ShopUpdate = Omit<Shop, "id" | "active" | "saas_plan" | "created_at">;

export interface Service { id: string; shop_id: string; name: string; duration: number; price: number; active: boolean }
export type ServiceIn = Omit<Service, "id" | "shop_id">;
export interface Product { id: string; shop_id: string; name: string; price: number; stock: number; active: boolean }
export type ProductIn = Omit<Product, "id" | "shop_id">;

export interface Barber {
  id: string; shop_id: string; name: string; photo_url: string | null; specialties: string[]; work_days: number[];
  start: string; end: string; lunch_start: string; lunch_end: string; commission: number; active: boolean;
  user_id: string | null; rating: number; rating_count: number;
}
export interface BarberIn {
  name: string; photo_url: string | null; specialties: string[]; work_days: number[]; start: string; end: string;
  lunch_start: string; lunch_end: string; commission: number; active: boolean; email?: string | null; password?: string | null;
}
export interface BarberPublic {
  id: string; name: string; photo_url: string | null; specialties: string[]; work_days: number[];
  start: string; end: string; rating: number; rating_count: number;
}

export interface Block { id: string; shop_id: string; barber_id: string; date: string; start: string; end: string; reason: string }
export interface ApptProduct { product_id: string; name: string; qty: number; price: number }
export interface Appointment {
  id: string; shop_id: string; client_id: string | null; client_name: string; client_phone: string;
  barber_id: string; barber_name: string; service_ids: string[]; service_names: string[]; date: string;
  start: string; end: string; duration: number; price: number; discount: number; products: ApptProduct[];
  products_total: number; total: number; payment_method: PaymentMethod; status: "agendado" | "concluido" | "cancelado";
  walk_in: boolean; subscription_id: string | null; coupon_id: string | null; rated: boolean; created_at: string;
}
export interface Review {
  id: string; shop_id: string; appointment_id: string; barber_id: string; client_name: string;
  rating: number; comment: string; created_at: string;
}
export interface Plan {
  id: string; shop_id: string; name: string; description: string; price: number; credits: number;
  weekdays: number[]; allows_dependent: boolean; active: boolean;
}
export type PlanIn = Omit<Plan, "id" | "shop_id">;
export interface Subscription {
  id: string; shop_id: string; client_id: string; client_name: string; client_phone: string; plan_id: string;
  plan_name: string; price: number; credits_total: number; credits_left: number; weekdays: number[];
  billing: "unica" | "recorrente"; status: "pendente" | "ativa" | "cancelada" | "expirada";
  cycle_start: string; cycle_end: string; dependent_name: string; request: string | null; created_at: string;
}
export interface Coupon {
  id: string; shop_id: string; client_id: string; kind: "valor" | "percent"; value: number;
  used: boolean; origin: string; created_at: string;
}
export interface Member {
  id: string; shop_id: string; client_id: string; referral_code: string; referred_by: string | null;
  referral_rewarded: boolean; loyalty_stamps: number;
}
export interface GalleryItem { id: string; shop_id: string; url: string; caption: string; created_at: string }

export interface ShopPublic {
  shop: Shop; services: Service[]; barbers: BarberPublic[]; plans: Plan[]; gallery: GalleryItem[]; reviews: Review[];
}
export interface ClientDashboard {
  member: Member; referrals_count: number; referrals_rewarded: number; loyalty_target: number;
  subscriptions: Subscription[]; coupons: Coupon[]; upcoming: Appointment[]; history: Appointment[];
}
export interface AgendaOut { date: string; barbers: Barber[]; appointments: Appointment[]; blocks: Block[] }

export interface MethodTotals {
  pix: number; credito: number; debito: number; plano_atendimentos: number; assinaturas: number; produtos: number;
}
export interface BarberCommission {
  barber_id: string; barber_name: string; atendimentos: number; base: number; commission_pct: number; commission: number;
}
export interface FinanceOut {
  start: string; end: string; totals: MethodTotals; gross: number; atendimentos: number; ticket_medio: number;
  commissions: BarberCommission[]; services: { name: string; count: number }[];
  daily: { date: string; total: number; count: number }[]; appointments: Appointment[];
}
export interface SaasPlan { id: string; name: string; price: number }
export interface SuperShop { shop: Shop; admin_email: string; appointments: number; barbers: number }
export interface SuperMetrics {
  total_shops: number; active_shops: number; suspended_shops: number; total_appointments: number;
  total_clients: number; mrr: number;
}
export interface FileOut { id: string; url: string }

export interface ClientRank {
  key: string;
  name: string;
  phone: string;
  visits: number;
  spent: number;
  last_visit: string;
  registered: boolean;
}

export interface InsightsOut {
  today: string;
  tomorrow: string;
  reminders: Appointment[];
  expiring: Subscription[];
  ranking: ClientRank[];
}
