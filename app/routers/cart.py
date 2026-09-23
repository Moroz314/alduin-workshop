"""
Корзина на базе Redis.

Структура хранения:
  Ключ:     cart:{session_id}   — Redis Hash
  Поле:     "{product_id}"      — строковый ключ
  Значение: "{quantity}"        — строковое число
  TTL: 7 дней (продлевается при каждом обращении).
"""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Product
from app.schemas import CartItemAdd, CartItemRead, CartItemRemove, CartRead

router = APIRouter()

CART_TTL_SECONDS = 60 * 60 * 24 * 7  # 7 дней


def _cart_key(session_id: str) -> str:
    return f"cart:{session_id}"


def _get_redis(request: Request):
    return request.app.state.redis


@router.post("/add", response_model=CartRead, summary="Добавить / обновить товар в корзине")
async def add_to_cart(
    body: CartItemAdd,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> CartRead:
    redis = _get_redis(request)

    result = await db.execute(select(Product).where(Product.id == body.product_id))
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Товар с id={body.product_id} не найден")
    # Товары с in_stock=False принимаются под заказ — блокировка корзины убрана

    key = _cart_key(body.session_id)
    await redis.hincrby(key, str(body.product_id), body.quantity)
    await redis.expire(key, CART_TTL_SECONDS)
    return await _build_cart(body.session_id, redis, db)


@router.get("/{session_id}", response_model=CartRead, summary="Получить содержимое корзины")
async def get_cart(
    session_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> CartRead:
    redis = _get_redis(request)
    return await _build_cart(session_id, redis, db)


@router.delete("/remove", response_model=CartRead, summary="Удалить позицию из корзины")
async def remove_from_cart(
    body: CartItemRemove,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> CartRead:
    redis = _get_redis(request)
    key = _cart_key(body.session_id)
    deleted = await redis.hdel(key, str(body.product_id))
    if deleted == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Товар id={body.product_id} не найден в корзине сессии '{body.session_id}'",
        )
    await redis.expire(key, CART_TTL_SECONDS)
    return await _build_cart(body.session_id, redis, db)


async def _build_cart(session_id: str, redis, db: AsyncSession) -> CartRead:
    """Читает корзину из Redis и обогащает данными из PostgreSQL."""
    key = _cart_key(session_id)
    raw: dict[str, str] = await redis.hgetall(key)

    if not raw:
        return CartRead(session_id=session_id, items=[], total=Decimal("0.00"))

    product_ids = [int(pid) for pid in raw.keys()]
    result = await db.execute(select(Product).where(Product.id.in_(product_ids)))
    products_map: dict[int, Product] = {p.id: p for p in result.scalars().all()}

    items: list[CartItemRead] = []
    total = Decimal("0.00")

    for pid_str, qty_str in raw.items():
        pid = int(pid_str)
        qty = int(qty_str)
        product = products_map.get(pid)
        if product is None:
            await redis.hdel(key, pid_str)
            continue
        subtotal = product.price * qty
        total += subtotal
        items.append(CartItemRead(
            product_id=pid,
            quantity=qty,
            name=product.name,
            price=product.price,
            image_url=product.image_url,
            subtotal=subtotal,
        ))

    return CartRead(session_id=session_id, items=items, total=total)
