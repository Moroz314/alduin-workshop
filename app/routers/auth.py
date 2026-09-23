"""
POST /api/auth/login — выдача JWT токена администратору.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import create_access_token, verify_password
from app.models import AdminUser
from app.schemas import LoginRequest, TokenResponse

router = APIRouter()


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Вход администратора",
)
async def login(
    body: LoginRequest,
    db:   AsyncSession = Depends(get_db),
) -> TokenResponse:
    result = await db.execute(
        select(AdminUser).where(AdminUser.username == body.username)
    )
    admin = result.scalar_one_or_none()

    if admin is None or not verify_password(body.password, admin.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль",
        )

    token = create_access_token(subject=admin.username)
    return TokenResponse(access_token=token)
