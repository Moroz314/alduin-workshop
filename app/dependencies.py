"""
JWT-зависимости для FastAPI Dependency Injection.
"""
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models import AdminUser

settings = get_settings()

# ── Argon2 hasher ────────────────────────────────────────────────────────────
_ph = PasswordHasher()

# ── OAuth2 схема — указывает Swagger где логиниться ───────────────────────────
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

ALGORITHM    = "HS256"
TOKEN_EXPIRE = timedelta(hours=24)


# ── Хелперы для паролей ───────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return _ph.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, plain)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


# ── Хелперы для JWT ───────────────────────────────────────────────────────────

def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + TOKEN_EXPIRE
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> str:
    """Декодирует JWT и возвращает username (sub). Бросает 401 при ошибке."""
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Недействительный или истёкший токен",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        username: str | None = payload.get("sub")
        if not username:
            raise credentials_exc
        return username
    except JWTError:
        raise credentials_exc


# ── Dependency: текущий администратор ────────────────────────────────────────

async def get_current_admin(
    token: str = Depends(oauth2_scheme),
    db:    AsyncSession = Depends(get_db),
) -> AdminUser:
    username = decode_token(token)
    result = await db.execute(select(AdminUser).where(AdminUser.username == username))
    admin = result.scalar_one_or_none()
    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Администратор не найден",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return admin
