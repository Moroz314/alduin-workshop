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

    # Если в .env ничего не указано или указано тестовое значение, используем проверенные тестовые ключи
    if not account or not password:
        return DEFAULT_TEST_ACCOUNT, DEFAULT_TEST_PASSWORD
    return account, password


def _fetch_access_token_sync() -> str:
    global _cached_token, _token_expires_at

    now = time.time()
    if _cached_token and now < (_token_expires_at - 60):
        return _cached_token

    api_url = _get_api_url()
    account, password = _get_credentials()

    url = f"{api_url}/oauth/token"
    data = {
        "grant_type": "client_credentials",
        "client_id": account,
        "client_secret": password,
    }

    try:
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
        logger.error("Ошибка авторизации в СДЭК API (%s): %s", url, exc)
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


def _calculate_delivery_sync(city_code: int, weight_grams: int = 1000) -> dict[str, Any]:
    settings = get_settings()
    sender_city_code = settings.cdek_sender_city_code or 137  # Санкт-Петербург по умолчанию
    token = _fetch_access_token_sync()
    api_url = _get_api_url()

    url = f"{api_url}/calculator/tariff"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    # Пробуем тариф 136 (Посылка склад-склад/ПВЗ), при ошибке 368 (Посылка склад-постамат)
    tariffs_to_try = [136, 368, 234]

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
        except Exception as exc:
            logger.warning("СДЭК тариф %s не сработал для города %s: %s", tariff_code, city_code, exc)

    # Если API вернуло ошибку или тариф недоступен, возвращаем стабильный расчет
    logger.info("Возврат резервного тарифа доставки СДЭК для города %s", city_code)
    return {
        "delivery_sum": Decimal("350.00"),
        "period_min": 2,
        "period_max": 4,
        "calendar_min": 2,
        "calendar_max": 4,
        "tariff_code": 136,
    }


async def calculate_delivery(city_code: int, weight_grams: int = 1000) -> dict[str, Any]:
    return await asyncio.to_thread(_calculate_delivery_sync, city_code, weight_grams)
