"""Pydantic models — each mirrored by a TS interface in frontend/src/lib/types.ts."""
from typing import Literal, Optional
from pydantic import BaseModel, Field

PaymentMethod = Literal["pix", "credito", "debito", "plano"]


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    phone: str = ""
    role: Literal["superadmin", "admin", "barber", "client"]
    shop_id: Optional[str] = None
    barber_id: Optional[str] = None
    shop_slug: Optional[str] = None


class RegisterIn(BaseModel):
    name: str = Field(min_length=2)
    phone: str = Field(min_length=8)
    email: str = Field(min_length=5)
    password: str = Field(min_length=6)
    shop_slug: Optional[str] = None
    ref_code: Optional[str] = None


class LoginIn(BaseModel):
    email: str
    password: str


class Shop(BaseModel):
    id: str
    name: str
    slug: str
    logo_url: Optional[str] = None
    address: str = ""
    maps_url: str = ""
    whatsapp: str = ""
    hours_text: str = ""
    cancel_min_hours: int = 2
    active: bool = True
    referral_reward_type: Literal["valor", "percent"] = "valor"
    referral_reward_value: float = 15
    loyalty_target: int = 10
    saas_plan: str = "Básico"
    created_at: str = ""


class ShopUpdate(BaseModel):
    name: str
    slug: str
    logo_url: Optional[str] = None
    address: str = ""
    maps_url: str = ""
    whatsapp: str = ""
    hours_text: str = ""
    cancel_min_hours: int = 2
    referral_reward_type: Literal["valor", "percent"] = "valor"
    referral_reward_value: float = 15
    loyalty_target: int = 10


class Service(BaseModel):
    id: str
    shop_id: str
    name: str
    duration: int
    price: float
    active: bool = True


class ServiceIn(BaseModel):
    name: str = Field(min_length=2)
    duration: int = Field(gt=0)
    price: float = Field(ge=0)
    active: bool = True


class Product(BaseModel):
    id: str
    shop_id: str
    name: str
    price: float
    stock: int
    active: bool = True


class ProductIn(BaseModel):
    name: str = Field(min_length=2)
    price: float = Field(ge=0)
    stock: int = 0
    active: bool = True


class Barber(BaseModel):
    id: str
    shop_id: str
    name: str
    photo_url: Optional[str] = None
    specialties: list[str] = []
    work_days: list[int] = []
    start: str = "09:00"
    end: str = "19:00"
    lunch_start: str = ""
    lunch_end: str = ""
    commission: float = 50
    active: bool = True
    user_id: Optional[str] = None
    rating: float = 0
    rating_count: int = 0


class BarberIn(BaseModel):
    name: str = Field(min_length=2)
    photo_url: Optional[str] = None
    specialties: list[str] = []
    work_days: list[int] = []
    start: str = "09:00"
    end: str = "19:00"
    lunch_start: str = ""
    lunch_end: str = ""
    commission: float = 50
    active: bool = True
    email: Optional[str] = None
    password: Optional[str] = None


class Block(BaseModel):
    id: str
    shop_id: str
    barber_id: str
    date: str
    start: str = ""
    end: str = ""
    reason: str = ""


class BlockIn(BaseModel):
    barber_id: str
    date: str
    start: str = ""
    end: str = ""
    reason: str = ""


class ApptProduct(BaseModel):
    product_id: str
    name: str
    qty: int
    price: float


class Appointment(BaseModel):
    id: str
    shop_id: str
    client_id: Optional[str] = None
    client_name: str
    client_phone: str = ""
    barber_id: str
    barber_name: str
    service_ids: list[str]
    service_names: list[str]
    date: str
    start: str
    end: str
    duration: int
    price: float
    discount: float = 0
    products: list[ApptProduct] = []
    products_total: float = 0
    total: float
    payment_method: PaymentMethod
    status: Literal["agendado", "concluido", "cancelado"]
    walk_in: bool = False
    subscription_id: Optional[str] = None
    coupon_id: Optional[str] = None
    rated: bool = False
    created_at: str = ""


class BookingIn(BaseModel):
    service_ids: list[str] = Field(min_length=1)
    barber_id: str
    date: str
    start: str
    payment_method: PaymentMethod
    subscription_id: Optional[str] = None
    coupon_id: Optional[str] = None


class WalkInIn(BaseModel):
    client_name: str = Field(min_length=2)
    client_phone: str = ""
    service_ids: list[str] = Field(min_length=1)
    barber_id: str
    date: str
    start: str
    payment_method: PaymentMethod = "pix"


class RescheduleIn(BaseModel):
    date: str
    start: str


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = ""


class Review(BaseModel):
    id: str
    shop_id: str
    appointment_id: str
    barber_id: str
    client_name: str
    rating: int
    comment: str = ""
    created_at: str = ""


