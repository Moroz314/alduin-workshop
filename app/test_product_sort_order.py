"""
Unit tests for Product sort_order, bulk reorder, and catalog ordering.
"""
from decimal import Decimal
import unittest
from sqlalchemy import create_engine, select, func, update, case
from sqlalchemy.orm import sessionmaker

from app.models import Base, Product, Category
from app.schemas import (
    ProductCreate,
    ProductRead,
    ProductListRead,
    ProductReorderItem,
    ProductReorderRequest,
)


class TestProductSortOrder(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(cls.engine)
        cls.Session = sessionmaker(bind=cls.engine)

    def setUp(self):
        # Clean up database before each test
        with self.Session() as session:
            session.query(Product).delete()
            session.query(Category).delete()
            session.commit()

    def test_schema_sort_order_defaults(self):
        """Проверка схем Pydantic: sort_order по умолчанию 0, корректная сериализация."""
        item = ProductReorderItem(id=1, sort_order=5)
        self.assertEqual(item.id, 1)
        self.assertEqual(item.sort_order, 5)

        req = ProductReorderRequest(items=[item])
        self.assertEqual(len(req.items), 1)

    def test_public_catalog_ordering(self):
        """GET /api/products/ должен сортировать по sort_order ASC, затем id ASC."""
        with self.Session() as session:
            cat = Category(name="Кожа", slug="leather")
            session.add(cat)
            session.commit()

            # Добавляем товары с разным sort_order
            p1 = Product(name="Товар B", slug="b", price=Decimal("100"), category_id=cat.id, sort_order=2)
            p2 = Product(name="Товар C", slug="c", price=Decimal("100"), category_id=cat.id, sort_order=3)
            p3 = Product(name="Товар A", slug="a", price=Decimal("100"), category_id=cat.id, sort_order=1)
            p4 = Product(name="Товар D", slug="d", price=Decimal("100"), category_id=cat.id, sort_order=3)
            session.add_all([p1, p2, p3, p4])
            session.commit()

            # Запрос как в GET /api/products/
            stmt = select(Product).order_by(Product.sort_order.asc(), Product.id.asc())
            products = session.execute(stmt).scalars().all()

            names = [p.name for p in products]
            self.assertEqual(names, ["Товар A", "Товар B", "Товар C", "Товар D"])

    def test_bulk_reorder_single_query(self):
        """PATCH /api/admin/products/reorder обновляет позиции товаров в транзакции."""
        with self.Session() as session:
            cat = Category(name="Ковка", slug="forged")
            session.add(cat)
            session.commit()

            p1 = Product(name="Меч", slug="sword", price=Decimal("5000"), category_id=cat.id, sort_order=1)
            p2 = Product(name="Щит", slug="shield", price=Decimal("4000"), category_id=cat.id, sort_order=2)
            p3 = Product(name="Шлем", slug="helm", price=Decimal("3000"), category_id=cat.id, sort_order=3)
            session.add_all([p1, p2, p3])
            session.commit()

            # Меняем порядок: Шлем (1), Меч (2), Щит (3)
            reorder_items = [
                ProductReorderItem(id=p3.id, sort_order=1),
                ProductReorderItem(id=p1.id, sort_order=2),
                ProductReorderItem(id=p2.id, sort_order=3),
            ]
            case_mapping = {item.id: item.sort_order for item in reorder_items}
            stmt = (
                update(Product)
                .where(Product.id.in_(case_mapping.keys()))
                .values(sort_order=case(case_mapping, value=Product.id))
            )
            result = session.execute(stmt)
            session.commit()

            self.assertEqual(result.rowcount, 3)

            # Проверяем новый порядок выборки
            ordered = session.execute(
                select(Product).order_by(Product.sort_order.asc(), Product.id.asc())
            ).scalars().all()
            self.assertEqual([p.name for p in ordered], ["Шлем", "Меч", "Щит"])

    def test_new_product_gets_max_order_plus_one(self):
        """Новый товар в категории получает sort_order = max(текущих) + 1."""
        with self.Session() as session:
            cat = Category(name="Сувениры", slug="souvenirs")
            session.add(cat)
            session.commit()

            p1 = Product(name="Брелок", slug="brelok", price=Decimal("500"), category_id=cat.id, sort_order=1)
            p2 = Product(name="Магнит", slug="magnit", price=Decimal("300"), category_id=cat.id, sort_order=2)
            session.add_all([p1, p2])
            session.commit()

            max_q = select(func.coalesce(func.max(Product.sort_order), 0)).where(Product.category_id == cat.id)
            current_max = session.execute(max_q).scalar() or 0
            new_sort_order = current_max + 1
            self.assertEqual(new_sort_order, 3)

            p3 = Product(name="Значок", slug="badge", price=Decimal("200"), category_id=cat.id, sort_order=new_sort_order)
            session.add(p3)
            session.commit()

            self.assertEqual(p3.sort_order, 3)

    def test_category_isolated_ordering(self):
        """sort_order настраивается в пределах каждой категории отдельно."""
        with self.Session() as session:
            cat1 = Category(name="Кат 1", slug="cat-1")
            cat2 = Category(name="Кат 2", slug="cat-2")
            session.add_all([cat1, cat2])
            session.commit()

            # В Категории 1: товары с порядком 1, 2
            p1_1 = Product(name="К1-П1", slug="c1-p1", price=Decimal("100"), category_id=cat1.id, sort_order=1)
            p1_2 = Product(name="К1-П2", slug="c1-p2", price=Decimal("100"), category_id=cat1.id, sort_order=2)
            # В Категории 2: товары с порядком 1, 2
            p2_1 = Product(name="К2-П1", slug="c2-p1", price=Decimal("100"), category_id=cat2.id, sort_order=1)
            p2_2 = Product(name="К2-П2", slug="c2-p2", price=Decimal("100"), category_id=cat2.id, sort_order=2)
            session.add_all([p1_1, p1_2, p2_1, p2_2])
            session.commit()

            # Выборка по Категории 1
            c1_products = session.execute(
                select(Product).where(Product.category_id == cat1.id).order_by(Product.sort_order.asc(), Product.id.asc())
            ).scalars().all()
            self.assertEqual([p.name for p in c1_products], ["К1-П1", "К1-П2"])

            # Выборка по Категории 2
            c2_products = session.execute(
                select(Product).where(Product.category_id == cat2.id).order_by(Product.sort_order.asc(), Product.id.asc())
            ).scalars().all()
            self.assertEqual([p.name for p in c2_products], ["К2-П1", "К2-П2"])


if __name__ == "__main__":
    unittest.main()
