from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Product, Review
from app.schemas import ProductListRead, ProductRead, ReviewCreate, ReviewRead

router = APIRouter()


@router.get(
    "/",
    response_model=list[ProductListRead],
    summary="Список товаров (с фильтрацией по категории)",
)
async def get_products(
    category_id: int | None = Query(default=None, description="ID категории для фильтрации"),
    in_stock: bool | None = Query(default=None, description="Только товары в наличии"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> list[Product]:
    stmt = select(Product).order_by(Product.name)
    if category_id is not None:
        stmt = stmt.where(Product.category_id == category_id)
    if in_stock is not None:
        stmt = stmt.where(Product.in_stock == in_stock)
    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post(
    "/{product_id}/reviews",
    response_model=ReviewRead,
    status_code=status.HTTP_201_CREATED,
    summary="Добавить отзыв к товару",
)
async def create_review(
    product_id: int,
    body: ReviewCreate,
    db: AsyncSession = Depends(get_db),
) -> Review:
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Товар не найден")

    review = Review(product_id=product_id, **body.model_dump())
    db.add(review)
    await db.commit()
    await db.refresh(review)
    return review


@router.get(
    "/{slug}",
    response_model=ProductRead,
    summary="Товар по slug",
)
async def get_product_by_slug(slug: str, db: AsyncSession = Depends(get_db)) -> Product:
    """Возвращает полную карточку товара с вложенной категорией."""
    result = await db.execute(select(Product).where(Product.slug == slug))
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Товар '{slug}' не найден")
    return product
