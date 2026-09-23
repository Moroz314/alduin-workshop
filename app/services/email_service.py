"""Email notifications service for orders."""
from __future__ import annotations

import html
import logging
import smtplib
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)

PAYMENT_METHODS_MAP = {
    "sbp": "СБП (Система быстрых платежей)",
    "bank_card": "Банковская карта",
    "cash": "Оплата при получении",
}


def _format_price(val: Any) -> str:
    try:
        num = float(val)
        return f"{num:,.2f} ₽".replace(",", " ")
    except Exception:
        return f"{val} ₽"


def _build_html_email(order_data: dict[str, Any]) -> str:
    order_id = html.escape(str(order_data.get("order_id", "—")))
    customer_name = html.escape(str(order_data.get("customer_name", "—")))
    customer_phone = html.escape(str(order_data.get("customer_phone", "—")))
    customer_email = html.escape(str(order_data.get("customer_email", "—") or "—"))
    delivery_address = html.escape(str(order_data.get("delivery_address", "—") or "Не указан"))
    comment = html.escape(str(order_data.get("comment", "") or "—"))

    pvz_code = html.escape(str(order_data.get("pvz_code") or ""))
    delivery_cost = float(order_data.get("delivery_cost") or 0.0)
    delivery_cost_formatted = _format_price(delivery_cost)

    raw_method = order_data.get("payment_method") or ""
    payment_method_label = html.escape(PAYMENT_METHODS_MAP.get(raw_method, raw_method or "Не указан"))

    total_amount_formatted = _format_price(order_data.get("total_amount", 0))

    items = order_data.get("items", [])
    items_rows_html = ""
    for idx, item in enumerate(items, start=1):
        name = html.escape(str(item.get("name", "Товар")))
        price = _format_price(item.get("price", 0))
        qty = item.get("quantity", 1)
        subtotal = _format_price(item.get("subtotal", 0))

        items_rows_html += f"""
        <tr style="border-bottom: 1px solid #E5E7EB;">
            <td style="padding: 12px 14px; color: #6B7280; font-size: 13px; text-align: center;">{idx}</td>
            <td style="padding: 12px 14px; color: #111827; font-size: 14px; font-weight: 500;">{name}</td>
            <td style="padding: 12px 14px; color: #374151; font-size: 14px; text-align: right; white-space: nowrap;">{price}</td>
            <td style="padding: 12px 14px; color: #374151; font-size: 14px; text-align: center;">{qty}</td>
            <td style="padding: 12px 14px; color: #111827; font-size: 14px; font-weight: 600; text-align: right; white-space: nowrap;">{subtotal}</td>
        </tr>
        """

    if delivery_cost > 0:
        items_rows_html += f"""
        <tr style="border-bottom: 1px solid #E5E7EB; background-color: #FDFBF7;">
            <td style="padding: 12px 14px; color: #C49A45; font-size: 13px; text-align: center;">📦</td>
            <td style="padding: 12px 14px; color: #111827; font-size: 14px; font-weight: 500;">Доставка СДЭК (до ПВЗ {pvz_code})</td>
            <td style="padding: 12px 14px; color: #374151; font-size: 14px; text-align: right; white-space: nowrap;">{delivery_cost_formatted}</td>
            <td style="padding: 12px 14px; color: #374151; font-size: 14px; text-align: center;">1</td>
            <td style="padding: 12px 14px; color: #111827; font-size: 14px; font-weight: 600; text-align: right; white-space: nowrap;">{delivery_cost_formatted}</td>
        </tr>
        """

    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Новый заказ #{order_id}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F3F4F6; padding: 30px 10px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 640px; background-color: #FFFFFF; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #E5E7EB;">
                    
                    <!-- Шапка -->
                    <tr>
                        <td style="background-color: #000000; padding: 28px 32px; text-align: center; border-bottom: 2px solid #C49A45;">
                            <div style="font-size: 22px; font-weight: 700; letter-spacing: 0.15em; color: #F3F4F6; text-transform: uppercase;">
                                МАСТЕРСКАЯ АЛДУИН
                            </div>
                            <div style="font-size: 12px; color: #C49A45; letter-spacing: 0.25em; text-transform: uppercase; margin-top: 4px;">
                                Уведомление о новом заказе
                            </div>
                        </td>
                    </tr>

                    <!-- Основное тело -->
                    <tr>
                        <td style="padding: 32px 32px 24px 32px;">
                            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 20px;">
                                <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #111827;">
                                    Заказ <span style="color: #C49A45;">#{order_id}</span>
                                </h1>
                            </div>
                            <p style="margin: 0 0 24px 0; color: #4B5563; font-size: 14px; line-height: 1.5;">
                                На сайте поступил новый заказ. Детали клиента и состав заказа представлены ниже:
                            </p>

                            <!-- Блок с данными клиента -->
                            <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px; padding: 20px; margin-bottom: 28px;">
                                <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6B7280; margin-bottom: 12px;">
                                    Данные клиента
                                </div>
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 14px;">
                                    <tr>
                                        <td style="padding: 4px 0; color: #6B7280; width: 140px;">Покупатель:</td>
                                        <td style="padding: 4px 0; color: #111827; font-weight: 600;">{customer_name}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 4px 0; color: #6B7280;">Телефон:</td>
                                        <td style="padding: 4px 0; color: #111827; font-weight: 600;">
                                            <a href="tel:{customer_phone}" style="color: #C49A45; text-decoration: none;">{customer_phone}</a>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 4px 0; color: #6B7280;">Email:</td>
                                        <td style="padding: 4px 0; color: #111827;">
                                            <a href="mailto:{customer_email}" style="color: #C49A45; text-decoration: none;">{customer_email}</a>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 4px 0; color: #6B7280;">Адрес доставки:</td>
                                        <td style="padding: 4px 0; color: #111827;">{delivery_address}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 4px 0; color: #6B7280;">Оплата:</td>
                                        <td style="padding: 4px 0; color: #111827; font-weight: 500;">{payment_method_label}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 4px 0; color: #6B7280;">Комментарий:</td>
                                        <td style="padding: 4px 0; color: #374151; font-style: italic;">{comment}</td>
                                    </tr>
                                </table>
                            </div>

                            <!-- Состав заказа -->
                            <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6B7280; margin-bottom: 12px;">
                                Состав заказа
                            </div>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse; margin-bottom: 24px;">
                                <thead>
                                    <tr style="background-color: #F3F4F6; border-bottom: 1px solid #E5E7EB;">
                                        <th style="padding: 10px 14px; color: #4B5563; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; text-align: center; width: 30px;">#</th>
                                        <th style="padding: 10px 14px; color: #4B5563; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; text-align: left;">Товар</th>
                                        <th style="padding: 10px 14px; color: #4B5563; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; text-align: right;">Цена</th>
                                        <th style="padding: 10px 14px; color: #4B5563; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; text-align: center;">Кол-во</th>
                                        <th style="padding: 10px 14px; color: #4B5563; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; text-align: right;">Сумма</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items_rows_html}
                                </tbody>
                            </table>

                            <!-- Итог -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #000000; border-radius: 6px; padding: 16px 20px; color: #FFFFFF;">
                                <tr>
                                    <td style="font-size: 15px; font-weight: 600; color: #E5E7EB;">
                                        Итого к оплате:
                                    </td>
                                    <td align="right" style="font-size: 20px; font-weight: 700; color: #C49A45;">
                                        {total_amount_formatted}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Подвал письма -->
                    <tr>
                        <td style="background-color: #F9FAFB; padding: 20px 32px; border-top: 1px solid #E5E7EB; text-align: center; font-size: 12px; color: #9CA3AF;">
                            Письмо сформировано автоматически сайтом мастерской «Алдуин».<br>
                            Не отвечайте на это письмо, если не настроен обратный адрес.
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""


