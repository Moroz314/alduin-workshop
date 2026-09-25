"""
Защищённый CRUD для товаров.
"""
from typing import Union
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import case, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_admin
from app.models import AdminUser, Product, ProductImage
from app.schemas import (
    ProductCreate,
    ProductRead,
    ProductUpdate,
    ProductReorderItem,
    ProductReorderRequest,
)

router = APIRouter()


@router.get("/", response_model=list[ProductRead], summary="Все товары")
async def list_products(
    category_id: int | None = Query(default=None),
    in_stock:    bool | None = Query(default=None),
    search:      str | None  = Query(default=None),
    limit:       int         = Query(default=500, le=1000),
    offset:      int         = Query(default=0, ge=0),
    db:          AsyncSession = Depends(get_db),
    _:           AdminUser    = Depends(get_current_admin),
) -> list[ProductRead]:
    q = select(Product).order_by(Product.sort_order.asc(), Product.id.asc()).limit(limit).offset(offset)
    if category_id is not None:
        q = q.where(Product.category_id == category_id)
    if in_stock is not None:
        q = q.where(Product.in_stock == in_stock)
    if search and search.strip():
        term = f"%{search.strip()}%"
        q = q.where(Product.name.ilike(term) | Product.description.ilike(term))
    result = await db.execute(q)
    return result.scalars().all()


@router.patch("/reorder", summary="Изменить порядок товаров")
async def reorder_products(
    payload: Union[list[ProductReorderItem], ProductReorderRequest] = Body(...),
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
):
    items = payload if isinstance(payload, list) else payload.items
    if not items:
        return {"status": "ok", "updated": 0}

    # Bulk update в рамках транзакции одним SQL-запросом
    case_mapping = {item.id: item.sort_order for item in items}
    stmt = (
        update(Product)
        .where(Product.id.in_(case_mapping.keys()))
        .values(sort_order=case(case_mapping, value=Product.id))
    )
    result = await db.execute(stmt)
    await db.commit()
    updated_count = result.rowcount if result.rowcount is not None and result.rowcount >= 0 else len(items)
    return {"status": "ok", "updated": updated_count}


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

    # Новый товар получает sort_order = max(текущих в категории) + 1, чтобы попадал в конец списка
    if not data.get("sort_order"):
        cat_id = data.get("category_id")
        if cat_id is not None:
            max_q = select(func.coalesce(func.max(Product.sort_order), 0)).where(Product.category_id == cat_id)
        else:
            max_q = select(func.coalesce(func.max(Product.sort_order), 0)).where(Product.category_id.is_(None))
        max_order = (await db.execute(max_q)).scalar() or 0
        data["sort_order"] = max_order + 1

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

    if "category_id" in data and data["category_id"] != product.category_id and "sort_order" not in data:
        cat_id = data["category_id"]
        if cat_id is not None:
            max_q = select(func.coalesce(func.max(Product.sort_order), 0)).where(Product.category_id == cat_id)
        else:
            max_q = select(func.coalesce(func.max(Product.sort_order), 0)).where(Product.category_id.is_(None))
        max_order = (await db.execute(max_q)).scalar() or 0
        product.sort_order = max_order + 1

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
