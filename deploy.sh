#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
    cp .env.example .env
    echo "[!] Создан .env из примера. Заполните его (пароли, секретный ключ, DEBUG=false) и запустите скрипт снова."
    exit 1
fi

echo "[+] Обновление кода..."
git pull --ff-only

echo "[+] Сборка и запуск контейнеров..."
docker compose up -d --build --remove-orphans --wait

echo "[+] Статус:"
docker compose ps

echo "Создать админа:  docker compose exec backend python create_admin.py admin"