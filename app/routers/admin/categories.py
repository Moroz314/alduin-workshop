"""
Защищённый CRUD для категорий.
Все эндпоинты требуют JWT токен администратора.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_admin
from app.models import AdminUser, Category
from app.schemas import CategoryCreate, CategoryRead, CategoryUpdate

router = APIRouter()


@router.get("/", response_model=list[CategoryRead], summary="Все категории")
async def list_categories(
    db:    AsyncSession = Depends(get_db),
    _:     AdminUser   = Depends(get_current_admin),
) -> list[CategoryRead]:
    result = await db.execute(select(Category).order_by(Category.name))
    return result.scalars().all()


@router.post(
    "/",
    response_model=CategoryRead,
    status_code=status.HTTP_201_CREATED,
    summary="Создать категорию",
)
async def create_category(
    body: CategoryCreate,
    db:   AsyncSession = Depends(get_db),
    _:    AdminUser    = Depends(get_current_admin),
) -> CategoryRead:
    # Проверка уникальности slug
    existing = await db.execute(select(Category).where(Category.slug == body.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Slug '{body.slug}' уже занят")

    category = Category(**body.model_dump())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


@router.get("/{category_id}", response_model=CategoryRead, summary="Категория по ID")
async def get_category(
    category_id: int,
    db:  AsyncSession = Depends(get_db),
    _:   AdminUser    = Depends(get_current_admin),
) -> CategoryRead:
    result = await db.execute(select(Category).where(Category.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    return category


@router.patch("/{category_id}", response_model=CategoryRead, summary="Обновить категорию")
async def update_category(
    category_id: int,
    body: CategoryUpdate,
    db:   AsyncSession = Depends(get_db),
    _:    AdminUser    = Depends(get_current_admin),
) -> CategoryRead:
    result = await db.execute(select(Category).where(Category.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Категория не найдена")

    data = body.model_dump(exclude_unset=True)
    if "slug" in data:
        clash = await db.execute(
            select(Category).where(Category.slug == data["slug"], Category.id != category_id)
        )
        if clash.scalar_one_or_none():
            raise HTTPException(status_code=409, detail=f"Slug '{data['slug']}' уже занят")

    for field, value in data.items():
        setattr(category, field, value)

    await db.commit()
    await db.refresh(category)
    return category


@router.delete(
    "/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Удалить категорию",
)
async def delete_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    _:  AdminUser    = Depends(get_current_admin),
) -> None:
    result = await db.execute(select(Category).where(Category.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    await db.delete(category)
    await db.commit()
