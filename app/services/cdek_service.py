"""CDEK API v2 logistics service."""
from __future__ import annotations

import asyncio
import logging
import time
from decimal import Decimal
from typing import Any

import requests

from app.config import get_settings

logger = logging.getLogger(__name__)

# Официальные тестовые ключи песочницы СДЭК для разработки/демо
DEFAULT_TEST_ACCOUNT = "wqGwiQx0gg8mLtiEKsUinjVSICCjtTEP"
DEFAULT_TEST_PASSWORD = "RmAmgvSgSl1yirlz9QupbzOJVqhCxcP5"

_cached_token: str | None = None
_token_expires_at: float = 0.0


def _get_api_url() -> str:
    settings = get_settings()
    if settings.cdek_is_test:
        return "https://api.edu.cdek.ru/v2"
    return "https://api.cdek.ru/v2"


def _get_credentials() -> tuple[str, str]:
    settings = get_settings()
    account = settings.cdek_account.strip() if settings.cdek_account else ""
    password = settings.cdek_secure_password.strip() if settings.cdek_secure_password else ""

    if settings.cdek_is_test:
        if not account or not password:
            return DEFAULT_TEST_ACCOUNT, DEFAULT_TEST_PASSWORD
        return account, password

    if not account or not password:
        raise RuntimeError("Не настроены CDEK_ACCOUNT и CDEK_SECURE_PASSWORD в .env для боевого режима")
    return account, password


def _fetch_access_token_sync() -> str:
    global _cached_token, _token_expires_at

    now = time.time()
    if _cached_token and now < (_token_expires_at - 60):
        return _cached_token

    api_url = _get_api_url()
    settings = get_settings()
    account, password = _get_credentials()

    url = f"{api_url}/oauth/token"
    data = {
        "grant_type": "client_credentials",
        "client_id": account,
        "client_secret": password,
    }

    try:
        res = requests.post(url, data=data, timeout=10)
        # Если в тестовом режиме указанные ключи отклонены (например, боевые ключи в режиме test),
        # используем проверенные тестовые ключи песочницы СДЭК
        if res.status_code == 401 and settings.cdek_is_test and account != DEFAULT_TEST_ACCOUNT:
            logger.warning("Ключи в .env отклонены тестовым сервером СДЭК. Применяются официальные ключи песочницы.")
            data["client_id"] = DEFAULT_TEST_ACCOUNT
            data["client_secret"] = DEFAULT_TEST_PASSWORD
            res = requests.post(url, data=data, timeout=10)

        res.raise_for_status()
        payload = res.json()
        token = payload.get("access_token")
        expires_in = payload.get("expires_in", 3600)

        if not token:
            raise RuntimeError("CDEK API did not return access_token")

        _cached_token = token
        _token_expires_at = now + float(expires_in)
        return token
    except Exception as exc:
        logger.error("Ошибка авторизации в СДЭК API: %s", exc)
        raise


async def get_access_token() -> str:
    return await asyncio.to_thread(_fetch_access_token_sync)


def _search_cities_sync(query: str, size: int = 15) -> list[dict[str, Any]]:
    if not query or len(query.strip()) < 2:
        return []

    token = _fetch_access_token_sync()
    api_url = _get_api_url()
    url = f"{api_url}/location/cities"
    headers = {"Authorization": f"Bearer {token}"}
    params = {
        "city": query.strip(),
        "country_codes": "RU",
        "size": size,
    }

    try:
        res = requests.get(url, headers=headers, params=params, timeout=10)
        res.raise_for_status()
        raw_cities = res.json()

        result = []
        for c in raw_cities:
            code = c.get("code")
            city_name = c.get("city")
            if code and city_name:
                result.append({
                    "code": int(code),
                    "city": city_name,
                    "region": c.get("region"),
                    "country": c.get("country", "Россия"),
                })
        return result
    except Exception as exc:
        logger.error("Ошибка поиска городов СДЭК по запросу '%s': %s", query, exc)
        return []


