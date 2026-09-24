"""
PATCH /api/admin/settings/ — защищённый endpoint для обновления настроек.

Принимает словарь ключ→значение.
Разрешены только ключи из whitelist.
URL-поля валидируются (только http/https).
"""
import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_admin
from app.models import SiteSettings, AdminUser
from app.routers.settings import ALLOWED_KEYS, DEFAULTS

router = APIRouter()

# Ключи, значение которых должно быть валидным URL (или пустой строкой)
URL_KEYS: set[str] = {"social_vk", "social_tg", "social_yt", "social_rutube", "developer_url"}

_URL_RE = re.compile(r"^https?://[^\s]{3,}$", re.IGNORECASE)


class SettingsUpdate(BaseModel):
    """Словарь настроек для обновления."""
    settings: dict[str, str]

    @model_validator(mode="after")
    def validate_keys_and_urls(self) -> "SettingsUpdate":
        for key, value in self.settings.items():
            # Whitelist
            if key not in ALLOWED_KEYS:
                raise ValueError(f"Недопустимый ключ настройки: '{key}'")
            # URL-валидация для ссылок на соцсети (пустая строка допустима)
            if key in URL_KEYS and value and not _URL_RE.match(value):
                raise ValueError(
                    f"Поле '{key}' должно содержать корректный URL (http:// или https://) "
                    f"или быть пустым"
                )
        return self


@router.get("/", summary="Получить все настройки (для admin-панели)")
async def admin_get_settings(
    db: AsyncSession = Depends(get_db),
    _: Annotated[AdminUser, Depends(get_current_admin)] = None,
) -> dict[str, str]:
    from sqlalchemy import select
    result = await db.execute(select(SiteSettings))
    rows: dict[str, str] = {row.key: row.value for row in result.scalars().all()}
    # Возвращаем значения по умолчанию для отсутствующих ключей
    return {key: rows.get(key, default) for key, default in DEFAULTS.items()}


@router.patch("/", summary="Обновить настройки сайта")
async def update_settings(
    body: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _: Annotated[AdminUser, Depends(get_current_admin)] = None,
) -> dict[str, str]:
    """Обновляет переданные ключи (upsert). Остальные ключи не трогает."""
    for key, value in body.settings.items():
        existing = await db.get(SiteSettings, key)
        if existing is None:
            db.add(SiteSettings(key=key, value=value))
        else:
            existing.value = value
    await db.commit()

    # Возвращаем обновлённое состояние
    from sqlalchemy import select
    result = await db.execute(select(SiteSettings))
    rows: dict[str, str] = {row.key: row.value for row in result.scalars().all()}
    return {key: rows.get(key, default) for key, default in DEFAULTS.items()}
