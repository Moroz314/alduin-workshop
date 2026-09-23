"""Delivery endpoints (CDEK)."""
from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException, Query, status

from app.schemas import (
    CdekCityRead,
    CdekPvzRead,
    DeliveryCalculateRequest,
    DeliveryCalculateResponse,
)
from app.services import cdek_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/cities", response_model=list[CdekCityRead], summary="Поиск городов СДЭК")
async def search_cities(
    query: str = Query(..., min_length=2, description="Название города для поиска")
) -> list[CdekCityRead]:
    try:
        cities = await cdek_service.search_cities(query)
        return [CdekCityRead(**c) for c in cities]
    except Exception as exc:
        logger.error("Ошибка при поиске городов СДЭК: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Не удалось выполнить поиск городов СДЭК",
        ) from exc


@router.get("/pvz", response_model=list[CdekPvzRead], summary="Список ПВЗ в городе")
async def get_pvz(
    city_code: int = Query(..., description="Код города СДЭК")
) -> list[CdekPvzRead]:
    try:
        points = await cdek_service.get_pvz_list(city_code)
        return [CdekPvzRead(**p) for p in points]
    except Exception as exc:
        logger.error("Ошибка при получении ПВЗ СДЭК для города %s: %s", city_code, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Не удалось получить список пунктов выдачи СДЭК",
        ) from exc


@router.post("/calculate", response_model=DeliveryCalculateResponse, summary="Расчет стоимости доставки СДЭК")
async def calculate_delivery(
    payload: DeliveryCalculateRequest
) -> DeliveryCalculateResponse:
    try:
        result = await cdek_service.calculate_delivery(
            city_code=payload.city_code,
            weight_grams=payload.weight_grams,
        )
        return DeliveryCalculateResponse(**result)
    except Exception as exc:
        logger.error("Ошибка при расчете доставки СДЭК: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Не удалось рассчитать стоимость доставки СДЭК",
        ) from exc
