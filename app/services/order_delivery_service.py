"""Order delivery automation workflow (CDEK + YooKassa + Emails)."""
from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models import Order, OrderStatus, Product, SiteSettings
from app.routers.settings import DEFAULTS
from app.services import cdek_service
from app.services.email_service import (
    send_cdek_dispatched_email,
    send_order_paid_email,
)

logger = logging.getLogger(__name__)


def _build_order_dict_for_email(order: Order) -> dict[str, Any]:
    return {
        "order_id": order.order_id,
        "customer_name": order.guest_name,
        "customer_phone": order.guest_phone,
        "customer_email": order.guest_email,
        "delivery_address": order.delivery_address,
        "delivery_cost": float(order.delivery_cost or 0.0),
        "pvz_code": order.pvz_code,
        "payment_method": order.payment_method,
        "comment": order.comment,
        "cdek_number": order.cdek_number,
        "items": [
            {
                "name": it.product_name,
                "price": float(it.product_price),
                "quantity": it.quantity,
                "subtotal": float(it.product_price * it.quantity),
            }
            for it in order.items
        ],
        "total_amount": float(order.total_amount),
    }


async def _get_site_requisites(db: Any) -> dict[str, str]:
    result = await db.execute(select(SiteSettings))
    rows = {row.key: row.value for row in result.scalars().all()}
    return {k: rows.get(k, default) for k, default in DEFAULTS.items()}


def validate_cdek_sender_data(site_requisites: dict[str, str]) -> tuple[bool, str]:
    """Проверяет заполненность обязательных данных отправителя для заказа СДЭК."""
    settings = get_settings()
    missing = []

    city_code = (
        site_requisites.get("cdek_sender_city_code")
        or settings.cdek_sender_city_code
    )
    if not city_code or not str(city_code).strip():
        missing.append("Город отправления (код СДЭК)")

    sender_name = (
        site_requisites.get("cdek_sender_name")
        or settings.cdek_sender_name
        or site_requisites.get("contact_legal_name")
    )
    if not sender_name or not str(sender_name).strip():
        missing.append("Имя отправителя")

    sender_phone = (
        site_requisites.get("cdek_sender_phone")
        or settings.cdek_sender_phone
        or site_requisites.get("contact_phone1")
    )
    if not sender_phone or not str(sender_phone).strip():
        missing.append("Телефон отправителя")

    delivery_type = (
        site_requisites.get("cdek_delivery_type")
        or settings.cdek_delivery_type
        or "pvz"
    ).strip().lower()

    if delivery_type not in ("pvz", "courier"):
        missing.append("Способ передачи в СДЭК (отправка из ПВЗ или вызов курьера)")
    elif delivery_type == "pvz":
        pvz_code = (
            site_requisites.get("cdek_sender_pvz_code")
            or settings.cdek_sender_pvz_code
        )
        if not pvz_code or not str(pvz_code).strip():
            missing.append("Код ПВЗ отправления СДЭК")
    elif delivery_type == "courier":
        courier_addr = (
            site_requisites.get("cdek_sender_address")
            or settings.cdek_sender_address
        )
        if not courier_addr or not str(courier_addr).strip():
            missing.append("Адрес для забора курьером СДЭК")

    if missing:
        error_msg = f"Не заполнены обязательные данные отправителя СДЭК: {', '.join(missing)}. Заполните их в Настройках сайта (вкладка «Доставка СДЭК») или в .env."
        return False, error_msg

    return True, ""


