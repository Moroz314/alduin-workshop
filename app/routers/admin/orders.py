"""
Защищённые эндпоинты для управления заказами.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_admin
from app.models import AdminUser, Order, OrderStatus
from app.schemas import OrderRead, OrderStatusUpdate
from app.services import cdek_service
from app.services.order_delivery_service import process_cdek_order_for_order

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
    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")

    # Защита от недопустимых переходов
    forbidden = {
        OrderStatus.cancelled: [OrderStatus.paid, OrderStatus.in_production, OrderStatus.shipped],
        OrderStatus.shipped:   [OrderStatus.pending, OrderStatus.in_production],
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


@router.post(
    "/{order_id}/create-cdek",
    response_model=OrderRead,
    summary="Создать заказ в СДЭК (вручную / кнопка «Готово к отправке»)",
)
async def create_cdek_order_endpoint(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> OrderRead:
    """
    Вызывается администратором при готовности изделий «под заказ» (кнопка «Готово к отправке»)
    или при повторной попытке отправки после ошибки СДЭК.
    """
    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")

    # Запуск создания заказа в СДЭК
    cdek_res = await process_cdek_order_for_order(
        order.id,
        mark_shipped_if_in_production=True,
    )

    await db.refresh(order, attribute_names=["items"])

    if not cdek_res.get("success"):
        error_detail = cdek_res.get("error") or "Не удалось создать заказ в СДЭК"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"СДЭК: {error_detail}",
        )

    return order


@router.get(
    "/{order_id}/cdek-print",
    summary="Получить ссылку на печать квитанции / ярлыка СДЭК",
)
async def get_cdek_print_form(
    order_id: int,
    form_type: str = Query(default="orders", description="orders или barcodes"),
    redirect: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")

    if not order.cdek_uuid:
        raise HTTPException(status_code=400, detail="У заказа нет cdek_uuid (заказ еще не создан в СДЭК)")

    pdf_url = await cdek_service.get_print_form_url(order.cdek_uuid, form_type=form_type)
    if not pdf_url:
        raise HTTPException(
            status_code=502,
            detail="СДЭК еще формирует печатную форму или вернул ошибку. Попробуйте через несколько секунд.",
        )

    if redirect:
        return RedirectResponse(pdf_url)

    return {"print_url": pdf_url}


@router.post(
    "/{order_id}/cdek-refresh",
    response_model=OrderRead,
    summary="Обновить статус заказа из СДЭК",
)
async def refresh_cdek_status(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> OrderRead:
    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")

    if not order.cdek_uuid:
        raise HTTPException(status_code=400, detail="Заказ еще не отправлялся в СДЭК")

    try:
        info = await cdek_service.get_cdek_order_info(order.cdek_uuid)
        cdek_num = info.get("cdek_number")
        if cdek_num:
            order.cdek_number = cdek_num
        st = info.get("status")
        if st:
            order.cdek_status = st
        order.cdek_error = None
        await db.commit()
    except Exception as exc:
        order.cdek_error = str(exc)
        await db.commit()
        raise HTTPException(status_code=502, detail=f"Ошибка запроса к СДЭК: {exc}")

    await db.refresh(order, attribute_names=["items"])
    return order