def _build_plain_email(order_data: dict[str, Any]) -> str:
    order_id = order_data.get("order_id", "—")
    customer_name = order_data.get("customer_name", "—")
    customer_phone = order_data.get("customer_phone", "—")
    customer_email = order_data.get("customer_email", "—")
    delivery_address = order_data.get("delivery_address", "—")
    comment = order_data.get("comment", "—")
    raw_method = order_data.get("payment_method") or ""
    payment_method = PAYMENT_METHODS_MAP.get(raw_method, raw_method)

    items = order_data.get("items", [])
    items_text = []
    for idx, it in enumerate(items, start=1):
        name = it.get("name", "Товар")
        price = _format_price(it.get("price", 0))
        qty = it.get("quantity", 1)
        subtotal = _format_price(it.get("subtotal", 0))
        items_text.append(f"{idx}. {name} — {qty} шт. x {price} = {subtotal}")

    total_formatted = _format_price(order_data.get("total_amount", 0))

    return (
        f"НОВЫЙ ЗАКАЗ #{order_id}\n"
        f"Мастерская Алдуин\n\n"
        f"ДАННЫЕ КЛИЕНТА:\n"
        f"- Имя: {customer_name}\n"
        f"- Телефон: {customer_phone}\n"
        f"- Email: {customer_email}\n"
        f"- Адрес: {delivery_address}\n"
        f"- Способ оплаты: {payment_method}\n"
        f"- Комментарий: {comment}\n\n"
        f"СОСТАВ ЗАКАЗА:\n"
        + "\n".join(items_text)
        + f"\n\nИТОГО К ОПЛАТЕ: {total_formatted}\n"
    )


