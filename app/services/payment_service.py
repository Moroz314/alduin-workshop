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


def build_yookassa_return_url(order_id: str) -> str:
    """Формирует корректный return_url для ЮKassa без дублирования схемы протокола."""
    settings = get_settings()
    base_url = (settings.yookassa_return_url or "").strip()
    if not base_url:
        return f"https://alduin-workshop.ru/order/success/{order_id}"

    # Подстановка плейсхолдеров, если они указаны в шаблоне
    if "{order_id}" in base_url:
        return base_url.format(order_id=order_id)
    if ":orderId" in base_url:
        return base_url.replace(":orderId", order_id)
    if "{orderId}" in base_url:
        return base_url.format(orderId=order_id)

    # Если в старых конфигах указан /checkout, заменяем на /order/success
    if base_url.endswith("/checkout"):
        base_url = base_url[:-len("/checkout")].rstrip("/") + "/order/success"

    # Избегаем повторного добавления order_id
    if base_url.endswith(f"/{order_id}"):
        return base_url

    return f"{base_url.rstrip('/')}/{order_id}"


def _build_receipt(
    cart_or_items: Any,
    customer_email: str | None,
    customer_phone: str,
    delivery_cost: Decimal = Decimal("0.00"),
) -> dict[str, Any]:
    items = []
    source_items = getattr(cart_or_items, "items", cart_or_items) or []
    for item in source_items:
        name = getattr(item, "name", None) or getattr(item, "product_name", "Товар")
        quantity = getattr(item, "quantity", 1)
        subtotal = getattr(item, "subtotal", None)
        if subtotal is None:
            price = getattr(item, "price", None) or getattr(item, "product_price", Decimal("0.00"))
            subtotal = Decimal(str(price)) * int(str(quantity))
        amount = Decimal(str(subtotal))
        items.append({
            "description": str(name)[:128],
            "quantity": str(quantity),
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
    return_url = build_yookassa_return_url(order_id)
    request = {
        "amount": {"value": f"{Decimal(str(amount)):.2f}", "currency": "RUB"},
        "capture": True,
        "description": f"Заказ {order_id}",
        "receipt": _build_receipt(cart, customer_email, customer_phone, delivery_cost),
        "confirmation": {"type": "redirect", "return_url": return_url},
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


def _get_payment_sync(payment_id: str) -> Any:
    _configure()
    return Payment.find_one(payment_id)


async def get_payment(payment_id: str) -> Any:
    """Запрашивает статус и данные платежа по ID напрямую из API ЮKassa."""
    return await asyncio.to_thread(_get_payment_sync, payment_id)

