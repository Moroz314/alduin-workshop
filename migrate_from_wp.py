"""Migrate products from the old WordPress site into the local PostgreSQL database.

Run from the project root:
    .venv\\Scripts\\python.exe migrate_from_wp.py

The script is intentionally additive: an existing local product with the same
slug is skipped and no local records are deleted or overwritten.
"""
from __future__ import annotations

import argparse
import html
import re
import sys
import unicodedata
import uuid
from decimal import Decimal, InvalidOperation
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests
from sqlalchemy import select

from app.database import AsyncSessionLocal, engine
from app.models import Product

DEFAULT_API_URL = "https://alduin-workshop.ru/wp-json/wp/v2/product"
UPLOAD_DIR = Path("uploads/products")
PUBLIC_UPLOAD_PREFIX = "/uploads/products"
REQUEST_TIMEOUT = (10, 60)


class TextExtractor(HTMLParser):
    """Convert WordPress rendered HTML into readable plain text."""

    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)

    def text(self) -> str:
        return re.sub(r"\s+", " ", html.unescape(" ".join(self.parts))).strip()


def html_to_text(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    parser = TextExtractor()
    parser.feed(value)
    return parser.text()


def first_value(data: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = data.get(key)
        if value not in (None, "", [], {}):
            return value
    return None


def find_price(product: dict[str, Any]) -> Decimal | None:
    """Read price from common WooCommerce/custom-field response shapes."""
    candidates: list[Any] = []
    for container in (
        product,
        product.get("meta", {}),
        product.get("acf", {}),
        product.get("woocommerce", {}),
    ):
        if isinstance(container, dict):
            candidates.extend(
                container.get(key)
                for key in ("price", "regular_price", "sale_price", "product_price")
            )

    price_html = product.get("price_html")
    if isinstance(price_html, str):
        candidates.append(price_html)

    for candidate in candidates:
        if candidate in (None, ""):
            continue
        if isinstance(candidate, (int, float, Decimal)):
            raw = str(candidate)
        else:
            raw = str(candidate).replace("\xa0", " ")
        match = re.search(r"\d[\d\s.,]*", raw)
        if not match:
            continue
        normalized = match.group(0).replace(" ", "").replace("\u202f", "")
        if "," in normalized and "." in normalized:
            decimal_separator = "," if normalized.rfind(",") > normalized.rfind(".") else "."
            thousands_separator = "." if decimal_separator == "," else ","
            normalized = normalized.replace(thousands_separator, "").replace(decimal_separator, ".")
        else:
            normalized = normalized.replace(",", ".")
        try:
            price = Decimal(normalized)
        except InvalidOperation:
            continue
        if price > 0:
            return price.quantize(Decimal("0.01"))
    return None


def slugify(value: str, fallback_id: Any) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
    return value[:240] or f"wp-product-{fallback_id}"


def image_url_from_product(product: dict[str, Any]) -> str | None:
    embedded = product.get("_embedded", {})
    media_items = embedded.get("wp:featuredmedia", []) if isinstance(embedded, dict) else []
    if media_items and isinstance(media_items[0], dict):
        source_url = media_items[0].get("source_url")
        if source_url:
            return source_url

    links = product.get("_links", {})
    media_links = links.get("wp:featuredmedia", []) if isinstance(links, dict) else []
    if media_links and isinstance(media_links[0], dict):
        return media_links[0].get("href")
    return None


def image_extension(response: requests.Response, source_url: str) -> str:
    content_type = response.headers.get("Content-Type", "").split(";", 1)[0].lower()
    extensions = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
        "image/avif": ".avif",
    }
    if content_type in extensions:
        return extensions[content_type]
    suffix = Path(urlparse(source_url).path).suffix.lower()
    return suffix if suffix in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"} else ".jpg"


def download_image(session: requests.Session, source_url: str, product_id: Any) -> str | None:
    try:
        response = session.get(source_url, timeout=REQUEST_TIMEOUT, stream=True)
        response.raise_for_status()
        content_type = response.headers.get("Content-Type", "").lower()
        if "application/json" in content_type:
            media_data = response.json()
            media_url = media_data.get("source_url") if isinstance(media_data, dict) else None
            response.close()
            if media_url and media_url != source_url:
                return download_image(session, media_url, product_id)
            print(f"  ! Не найден source_url изображения товара {product_id}")
            return None
        if content_type and not content_type.startswith("image/"):
            print(f"  ! Изображение товара {product_id} имеет тип {content_type}, пропускаю фото")
            return None

        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        filename = f"wp-{uuid.uuid4().hex}{image_extension(response, source_url)}"
        destination = UPLOAD_DIR / filename
        with destination.open("wb") as file:
            for chunk in response.iter_content(chunk_size=1024 * 128):
                if chunk:
                    file.write(chunk)
        return f"{PUBLIC_UPLOAD_PREFIX}/{filename}"
    except requests.RequestException as error:
        print(f"  ! Не удалось скачать изображение товара {product_id}: {error}")
        return None


def fetch_products(http: requests.Session, api_url: str, per_page: int) -> list[dict[str, Any]]:
    products: list[dict[str, Any]] = []
    page = 1
    while True:
        response = http.get(
            api_url,
            params={"page": page, "per_page": per_page, "_embed": "1", "status": "publish"},
            timeout=REQUEST_TIMEOUT,
        )
        if response.status_code == 400 and page > 1:
            break
        response.raise_for_status()
        batch = response.json()
        if not isinstance(batch, list):
            raise RuntimeError("WordPress API вернул неожиданный формат данных")
        products.extend(item for item in batch if isinstance(item, dict))
        total_pages = int(response.headers.get("X-WP-TotalPages", page))
        print(f"Получена страница {page}/{total_pages}: {len(batch)} товаров")
        if page >= total_pages or not batch:
            break
        page += 1
    return products


async def migrate(products: list[dict[str, Any]], http: requests.Session) -> tuple[int, int, int]:
    created = skipped = failed = 0
    async with AsyncSessionLocal() as db:
        for source in products:
            source_id = source.get("id", "unknown")
            title_data = source.get("title", {})
            name = html_to_text(title_data.get("rendered", "")) if isinstance(title_data, dict) else ""
            price = find_price(source)
            slug = slugify(str(source.get("slug") or name), source_id)

            if not name:
                print(f"- Товар {source_id}: пропуск, нет названия")
                failed += 1
                continue
            if price is None:
                print(f"- {name}: пропуск, цена не указана")
                skipped += 1
                continue

            exists = await db.scalar(select(Product).where(Product.slug == slug))
            if exists:
                print(f"= {name}: уже существует, пропуск")
                skipped += 1
                continue

            try:
                content = source.get("content", {})
                description = html_to_text(content.get("rendered", "")) if isinstance(content, dict) else ""
                source_image_url = image_url_from_product(source)
                local_image_url = download_image(http, source_image_url, source_id) if source_image_url else None
                if not source_image_url:
                    print(f"  ! {name}: главное изображение отсутствует")

                db.add(Product(
                    name=name,
                    slug=slug,
                    price=price,
                    description=description or None,
                    image_url=local_image_url,
                    in_stock=True,
                ))
                await db.commit()
                print(f"+ {name}: добавлен")
                created += 1
            except Exception as error:
                await db.rollback()
                print(f"! {name}: ошибка миграции: {error}")
                failed += 1
    return created, skipped, failed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Перенос товаров из WordPress в PostgreSQL")
    parser.add_argument("--api-url", default=DEFAULT_API_URL, help="URL WordPress REST API")
    parser.add_argument("--per-page", type=int, default=100, choices=range(1, 101), metavar="N")
    return parser.parse_args()


async def main() -> int:
    args = parse_args()
    try:
        with requests.Session() as http:
            http.headers.update({"User-Agent": "AlduinWorkshopMigration/1.0"})
            products = fetch_products(http, args.api_url, args.per_page)
            print(f"Всего товаров WordPress: {len(products)}")
            created, skipped, failed = await migrate(products, http)
        print(f"Готово: добавлено {created}, пропущено {skipped}, ошибок {failed}")
        return 1 if failed else 0
    finally:
        await engine.dispose()


if __name__ == "__main__":
    try:
        import asyncio
        raise SystemExit(asyncio.run(main()))
    except requests.RequestException as error:
        print(f"Ошибка WordPress API: {error}", file=sys.stderr)
        raise SystemExit(1)
    except KeyboardInterrupt:
        print("Миграция прервана", file=sys.stderr)
        raise SystemExit(130)
