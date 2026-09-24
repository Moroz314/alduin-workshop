"""Test suite for YooKassa webhook, CDEK automated delivery, and email notifications."""
from __future__ import annotations

import unittest
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

from app.models import Order, OrderItem, OrderStatus, Product
from app.services import cdek_service, email_service
from app.services.order_delivery_service import _build_order_dict_for_email


class TestCdekAutomation(unittest.TestCase):

    def test_cdek_payload_builder(self):
        """Проверка формирования запроса в СДЭК: оплачено онлайн, габариты и реквизиты."""
        order = Order(
            id=1,
            order_id="ORD-TEST1234",
            guest_name="Иван Иванов",
            guest_phone="+79991234567",
            guest_email="ivan@example.com",
            delivery_address="г. Москва, ул. Тверская, 1",
            pvz_code="MSK1",
            comment="Осторожно, хрупкое",
            total_amount=Decimal("3500.00"),
        )
        item1 = OrderItem(
            id=10,
            order_id=1,
            product_id=101,
            product_name="Кожаный ремень",
            product_price=Decimal("2500.00"),
            quantity=1,
        )
        item2 = OrderItem(
            id=11,
            order_id=1,
            product_id=102,
            product_name="Браслет кованый",
            product_price=Decimal("1000.00"),
            quantity=2,
        )
        order.items = [item1, item2]

        dims = {
            101: {"weight_grams": 400, "length_cm": 30, "width_cm": 15, "height_cm": 5},
            # 102 без явных габаритов — проверка значений по умолчанию
        }
        site_reqs = {
            "contact_legal_name": "ИП Морозов В. С.",
            "contact_phone1": "+79500082208",
        }

        payload = cdek_service.build_cdek_order_payload(
            order=order,
            product_dimensions=dims,
            site_requisites=site_reqs,
            tariff_code=136,
        )

        # 1. Проверка номера и тарифа
        self.assertEqual(payload["number"], "ORD-TEST1234")
        self.assertEqual(payload["tariff_code"], 136)
        self.assertEqual(payload["delivery_point"], "MSK1")

        # 2. Проверка получателя и отправителя
        self.assertEqual(payload["recipient"]["name"], "Иван Иванов")
        self.assertEqual(payload["recipient"]["phones"][0]["number"], "+79991234567")
        self.assertEqual(payload["recipient"]["email"], "ivan@example.com")
        self.assertEqual(payload["sender"]["name"], "ИП Морозов В. С.")

        # 3. Проверка посылки и позиций
        packages = payload["packages"]
        self.assertEqual(len(packages), 1)
        pkg = packages[0]
        items = pkg["items"]
        self.assertEqual(len(items), 2)

        # Все позиции должны быть помечены как оплаченные онлайн (payment.value == 0.0)
        for it in items:
            self.assertEqual(it["payment"]["value"], 0.0, "Позиция должна иметь payment.value = 0 (без наложенного платежа)")

        self.assertEqual(items[0]["cost"], 2500.0)
        self.assertEqual(items[0]["weight"], 400)
        self.assertEqual(items[1]["amount"], 2)

    def test_qr_code_generation(self):
        """Проверка генерации QR-кода библиотекой qrcode."""
        url = "https://www.cdek.ru/ru/tracking?order_id=123456789"
        qr_bytes = email_service._generate_qr_code_png(url)
        self.assertIsNotNone(qr_bytes)
        self.assertTrue(len(qr_bytes) > 500)
        # Проверка PNG сигнатуры
        self.assertEqual(qr_bytes[:8], b"\x89PNG\r\n\x1a\n")

    def test_order_dict_for_email(self):
        """Проверка подготовки данных заказа для шаблонов писем."""
        order = Order(
            id=1,
            order_id="ORD-EML-99",
            guest_name="Петр Сидоров",
            guest_phone="+79201112233",
            guest_email="petr@example.com",
            delivery_address="Санкт-Петербург, Невский пр. 10",
            pvz_code="SPB10",
            delivery_cost=Decimal("350.00"),
            payment_method="bank_card",
            cdek_number="1106321555",
            total_amount=Decimal("4350.00"),
        )
        item = OrderItem(
            id=1,
            order_id=1,
            product_id=5,
            product_name="Топор кованый",
            product_price=Decimal("4000.00"),
            quantity=1,
        )
        order.items = [item]

        order_dict = _build_order_dict_for_email(order)
        self.assertEqual(order_dict["order_id"], "ORD-EML-99")
        self.assertEqual(order_dict["cdek_number"], "1106321555")
        self.assertEqual(order_dict["delivery_cost"], 350.0)
        self.assertEqual(len(order_dict["items"]), 1)
        self.assertEqual(order_dict["items"][0]["subtotal"], 4000.0)

    def test_validate_cdek_sender_data_pvz(self):
        """Проверка валидации данных отправителя для отправки из ПВЗ."""
        from app.services.order_delivery_service import validate_cdek_sender_data

        # Корректные данные: город, имя, телефон, тип pvz и код pvz
        valid_reqs = {
            "cdek_sender_city_code": "137",
            "cdek_sender_name": "ИП Тестовый",
            "cdek_sender_phone": "+79991112233",
            "cdek_delivery_type": "pvz",
            "cdek_sender_pvz_code": "SPB1",
        }
        ok, err = validate_cdek_sender_data(valid_reqs)
        self.assertTrue(ok)
        self.assertEqual(err, "")

        # Не указан код ПВЗ отправителя
        invalid_pvz = dict(valid_reqs, cdek_sender_pvz_code="")
        ok, err = validate_cdek_sender_data(invalid_pvz)
        self.assertFalse(ok)
        self.assertIn("Код ПВЗ", err)

    def test_validate_cdek_sender_data_courier(self):
        """Проверка валидации данных отправителя при заборе курьером."""
        from app.services.order_delivery_service import validate_cdek_sender_data

        courier_reqs = {
            "cdek_sender_city_code": "137",
            "cdek_sender_name": "ИП Тестовый",
            "cdek_sender_phone": "+79991112233",
            "cdek_delivery_type": "courier",
            "cdek_sender_address": "г. Санкт-Петербург, Невский пр. 10",
        }
        ok, err = validate_cdek_sender_data(courier_reqs)
        self.assertTrue(ok)
        self.assertEqual(err, "")

        # Не указан адрес забора
        invalid_courier = dict(courier_reqs, cdek_sender_address="")
        ok, err = validate_cdek_sender_data(invalid_courier)
        self.assertFalse(ok)
        self.assertIn("Адрес для забора", err)

    def test_validate_cdek_sender_data_missing_core_fields(self):
        """Проверка блокировки, если не заполнен город, телефон или имя."""
        from app.services.order_delivery_service import validate_cdek_sender_data

        with patch("app.services.order_delivery_service.get_settings") as mock_settings:
            mock_s = MagicMock()
            mock_s.cdek_sender_city_code = None
            mock_s.cdek_sender_name = None
            mock_s.cdek_sender_phone = None
            mock_s.cdek_delivery_type = "pvz"
            mock_s.cdek_sender_pvz_code = ""
            mock_settings.return_value = mock_s

            ok, err = validate_cdek_sender_data({})
            self.assertFalse(ok)
            self.assertIn("Город отправления", err)
            self.assertIn("Имя отправителя", err)
            self.assertIn("Телефон отправителя", err)

    @patch("app.services.cdek_service._fetch_access_token_sync", return_value="fake_token")
    @patch("requests.post")
    def test_calculate_delivery_no_silent_fallback(self, mock_post, mock_token):
        """При сбое расчета СДЭК должен выбросить RuntimeError без тихого fallback на 350 руб."""
        # Моделируем ошибку API СДЭК (например 400 Bad Request)
        mock_resp = MagicMock()
        mock_resp.status_code = 400
        mock_resp.json.return_value = {"requests": [{"errors": [{"code": "error", "message": "Tariff not available"}]}]}
        mock_post.return_value = mock_resp

        with self.assertRaises(RuntimeError) as ctx:
            cdek_service._calculate_delivery_sync(
                city_code=44,  # Москва
                weight_grams=1000,
                site_requisites={"cdek_tariff_codes": "136, 368"},
            )

        self.assertIn("Не удалось рассчитать доставку, попробуйте позже", str(ctx.exception))

    @patch("app.services.cdek_service._fetch_access_token_sync", return_value="fake_token")
    @patch("requests.post")
    def test_calculate_delivery_success_custom_tariffs(self, mock_post, mock_token):
        """Успешный расчет с кастомными тарифами возвращает точную сумму СДЭК."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "delivery_sum": 480.50,
            "period_min": 2,
            "period_max": 3,
            "calendar_min": 2,
            "calendar_max": 4,
        }
        mock_post.return_value = mock_resp

        res = cdek_service._calculate_delivery_sync(
            city_code=44,
            weight_grams=800,
            site_requisites={
                "cdek_sender_city_code": "137",
                "cdek_tariff_codes": "234",
            },
        )
        self.assertEqual(res["delivery_sum"], Decimal("480.50"))
        self.assertEqual(res["period_min"], 2)
        self.assertEqual(res["tariff_code"], 234)



class TestWebhookScenarios(unittest.IsolatedAsyncioTestCase):

    async def test_webhook_idempotency_duplicate_notification(self):
        """Повторное уведомление не меняет статус и не создает второй заказ в СДЭК."""
        from app.routers.payments import _handle_yookassa_webhook

        # Заказ уже в статусе 'paid'
        order = Order(
            id=1,
            order_id="ORD-DUP-01",
            status=OrderStatus.paid,
            total_amount=Decimal("1500.00"),
        )
        order.items = []

        fake_verified_payment = MagicMock()
        fake_verified_payment.id = "pay_12345"
        fake_verified_payment.status = "succeeded"
        fake_verified_payment.metadata = {"order_id": "ORD-DUP-01"}
        fake_verified_payment.amount = MagicMock(value="1500.00")

        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = order
        mock_db.execute.return_value = mock_result

        background_tasks = MagicMock()

        payload = {
            "event": "payment.succeeded",
            "object": {"id": "pay_12345", "status": "succeeded"},
        }

        with patch("app.routers.payments.get_payment", new=AsyncMock(return_value=fake_verified_payment)):
            res = await _handle_yookassa_webhook(payload, background_tasks, mock_db)
            self.assertEqual(res, "OK")
            # Фоновые задачи НЕ должны быть добавлены повторно
            background_tasks.add_task.assert_not_called()
            # Статус остался paid
            self.assertEqual(order.status, OrderStatus.paid)

    async def test_webhook_in_production_for_made_to_order(self):
        """Если товар под заказ (in_stock=False), заказ переходит в in_production."""
        from app.routers.payments import _handle_yookassa_webhook

        order = Order(
            id=2,
            order_id="ORD-PROD-02",
            status=OrderStatus.pending,
            total_amount=Decimal("2000.00"),
        )
        item = OrderItem(
            id=1,
            order_id=2,
            product_id=50,
            product_name="Меч на заказ",
            product_price=Decimal("2000.00"),
            quantity=1,
        )
        order.items = [item]

        fake_verified = MagicMock()
        fake_verified.id = "pay_9999"
        fake_verified.status = "succeeded"
        fake_verified.metadata = {"order_id": "ORD-PROD-02"}
        fake_verified.amount = MagicMock(value="2000.00")

        mock_db = AsyncMock()
        # 1-й запрос: заказ
        mock_order_res = MagicMock()
        mock_order_res.scalar_one_or_none.return_value = order
        # 2-й запрос: проверка наличия товара (in_stock=False)
        mock_prod_res = MagicMock()
        mock_prod_res.all.return_value = [(50, False)]

        mock_db.execute.side_effect = [mock_order_res, mock_prod_res]

        background_tasks = MagicMock()

        payload = {
            "event": "payment.succeeded",
            "object": {"id": "pay_9999", "status": "succeeded"},
        }

        with patch("app.routers.payments.get_payment", new=AsyncMock(return_value=fake_verified)):
            res = await _handle_yookassa_webhook(payload, background_tasks, mock_db)
            self.assertEqual(res, "OK")
            # Статус должен стать 'in_production'
            self.assertEqual(order.status, OrderStatus.in_production)
            # В фоновую задачу передано is_all_in_stock=False
            background_tasks.add_task.assert_called_once()
            call_args = background_tasks.add_task.call_args[0]
            self.assertEqual(call_args[1], "ORD-PROD-02")
            self.assertFalse(call_args[2])  # is_all_in_stock is False

    async def test_webhook_rejects_unverified_status(self):
        """Если ЮKassa API сообщает, что статус не succeeded, webhook не активирует заказ."""
        from app.routers.payments import _handle_yookassa_webhook

        fake_verified = MagicMock()
        fake_verified.id = "pay_fake"
        fake_verified.status = "canceled"  # Платёж отменён

        payload = {
            "event": "payment.succeeded",  # Злоумышленник отправил payment.succeeded в теле
            "object": {"id": "pay_fake", "status": "succeeded"},
        }

        mock_db = AsyncMock()
        background_tasks = MagicMock()

        with patch("app.routers.payments.get_payment", new=AsyncMock(return_value=fake_verified)):
            res = await _handle_yookassa_webhook(payload, background_tasks, mock_db)
            self.assertEqual(res, "OK")
            mock_db.execute.assert_not_called()
            background_tasks.add_task.assert_not_called()


if __name__ == "__main__":
    unittest.main()

