"""
GET /api/settings/ — публичный endpoint.

Возвращает только ключи из ALLOWED_KEYS (whitelist).
Если ключ не найден в БД — возвращает значение по умолчанию из DEFAULTS.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import SiteSettings

router = APIRouter()

# ── Whitelist разрешённых публичных ключей ────────────────────────────────────
ALLOWED_KEYS: set[str] = {
    "about_title",
    "about_text",
    "contact_text",
    "contact_phone1",
    "contact_phone2",
    "contact_address",
    "contact_inn",
    "contact_ogrnip",
    "social_vk",
    "social_tg",
    "social_yt",
    "social_rutube",
    "warranty_return_title",
    "warranty_return_text",
    "warranty_period_title",
    "warranty_period_text",
    "developer_name",
    "developer_url",
}

# ── Значения по умолчанию (используются пока таблица пуста) ──────────────────
DEFAULTS: dict[str, str] = {
    "about_title": "О мастерской",
    "about_text": (
        "Мастерская Алдуин — это небольшая мастерская, которая является объединением "
        "друзей и мастеров, экспертов в своём деле. Мы делаем изделия из металла, дерева "
        "и кожи. Все изделия сделаны вручную, с любовью к ремеслу и уважением к традициям."
    ),
    "contact_text": "Купить готовые изделия или заказать что-то нестандартное можно по телефонам:",
    "contact_phone1": "+79500082208",
    "contact_phone2": "+79202091993",
    "contact_address": "Петергоф, Ропшинское ш., 8Г, 198517",
    "contact_inn": "780534396013",
    "contact_ogrnip": "325784700428266",
    "social_vk": "https://vk.com/alduin_workshop",
    "social_tg": "https://t.me/alduin_workshop",
    "social_yt": "https://youtube.com/@alduln_workshop?si=F9XkPmBBNxbPs9e2",
    "social_rutube": "https://rutube.ru/channel/48354889",
    "warranty_return_title": "Возврат товара",
    "warranty_return_text": (
        "Дорогие покупатели Мастерской Алдуин! В соответствии со ст. 26.1 Закона "
        "«О защите прав потребителей» вы можете вернуть товар, если он не относится "
        "к категории изделий с индивидуально-определёнными свойствами, не был в употреблении, "
        "полностью сохранены его товарный вид, потребительские качества, все бирки, "
        "документы об оплате и заводская упаковка."
    ),
    "warranty_period_title": "Гарантийный срок",
    "warranty_period_text": (
        "Срок гарантии — 12 месяцев. Если за этот период обнаружится производственный брак, "
        "мы проведём бесплатный ремонт. В случае невозможности ремонта — заменим изделие "
        "новым аналогом либо вернём полную стоимость. Гарантия не действует при естественном "
        "износе, возникшем в процессе использования, а также при поломках из-за неправильной "
        "эксплуатации. Мы дорожим своей репутацией и делаем всё, чтобы вы остались довольны "
        "качеством нашей продукции."
    ),
    "developer_name": "Владислав Морозов",
    "developer_url": "http://x90461p7.beget.tech/",
}


@router.get("/", summary="Публичные настройки сайта")
async def get_settings(db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    """Возвращает словарь настроек с публичным whitelist ключей."""
    result = await db.execute(
        select(SiteSettings).where(SiteSettings.key.in_(ALLOWED_KEYS))
    )
    rows: dict[str, str] = {row.key: row.value for row in result.scalars().all()}

    # Применяем значения по умолчанию для отсутствующих ключей
    return {key: rows.get(key, default) for key, default in DEFAULTS.items()}
