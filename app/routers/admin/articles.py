"""
Защищённый CRUD для статей (новости и обучение) и разделов обучения.
"""
import re
import time
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_admin
from app.models import AdminUser, Article, ArticleType, TrainingSection
from app.schemas import (
    ArticleCreate,
    ArticleRead,
    ArticleUpdate,
    TrainingSectionCreate,
    TrainingSectionRead,
)

router = APIRouter()

RU_ALPHABET = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
    'я': 'ya'
}

def _slugify(text: str) -> str:
    text = text.lower()
    trans = ''.join(RU_ALPHABET.get(ch, ch) for ch in text)
    slug = re.sub(r'[^a-z0-9]+', '-', trans).strip('-')
    return slug or f"section-{int(time.time())}"


# ── Разделы обучения (Training Sections) ──────────────────────────────────────

@router.get(
    "/sections/training",
    response_model=list[TrainingSectionRead],
    summary="Список всех разделов обучения",
)
async def list_training_sections(
    db: AsyncSession = Depends(get_db),
    _:  AdminUser    = Depends(get_current_admin),
) -> list[TrainingSectionRead]:
    q = select(TrainingSection).order_by(TrainingSection.name.asc())
    result = await db.execute(q)
    return result.scalars().all()


@router.post(
    "/sections/training",
    response_model=TrainingSectionRead,
    status_code=status.HTTP_201_CREATED,
    summary="Создать новый раздел обучения",
)
async def create_training_section(
    body: TrainingSectionCreate,
    db:   AsyncSession = Depends(get_db),
    _:    AdminUser    = Depends(get_current_admin),
) -> TrainingSectionRead:
    name_clean = body.name.strip()
    if not name_clean:
        raise HTTPException(status_code=400, detail="Название раздела не может быть пустым")

    # Проверка уникальности имени
    existing = await db.execute(select(TrainingSection).where(TrainingSection.name == name_clean))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Раздел с названием '{name_clean}' уже существует")

    base_slug = _slugify(name_clean)
    slug = base_slug
    idx = 1
    while True:
        exists_slug = await db.execute(select(TrainingSection).where(TrainingSection.slug == slug))
        if not exists_slug.scalar_one_or_none():
            break
        idx += 1
        slug = f"{base_slug}-{idx}"

    section = TrainingSection(name=name_clean, slug=slug)
    db.add(section)
    await db.commit()
    await db.refresh(section)
    return section


@router.delete(
    "/sections/training/{section_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Удалить раздел обучения",
)
async def delete_training_section(
    section_id: int,
    db: AsyncSession = Depends(get_db),
    _:  AdminUser    = Depends(get_current_admin),
) -> None:
    result = await db.execute(select(TrainingSection).where(TrainingSection.id == section_id))
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Раздел не найден")

    await db.delete(section)
    await db.commit()


# ── Статьи (Articles) ─────────────────────────────────────────────────────────

@router.get("/", response_model=list[ArticleRead], summary="Все статьи")
async def list_articles(
    type:       ArticleType | None = Query(default=None),
    section_id: int | None         = Query(default=None),
    limit:      int                = Query(default=50, le=200),
    offset:     int                = Query(default=0, ge=0),
    db:         AsyncSession       = Depends(get_db),
    _:          AdminUser          = Depends(get_current_admin),
) -> list[ArticleRead]:
    q = (
        select(Article)
        .options(selectinload(Article.section))
        .order_by(Article.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if type is not None:
        q = q.where(Article.type == type)
    if section_id is not None:
        q = q.where(Article.section_id == section_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.post(
    "/",
    response_model=ArticleRead,
    status_code=status.HTTP_201_CREATED,
    summary="Создать статью",
)
async def create_article(
    body: ArticleCreate,
    db:   AsyncSession = Depends(get_db),
    _:    AdminUser    = Depends(get_current_admin),
) -> ArticleRead:
    article = Article(**body.model_dump())
    db.add(article)
    await db.commit()
    # Загружаем со связью section
    result = await db.execute(
        select(Article).options(selectinload(Article.section)).where(Article.id == article.id)
    )
    return result.scalar_one()


@router.get("/{article_id}", response_model=ArticleRead, summary="Статья по ID")
async def get_article(
    article_id: int,
    db: AsyncSession = Depends(get_db),
    _:  AdminUser    = Depends(get_current_admin),
) -> ArticleRead:
    result = await db.execute(
        select(Article).options(selectinload(Article.section)).where(Article.id == article_id)
    )
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Статья не найдена")
    return article


@router.patch("/{article_id}", response_model=ArticleRead, summary="Обновить статью")
async def update_article(
    article_id: int,
    body: ArticleUpdate,
    db:   AsyncSession = Depends(get_db),
    _:    AdminUser    = Depends(get_current_admin),
) -> ArticleRead:
    result = await db.execute(
        select(Article).options(selectinload(Article.section)).where(Article.id == article_id)
    )
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Статья не найдена")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(article, field, value)

    await db.commit()
    await db.refresh(article, attribute_names=["section"])
    return article


@router.delete(
    "/{article_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Удалить статью",
)
async def delete_article(
    article_id: int,
    db: AsyncSession = Depends(get_db),
    _:  AdminUser    = Depends(get_current_admin),
) -> None:
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Статья не найдена")
    await db.delete(article)
    await db.commit()
