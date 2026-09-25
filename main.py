from contextlib import asynccontextmanager
import asyncio
import logging
import os
from pathlib import Path

import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

logger = logging.getLogger(__name__)

import sqlalchemy as sa
from app.config import get_settings
from app.database import Base, engine
from app.routers import categories, products, cart, checkout, delivery
from app.routers import auth
from app.routers import payments
from app.routers import articles as public_articles
from app.routers import gallery  as public_gallery
from app.routers.admin import categories as admin_categories
from app.routers.admin import products  as admin_products
from app.routers.admin import articles  as admin_articles
from app.routers.admin import orders    as admin_orders
from app.routers.admin import upload    as admin_upload
from app.routers.admin import gallery   as admin_gallery
from app.routers import settings         as public_settings
from app.routers.admin import settings   as admin_settings

settings = get_settings()

# ── Swagger/OpenAPI: отключаем в продакшне (DEBUG=false) ─────────────────────
_debug = os.getenv("DEBUG", "false").lower() in ("1", "true", "yes")
_docs_url    = "/api/docs"         if _debug else None
_redoc_url   = "/api/redoc"        if _debug else None
_openapi_url = "/api/openapi.json" if _debug else None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Retry DB connection — the postgres container may need a moment even after
    # the healthcheck passes, especially on first boot.
    for attempt in range(1, 11):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
                # Безопасное добавление новых колонок в существующие таблицы
                await conn.execute(
                    sa.text("ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url VARCHAR(512);")
                )
                await conn.execute(
                    sa.text("ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;")
                )
                await conn.execute(
                    sa.text("""
                        UPDATE categories
                        SET sort_order = sub.rn
                        FROM (
                            SELECT id, ROW_NUMBER() OVER (ORDER BY id ASC) AS rn
                            FROM categories
                        ) sub
                        WHERE categories.id = sub.id AND (categories.sort_order = 0 OR categories.sort_order IS NULL);
                    """)
                )
                await conn.execute(
                    sa.text("CREATE INDEX IF NOT EXISTS ix_categories_sort_order ON categories (sort_order);")
                )
                await conn.execute(
                    sa.text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_cost NUMERIC(10, 2) DEFAULT 0.00;")
                )
                await conn.execute(
                    sa.text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS pvz_code VARCHAR(64);")
                )
                await conn.execute(
                    sa.text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS cdek_uuid VARCHAR(64);")
                )
                await conn.execute(
                    sa.text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS cdek_number VARCHAR(64);")
                )
                await conn.execute(
                    sa.text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS cdek_status VARCHAR(64);")
                )
                await conn.execute(
                    sa.text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS cdek_error TEXT;")
                )
                await conn.execute(
                    sa.text("ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_grams INTEGER;")
                )
                await conn.execute(
                    sa.text("ALTER TABLE products ADD COLUMN IF NOT EXISTS length_cm INTEGER;")
                )
                await conn.execute(
                    sa.text("ALTER TABLE products ADD COLUMN IF NOT EXISTS width_cm INTEGER;")
                )
                await conn.execute(
                    sa.text("ALTER TABLE products ADD COLUMN IF NOT EXISTS height_cm INTEGER;")
                )
                await conn.execute(
                    sa.text("ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;")
                )
                await conn.execute(
                    sa.text("""
                        UPDATE products
                        SET sort_order = sub.rn
                        FROM (
                            SELECT id, ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY id ASC) AS rn
                            FROM products
                        ) sub
                        WHERE products.id = sub.id AND (products.sort_order = 0 OR products.sort_order IS NULL);
                    """)
                )
                await conn.execute(
                    sa.text("CREATE INDEX IF NOT EXISTS ix_products_sort_order ON products (sort_order);")
                )
                await conn.execute(
                    sa.text("""
                        CREATE TABLE IF NOT EXISTS training_sections (
                            id SERIAL PRIMARY KEY,
                            name VARCHAR(128) NOT NULL UNIQUE,
                            slug VARCHAR(128) NOT NULL UNIQUE,
                            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                        );
                    """)
                )
                await conn.execute(
                    sa.text("ALTER TABLE articles ADD COLUMN IF NOT EXISTS image_url VARCHAR(512);")
                )
                await conn.execute(
                    sa.text("ALTER TABLE articles ADD COLUMN IF NOT EXISTS section_id INTEGER REFERENCES training_sections(id) ON DELETE SET NULL;")
                )
                await conn.execute(
                    sa.text("""
                        CREATE TABLE IF NOT EXISTS site_settings (
                            key   VARCHAR(128) PRIMARY KEY,
                            value TEXT NOT NULL DEFAULT ''
                        );
                    """)
                )
            # Добавляем новое значение 'in_production' в enum order_status (вне транзакции)
            try:
                async with engine.connect() as auto_conn:
                    await auto_conn.execution_options(isolation_level="AUTOCOMMIT")
                    await auto_conn.execute(
                        sa.text("ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'in_production';")
                    )
            except Exception as e_enum:
                logger.debug("Enum update notice: %s", e_enum)
            break
        except Exception as exc:
            if attempt == 10:
                raise
            logger.warning(
                "DB not ready (attempt %d/10): %s — retrying in 3 s…", attempt, exc
            )
            await asyncio.sleep(3)

    app.state.redis = aioredis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,
    )

    yield

    await app.state.redis.aclose()
    await engine.dispose()


