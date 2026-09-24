"""Public payment provider callbacks."""
from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from yookassa.domain.notification import WebhookNotification

from app.database import get_db
from app.models import Order, OrderStatus, Product
from app.services.order_delivery_service import handle_paid_order_background
from app.services.payment_service import get_payment

logger = logging.getLogger(__name__)

router = APIRouter()


async def _handle_yookassa_webhook(
    payload: dict[str, Any],
    background_tasks: BackgroundTasks,
    db: AsyncSession,
) -> str:
    # 1. Извлекаем id платежа из тела уведомления
    try:
        notification = WebhookNotification(payload)
        payment_obj = notification.object
        payment_id = getattr(payment_obj, "id", None)
        event = getattr(notification, "event", None)
    except Exception as exc:
        logger.warning("Некорректная структура webhook ЮKassa: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некорректная структура уведомления",
        ) from exc

    if not payment_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="payment.id отсутствует в уведомлении",
        )

    # Реагируем только на событие успешной оплаты
    if event != "payment.succeeded":
        logger.info("Пропуск события ЮKassa '%s' для платежа %s", event, payment_id)
        return "OK"

    # 2. НЕ доверяем телу запроса: запрашиваем платёж напрямую через API ЮKassa
    try:
        verified_payment = await get_payment(str(payment_id))
    except Exception as exc:
        logger.error("Не удалось запросить платёж %s из API ЮKassa: %s", payment_id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Ошибка верификации платежа в API ЮKassa",
        ) from exc

    if not verified_payment or verified_payment.status != "succeeded":
        logger.warning(
            "Платёж %s не подтверждён API ЮKassa: статус '%s'",
            payment_id,
            getattr(verified_payment, "status", None),
        )
        return "OK"

    metadata = verified_payment.metadata or {}
    order_id = str(metadata.get("order_id") or "")
    if not order_id:
        logger.error("В metadata проверенного платежа %s отсутствует order_id", payment_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="metadata.order_id отсутствует в проверенном платеже",
        )

    # 3. Транзакционная и идемпотентная обработка с блокировкой строки заказа
    stmt = (
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.order_id == order_id)
        .with_for_update()
    )
    order = (await db.execute(stmt)).scalar_one_or_none()
    if order is None:
        logger.error("Заказ %s для подтверждённого платежа %s не найден", order_id, payment_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заказ не найден",
        )

    # Проверка суммы платежа
    verified_amount = Decimal(str(verified_payment.amount.value))
    order_amount = Decimal(str(order.total_amount))
    if verified_amount != order_amount:
        logger.error(
            "Сумма платежа ЮKassa (%s ₽) не совпадает с суммой заказа %s (%s ₽)",
            verified_amount,
            order_id,
            order_amount,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сумма платежа не совпадает с суммой заказа",
        )

    # Идемпотентность: если статус уже не pending (например, повторный webhook)
    if order.status != OrderStatus.pending:
        logger.info(
            "Идемпотентный пропуск: заказ %s уже обработан (текущий статус: %s)",
            order_id,
            order.status.value,
        )
        return "OK"

    # 4. Проверяем товары: все ли в наличии, либо есть позиции «под заказ»
    product_ids = [item.product_id for item in order.items if item.product_id]
    is_all_in_stock = True
    if product_ids:
        prod_res = await db.execute(
            select(Product.id, Product.in_stock).where(Product.id.in_(product_ids))
        )
        in_stock_map = dict(prod_res.all())
        for item in order.items:
            if item.product_id and not in_stock_map.get(item.product_id, True):
                is_all_in_stock = False
                break

    if is_all_in_stock:
        order.status = OrderStatus.paid
        logger.info("Заказ %s: все товары в наличии, статус установлен в paid", order_id)
    else:
        order.status = OrderStatus.in_production
        logger.info("Заказ %s: содержит товары под заказ, статус установлен в in_production", order_id)

    order.payment_id = str(verified_payment.id)
    await db.commit()

    # 5. Фоновые задачи (письма и создание заказа в СДЭК для товаров в наличии)
    background_tasks.add_task(handle_paid_order_background, order.order_id, is_all_in_stock)

    return "OK"


@router.post("/yookassa/webhook", response_class=PlainTextResponse, summary="Webhook YooKassa")
async def yookassa_webhook(
    payload: dict[str, Any],
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> str:
    return await _handle_yookassa_webhook(payload, background_tasks, db)


@router.post("/webhook", response_class=PlainTextResponse, summary="Webhook YooKassa (legacy alias)")
async def yookassa_webhook_legacy(
    payload: dict[str, Any],
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> str:
    return await _handle_yookassa_webhook(payload, background_tasks, db)
