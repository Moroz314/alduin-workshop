"""
Публичные эндпоинты для проверки статуса и деталей заказа покупателем.
"""
from __future__ import annotations

import logging
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database import get_db
from app.models import Order, OrderStatus
from app.schemas import OrderStatusPublicRead
from app.services.payment_service import create_payment

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/{order_id}/status",
    response_model=OrderStatusPublicRead,
    summary="Статус заказа (публичный)",
)
@router.get(
    "/{order_id}",
    response_model=OrderStatusPublicRead,
    summary="Детали заказа (публичный)",
)
async def get_order_status(
    order_id: str,
    db: AsyncSession = Depends(get_db),
) -> OrderStatusPublicRead:
    """
    Возвращает актуальный статус заказа и его позиции из БД.
    Используется страницей возврата после оплаты для проверки статуса.
    """
    stmt = (
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.order_id == order_id)
    )
    order = (await db.execute(stmt)).scalar_one_or_none()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Заказ {order_id} не найден",
        )
    return order


@router.post(
    "/{order_id}/retry-payment",
    summary="Повторить оплату заказа",
)
async def retry_order_payment(
    order_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """
    Позволяет покупателю повторить оплату заказа, если предыдущая попытка
    не удалась (статус canceled/pending).
    """
    stmt = (
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.order_id == order_id)
    )
    order = (await db.execute(stmt)).scalar_one_or_none()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Заказ {order_id} не найден",
        )

    if order.status in (OrderStatus.paid, OrderStatus.in_production, OrderStatus.shipped):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Этот заказ уже оплачен.",
        )

    settings = get_settings()
    if not settings.yookassa_shop_id or not settings.yookassa_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Онлайн-оплата временно недоступна. Пожалуйста, свяжитесь с мастером.",
        )

    try:
        payment_url = await create_payment(
            order_id=order.order_id,
            amount=order.total_amount,
            cart=order,
            customer_email=order.guest_email,
            customer_phone=order.guest_phone,
            delivery_cost=order.delivery_cost,
        )
    except Exception as exc:
        logger.error("Ошибка при создании повторного платежа для заказа %s: %s", order_id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Не удалось создать платеж: {exc}",
        ) from exc

    # Если статус был отменён, возвращаем в pending для новой попытки
    if order.status == OrderStatus.cancelled:
        order.status = OrderStatus.pending
        await db.commit()

    return {"payment_url": payment_url}
