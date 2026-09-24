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


# ── Отправка писем после оплаты и оформления СДЭК ───────────────────────────

def _generate_qr_code_png(text: str) -> bytes | None:
    """Генерирует PNG-изображение QR-кода с помощью библиотеки qrcode."""
    try:
        import io
        import qrcode
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=6,
            border=2,
        )
        qr.add_data(text)
        qr.make(fit=True)
        img = qr.make_image(fill_color="#111827", back_color="#FFFFFF")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    except Exception as exc:
        logger.error("Не удалось сгенерировать QR-код для ссылки %s: %s", text, exc)
        return None


def _send_smtp_raw(to_emails: list[str], msg: MIMEMultipart) -> None:
    """Отправляет готовое сообщение через настроенный SMTP-сервер."""
    settings = get_settings()
    if not settings.smtp_host or not to_emails:
        return

    sender = settings.smtp_user or f"noreply@{settings.smtp_host}"
    port = int(settings.smtp_port) if settings.smtp_port else 465

    if port == 465:
        with smtplib.SMTP_SSL(settings.smtp_host, port, timeout=15) as server:
            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(sender, to_emails, msg.as_string())
    else:
        with smtplib.SMTP(settings.smtp_host, port, timeout=15) as server:
            server.starttls()
            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(sender, to_emails, msg.as_string())


