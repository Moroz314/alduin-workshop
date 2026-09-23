"""YooKassa acquiring integration."""
from __future__ import annotations

import asyncio
import uuid
from decimal import Decimal
from typing import Any

from yookassa import Configuration, Payment

from app.config import get_settings


def _configure() -> None:
    settings = get_settings()
    if not settings.yookassa_shop_id or not settings.yookassa_secret_key:
        raise RuntimeError("Не настроены YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY")
    Configuration.configure(settings.yookassa_shop_id, settings.yookassa_secret_key)


def _build_receipt(
    cart: Any,
    customer_email: str | None,
    customer_phone: str,
    delivery_cost: Decimal = Decimal("0.00"),
) -> dict[str, Any]:
    items = []
    for item in cart.items:
        amount = Decimal(str(item.subtotal))
        items.append({
            "description": item.name[:128],
            "quantity": str(item.quantity),
            "amount": {"value": f"{amount:.2f}", "currency": "RUB"},
            "vat_code": 1,
            "payment_mode": "full_payment",
            "payment_subject": "commodity",
        })
    if delivery_cost and Decimal(str(delivery_cost)) > Decimal("0.00"):
        d_amount = Decimal(str(delivery_cost))
        items.append({
            "description": "Доставка СДЭК",
            "quantity": "1",
            "amount": {"value": f"{d_amount:.2f}", "currency": "RUB"},
            "vat_code": 1,
            "payment_mode": "full_payment",
            "payment_subject": "service",
        })
    customer = {"email": customer_email} if customer_email else {"phone": customer_phone}
    return {"customer": customer, "items": items}


def _create_payment_sync(
    *,
    order_id: str,
    amount: Decimal,
    cart: Any,
    customer_email: str | None,
    customer_phone: str,
    delivery_cost: Decimal = Decimal("0.00"),
) -> str:
    _configure()
    settings = get_settings()
    request = {
        "amount": {"value": f"{Decimal(str(amount)):.2f}", "currency": "RUB"},
        "capture": True,
        "description": f"Заказ {order_id}",
        "receipt": _build_receipt(cart, customer_email, customer_phone, delivery_cost),
        "confirmation": {"type": "redirect", "return_url": settings.yookassa_return_url},
        "metadata": {"order_id": order_id},
    }
    payment = Payment.create(request, str(uuid.uuid4()))
    payment_url = getattr(payment.confirmation, "confirmation_url", None)
    if not payment_url:
        raise RuntimeError("ЮKassa не вернула confirmation_url")
    return payment_url


async def create_payment(**kwargs: Any) -> str:
    """Создаёт платеж YooKassa без блокировки async event loop."""
    return await asyncio.to_thread(_create_payment_sync, **kwargs)
