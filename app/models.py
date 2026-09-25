from __future__ import annotations

import enum
from datetime import datetime
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# ── Enums ─────────────────────────────────────────────────────────────────────

class ArticleType(str, enum.Enum):
    news     = "news"
    training = "training"


class OrderStatus(str, enum.Enum):
    pending       = "pending"
    paid          = "paid"
    in_production = "in_production"
    shipped       = "shipped"
    cancelled     = "cancelled"


# ── Category ──────────────────────────────────────────────────────────────────

class Category(Base):
    __tablename__ = "categories"

    id:   Mapped[int] = mapped_column(sa.Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(sa.String(128), nullable=False)
    slug: Mapped[str] = mapped_column(sa.String(128), nullable=False, unique=True, index=True)
    image_url: Mapped[str | None] = mapped_column(sa.String(512), nullable=True)

    products: Mapped[list["Product"]] = relationship(
        "Product", back_populates="category", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Category id={self.id} slug={self.slug!r}>"


# ── Product ───────────────────────────────────────────────────────────────────

class Product(Base):
    __tablename__ = "products"

    id:          Mapped[int]          = mapped_column(sa.Integer, primary_key=True, index=True)
    name:        Mapped[str]          = mapped_column(sa.String(256), nullable=False)
    slug:        Mapped[str]          = mapped_column(sa.String(256), nullable=False, unique=True, index=True)
    price:       Mapped[Decimal]      = mapped_column(sa.Numeric(10, 2), nullable=False)
    description: Mapped[str | None]   = mapped_column(sa.Text, nullable=True)
    image_url:   Mapped[str | None]   = mapped_column(sa.String(512), nullable=True)
    in_stock:    Mapped[bool]         = mapped_column(sa.Boolean, nullable=False, default=True, server_default=sa.true())
    sort_order:  Mapped[int]          = mapped_column(sa.Integer, nullable=False, default=0, server_default="0", index=True)
    weight_grams: Mapped[int | None]  = mapped_column(sa.Integer, nullable=True)
    length_cm:    Mapped[int | None]  = mapped_column(sa.Integer, nullable=True)
    width_cm:     Mapped[int | None]  = mapped_column(sa.Integer, nullable=True)
    height_cm:    Mapped[int | None]  = mapped_column(sa.Integer, nullable=True)
    category_id: Mapped[int | None]   = mapped_column(
        sa.Integer, sa.ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    category: Mapped["Category | None"] = relationship(
        "Category", back_populates="products", lazy="selectin"
    )
    reviews: Mapped[list["Review"]] = relationship(
        "Review", back_populates="product", cascade="all, delete-orphan", lazy="selectin"
    )
    images: Mapped[list["ProductImage"]] = relationship(
        "ProductImage", back_populates="product", cascade="all, delete-orphan",
        order_by="ProductImage.position", lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Product id={self.id} slug={self.slug!r} price={self.price}>"


# ── Product images ───────────────────────────────────────────────────────────

class ProductImage(Base):
    __tablename__ = "product_images"

    id:         Mapped[int]  = mapped_column(sa.Integer, primary_key=True, index=True)
    product_id: Mapped[int]  = mapped_column(
        sa.Integer, sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    url:        Mapped[str]  = mapped_column(sa.String(512), nullable=False)
    is_cover:   Mapped[bool] = mapped_column(sa.Boolean, nullable=False, default=False, server_default=sa.false())
    position:   Mapped[int]  = mapped_column(sa.Integer, nullable=False, default=0, server_default="0")

    product: Mapped["Product"] = relationship("Product", back_populates="images")


# ── Review ────────────────────────────────────────────────────────────────────

class Review(Base):
    __tablename__ = "reviews"

    id:          Mapped[int]      = mapped_column(sa.Integer, primary_key=True, index=True)
    product_id:  Mapped[int]      = mapped_column(
        sa.Integer, sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_name: Mapped[str]      = mapped_column(sa.String(128), nullable=False)
    author_email: Mapped[str]     = mapped_column(sa.String(256), nullable=False)
    rating:      Mapped[int]      = mapped_column(sa.SmallInteger, nullable=False)
    text:        Mapped[str]      = mapped_column(sa.Text, nullable=False)
    created_at:  Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
    )

    product: Mapped["Product"] = relationship("Product", back_populates="reviews")

    __table_args__ = (
        sa.CheckConstraint("rating BETWEEN 1 AND 5", name="ck_reviews_rating_range"),
    )


# ── AdminUser ─────────────────────────────────────────────────────────────────

class AdminUser(Base):
    __tablename__ = "admin_users"

    id:              Mapped[int] = mapped_column(sa.Integer, primary_key=True, index=True)
    username:        Mapped[str] = mapped_column(sa.String(64), nullable=False, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(sa.String(256), nullable=False)

    def __repr__(self) -> str:
        return f"<AdminUser id={self.id} username={self.username!r}>"


# ── TrainingSection + Article ────────────────────────────────────────────────

class TrainingSection(Base):
    __tablename__ = "training_sections"

    id:         Mapped[int]      = mapped_column(sa.Integer, primary_key=True, index=True)
    name:       Mapped[str]      = mapped_column(sa.String(128), nullable=False, unique=True)
    slug:       Mapped[str]      = mapped_column(sa.String(128), nullable=False, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )

    articles: Mapped[list["Article"]] = relationship(
        "Article", back_populates="section", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<TrainingSection id={self.id} name={self.name!r}>"


class Article(Base):
    __tablename__ = "articles"

    id:         Mapped[int]         = mapped_column(sa.Integer, primary_key=True, index=True)
    title:      Mapped[str]         = mapped_column(sa.String(256), nullable=False)
    content:    Mapped[str]         = mapped_column(sa.Text, nullable=False)
    type:       Mapped[ArticleType] = mapped_column(
        sa.Enum(ArticleType, name="article_type"), nullable=False, index=True
    )
    image_url:  Mapped[str | None]  = mapped_column(sa.String(512), nullable=True)
    section_id: Mapped[int | None]  = mapped_column(
        sa.Integer, sa.ForeignKey("training_sections.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime]    = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )

    section: Mapped["TrainingSection | None"] = relationship(
        "TrainingSection", back_populates="articles"
    )

    def __repr__(self) -> str:
        return f"<Article id={self.id} type={self.type} title={self.title!r}>"


# ── Order + OrderItem ─────────────────────────────────────────────────────────

class Order(Base):
    __tablename__ = "orders"

    id:           Mapped[int]         = mapped_column(sa.Integer, primary_key=True, index=True)
    order_id:     Mapped[str]         = mapped_column(sa.String(32), nullable=False, unique=True, index=True)
    guest_name:   Mapped[str]         = mapped_column(sa.String(128), nullable=False)
    guest_phone:  Mapped[str]         = mapped_column(sa.String(32), nullable=False)
    guest_email:  Mapped[str | None]  = mapped_column(sa.String(256), nullable=True)
    delivery_address: Mapped[str]     = mapped_column(sa.String(512), nullable=False, server_default="")
    delivery_cost:    Mapped[Decimal] = mapped_column(sa.Numeric(10, 2), nullable=False, default=Decimal("0.00"), server_default="0.00")
    pvz_code:         Mapped[str | None] = mapped_column(sa.String(64), nullable=True)
    payment_method:   Mapped[str]     = mapped_column(sa.String(16), nullable=False, server_default="card")
    comment:      Mapped[str | None]  = mapped_column(sa.Text, nullable=True)
    status:       Mapped[OrderStatus] = mapped_column(
        sa.Enum(OrderStatus, name="order_status"),
        nullable=False,
        default=OrderStatus.pending,
        server_default=OrderStatus.pending.value,
        index=True,
    )
    total_amount: Mapped[Decimal]     = mapped_column(sa.Numeric(12, 2), nullable=False)
    payment_id:   Mapped[str | None]  = mapped_column(sa.String(128), nullable=True)
    cdek_uuid:    Mapped[str | None]  = mapped_column(sa.String(64), nullable=True)
    cdek_number:  Mapped[str | None]  = mapped_column(sa.String(64), nullable=True, index=True)
    cdek_status:  Mapped[str | None]  = mapped_column(sa.String(64), nullable=True)
    cdek_error:   Mapped[str | None]  = mapped_column(sa.Text, nullable=True)
    created_at:   Mapped[datetime]    = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )

    items: Mapped[list["OrderItem"]] = relationship(
        "OrderItem", back_populates="order", cascade="all, delete-orphan", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Order order_id={self.order_id!r} status={self.status}>"


class OrderItem(Base):
    __tablename__ = "order_items"

    id:            Mapped[int]        = mapped_column(sa.Integer, primary_key=True, index=True)
    order_id:      Mapped[int]        = mapped_column(
        sa.Integer, sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id:    Mapped[int | None] = mapped_column(
        sa.Integer, sa.ForeignKey("products.id", ondelete="SET NULL"), nullable=True
    )
    # Снимок данных на момент заказа — не меняется если товар удалят
    product_name:  Mapped[str]        = mapped_column(sa.String(256), nullable=False)
    product_price: Mapped[Decimal]    = mapped_column(sa.Numeric(10, 2), nullable=False)
    quantity:      Mapped[int]        = mapped_column(sa.Integer, nullable=False)

    order: Mapped["Order"] = relationship("Order", back_populates="items")

    def __repr__(self) -> str:
        return f"<OrderItem product={self.product_name!r} qty={self.quantity}>"


# ── Gallery ───────────────────────────────────────────────────────────────────

class Gallery(Base):
    __tablename__ = "gallery"

    id:          Mapped[int]         = mapped_column(sa.Integer, primary_key=True, index=True)
    image_url:   Mapped[str | None]  = mapped_column(sa.String(512), nullable=True)
    video_url:   Mapped[str | None]  = mapped_column(sa.String(512), nullable=True)
    description: Mapped[str | None]  = mapped_column(sa.Text, nullable=True)
    created_at:  Mapped[datetime]    = mapped_column(
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )

    def __repr__(self) -> str:
        return f"<Gallery id={self.id} image_url={self.image_url!r} video_url={self.video_url!r}>"


GalleryItem = Gallery


# ── SiteSettings ──────────────────────────────────────────────────────────────

class SiteSettings(Base):
    """Хранилище настроек сайта в виде ключ→значение.

    Ключи:
      about_title, about_text,
      contact_text, contact_phone1, contact_phone2,
      contact_address, contact_inn, contact_ogrnip,
      social_vk, social_tg, social_yt, social_rutube,
      warranty_return_title, warranty_return_text,
      warranty_period_title, warranty_period_text
    """
    __tablename__ = "site_settings"

    key:   Mapped[str] = mapped_column(sa.String(128), primary_key=True)
    value: Mapped[str] = mapped_column(sa.Text, nullable=False, server_default="")

    def __repr__(self) -> str:
        return f"<SiteSettings key={self.key!r}>"
