from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field
from typing import Literal

from app.models import ArticleType, OrderStatus


# ── Category ──────────────────────────────────────────────────────────────────

class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    slug: str = Field(..., min_length=1, max_length=128, pattern=r"^[a-z0-9-]+$")
    image_url: str | None = Field(default=None, max_length=512)
    sort_order: int = Field(default=0)

class CategoryCreate(CategoryBase): pass
class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    slug: str | None = Field(default=None, min_length=1, max_length=128, pattern=r"^[a-z0-9-]+$")
    image_url: str | None = Field(default=None, max_length=512)
    sort_order: int | None = Field(default=None)

class CategoryRead(CategoryBase):
    model_config = ConfigDict(from_attributes=True)
    id: int

class CategoryReorderItem(BaseModel):
    id: int = Field(..., description="ID категории")
    sort_order: int = Field(..., description="Порядковый номер")

class CategoryReorderRequest(BaseModel):
    items: list[CategoryReorderItem]


# ── Product ───────────────────────────────────────────────────────────────────

class ProductBase(BaseModel):
    name:        str         = Field(..., min_length=1, max_length=256)
    slug:        str         = Field(..., min_length=1, max_length=256, pattern=r"^[a-z0-9-]+$")
    price:       Decimal     = Field(..., gt=0, decimal_places=2)
    description: str | None  = Field(default=None)
    image_url:   str | None  = Field(default=None)
    in_stock:    bool        = Field(default=True)
    sort_order:  int         = Field(default=0)
    weight_grams: int | None = Field(default=None, ge=1)
    length_cm:    int | None = Field(default=None, ge=1)
    width_cm:     int | None = Field(default=None, ge=1)
    height_cm:    int | None = Field(default=None, ge=1)
    category_id: int | None  = Field(default=None)

class ProductCreate(ProductBase):
    images: list[str] = Field(default_factory=list)
class ProductUpdate(BaseModel):
    name:        str | None     = Field(default=None, min_length=1, max_length=256)
    slug:        str | None     = Field(default=None, min_length=1, max_length=256, pattern=r"^[a-z0-9-]+$")
    price:       Decimal | None = Field(default=None, gt=0, decimal_places=2)
    description: str | None     = Field(default=None)
    image_url:   str | None     = Field(default=None)
    in_stock:    bool | None    = Field(default=None)
    sort_order:  int | None     = Field(default=None)
    weight_grams: int | None    = None
    length_cm:    int | None    = None
    width_cm:     int | None    = None
    height_cm:    int | None    = None
    category_id: int | None     = Field(default=None)
    images: list[str] | None = None

class ProductImageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:       int
    url:      str
    is_cover: bool
    position: int

class ProductRead(ProductBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    category: CategoryRead | None = None
    reviews: list["ReviewRead"] = Field(default_factory=list)
    images: list[ProductImageRead] = Field(default_factory=list)

class ProductListRead(ProductBase):
    model_config = ConfigDict(from_attributes=True)
    id: int

class ProductReorderItem(BaseModel):
    id: int = Field(..., description="ID товара")
    sort_order: int = Field(..., description="Порядковый номер")

class ProductReorderRequest(BaseModel):
    items: list[ProductReorderItem]


# ── Review ────────────────────────────────────────────────────────────────────

class ReviewCreate(BaseModel):
    author_name:  str = Field(..., min_length=1, max_length=128)
    author_email: str = Field(..., min_length=3, max_length=256)
    rating:       int = Field(..., ge=1, le=5)
    text:         str = Field(..., min_length=1, max_length=5000)

class ReviewRead(ReviewCreate):
    model_config = ConfigDict(from_attributes=True)
    id:         int
    product_id: int
    created_at: datetime


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)

class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"


# ── Article ───────────────────────────────────────────────────────────────────

# ── TrainingSection ───────────────────────────────────────────────────────────

class TrainingSectionBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=128)

class TrainingSectionCreate(TrainingSectionBase):
    pass

class TrainingSectionRead(TrainingSectionBase):
    model_config = ConfigDict(from_attributes=True)
    id:         int
    slug:       str
    created_at: datetime


# ── Article ───────────────────────────────────────────────────────────────────

