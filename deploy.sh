#!/bin/bash
set -e

echo "=== Развертывание проекта на сервере (188.225.23.146) ==="

# Проверка наличия .env
if [ ! -f .env ]; then
    echo "[!] Файл .env не найден. Создаю из .env.example..."
    cp .env.example .env
    echo "[!] Пожалуйста, отредактируйте .env перед первым запуском!"
fi

echo "[+] Сборка и запуск контейнеров..."
docker compose down --remove-orphans
docker compose up -d --build

echo "[+] Ожидание инициализации сервисов..."
sleep 5

echo "[+] Статус контейнеров:"
docker compose ps

echo ""
echo "================================================================"
echo " Сайт доступен по адресу: http://188.225.23.146/"
echo " Swagger документация API: http://188.225.23.146/api/docs"
echo "----------------------------------------------------------------"
echo " Для создания администратора выполните:"
echo "   docker compose exec backend python create_admin.py admin ВАШ_ПАРОЛЬ"
echo ""
echo " Для наполнения тестовыми товарами (опционально):"
echo "   docker compose exec backend python seed.py"
echo "================================================================"
