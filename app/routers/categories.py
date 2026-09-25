from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Category
from app.schemas import CategoryRead

router = APIRouter()


@router.get(
    "/",
    response_model=list[CategoryRead],
    summary="Список всех категорий",
)
async def get_categories(db: AsyncSession = Depends(get_db)) -> list[Category]:
    """Возвращает все категории каталога в порядке, заданном администратором."""
    result = await db.execute(select(Category).order_by(Category.sort_order.asc(), Category.id.asc()))
    return result.scalars().all()


@router.get(
    "/{slug}",
    response_model=CategoryRead,
    summary="Категория по slug",
)
async def get_category_by_slug(slug: str, db: AsyncSession = Depends(get_db)) -> Category:
    result = await db.execute(select(Category).where(Category.slug == slug))
    category = result.scalar_one_or_none()
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Категория '{slug}' не найдена")
    return category
