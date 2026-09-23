"""
Защищённые эндпоинты для управления заказами.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_admin
from app.models import AdminUser, Order, OrderStatus
from app.schemas import OrderRead, OrderStatusUpdate

router = APIRouter()


@router.get("/", response_model=list[OrderRead], summary="Список всех заказов")
async def list_orders(
    order_status: OrderStatus | None = Query(default=None, alias="status"),
    limit:        int                = Query(default=50, le=200),
    offset:       int                = Query(default=0, ge=0),
    db:           AsyncSession       = Depends(get_db),
    _:            AdminUser          = Depends(get_current_admin),
) -> list[OrderRead]:
    q = (
        select(Order)
        .options(selectinload(Order.items))
        .order_by(Order.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if order_status is not None:
        q = q.where(Order.status == order_status)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{order_id}", response_model=OrderRead, summary="Заказ по ID")
async def get_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    _:  AdminUser    = Depends(get_current_admin),
) -> OrderRead:
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    return order


@router.patch(
    "/{order_id}/status",
    response_model=OrderRead,
    summary="Изменить статус заказа",
)
async def update_order_status(
    order_id: int,
    body:     OrderStatusUpdate,
    db:       AsyncSession = Depends(get_db),
    _:        AdminUser    = Depends(get_current_admin),
) -> OrderRead:
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")

    # Защита от недопустимых переходов
    forbidden = {
        OrderStatus.cancelled: [OrderStatus.paid, OrderStatus.shipped],
        OrderStatus.shipped:   [OrderStatus.pending],
    }
    blocked = forbidden.get(order.status, [])
    if body.status in blocked:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Нельзя перевести заказ из '{order.status.value}' в '{body.status.value}'",
        )

    order.status = body.status
    await db.commit()
    await db.refresh(order, attribute_names=["items"])
    return order