class ArticleBase(BaseModel):
    title:      str         = Field(..., min_length=1, max_length=256)
    content:    str         = Field(..., min_length=1)
    type:       ArticleType = Field(...)
    image_url:  str | None  = Field(default=None, max_length=512)
    section_id: int | None  = Field(default=None)

class ArticleCreate(ArticleBase):
    pass

class ArticleUpdate(BaseModel):
    title:      str | None         = Field(default=None, min_length=1, max_length=256)
    content:    str | None         = Field(default=None, min_length=1)
    type:       ArticleType | None = Field(default=None)
    image_url:  str | None         = Field(default=None, max_length=512)
    section_id: int | None         = Field(default=None)

class ArticleRead(ArticleBase):
    model_config = ConfigDict(from_attributes=True)
    id:         int
    created_at: datetime
    section:    TrainingSectionRead | None = None


# ── Cart ──────────────────────────────────────────────────────────────────────

class CartItemAdd(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=128)
    product_id: int = Field(..., gt=0)
    quantity:   int = Field(default=1, ge=1, le=100)

class CartItemRemove(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=128)
    product_id: int = Field(..., gt=0)

class CartItemRead(BaseModel):
    product_id: int
    quantity:   int
    name:       str
    price:      Decimal
    image_url:  str | None
    subtotal:   Decimal

class CartRead(BaseModel):
    session_id: str
    items:      list[CartItemRead]
    total:      Decimal


# ── Order ─────────────────────────────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    session_id:       str      = Field(..., min_length=1, max_length=128)
    customer_name:    str      = Field(..., min_length=2, max_length=128)
    customer_phone:   str      = Field(..., pattern=r"^\+?[0-9\s\-\(\)]{7,20}$")
    customer_email:   str | None = Field(default=None)
    delivery_address: str      = Field(..., min_length=5, max_length=512)
    pvz_code:         str | None = Field(default=None, max_length=64)
    delivery_cost:    Decimal  = Field(default=Decimal("0.00"), ge=0)
    payment_method:   Literal["sbp", "card"] = "card"
    comment:          str | None = Field(default=None, max_length=1000)

class CheckoutResponse(BaseModel):
    status:   str
    message:  str
    order_id: str
    payment_url: str | None = None

class OrderItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:            int
    product_id:    int | None
    product_name:  str
    product_price: Decimal
    quantity:      int

class OrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:           int
    order_id:     str
    guest_name:   str
    guest_phone:  str
    guest_email:  str | None
    delivery_address: str
    delivery_cost:    Decimal = Decimal("0.00")
    pvz_code:         str | None = None
    payment_method: str
    comment:      str | None
    status:       OrderStatus
    total_amount: Decimal
    payment_id:   str | None
    cdek_uuid:    str | None = None
    cdek_number:  str | None = None
    cdek_status:  str | None = None
    cdek_error:   str | None = None
    created_at:   datetime
    items:        list[OrderItemRead] = []

class OrderStatusUpdate(BaseModel):
    status: OrderStatus


# ── Delivery (CDEK) ───────────────────────────────────────────────────────────

class DeliveryCalculateRequest(BaseModel):
    city_code: int = Field(..., description="Код города СДЭК")
    weight_grams: int = Field(default=1000, ge=10, le=50000)

class DeliveryCalculateResponse(BaseModel):
    delivery_sum: Decimal
    period_min: int | None = None
    period_max: int | None = None
    tariff_code: int | None = None
    calendar_min: int | None = None
    calendar_max: int | None = None

class CdekCityRead(BaseModel):
    code: int
    city: str
    region: str | None = None
    country: str | None = None

class CdekPvzRead(BaseModel):
    code: str
    name: str
    address: str
    address_full: str | None = None
    work_time: str | None = None
    phone: str | None = None
    note: str | None = None
    type: str | None = None


# ── Gallery ───────────────────────────────────────────────────────────────────

class GalleryBase(BaseModel):
    image_url:   str | None = Field(default=None, max_length=512)
    video_url:   str | None = Field(default=None, max_length=512)
    description: str | None = Field(default=None)

class GalleryCreate(GalleryBase):
    pass

class GalleryUpdate(BaseModel):
    image_url:   str | None = Field(default=None, max_length=512)
    video_url:   str | None = Field(default=None, max_length=512)
    description: str | None = Field(default=None)

class GalleryRead(GalleryBase):
    model_config = ConfigDict(from_attributes=True)
    id:         int
    created_at: datetime
