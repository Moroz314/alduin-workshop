"""
Публичные эндпоинты для галереи (без авторизации, только чтение).
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Gallery
from app.schemas import GalleryRead

router = APIRouter()


@router.get("/", response_model=list[GalleryRead], summary="Публичный список элементов галереи")
async def list_gallery(
    limit:  int          = Query(default=50, le=100),
    offset: int          = Query(default=0, ge=0),
    db:     AsyncSession = Depends(get_db),
) -> list[GalleryRead]:
    q = select(Gallery).order_by(Gallery.created_at.desc(), Gallery.id.desc()).limit(limit).offset(offset)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{gallery_id}", response_model=GalleryRead, summary="Элемент галереи по ID")
async def get_gallery_item(
    gallery_id: int,
    db:         AsyncSession = Depends(get_db),
) -> GalleryRead:
    result = await db.execute(select(Gallery).where(Gallery.id == gallery_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Элемент галереи не найден")
    return item