def send_order_paid_email(order_data: dict[str, Any], in_production: bool = False) -> None:
    """
    Письмо покупателю и администратору после подтверждения оплаты ЮKassa.
    in_production=True — если товары под заказ (в изготовлении).
    """
    settings = get_settings()
    if not settings.smtp_host:
        return

    order_id = html.escape(str(order_data.get("order_id", "—")))
    customer_email = order_data.get("customer_email")
    if customer_email:
        customer_email = str(customer_email).strip()

    status_title = "Заказ передан в изготовление" if in_production else "Оплата успешно получена"
    status_desc = (
        "Ваш заказ оплачен и принят в работу нашими мастерами. Мы уведомим вас о готовности и отправке."
        if in_production
        else "Ваш заказ успешно оплачен! Мы уже формируем посылку для передачи в службу доставки СДЭК."
    )

    total_amount_formatted = _format_price(order_data.get("total_amount", 0))

    html_content = f"""<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>{status_title} #{order_id}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F3F4F6; padding: 30px 10px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #FFFFFF; border-radius: 8px; overflow: hidden; border: 1px solid #E5E7EB;">
                    <tr>
                        <td style="background-color: #000000; padding: 24px; text-align: center; border-bottom: 2px solid #C49A45;">
                            <div style="font-size: 20px; font-weight: 700; color: #F3F4F6; letter-spacing: 0.1em; text-transform: uppercase;">МАСТЕРСКАЯ АЛДУИН</div>
                            <div style="font-size: 12px; color: #C49A45; margin-top: 4px; text-transform: uppercase;">{status_title}</div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px 24px;">
                            <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #111827;">Заказ #{order_id}</h2>
                            <p style="margin: 0 0 20px 0; color: #374151; font-size: 14px; line-height: 1.6;">{status_desc}</p>
                            <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
                                <div style="font-size: 13px; color: #6B7280; margin-bottom: 4px;">Сумма оплаты:</div>
                                <div style="font-size: 22px; font-weight: 700; color: #111827;">{total_amount_formatted}</div>
                            </div>
                            <p style="margin: 0; color: #6B7280; font-size: 13px;">Как только посылка будет зарегистрирована в СДЭК, вы получите трек-номер и QR-код для отслеживания.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""

    plain_content = f"Заказ #{order_id}\n{status_title}\n\n{status_desc}\nСумма: {total_amount_formatted}\n"

    sender = settings.smtp_user or f"noreply@{settings.smtp_host}"
    display = Header("Мастерская Алдуин", "utf-8").encode()

    try:
        # Письмо покупателю
        if customer_email and "@" in customer_email:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = Header(f"Заказ #{order_id}: {status_title} — Мастерская Алдуин", "utf-8")
            msg["From"] = f"{display} <{sender}>"
            msg["To"] = customer_email
            msg.attach(MIMEText(plain_content, "plain", "utf-8"))
            msg.attach(MIMEText(html_content, "html", "utf-8"))
            _send_smtp_raw([customer_email], msg)

        # Письмо админу
        if settings.admin_email:
            msg_adm = MIMEMultipart("alternative")
            msg_adm["Subject"] = Header(f"[ОПЛАТА] Заказ #{order_id} оплачен ({'в изготовлении' if in_production else 'в наличии'})", "utf-8")
            msg_adm["From"] = f"{display} <{sender}>"
            msg_adm["To"] = settings.admin_email
            msg_adm.attach(MIMEText(f"Заказ #{order_id} успешно оплачен на сумму {total_amount_formatted}.\nКлиент: {order_data.get('customer_name')}, тел: {order_data.get('customer_phone')}", "plain", "utf-8"))
            msg_adm.attach(MIMEText(html_content, "html", "utf-8"))
            _send_smtp_raw([settings.admin_email], msg_adm)

        logger.info("Email об успешной оплате заказа %s отправлен", order_id)
    except Exception as exc:
        logger.error("Ошибка при отправке email об оплате заказа %s: %s", order_id, exc)


def send_cdek_dispatched_email(
    order_data: dict[str, Any],
    requisites: dict[str, str],
    print_url: str | None = None,
) -> None:
    """
    Письмо покупателю и администратору после создания заказа в СДЭК:
    - номер заказа, состав, сумма, адрес ПВЗ
    - номер СДЭК и ссылка на отслеживание
    - QR-код со ссылкой на отслеживание (сгенерирован через qrcode)
    - реквизиты продавца из SiteSettings (ИП, ИНН, ОГРНИП, телефоны, email)
    - ссылка на «Гарантия и возврат»
    - ссылка для печати ярлыка СДЭК (админу)
    """
    settings = get_settings()
    if not settings.smtp_host:
        return

    order_id = html.escape(str(order_data.get("order_id", "—")))
    cdek_number = str(order_data.get("cdek_number") or "").strip()
    customer_email = order_data.get("customer_email")
    if customer_email:
        customer_email = str(customer_email).strip()

    customer_name = html.escape(str(order_data.get("customer_name", "—")))
    delivery_address = html.escape(str(order_data.get("delivery_address", "—") or "Не указан"))
    pvz_code = html.escape(str(order_data.get("pvz_code") or ""))
    total_amount_formatted = _format_price(order_data.get("total_amount", 0))

    tracking_url = f"https://www.cdek.ru/ru/tracking?order_id={cdek_number}" if cdek_number else "https://www.cdek.ru/ru/tracking"
    site_url = (settings.site_base_url or "http://139.100.224.102").rstrip("/")
    warranty_url = f"{site_url}/warranty"

    # Реквизиты продавца
    legal_name = html.escape(requisites.get("contact_legal_name") or "ИП Морозов Владислав Сергеевич")
    inn = html.escape(requisites.get("contact_inn") or "780534396013")
    ogrnip = html.escape(requisites.get("contact_ogrnip") or "325784700428266")
    phone1 = html.escape(requisites.get("contact_phone1") or "+79500082208")
    phone2 = html.escape(requisites.get("contact_phone2") or "+79202091993")
    email_contact = html.escape(requisites.get("contact_email") or "info@alduin-workshop.ru")

    # Генерация QR-кода
    qr_bytes = _generate_qr_code_png(tracking_url)

    items = order_data.get("items", [])
    items_rows_html = ""
    for idx, item in enumerate(items, start=1):
        name = html.escape(str(item.get("name", "Товар")))
        price = _format_price(item.get("price", 0))
        qty = item.get("quantity", 1)
        subtotal = _format_price(item.get("subtotal", 0))
        items_rows_html += f"""
        <tr style="border-bottom: 1px solid #E5E7EB;">
            <td style="padding: 10px 12px; color: #6B7280; font-size: 13px; text-align: center;">{idx}</td>
            <td style="padding: 10px 12px; color: #111827; font-size: 14px; font-weight: 500;">{name}</td>
            <td style="padding: 10px 12px; color: #374151; font-size: 14px; text-align: right; white-space: nowrap;">{price}</td>
            <td style="padding: 10px 12px; color: #374151; font-size: 14px; text-align: center;">{qty}</td>
            <td style="padding: 10px 12px; color: #111827; font-size: 14px; font-weight: 600; text-align: right; white-space: nowrap;">{subtotal}</td>
        </tr>
        """

    delivery_cost = float(order_data.get("delivery_cost") or 0.0)
    if delivery_cost > 0:
        delivery_cost_formatted = _format_price(delivery_cost)
        items_rows_html += f"""
        <tr style="border-bottom: 1px solid #E5E7EB; background-color: #FDFBF7;">
            <td style="padding: 10px 12px; color: #C49A45; font-size: 13px; text-align: center;">📦</td>
            <td style="padding: 10px 12px; color: #111827; font-size: 14px; font-weight: 500;">Доставка СДЭК ({f'ПВЗ {pvz_code}' if pvz_code else 'до пункта выдачи'})</td>
            <td style="padding: 10px 12px; color: #374151; font-size: 14px; text-align: right; white-space: nowrap;">{delivery_cost_formatted}</td>
            <td style="padding: 10px 12px; color: #374151; font-size: 14px; text-align: center;">1</td>
            <td style="padding: 10px 12px; color: #111827; font-size: 14px; font-weight: 600; text-align: right; white-space: nowrap;">{delivery_cost_formatted}</td>
        </tr>
        """

    customer_html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Заказ #{order_id} отправлен СДЭК</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F3F4F6; padding: 30px 10px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 640px; background-color: #FFFFFF; border-radius: 8px; overflow: hidden; border: 1px solid #E5E7EB; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
                    <!-- Шапка -->
                    <tr>
                        <td style="background-color: #000000; padding: 24px 32px; text-align: center; border-bottom: 2px solid #C49A45;">
                            <div style="font-size: 20px; font-weight: 700; color: #F3F4F6; letter-spacing: 0.15em; text-transform: uppercase;">МАСТЕРСКАЯ АЛДУИН</div>
                            <div style="font-size: 12px; color: #C49A45; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.2em;">Заказ передан в доставку СДЭК</div>
                        </td>
                    </tr>

                    <!-- Основной блок -->
                    <tr>
                        <td style="padding: 32px;">
                            <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #111827;">Здравствуйте, {customer_name}!</h1>
                            <p style="margin: 0 0 24px 0; color: #4B5563; font-size: 14px; line-height: 1.5;">
                                Ваш заказ <strong>#{order_id}</strong> успешно оформлен и передан в курьерскую службу СДЭК.
                            </p>

                            <!-- Блок СДЭК Трекинг -->
                            <div style="background-color: #FDFBF7; border: 1px solid #E8D9B8; border-radius: 8px; padding: 20px; margin-bottom: 24px; text-align: center;">
                                <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #855D10; font-weight: 700; margin-bottom: 6px;">Номер отправления СДЭК:</div>
                                <div style="font-size: 24px; font-weight: 800; color: #111827; letter-spacing: 0.05em; font-family: monospace; margin-bottom: 12px;">{cdek_number or "В обработке"}</div>
                                
                                <div style="margin-bottom: 16px;">
                                    <a href="{tracking_url}" target="_blank" style="display: inline-block; background-color: #111827; color: #FFFFFF; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">
                                        Отследить на сайте СДЭК →
                                    </a>
                                </div>

                                {'''
                                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px dashed #E8D9B8;">
                                    <img src="cid:tracking_qr" alt="QR-код для отслеживания" width="140" height="140" style="display: block; margin: 0 auto; border-radius: 6px; border: 1px solid #E5E7EB;" />
                                    <div style="font-size: 12px; color: #6B7280; margin-top: 6px;">Наведите камеру смартфона для быстрого перехода к трекингу</div>
                                </div>
                                ''' if qr_bytes else ''}
                            </div>

                            <!-- Адрес ПВЗ -->
                            <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px; padding: 14px 16px; margin-bottom: 24px; font-size: 14px;">
                                <div style="color: #6B7280; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Пункт выдачи заказа (ПВЗ):</div>
                                <div style="color: #111827; font-weight: 600;">{delivery_address}</div>
                                {f'<div style="color: #6B7280; font-size: 12px; margin-top: 2px;">Код ПВЗ: <strong style="color: #D97706;">{pvz_code}</strong></div>' if pvz_code else ''}
                            </div>

                            <!-- Состав заказа -->
                            <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6B7280; margin-bottom: 10px;">Состав заказа:</div>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse; margin-bottom: 20px;">
                                <thead>
                                    <tr style="background-color: #F9FAFB; border-bottom: 1px solid #E5E7EB;">
                                        <th style="padding: 8px 12px; color: #4B5563; font-size: 12px; text-align: center; width: 30px;">#</th>
                                        <th style="padding: 8px 12px; color: #4B5563; font-size: 12px; text-align: left;">Товар</th>
                                        <th style="padding: 8px 12px; color: #4B5563; font-size: 12px; text-align: right;">Цена</th>
                                        <th style="padding: 8px 12px; color: #4B5563; font-size: 12px; text-align: center;">Кол-во</th>
                                        <th style="padding: 8px 12px; color: #4B5563; font-size: 12px; text-align: right;">Сумма</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items_rows_html}
                                </tbody>
                            </table>

                            <!-- Итог -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #000000; border-radius: 6px; padding: 14px 18px; color: #FFFFFF; margin-bottom: 24px;">
                                <tr>
                                    <td style="font-size: 14px; font-weight: 600; color: #E5E7EB;">Оплачено:</td>
                                    <td align="right" style="font-size: 18px; font-weight: 700; color: #C49A45;">{total_amount_formatted}</td>
                                </tr>
                            </table>

                            <!-- Реквизиты продавца и Гарантия -->
                            <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px; padding: 18px; font-size: 13px; color: #4B5563; line-height: 1.6;">
                                <div style="font-weight: 700; color: #111827; margin-bottom: 6px;">Реквизиты продавца:</div>
                                <div><strong>{legal_name}</strong></div>
                                <div>ИНН: {inn} | ОГРНИП: {ogrnip}</div>
                                <div>Телефон: <a href="tel:{phone1}" style="color: #C49A45; text-decoration: none;">{phone1}</a>{f", <a href='tel:{phone2}' style='color: #C49A45; text-decoration: none;'>{phone2}</a>" if phone2 else ""}</div>
                                <div>Email: <a href="mailto:{email_contact}" style="color: #C49A45; text-decoration: none;">{email_contact}</a></div>
                                
                                <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed #D1D5DB;">
                                    🛡️ <a href="{warranty_url}" target="_blank" style="color: #111827; font-weight: 600; text-decoration: underline;">Условия гарантии и возврата товара</a>
                                </div>
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""

    sender = settings.smtp_user or f"noreply@{settings.smtp_host}"
    display = Header("Мастерская Алдуин", "utf-8").encode()

    try:
        # Письмо покупателю
        if customer_email and "@" in customer_email:
            msg = MIMEMultipart("related")
            msg_alt = MIMEMultipart("alternative")
            msg.attach(msg_alt)

            msg["Subject"] = Header(f"Заказ #{order_id} отправлен СДЭК (трек: {cdek_number})", "utf-8")
            msg["From"] = f"{display} <{sender}>"
            msg["To"] = customer_email

            plain_text = (
                f"Заказ #{order_id} передан в доставку СДЭК\n"
                f"Трек-номер: {cdek_number}\n"
                f"Отслеживание: {tracking_url}\n"
                f"Адрес ПВЗ: {delivery_address}\n"
                f"Сумма: {total_amount_formatted}\n\n"
                f"Реквизиты продавца:\n{legal_name}, ИНН {inn}, ОГРНИП {ogrnip}\n"
                f"Контакты: {phone1}, {email_contact}\n"
                f"Гарантия и возврат: {warranty_url}\n"
            )
            msg_alt.attach(MIMEText(plain_text, "plain", "utf-8"))
            msg_alt.attach(MIMEText(customer_html, "html", "utf-8"))

            if qr_bytes:
                from email.mime.image import MIMEImage
                img_part = MIMEImage(qr_bytes, _subtype="png")
                img_part.add_header("Content-ID", "<tracking_qr>")
                img_part.add_header("Content-Disposition", "inline", filename="tracking_qr.png")
                msg.attach(img_part)

            _send_smtp_raw([customer_email], msg)

        # Письмо администратору
        if settings.admin_email:
            msg_adm = MIMEMultipart("alternative")
            msg_adm["Subject"] = Header(f"[СДЭК] Заказ #{order_id} зарегистрирован (трек: {cdek_number})", "utf-8")
            msg_adm["From"] = f"{display} <{sender}>"
            msg_adm["To"] = settings.admin_email

            print_html_block = f"""
            <div style="margin-top: 15px; padding: 12px; background-color: #EEF2FF; border-radius: 6px;">
                📄 <a href="{print_url}" target="_blank" style="font-weight: 700; color: #4F46E5; text-decoration: underline;">Распечатать квитанцию / ярлык СДЭК</a>
            </div>
            """ if print_url else ""

            adm_html = f"""
            <div style="font-family: sans-serif; padding: 20px;">
                <h2>Заказ #{order_id} зарегистрирован в СДЭК</h2>
                <p>Трек-номер: <strong>{cdek_number}</strong></p>
                <p>Клиент: {customer_name}, тел: {order_data.get('customer_phone')}</p>
                <p>ПВЗ: {delivery_address} ({pvz_code})</p>
                <p><a href="{tracking_url}" target="_blank">Ссылка на отслеживание СДЭК</a></p>
                {print_html_block}
            </div>
            """
            msg_adm.attach(MIMEText(f"Заказ #{order_id} в СДЭК: {cdek_number}. Печать: {print_url or '—'}", "plain", "utf-8"))
            msg_adm.attach(MIMEText(adm_html, "html", "utf-8"))
            _send_smtp_raw([settings.admin_email], msg_adm)

        logger.info("Уведомление об отправке СДЭК для заказа %s успешно отправлено", order_id)
    except Exception as exc:
        logger.error("Ошибка при отправке email об отправке СДЭК для заказа %s: %s", order_id, exc)

