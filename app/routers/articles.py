"""
Публичные эндпоинты для статей (без авторизации, только чтение).
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Article, ArticleType, TrainingSection
from app.schemas import ArticleRead, TrainingSectionRead

router = APIRouter()


@router.get(
    "/sections/training",
    response_model=list[TrainingSectionRead],
    summary="Публичный список разделов обучения",
)
async def list_training_sections(
    db: AsyncSession = Depends(get_db),
) -> list[TrainingSectionRead]:
    q = select(TrainingSection).order_by(TrainingSection.name.asc())
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/", response_model=list[ArticleRead], summary="Публичный список статей")
async def list_articles(
    type:       ArticleType | None = Query(default=None, description="Фильтр: news | training"),
    section_id: int | None         = Query(default=None, description="Фильтр по разделу обучения"),
    limit:      int                = Query(default=20, le=100),
    offset:     int                = Query(default=0, ge=0),
    db:         AsyncSession       = Depends(get_db),
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


@router.get("/{article_id}", response_model=ArticleRead, summary="Публичная статья по ID")
async def get_article(
    article_id: int,
    db: AsyncSession = Depends(get_db),
) -> ArticleRead:
    result = await db.execute(
        select(Article).options(selectinload(Article.section)).where(Article.id == article_id)
    )
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Статья не найдена")
    return article
