"""
Создаёт первого администратора.
Запуск: .venv/Scripts/python create_admin.py
"""
import asyncio
import sys
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import AdminUser
from app.dependencies import hash_password


async def create_admin(username: str, password: str) -> None:
    async with AsyncSessionLocal() as session:
        exists = await session.execute(
            select(AdminUser).where(AdminUser.username == username)
        )
        if exists.scalar_one_or_none():
            print(f"Admin '{username}' already exists.")
            return

        admin = AdminUser(
            username=username,
            hashed_password=hash_password(password),
        )
        session.add(admin)
        await session.commit()
        print(f"Admin '{username}' created successfully.")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python create_admin.py <username> <password>")
        sys.exit(1)
    asyncio.run(create_admin(sys.argv[1], sys.argv[2]))
