#!/bin/bash
# =============================================================================
# deploy.sh — обновление и перезапуск Мастерской Алдуин
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")"

# ── 1. Проверка .env ──────────────────────────────────────────────────────────
if [ ! -f .env ]; then
    cp .env.example .env
    echo "
[!] Создан .env из примера.
    Обязательно заполните перед первым запуском:
      SECRET_KEY        — случайная строка (openssl rand -hex 32)
      POSTGRES_PASSWORD — надёжный пароль БД
      ALLOWED_ORIGINS   — https://alduin-workshop.ru
      DEBUG             — false
      YOOKASSA_*        — реквизиты магазина (если нужны платежи)
    Затем запустите скрипт снова.
"
    exit 1
fi

# ── 2. Обновление кода ────────────────────────────────────────────────────────
echo "[+] Обновление кода..."
git pull --ff-only

# ── 3. Сборка и запуск ───────────────────────────────────────────────────────
echo "[+] Сборка и запуск контейнеров..."
docker compose up -d --build --remove-orphans --wait

# ── 4. Статус ─────────────────────────────────────────────────────────────────
echo "[+] Статус:"
docker compose ps

# ── 5. Подсказки ─────────────────────────────────────────────────────────────
cat <<'TIPS'

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Полезные команды
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Создать администратора:
    docker compose exec backend python create_admin.py admin

  Проверить TLS-сертификат (срок, CN, цепочка):
    docker compose exec caddy caddy certificates
    # или снаружи:
    echo | openssl s_client -connect alduin-workshop.ru:443 -servername alduin-workshop.ru 2>/dev/null \
      | openssl x509 -noout -dates -subject -issuer

  Принудительно обновить сертификат Let's Encrypt:
    docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
    # Caddy обновляет сертификаты автоматически за 30 дней до истечения.
    # Если нужно форсировать — просто перезапустите сервис:
    docker compose restart caddy

  Посмотреть логи Caddy (ACME-запросы, ошибки):
    docker compose logs -f caddy

  Откатить на предыдущий коммит:
    git revert HEAD --no-edit && bash deploy.sh

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TIPS