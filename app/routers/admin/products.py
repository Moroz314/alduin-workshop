"""
Защищённый CRUD для товаров.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_admin
from app.models import AdminUser, Product, ProductImage
from app.schemas import ProductCreate, ProductRead, ProductUpdate

router = APIRouter()


@router.get("/", response_model=list[ProductRead], summary="Все товары")
async def list_products(
    category_id: int | None = Query(default=None),
    in_stock:    bool | None = Query(default=None),
    limit:       int         = Query(default=50, le=200),
    offset:      int         = Query(default=0, ge=0),
    db:          AsyncSession = Depends(get_db),
    _:           AdminUser    = Depends(get_current_admin),
) -> list[ProductRead]:
    q = select(Product).order_by(Product.name).limit(limit).offset(offset)
    if category_id is not None:
        q = q.where(Product.category_id == category_id)
    if in_stock is not None:
        q = q.where(Product.in_stock == in_stock)
    result = await db.execute(q)
    return result.scalars().all()


@router.post(
    "/",
    response_model=ProductRead,
    status_code=status.HTTP_201_CREATED,
    summary="Создать товар",
)
async def create_product(
    body: ProductCreate,
    db:   AsyncSession = Depends(get_db),
    _:    AdminUser    = Depends(get_current_admin),
) -> ProductRead:
    existing = await db.execute(select(Product).where(Product.slug == body.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Slug '{body.slug}' уже занят")

    data = body.model_dump()
    image_urls = data.pop("images", None) or ([data["image_url"]] if data.get("image_url") else [])
    product = Product(**data)
    for position, url in enumerate(image_urls):
        product.images.append(ProductImage(url=url, is_cover=position == 0, position=position))
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


@router.get("/{product_id}", response_model=ProductRead, summary="Товар по ID")
async def get_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    _:  AdminUser    = Depends(get_current_admin),
) -> ProductRead:
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")
    return product


@router.patch("/{product_id}", response_model=ProductRead, summary="Обновить товар")
async def update_product(
    product_id: int,
    body: ProductUpdate,
    db:   AsyncSession = Depends(get_db),
    _:    AdminUser    = Depends(get_current_admin),
) -> ProductRead:
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")

    data = body.model_dump(exclude_unset=True)
    image_urls = data.pop("images", None)
    if "slug" in data:
        clash = await db.execute(
            select(Product).where(Product.slug == data["slug"], Product.id != product_id)
        )
        if clash.scalar_one_or_none():
            raise HTTPException(status_code=409, detail=f"Slug '{data['slug']}' уже занят")

    for field, value in data.items():
        setattr(product, field, value)

    if image_urls is not None:
        product.images.clear()
        product.image_url = image_urls[0] if image_urls else None
        for position, url in enumerate(image_urls):
            product.images.append(ProductImage(url=url, is_cover=position == 0, position=position))

    await db.commit()
    await db.refresh(product)
    return product


@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Удалить товар",
)
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    _:  AdminUser    = Depends(get_current_admin),
) -> None:
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")
    await db.delete(product)
    await db.commit()