class CompleteItem(BaseModel):
    product_id: str
    qty: int = Field(gt=0)


class CompleteIn(BaseModel):
    payment_method: PaymentMethod
    products: list[CompleteItem] = []


class Plan(BaseModel):
    id: str
    shop_id: str
    name: str
    description: str = ""
    price: float
    credits: int
    weekdays: list[int] = []
    allows_dependent: bool = False
    active: bool = True


class PlanIn(BaseModel):
    name: str = Field(min_length=2)
    description: str = ""
    price: float = Field(ge=0)
    credits: int = Field(gt=0)
    weekdays: list[int] = []
    allows_dependent: bool = False
    active: bool = True


class Subscription(BaseModel):
    id: str
    shop_id: str
    client_id: str
    client_name: str
    client_phone: str = ""
    plan_id: str
    plan_name: str
    price: float
    credits_total: int
    credits_left: int
    weekdays: list[int] = []
    billing: Literal["unica", "recorrente"]
    status: Literal["pendente", "ativa", "cancelada", "expirada"]
    cycle_start: str = ""
    cycle_end: str = ""
    dependent_name: str = ""
    request: Optional[str] = None
    created_at: str = ""


class SubscribeIn(BaseModel):
    plan_id: str
    billing: Literal["unica", "recorrente"]
    dependent_name: str = ""


class SubRequestIn(BaseModel):
    request: Literal["cancelar", "recorrente"]


class BillingIn(BaseModel):
    billing: Literal["unica", "recorrente"]


class AdjustIn(BaseModel):
    credits_left: int = Field(ge=0)


class Coupon(BaseModel):
    id: str
    shop_id: str
    client_id: str
    kind: Literal["valor", "percent"]
    value: float
    used: bool = False
    origin: str = ""
    created_at: str = ""


class Member(BaseModel):
    id: str
    shop_id: str
    client_id: str
    referral_code: str
    referred_by: Optional[str] = None
    referral_rewarded: bool = False
    loyalty_stamps: int = 0


class GalleryItem(BaseModel):
    id: str
    shop_id: str
    url: str
    caption: str = ""
    created_at: str = ""


class GalleryIn(BaseModel):
    url: str
    caption: str = ""


class BarberPublic(BaseModel):
    id: str
    name: str
    photo_url: Optional[str] = None
    specialties: list[str] = []
    work_days: list[int] = []
    start: str
    end: str
    rating: float = 0
    rating_count: int = 0


class ShopPublic(BaseModel):
    shop: Shop
    services: list[Service]
    barbers: list[BarberPublic]
    plans: list[Plan]
    gallery: list[GalleryItem]
    reviews: list[Review]


class ClientDashboard(BaseModel):
    member: Member
    referrals_count: int
    referrals_rewarded: int
    loyalty_target: int
    subscriptions: list[Subscription]
    coupons: list[Coupon]
    upcoming: list[Appointment]
    history: list[Appointment]


class AgendaOut(BaseModel):
    date: str
    barbers: list[Barber]
    appointments: list[Appointment]
    blocks: list[Block]


class MethodTotals(BaseModel):
    pix: float = 0
    credito: float = 0
    debito: float = 0
    plano_atendimentos: int = 0
    assinaturas: float = 0
    produtos: float = 0


class BarberCommission(BaseModel):
    barber_id: str
    barber_name: str
    atendimentos: int
    base: float
    commission_pct: float
    commission: float


class ServiceCount(BaseModel):
    name: str
    count: int


class DayPoint(BaseModel):
    date: str
    total: float
    count: int


class FinanceOut(BaseModel):
    start: str
    end: str
    totals: MethodTotals
    gross: float
    atendimentos: int
    ticket_medio: float
    commissions: list[BarberCommission]
    services: list[ServiceCount]
    daily: list[DayPoint]
    appointments: list[Appointment]


class SaasPlan(BaseModel):
    id: str
    name: str
    price: float


class SaasPlanIn(BaseModel):
    name: str = Field(min_length=2)
    price: float = Field(ge=0)


class ShopCreateIn(BaseModel):
    name: str = Field(min_length=2)
    slug: str = Field(min_length=2)
    whatsapp: str = ""
    admin_name: str = Field(min_length=2)
    admin_email: str = Field(min_length=5)
    admin_password: str = Field(min_length=6)
    saas_plan: str = "Básico"


class ShopStatusIn(BaseModel):
    active: bool
    saas_plan: Optional[str] = None


class SuperShop(BaseModel):
    shop: Shop
    admin_email: str = ""
    appointments: int = 0
    barbers: int = 0


class SuperMetrics(BaseModel):
    total_shops: int
    active_shops: int
    suspended_shops: int
    total_appointments: int
    total_clients: int
    mrr: float


class FileOut(BaseModel):
    id: str
    url: str
