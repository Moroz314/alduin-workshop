"""
Tests for YooKassa return_url builder, public order status endpoint,
payment retry, and webhook payment.canceled handling.
"""
from __future__ import annotations

import unittest
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

from app.models import Order, OrderItem, OrderStatus
from app.services.payment_service import build_yookassa_return_url, _build_receipt


class TestOrderSuccessFlow(unittest.IsolatedAsyncioTestCase):

    def test_build_yookassa_return_url_placeholder(self):
        """Проверка подстановки {order_id} в return_url."""
        with patch("app.services.payment_service.get_settings") as mock_settings:
            mock_settings.return_value.yookassa_return_url = "https://alduin-workshop.ru/order/success/{order_id}"
            url = build_yookassa_return_url("ORD-12345678")
            self.assertEqual(url, "https://alduin-workshop.ru/order/success/ORD-12345678")

    def test_build_yookassa_return_url_colon_placeholder(self):
        """Проверка подстановки :orderId в return_url."""
        with patch("app.services.payment_service.get_settings") as mock_settings:
            mock_settings.return_value.yookassa_return_url = "https://alduin-workshop.ru/order/success/:orderId"
            url = build_yookassa_return_url("ORD-12345678")
            self.assertEqual(url, "https://alduin-workshop.ru/order/success/ORD-12345678")

    def test_build_yookassa_return_url_without_placeholder(self):
        """Проверка добавления order_id, если плейсхолдер не был указан."""
        with patch("app.services.payment_service.get_settings") as mock_settings:
            mock_settings.return_value.yookassa_return_url = "https://alduin-workshop.ru/order/success"
            url = build_yookassa_return_url("ORD-12345678")
            self.assertEqual(url, "https://alduin-workshop.ru/order/success/ORD-12345678")

    def test_build_yookassa_return_url_legacy_checkout(self):
        """Проверка автоматической замены устаревшего /checkout на /order/success."""
        with patch("app.services.payment_service.get_settings") as mock_settings:
            mock_settings.return_value.yookassa_return_url = "http://139.100.224.102/checkout"
            url = build_yookassa_return_url("ORD-12345678")
            self.assertEqual(url, "http://139.100.224.102/order/success/ORD-12345678")

    def test_build_yookassa_return_url_no_duplicate_scheme(self):
        """Проверка отсутствия дублирования протокола https/http."""
        with patch("app.services.payment_service.get_settings") as mock_settings:
            mock_settings.return_value.yookassa_return_url = "https://alduin-workshop.ru/order/success/{order_id}"
            url = build_yookassa_return_url("ORD-ABC")
            self.assertTrue(url.startswith("https://alduin-workshop.ru/"))
            self.assertFalse(url.startswith("https://https://"))
            self.assertFalse(url.startswith("http://https://"))

    def test_build_receipt_with_order_items(self):
        """Проверка формирования чека из объектов OrderItem."""
        item1 = OrderItem(
            id=1,
            order_id=1,
            product_id=10,
            product_name="Браслет",
            product_price=Decimal("1500.00"),
            quantity=2,
        )
        receipt = _build_receipt(
            cart_or_items=[item1],
            customer_email="test@example.com",
            customer_phone="+79990001122",
            delivery_cost=Decimal("350.00"),
        )
        self.assertEqual(len(receipt["items"]), 2)  # Товар + доставка
        self.assertEqual(receipt["customer"]["email"], "test@example.com")
        self.assertEqual(receipt["items"][0]["description"], "Браслет")
        self.assertEqual(receipt["items"][0]["amount"]["value"], "3000.00")
        self.assertEqual(receipt["items"][1]["description"], "Доставка СДЭК")
        self.assertEqual(receipt["items"][1]["amount"]["value"], "350.00")

    async def test_webhook_payment_canceled(self):
        """Проверка перевода заказа в статус cancelled при событии payment.canceled."""
        from app.routers.payments import _handle_yookassa_webhook

        order = Order(
            id=1,
            order_id="ORD-CANCEL-01",
            status=OrderStatus.pending,
            total_amount=Decimal("1500.00"),
        )

        fake_verified = MagicMock()
        fake_verified.id = "pay_cancel_123"
        fake_verified.status = "canceled"
        fake_verified.metadata = {"order_id": "ORD-CANCEL-01"}

        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = order
        mock_db.execute.return_value = mock_result

        background_tasks = MagicMock()
        payload = {
            "event": "payment.canceled",
            "object": {"id": "pay_cancel_123", "status": "canceled"},
        }

        with patch("app.routers.payments.get_payment", new=AsyncMock(return_value=fake_verified)):
            res = await _handle_yookassa_webhook(payload, background_tasks, mock_db)
            self.assertEqual(res, "OK")
            self.assertEqual(order.status, OrderStatus.cancelled)
            mock_db.commit.assert_called_once()

    async def test_get_order_status_endpoint(self):
        """Проверка публичного эндпоинта GET /api/orders/{order_id}/status."""
        from app.routers.orders import get_order_status
        from fastapi import HTTPException

        order = Order(
            id=1,
            order_id="ORD-STATUS-99",
            guest_name="Анна",
            guest_phone="+79991112233",
            guest_email="anna@example.com",
            delivery_address="г. СПБ",
            delivery_cost=Decimal("300.00"),
            payment_method="card",
            status=OrderStatus.paid,
            total_amount=Decimal("5300.00"),
            created_at=None,
        )
        item = OrderItem(
            id=5,
            order_id=1,
            product_id=20,
            product_name="Сумка кожаная",
            product_price=Decimal("5000.00"),
            quantity=1,
        )
        order.items = [item]

        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = order
        mock_db.execute.return_value = mock_result

        res = await get_order_status("ORD-STATUS-99", mock_db)
        self.assertEqual(res.order_id, "ORD-STATUS-99")
        self.assertEqual(res.status, OrderStatus.paid)
        self.assertEqual(res.total_amount, Decimal("5300.00"))

        # 404 для неизвестного заказа
        mock_result.scalar_one_or_none.return_value = None
        with self.assertRaises(HTTPException) as ctx:
            await get_order_status("ORD-NONEXISTENT", mock_db)
        self.assertEqual(ctx.exception.status_code, 404)

    async def test_retry_order_payment_endpoint(self):
        """Проверка повторной оплаты заказа POST /api/orders/{order_id}/retry-payment."""
        from app.routers.orders import retry_order_payment
        from fastapi import HTTPException

        order = Order(
            id=2,
            order_id="ORD-RETRY-01",
            guest_name="Петр",
            guest_phone="+79998887766",
            guest_email="petr@example.com",
            delivery_address="г. Москва",
            delivery_cost=Decimal("200.00"),
            payment_method="card",
            status=OrderStatus.cancelled,
            total_amount=Decimal("2200.00"),
        )
        order.items = []

        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = order
        mock_db.execute.return_value = mock_result

        with patch("app.routers.orders.get_settings") as mock_settings, \
             patch("app.routers.orders.create_payment", new=AsyncMock(return_value="https://yookassa.ru/pay/123")):
            mock_settings.return_value.yookassa_shop_id = "test_shop"
            mock_settings.return_value.yookassa_secret_key = "test_key"

            res = await retry_order_payment("ORD-RETRY-01", mock_db)
            self.assertEqual(res["payment_url"], "https://yookassa.ru/pay/123")
            # Статус вернулся в pending
            self.assertEqual(order.status, OrderStatus.pending)
            mock_db.commit.assert_called_once()

        # Попытка повторной оплаты уже оплаченного заказа должна вызвать 400
        order.status = OrderStatus.paid
        with self.assertRaises(HTTPException) as ctx:
            await retry_order_payment("ORD-RETRY-01", mock_db)
        self.assertEqual(ctx.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