async def search_cities(query: str, size: int = 15) -> list[dict[str, Any]]:
    return await asyncio.to_thread(_search_cities_sync, query, size)


def _get_pvz_list_sync(city_code: int) -> list[dict[str, Any]]:
    token = _fetch_access_token_sync()
    api_url = _get_api_url()
    url = f"{api_url}/deliverypoints"
    headers = {"Authorization": f"Bearer {token}"}
    params = {
        "city_code": city_code,
        "type": "ALL",
    }

    try:
        res = requests.get(url, headers=headers, params=params, timeout=12)
        res.raise_for_status()
        raw_points = res.json()

        points = []
        for p in raw_points:
            code = p.get("code")
            name = p.get("name") or code
            loc = p.get("location") or {}
            address = loc.get("address") or ""
            address_full = loc.get("address_full") or address

            phones = p.get("phones") or []
            phone = phones[0].get("number") if phones else None

            if code and address:
                points.append({
                    "code": str(code),
                    "name": str(name),
                    "address": str(address),
                    "address_full": str(address_full),
                    "work_time": p.get("work_time"),
                    "phone": phone,
                    "note": p.get("note"),
                    "type": p.get("type", "PVZ"),
                })
        # Сортируем по адресу для удобства
        points.sort(key=lambda x: x["address"])
        return points
    except Exception as exc:
        logger.error("Ошибка получения ПВЗ СДЭК для города %s: %s", city_code, exc)
        return []


async def get_pvz_list(city_code: int) -> list[dict[str, Any]]:
    return await asyncio.to_thread(_get_pvz_list_sync, city_code)


def _calculate_delivery_sync(
    city_code: int,
    weight_grams: int = 1000,
    site_requisites: dict[str, Any] | None = None,
) -> dict[str, Any]:
    settings = get_settings()
    site_requisites = site_requisites or {}

    sender_city_code = int(
        site_requisites.get("cdek_sender_city_code")
        or settings.cdek_sender_city_code
        or 137
    )
    token = _fetch_access_token_sync()
    api_url = _get_api_url()

    url = f"{api_url}/calculator/tariff"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    # Тарифы СДЭК берутся из настроек договора (по умолчанию 136, 368, 234)
    tariffs_raw = (
        site_requisites.get("cdek_tariff_codes")
        or settings.cdek_tariff_codes
        or "136, 368, 234"
    )
    tariffs_to_try = [int(t.strip()) for t in str(tariffs_raw).split(",") if t.strip().isdigit()]
    if not tariffs_to_try:
        tariffs_to_try = [136, 368, 234]

    last_error = None
    for tariff_code in tariffs_to_try:
        body = {
            "tariff_code": tariff_code,
            "from_location": {"code": sender_city_code},
            "to_location": {"code": city_code},
            "packages": [
                {
                    "weight": max(100, weight_grams),
                    "length": 25,
                    "width": 20,
                    "height": 10,
                }
            ],
        }

        try:
            res = requests.post(url, headers=headers, json=body, timeout=10)
            if res.status_code == 200:
                data = res.json()
                total = data.get("total_sum") or data.get("delivery_sum")
                if total is not None:
                    return {
                        "delivery_sum": Decimal(str(total)),
                        "period_min": data.get("period_min"),
                        "period_max": data.get("period_max"),
                        "calendar_min": data.get("calendar_min"),
                        "calendar_max": data.get("calendar_max"),
                        "tariff_code": tariff_code,
                    }
            else:
                last_error = f"HTTP {res.status_code}"
                logger.warning("СДЭК тариф %s не доступен для города %s: %s", tariff_code, city_code, last_error)
        except Exception as exc:
            last_error = str(exc)
            logger.warning("СДЭК тариф %s не сработал для города %s: %s", tariff_code, city_code, exc)

    # Без молчаливого fallback: выбрасываем ошибку без секретных ключей
    logger.error("Не удалось рассчитать стоимость доставки СДЭК для города %s по тарифам %s", city_code, tariffs_to_try)
    raise RuntimeError("Не удалось рассчитать доставку, попробуйте позже")


