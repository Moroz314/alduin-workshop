"""
Скрипт заполнения БД тестовыми данными.
Запуск: .venv/Scripts/python seed.py
"""
import sys
import asyncio
sys.stdout.reconfigure(encoding='utf-8')
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.models import Category, Product


CATEGORIES = [
    {"name": "Кожаные изделия", "slug": "leather"},
    {"name": "Кованые изделия", "slug": "forged"},
    {"name": "Украшения",        "slug": "jewelry"},
]

PRODUCTS = [
    # Кожа
    {
        "name": "Кошелёк «Берсерк»",
        "slug": "wallet-berserk",
        "price": "2490.00",
        "description": "Кошелёк из натуральной кожи растительного дубления. Ручная прошивка вощёной нитью, латунная фурнитура. Со временем приобретает благородную патину.",
        "image_url": None,
        "in_stock": True,
        "category_slug": "leather",
    },
    {
        "name": "Ремень «Вальхалла»",
        "slug": "belt-valhalla",
        "price": "3200.00",
        "description": "Широкий ремень из кожи быка 4 мм. Кованая пряжка ручной работы, тиснение рунических орнаментов.",
        "image_url": None,
        "in_stock": True,
        "category_slug": "leather",
    },
    {
        "name": "Сумка «Скальд»",
        "slug": "bag-skald",
        "price": "8900.00",
        "description": "Вместительная сумка-мессенджер из толстой кожи. Латунные заклёпки, двойное дно, регулируемый ремень.",
        "image_url": None,
        "in_stock": True,
        "category_slug": "leather",
    },
    {
        "name": "Обложка «Один»",
        "slug": "cover-odin",
        "price": "1590.00",
        "description": "Обложка для паспорта из кожи крейзи-хорс. Тиснение символа Одина, два кармана для карт.",
        "image_url": None,
        "in_stock": False,
        "category_slug": "leather",
    },
    # Ковка
    {
        "name": "Нож «Ульфберт»",
        "slug": "knife-ulfberht",
        "price": "12500.00",
        "description": "Клинок из кованой стали 95Х18. Рукоять из мореного дуба и латуни. Кожаные ножны в комплекте.",
        "image_url": None,
        "in_stock": True,
        "category_slug": "forged",
    },
    {
        "name": "Подставка «Кузница»",
        "slug": "stand-forge",
        "price": "4700.00",
        "description": "Кованая подставка для телефона и ключей. Металл с эффектом «старое железо», патинирование.",
        "image_url": None,
        "in_stock": True,
        "category_slug": "forged",
    },
    {
        "name": "Крюки «Йотун»",
        "slug": "hooks-jotun",
        "price": "2100.00",
        "description": "Комплект из 3 кованых крюков для верхней одежды. Монтаж на деревянную планку (в комплекте).",
        "image_url": None,
        "in_stock": True,
        "category_slug": "forged",
    },
    # Украшения
    {
        "name": "Кулон «Мьёльнир»",
        "slug": "pendant-mjolnir",
        "price": "3800.00",
        "description": "Молот Тора из кованой бронзы. Покрытие — чернёное серебро, шнур из натуральной кожи.",
        "image_url": None,
        "in_stock": True,
        "category_slug": "jewelry",
    },
    {
        "name": "Браслет «Руны»",
        "slug": "bracelet-runes",
        "price": "2200.00",
        "description": "Кожаный браслет с кованой пластиной. Гравировка рунического алфавита Старший Футарк.",
        "image_url": None,
        "in_stock": True,
        "category_slug": "jewelry",
    },
]


async def seed():
    async with AsyncSessionLocal() as session:
        # Проверяем — не засеяно ли уже
        result = await session.execute(text("SELECT COUNT(*) FROM categories"))
        count = result.scalar()
        if count > 0:
            print(f"⚠️  БД уже содержит {count} категорий. Пропускаем.")
            return

        # Категории
        cat_map = {}
        for cat_data in CATEGORIES:
            cat = Category(name=cat_data["name"], slug=cat_data["slug"])
            session.add(cat)
            await session.flush()  # получаем id
            cat_map[cat_data["slug"]] = cat.id
            print(f"  + Категория: {cat.name}")

        # Товары
        for p_data in PRODUCTS:
            product = Product(
                name=p_data["name"],
                slug=p_data["slug"],
                price=p_data["price"],
                description=p_data["description"],
                image_url=p_data["image_url"],
                in_stock=p_data["in_stock"],
                category_id=cat_map[p_data["category_slug"]],
            )
            session.add(product)
            stock = "+" if p_data["in_stock"] else "-"
            print(f"  [{stock}] Товар: {product.name} — {product.price} руб.")

        await session.commit()
        print(f"\n>>> Готово! Добавлено {len(CATEGORIES)} категорий и {len(PRODUCTS)} товаров.")


if __name__ == "__main__":
    asyncio.run(seed())
