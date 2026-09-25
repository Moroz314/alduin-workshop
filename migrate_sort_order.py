"""
Миграция: добавление поля sort_order в таблицу products
и автозаполнение текущего порядка (по возрастанию id в рамках категорий).

Запуск:
    .venv/Scripts/python migrate_sort_order.py
"""
import sys
import asyncio
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import sqlalchemy as sa
from app.database import engine


async def run_migration():
    print("Применение миграции sort_order...")
    async with engine.begin() as conn:
        await conn.execute(
            sa.text("ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;")
        )
        print("Колонка sort_order проверена/добавлена.")

        # Автозаполнение существующего порядка (по id внутри категорий)
        res = await conn.execute(
            sa.text("""
                UPDATE products
                SET sort_order = sub.rn
                FROM (
                    SELECT id, ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY id ASC) AS rn
                    FROM products
                ) sub
                WHERE products.id = sub.id AND (products.sort_order = 0 OR products.sort_order IS NULL);
            """)
        )
        print(f"Обновлено товаров: {res.rowcount}")

        await conn.execute(
            sa.text("CREATE INDEX IF NOT EXISTS ix_products_sort_order ON products (sort_order);")
        )
        print("Индекс ix_products_sort_order проверен/создан.")

        # Категории
        await conn.execute(
            sa.text("ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;")
        )
        print("Колонка sort_order у categories проверена/добавлена.")

        res_cat = await conn.execute(
            sa.text("""
                UPDATE categories
                SET sort_order = sub.rn
                FROM (
                    SELECT id, ROW_NUMBER() OVER (ORDER BY id ASC) AS rn
                    FROM categories
                ) sub
                WHERE categories.id = sub.id AND (categories.sort_order = 0 OR categories.sort_order IS NULL);
            """)
        )
        print(f"Обновлено категорий: {res_cat.rowcount}")

        await conn.execute(
            sa.text("CREATE INDEX IF NOT EXISTS ix_categories_sort_order ON categories (sort_order);")
        )
        print("Индекс ix_categories_sort_order проверен/создан.")

    await engine.dispose()
    print("Миграция sort_order успешно завершена!")


if __name__ == "__main__":
    asyncio.run(run_migration())
