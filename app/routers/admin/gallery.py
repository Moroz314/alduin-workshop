"""
Защищённый CRUD для галереи мастерской.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_admin
from app.models import AdminUser, Gallery
from app.schemas import GalleryCreate, GalleryRead, GalleryUpdate

router = APIRouter()


@router.get("/", response_model=list[GalleryRead], summary="Все элементы галереи")
async def list_gallery(
    limit:  int          = Query(default=50, le=200),
    offset: int          = Query(default=0, ge=0),
    db:     AsyncSession = Depends(get_db),
    _:      AdminUser    = Depends(get_current_admin),
) -> list[GalleryRead]:
    q = select(Gallery).order_by(Gallery.created_at.desc(), Gallery.id.desc()).limit(limit).offset(offset)
    result = await db.execute(q)
    return result.scalars().all()


@router.post(
    "/",
    response_model=GalleryRead,
    status_code=status.HTTP_201_CREATED,
    summary="Создать элемент галереи",
)
async def create_gallery_item(
    body: GalleryCreate,
    db:   AsyncSession = Depends(get_db),
    _:    AdminUser    = Depends(get_current_admin),
) -> GalleryRead:
    if not body.image_url and not body.video_url:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Необходимо указать изображение (image_url) или ссылку на видео (video_url)",
        )

    item = Gallery(**body.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.get("/{gallery_id}", response_model=GalleryRead, summary="Элемент галереи по ID")
async def get_gallery_item(
    gallery_id: int,
    db:         AsyncSession = Depends(get_db),
    _:          AdminUser    = Depends(get_current_admin),
) -> GalleryRead:
    result = await db.execute(select(Gallery).where(Gallery.id == gallery_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Элемент галереи не найден")
    return item


@router.patch("/{gallery_id}", response_model=GalleryRead, summary="Обновить элемент галереи")
async def update_gallery_item(
    gallery_id: int,
    body:       GalleryUpdate,
    db:         AsyncSession = Depends(get_db),
    _:          AdminUser    = Depends(get_current_admin),
) -> GalleryRead:
    result = await db.execute(select(Gallery).where(Gallery.id == gallery_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Элемент галереи не найден")

    data = body.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(item, field, value)

    await db.commit()
    await db.refresh(item)
    return item


@router.delete(
    "/{gallery_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Удалить элемент галереи",
)
async def delete_gallery_item(
    gallery_id: int,
    db:         AsyncSession = Depends(get_db),
    _:          AdminUser    = Depends(get_current_admin),
) -> None:
    result = await db.execute(select(Gallery).where(Gallery.id == gallery_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Элемент галереи не найден")

    await db.delete(item)
    await db.commit()
