"""Public payment provider callbacks."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Order, OrderStatus
from yookassa.domain.notification import WebhookNotification

router = APIRouter()


@router.post("/webhook", response_class=PlainTextResponse, summary="Webhook YooKassa")
async def yookassa_webhook(
    payload: dict[str, Any],
    db: AsyncSession = Depends(get_db),
) -> str:
    notification = WebhookNotification(payload)
    payment = notification.object
    metadata = payment.metadata or {}
    order_id = str(metadata.get("order_id", ""))
    if not order_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="metadata.order_id отсутствует")

    order = await db.scalar(select(Order).where(Order.order_id == order_id))
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заказ не найден")

    if notification.event == "payment.succeeded" or payment.status == "succeeded":
        order.status = OrderStatus.paid
        order.payment_id = str(payment.id)
        await db.commit()

    return "OK"