async def process_cdek_order_for_order(
    order_id_or_db_id: int | str,
    mark_shipped_if_in_production: bool = False,
) -> dict[str, Any]:
    """
    Создает заказ в СДЭК для указанного заказа:
    1. Проверяет наличие pvz_code.
    2. Проверяет идемпотентность (если уже есть cdek_number, не дублирует).
    3. Валидирует обязательные данные отправителя.
    4. Вызывает POST /v2/orders в СДЭК.
    5. Сохраняет cdek_uuid.
    6. Опрашивает GET /v2/orders/{uuid} до получения cdek_number.
    7. Сохраняет cdek_number и статус в БД.
    8. Получает ссылку на печатную форму квитанции.
    9. Отправляет второе письмо покупателю (с QR-кодом, треком, реквизитами) и администратору.
    """
    async with AsyncSessionLocal() as db:
        if isinstance(order_id_or_db_id, int):
            stmt = select(Order).options(selectinload(Order.items)).where(Order.id == order_id_or_db_id)
        else:
            stmt = select(Order).options(selectinload(Order.items)).where(Order.order_id == str(order_id_or_db_id))

        order = (await db.execute(stmt)).scalar_one_or_none()
        if not order:
            logger.error("Заказ %s для СДЭК не найден в БД", order_id_or_db_id)
            return {"success": False, "error": "Заказ не найден"}

        # Идемпотентность: если трек-номер уже есть, повторно не отправляем в СДЭК
        if order.cdek_number:
            logger.info("Заказ %s уже имеет номер СДЭК: %s", order.order_id, order.cdek_number)
            return {
                "success": True,
                "cdek_uuid": order.cdek_uuid,
                "cdek_number": order.cdek_number,
                "cdek_status": order.cdek_status,
            }

        # Загружаем параметры товаров (габариты, вес)
        product_ids = [it.product_id for it in order.items if it.product_id]
        product_dims = {}
        if product_ids:
            prod_res = await db.execute(
                select(Product).where(Product.id.in_(product_ids))
            )
            for p in prod_res.scalars().all():
                product_dims[p.id] = {
                    "weight_grams": p.weight_grams,
                    "length_cm": p.length_cm,
                    "width_cm": p.width_cm,
                    "height_cm": p.height_cm,
                }

        requisites = await _get_site_requisites(db)

        # Валидация обязательных данных отправителя (Requirement 10)
        is_valid, validation_error = validate_cdek_sender_data(requisites)
        if not is_valid:
            logger.warning(
                "Создание заказа СДЭК для %s отклонено из-за незаполненных данных: %s",
                order.order_id,
                validation_error,
            )
            order.cdek_error = validation_error
            await db.commit()
            return {"success": False, "error": validation_error}

        # Формируем тело для СДЭК
        try:
            payload = cdek_service.build_cdek_order_payload(
                order=order,
                product_dimensions=product_dims,
                site_requisites=requisites,
            )
            create_res = await cdek_service.create_cdek_order(payload)
            cdek_uuid = create_res["uuid"]
            order.cdek_uuid = cdek_uuid
            order.cdek_status = "ACCEPTED"
            order.cdek_error = None
            await db.commit()
        except Exception as exc:
            err_msg = str(exc)
            logger.error("Сбой создания заказа СДЭК для %s: %s", order.order_id, err_msg)
            order.cdek_error = err_msg
            await db.commit()
            return {"success": False, "error": err_msg}

        # Опрашиваем получение cdek_number
        try:
            poll_info = await cdek_service.poll_cdek_number(cdek_uuid, max_attempts=8, delay=2.0)
            cdek_num = poll_info.get("cdek_number")
            order.cdek_status = poll_info.get("status") or order.cdek_status
            if cdek_num:
                order.cdek_number = cdek_num
                order.cdek_error = None
                if mark_shipped_if_in_production and order.status == OrderStatus.in_production:
                    order.status = OrderStatus.shipped
            else:
                logger.warning("СДЭК uuid %s: трек-номер еще не присвоен", cdek_uuid)

            await db.commit()
        except Exception as exc:
            err_msg = str(exc)
            logger.error("Ошибка при опросе статуса СДЭК для %s: %s", order.order_id, err_msg)
            order.cdek_error = err_msg
            await db.commit()

        # Получаем ссылку на печать квитанции
        print_url = None
        if order.cdek_uuid:
            try:
                print_url = await cdek_service.get_print_form_url(order.cdek_uuid)
            except Exception as e_print:
                logger.warning("Не удалось получить ссылку на печать для заказа %s: %s", order.order_id, e_print)

        # Отправляем письмо покупателю и админу о регистрации доставки
        if order.cdek_number:
            try:
                order_dict = _build_order_dict_for_email(order)
                send_cdek_dispatched_email(order_dict, requisites, print_url=print_url)
            except Exception as e_mail:
                logger.error("Сбой отправки email после регистрации СДЭК для заказа %s: %s", order.order_id, e_mail)

        return {
            "success": bool(order.cdek_number),
            "cdek_uuid": order.cdek_uuid,
            "cdek_number": order.cdek_number,
            "cdek_status": order.cdek_status,
            "cdek_error": order.cdek_error,
            "print_url": print_url,
        }


async def handle_paid_order_background(order_id: str, is_all_in_stock: bool) -> None:
    """
    Фоновый обработчик подтвержденного платежа:
    1. Отправляет первое письмо покупателю и админу об оплате.
    2. Если товары в наличии — инициирует создание заказа в СДЭК.
    """
    async with AsyncSessionLocal() as db:
        order = (
            await db.execute(
                select(Order).options(selectinload(Order.items)).where(Order.order_id == order_id)
            )
        ).scalar_one_or_none()
        if not order:
            return

        order_dict = _build_order_dict_for_email(order)

    # 1. Первое письмо об оплате
    try:
        send_order_paid_email(order_dict, in_production=not is_all_in_stock)
    except Exception as exc:
        logger.error("Ошибка отправки первого письма об оплате для заказа %s: %s", order_id, exc)

    # 2. Если товары в наличии — автоматическое создание заказа в СДЭК
    if is_all_in_stock:
        logger.info("Товары в заказе %s в наличии. Запуск автоматического создания заказа СДЭК.", order_id)
        await process_cdek_order_for_order(order_id)
    else:
        logger.info("Заказ %s содержит позиции под заказ. Ожидает готовности в мастерской.", order_id)
