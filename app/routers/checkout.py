"""
POST /api/checkout — Оформление гостевого заказа.
Читает корзину из Redis, сохраняет Order + OrderItems в БД, очищает корзину.
"""
import random
import string
from decimal import Decimal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models import Order, OrderItem, OrderStatus, Product
from app.routers.cart import _build_cart
from app.schemas import CheckoutRequest, CheckoutResponse
from app.services.payment_service import create_payment
from app.services.email_service import send_new_order_email

router = APIRouter()


def _gen_order_id() -> str:
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
    return f"ORD-{suffix}"


@router.post("/", response_model=CheckoutResponse, summary="Оформить заказ")
async def checkout(
    body:             CheckoutRequest,
    request:          Request,
    background_tasks: BackgroundTasks,
    db:               AsyncSession = Depends(get_db),
) -> CheckoutResponse:
    redis = request.app.state.redis

    # 1. Получить корзину
    cart = await _build_cart(body.session_id, redis, db)
    if not cart.items:
        raise HTTPException(status_code=400, detail="Корзина пуста")
    if body.payment_method == "sbp" and Decimal(str(cart.total)) < Decimal("10.00"):
        raise HTTPException(
            status_code=400,
            detail="Минимальная сумма заказа при оплате через СБП — 10 ₽",
        )

    # 2. Сгенерировать уникальный order_id
    order_id = _gen_order_id()

    delivery_cost = body.delivery_cost if body.delivery_cost is not None else Decimal("0.00")
    if body.pvz_code and Decimal(str(delivery_cost)) <= Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Не удалось рассчитать доставку, попробуйте позже. Оформление заказа невозможно.",
        )
    total_with_delivery = cart.total + delivery_cost

    # 3. Создать заказ
    order = Order(
        order_id         = order_id,
        guest_name       = body.customer_name,
        guest_phone      = body.customer_phone,
        guest_email      = body.customer_email,
        delivery_address = body.delivery_address,
        delivery_cost    = delivery_cost,
        pvz_code         = body.pvz_code,
        payment_method   = body.payment_method,
        comment          = body.comment,
        status           = OrderStatus.pending,
        total_amount     = total_with_delivery,
    )
    db.add(order)
    await db.flush()  # получаем order.id

    # 4. Создать позиции заказа (снимок данных)
    for item in cart.items:
        order_item = OrderItem(
            order_id      = order.id,
            product_id    = item.product_id,
            product_name  = item.name,
            product_price = item.price,
            quantity      = item.quantity,
        )
        db.add(order_item)

    await db.commit()

    # 5. Фоновая отправка email-уведомления администратору о новом заказе
    order_data = {
        "order_id": order_id,
        "customer_name": body.customer_name,
        "customer_phone": body.customer_phone,
        "customer_email": body.customer_email,
        "delivery_address": body.delivery_address,
        "delivery_cost": float(delivery_cost),
        "pvz_code": body.pvz_code,
        "payment_method": body.payment_method,
        "comment": body.comment,
        "items": [
            {
                "name": item.name,
                "price": float(item.price),
                "quantity": item.quantity,
                "subtotal": float(item.price * item.quantity),
            }
            for item in cart.items
        ],
        "cart_total": float(cart.total),
        "total_amount": float(total_with_delivery),
    }
    background_tasks.add_task(send_new_order_email, order_data)

    payment_url = None
    settings = get_settings()
    if settings.yookassa_shop_id and settings.yookassa_secret_key:
        try:
            payment_url = await create_payment(
                order_id=order_id,
                amount=total_with_delivery,
                cart=cart,
                delivery_cost=delivery_cost,
                customer_email=body.customer_email,
                customer_phone=body.customer_phone,
            )
        except Exception as error:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Не удалось создать платеж: {error}",
            ) from error

    # 5. Очистить корзину в Redis после успешного создания платежа
    cart_key = f"cart:{body.session_id}"
    await redis.delete(cart_key)

    # TODO: отправить уведомление в Telegram

    return CheckoutResponse(
        status   = "success",
        message  = f"Заказ {order_id} успешно оформлен. Мы свяжемся с вами в ближайшее время.",
        order_id = order_id,
        payment_url = payment_url,
    )