app = FastAPI(
    title="Мастерская Алдуин — API",
    description="Backend интернет-магазина кожаных и кованых изделий",
    version="0.3.0",
    docs_url=_docs_url,
    redoc_url=_redoc_url,
    openapi_url=_openapi_url,
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Продакшн: только HTTPS-домен из переменной окружения ALLOWED_ORIGINS.
# Разработка: дополнительно разрешаем localhost-адреса.
_extra_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]

if _debug:
    # Локальная разработка — разрешаем стандартные порты Vite / CRA
    _dev_origins = [
        "http://localhost",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
    ]
else:
    _dev_origins = []

ALLOWED_ORIGINS = list(dict.fromkeys([*_extra_origins, *_dev_origins]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Статика (загруженные изображения) ────────────────────────────────────────
uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ── Публичные эндпоинты ──────────────────────────────────────────────────────
app.include_router(auth.router,              prefix="/api/auth",       tags=["Auth"])
app.include_router(categories.router,        prefix="/api/categories", tags=["Categories"])
app.include_router(products.router,          prefix="/api/products",   tags=["Products"])
app.include_router(cart.router,              prefix="/api/cart",       tags=["Cart"])
app.include_router(checkout.router,          prefix="/api/checkout",   tags=["Checkout"])
app.include_router(public_articles.router,   prefix="/api/articles",   tags=["Articles"])
app.include_router(public_gallery.router,    prefix="/api/gallery",    tags=["Gallery"])
app.include_router(payments.router,          prefix="/api/payments",    tags=["Payments"])
app.include_router(delivery.router,          prefix="/api/delivery",    tags=["Delivery"])

# ── Защищённые эндпоинты администратора ──────────────────────────────────────
app.include_router(admin_categories.router,  prefix="/api/admin/categories", tags=["Admin · Categories"])
app.include_router(admin_products.router,    prefix="/api/admin/products",   tags=["Admin · Products"])
app.include_router(admin_articles.router,    prefix="/api/admin/articles",   tags=["Admin · Articles"])
app.include_router(admin_orders.router,      prefix="/api/admin/orders",     tags=["Admin · Orders"])
app.include_router(admin_upload.router,      prefix="/api/admin/upload",     tags=["Admin · Upload"])
app.include_router(admin_gallery.router,     prefix="/api/admin/gallery",    tags=["Admin · Gallery"])
app.include_router(public_settings.router,   prefix="/api/settings",         tags=["Settings"])
app.include_router(admin_settings.router,    prefix="/api/admin/settings",   tags=["Admin · Settings"])


@app.get("/api/healthcheck", tags=["System"])
async def healthcheck():
    return {"status": "ok", "version": app.version, "env": settings.app_env}