def send_new_order_email(order_data: dict[str, Any]) -> None:
    """
    Отправка HTML-уведомления о новом заказе:
    1) Администратору мастерской на ADMIN_EMAIL.
    2) Покупателю на customer_email (если email был указан при заказе).
    Вызывается в фоновом режиме (FastAPI BackgroundTasks).
    """
    settings = get_settings()

    if not settings.smtp_host or not settings.admin_email:
        logger.warning(
            "Пропуск отправки email: не настроены SMTP_HOST или ADMIN_EMAIL в .env"
        )
        return

    order_id = order_data.get("order_id", "—")
    customer_email = order_data.get("customer_email")
    if customer_email:
        customer_email = str(customer_email).strip()

    sender = settings.smtp_user or f"noreply@{settings.smtp_host}"
    port = int(settings.smtp_port) if settings.smtp_port else 465

    def _create_message(to_email: str, is_for_admin: bool) -> MIMEMultipart:
        msg = MIMEMultipart("alternative")
        if is_for_admin:
            subject = f"Новый заказ #{order_id} — Мастерская Алдуин"
        else:
            subject = f"Ваш заказ #{order_id} принят — Мастерская Алдуин"

        msg["Subject"] = Header(subject, "utf-8")
        # Яндекс требует, чтобы From совпадал с авторизованным пользователем.
        # Display name кодируем через RFC2047, адрес — только smtp_user.
        display = Header("Мастерская Алдуин", "utf-8").encode()
        msg["From"] = f"{display} <{sender}>"
        msg["To"] = to_email
        msg.attach(MIMEText(_build_plain_email(order_data), "plain", "utf-8"))
        msg.attach(MIMEText(_build_html_email(order_data), "html", "utf-8"))
        return msg

    try:
        logger.info(
            "Отправка email о заказе %s через %s:%s",
            order_id,
            settings.smtp_host,
            port,
        )

        if port == 465:
            with smtplib.SMTP_SSL(settings.smtp_host, port, timeout=15) as server:
                if settings.smtp_user and settings.smtp_password:
                    server.login(settings.smtp_user, settings.smtp_password)
                
                # Письмо администратору
                server.sendmail(sender, [settings.admin_email], _create_message(settings.admin_email, True).as_string())
                
                # Письмо покупателю
                if customer_email and "@" in customer_email and customer_email != settings.admin_email:
                    server.sendmail(sender, [customer_email], _create_message(customer_email, False).as_string())
        else:
            with smtplib.SMTP(settings.smtp_host, port, timeout=15) as server:
                server.starttls()
                if settings.smtp_user and settings.smtp_password:
                    server.login(settings.smtp_user, settings.smtp_password)
                
                # Письмо администратору
                server.sendmail(sender, [settings.admin_email], _create_message(settings.admin_email, True).as_string())
                
                # Письмо покупателю
                if customer_email and "@" in customer_email and customer_email != settings.admin_email:
                    server.sendmail(sender, [customer_email], _create_message(customer_email, False).as_string())

        logger.info("Уведомления о заказе %s успешно отправлены", order_id)
    except Exception as exc:
        logger.error(
            "Ошибка при отправке email о заказе %s: %s",
            order_id,
            exc,
            exc_info=True,
        )