async def calculate_delivery(
    city_code: int,
    weight_grams: int = 1000,
    site_requisites: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return await asyncio.to_thread(_calculate_delivery_sync, city_code, weight_grams, site_requisites)


# ── Создание и отслеживание заказов в СДЭК ───────────────────────────────────

def build_cdek_order_payload(
    order: Any,
    product_dimensions: dict[int, dict[str, Any]] | None = None,
    site_requisites: dict[str, str] | None = None,
    tariff_code: int | None = None,
) -> dict[str, Any]:
    """Формирует JSON-тело для регистрации заказа в СДЭК API v2."""
    settings = get_settings()
    site_requisites = site_requisites or {}
    product_dimensions = product_dimensions or {}

    tariff = tariff_code or settings.cdek_default_tariff_code or 136

    # Расчет веса и габаритов посылки
    cdek_items = []
    total_weight = 0
    max_len = settings.cdek_default_length
    max_w = settings.cdek_default_width
    total_h = 0

    items_list = getattr(order, "items", []) or []
    for idx, item in enumerate(items_list, start=1):
        dims = product_dimensions.get(item.product_id, {}) if item.product_id else {}
        w_item = dims.get("weight_grams") or 500
        l_item = dims.get("length_cm") or settings.cdek_default_length
        wd_item = dims.get("width_cm") or settings.cdek_default_width
        h_item = dims.get("height_cm") or 5

        total_weight += w_item * item.quantity
        max_len = max(max_len, l_item)
        max_w = max(max_w, wd_item)
        total_h += h_item * item.quantity

        cdek_items.append({
            "name": str(item.product_name)[:250],
            "ware_key": str(item.product_id or item.id or idx),
            "payment": {"value": 0.0},  # Оплачено онлайн (без оплаты при получении)
            "cost": float(item.product_price),
            "weight": max(10, int(w_item)),
            "amount": int(item.quantity),
        })

    package_weight = max(100, total_weight)
    package_height = max(5, min(total_h, 150)) if total_h > 0 else settings.cdek_default_height

    # Данные отправителя из SiteSettings или .env
    sender_name = (
        site_requisites.get("cdek_sender_name")
        or settings.cdek_sender_name
        or site_requisites.get("contact_legal_name")
        or "Мастерская Алдуин"
    )
    sender_phone = (
        site_requisites.get("cdek_sender_phone")
        or settings.cdek_sender_phone
        or site_requisites.get("contact_phone1")
        or "+79500082208"
    )
    sender_city_code = int(
        site_requisites.get("cdek_sender_city_code")
        or settings.cdek_sender_city_code
        or 137
    )
    delivery_type = (
        site_requisites.get("cdek_delivery_type")
        or settings.cdek_delivery_type
        or "pvz"
    ).strip().lower()

    payload: dict[str, Any] = {
        "type": 1,  # 1 — заказ интернет-магазина
        "number": str(order.order_id),
        "tariff_code": tariff,
        "comment": str(order.comment or f"Заказ {order.order_id}")[:250],
        "sender": {
            "name": sender_name,
            "phones": [{"number": sender_phone}],
        },
        "recipient": {
            "name": str(order.guest_name)[:128],
            "phones": [{"number": str(order.guest_phone)}],
        },
        "packages": [
            {
                "number": f"pkg-{order.order_id}",
                "weight": package_weight,
                "length": max_len,
                "width": max_w,
                "height": package_height,
                "comment": f"Посылка {order.order_id}",
                "items": cdek_items,
            }
        ],
    }

    # Способ передачи посылки: ПВЗ / склад или вызов курьера
    if delivery_type == "courier":
        sender_address = (
            site_requisites.get("cdek_sender_address")
            or settings.cdek_sender_address
        )
        if sender_address:
            payload["from_location"] = {
                "code": sender_city_code,
                "address": str(sender_address).strip(),
            }
    else:
        # Отправка из офиса/ПВЗ СДЭК
        sender_pvz = (
            site_requisites.get("cdek_sender_pvz_code")
            or settings.cdek_sender_pvz_code
        )
        if sender_pvz:
            payload["shipment_point"] = str(sender_pvz).strip()

    if order.guest_email:
        payload["recipient"]["email"] = str(order.guest_email).strip()

    # Точка выдачи получателю (ПВЗ)
    if order.pvz_code:
        payload["delivery_point"] = str(order.pvz_code).strip()
    elif order.delivery_address:
        payload["to_location"] = {"address": str(order.delivery_address).strip()}

    return payload


def _create_order_sync(payload: dict[str, Any]) -> dict[str, Any]:
    token = _fetch_access_token_sync()
    api_url = _get_api_url()
    url = f"{api_url}/orders"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    logger.info("Отправка запроса создания заказа СДЭК для order_id=%s", payload.get("number"))
    try:
        res = requests.post(url, json=payload, headers=headers, timeout=15)
        data = res.json()
    except Exception as exc:
        logger.error("Сетевая ошибка при обращении к СДЭК POST /orders: %s", exc)
        raise RuntimeError(f"Сетевая ошибка при обращении к СДЭК API: {exc}") from exc

    # Проверка ошибок валидации от СДЭК
    requests_list = data.get("requests", [])
    if requests_list:
        req0 = requests_list[0]
        state = req0.get("state")
        errors = req0.get("errors", [])
        if state == "INVALID" or errors:
            err_msg = "; ".join(f"{e.get('code', '')}: {e.get('message', '')}" for e in errors)
            logger.error("СДЭК отклонил создание заказа: %s", err_msg)
            raise RuntimeError(f"Ошибка валидации СДЭК: {err_msg}")

    entity = data.get("entity", {})
    uuid = entity.get("uuid")
    if not uuid:
        errs = data.get("errors", [])
        if errs:
            msg = "; ".join(f"{e.get('code', '')}: {e.get('message', '')}" for e in errs)
            raise RuntimeError(f"СДЭК вернул ошибку: {msg}")
        raise RuntimeError(f"СДЭК не вернул uuid созданного заказа")

    cdek_number = entity.get("cdek_number")
    logger.info("Заказ в СДЭК успешно зарегистрирован: uuid=%s, cdek_number=%s", uuid, cdek_number)
    return {
        "uuid": uuid,
        "cdek_number": cdek_number,
        "raw": data,
    }


async def create_cdek_order(payload: dict[str, Any]) -> dict[str, Any]:
    return await asyncio.to_thread(_create_order_sync, payload)


def _get_order_info_sync(uuid: str) -> dict[str, Any]:
    token = _fetch_access_token_sync()
    api_url = _get_api_url()
    url = f"{api_url}/orders/{uuid}"
    headers = {"Authorization": f"Bearer {token}"}

    try:
        res = requests.get(url, headers=headers, timeout=15)
        res.raise_for_status()
        data = res.json()
    except Exception as exc:
        logger.error("Ошибка запроса статуса СДЭК для uuid %s: %s", uuid, exc)
        raise RuntimeError(f"Ошибка запроса данных СДЭК: {exc}") from exc

    entity = data.get("entity", {})
    cdek_number = entity.get("cdek_number")

    statuses = entity.get("statuses", [])
    current_status = None
    if statuses:
        last = statuses[-1]
        current_status = last.get("name") or last.get("code")

    errors_list = []
    for r in data.get("requests", []):
        for e in r.get("errors", []):
            errors_list.append(f"{e.get('code', '')}: {e.get('message', '')}")

    return {
        "uuid": entity.get("uuid") or uuid,
        "cdek_number": cdek_number,
        "status": current_status or "ACCEPTED",
        "errors": errors_list,
        "raw": data,
    }


async def get_cdek_order_info(uuid: str) -> dict[str, Any]:
    return await asyncio.to_thread(_get_order_info_sync, uuid)


def _poll_cdek_number_sync(uuid: str, max_attempts: int = 8, delay: float = 2.0) -> dict[str, Any]:
    """Опрашивает GET /v2/orders/{uuid}, пока не появится cdek_number (с ограниченным числом попыток и логированием)."""
    last_info: dict[str, Any] = {"uuid": uuid, "cdek_number": None, "status": "WAITING"}

    for attempt in range(1, max_attempts + 1):
        try:
            info = _get_order_info_sync(uuid)
            last_info = info
            if info.get("errors"):
                err_text = "; ".join(info["errors"])
                logger.error("СДЭК вернул ошибку при обработке заказа %s: %s", uuid, err_text)
                raise RuntimeError(f"Ошибка СДЭК: {err_text}")

            cdek_num = info.get("cdek_number")
            if cdek_num:
                logger.info(
                    "Успешно получен трек-номер СДЭК %s для uuid %s (попытка %d/%d)",
                    cdek_num, uuid, attempt, max_attempts
                )
                return info

            logger.info(
                "Ожидание присвоения трек-номера СДЭК для uuid %s (попытка %d/%d)...",
                uuid, attempt, max_attempts
            )
        except Exception as exc:
            if "Ошибка СДЭК:" in str(exc):
                raise
            logger.warning(
                "Сбой при опросе СДЭК для uuid %s (попытка %d/%d): %s",
                uuid, attempt, max_attempts, exc
            )

        if attempt < max_attempts:
            time.sleep(delay)

    logger.warning("Трек-номер СДЭК для uuid %s не появился за %d попыток.", uuid, max_attempts)
    return last_info


async def poll_cdek_number(uuid: str, max_attempts: int = 8, delay: float = 2.0) -> dict[str, Any]:
    return await asyncio.to_thread(_poll_cdek_number_sync, uuid, max_attempts, delay)


def _get_print_form_url_sync(cdek_order_uuid: str, form_type: str = "orders") -> str | None:
    """Запрашивает формирование печатной формы (квитанция/ярлык) через API СДЭК."""
    token = _fetch_access_token_sync()
    api_url = _get_api_url()

    # form_type: 'orders' (квитанция) или 'barcodes' (штрихкод места/ярлык)
    endpoint = "orders" if form_type == "orders" else "barcodes"
    url = f"{api_url}/print/{endpoint}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    body: dict[str, Any] = {
        "orders": [{"order_uuid": cdek_order_uuid}],
        "copy_count": 1,
    }
    if endpoint == "barcodes":
        body["format"] = "A4"

    try:
        res = requests.post(url, json=body, headers=headers, timeout=15)
        if res.status_code not in (200, 202):
            logger.warning("СДЭК вернул статус %s при создании печатной формы", res.status_code)
            return None
        data = res.json()
        print_uuid = data.get("entity", {}).get("uuid")
        if not print_uuid:
            return None

        # Опрос готовности ссылки на PDF файл (до 5 попыток)
        check_url = f"{api_url}/print/{endpoint}/{print_uuid}"
        for _ in range(5):
            time.sleep(1.5)
            st_res = requests.get(check_url, headers={"Authorization": f"Bearer {token}"}, timeout=10)
            if st_res.status_code == 200:
                st_data = st_res.json()
                pdf_url = st_data.get("entity", {}).get("url")
                if pdf_url:
                    return pdf_url
        return None
    except Exception as exc:
        logger.warning("Не удалось получить печатную форму СДЭК: %s", exc)
        return None


async def get_print_form_url(cdek_order_uuid: str, form_type: str = "orders") -> str | None:
    return await asyncio.to_thread(_get_print_form_url_sync, cdek_order_uuid, form_type)

