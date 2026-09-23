import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import {
  closeDrawer,
  removeFromCart,
  updateQuantity,
  selectIsOpen,
  selectItems,
  selectTotal,
  selectLoading,
  selectSessionId,
} from '../store/cartSlice'

/* ── Иконки ─────────────────────────────────────────────────────────────── */
const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
    strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
)

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
    strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
  </svg>
)

const CartEmptyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
    strokeWidth={1} stroke="currentColor" className="w-16 h-16 text-forge-primary/25">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M2.25 3h1.386c.51 0 .955.343 1.087.836l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
  </svg>
)

/* ── Одна позиция корзины ────────────────────────────────────────────────── */
function CartItem({ item }) {
  const dispatch   = useDispatch()
  const sessionId  = useSelector(selectSessionId)
  const loading    = useSelector(selectLoading)

  const handleRemove = () => {
    dispatch(removeFromCart({ sessionId, productId: item.product_id }))
  }

  const handleQty = (delta) => {
    const next = item.quantity + delta
    dispatch(updateQuantity({ sessionId, productId: item.product_id, quantity: next }))
  }

  const price    = Number(item.price).toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
  const subtotal = Number(item.subtotal).toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })

  return (
    <li className="flex gap-3 py-4 border-b border-white/6 last:border-0">

      {/* Миниатюра */}
      <div className="flex-shrink-0 w-16 h-16 bg-forge-surface border border-white/6 overflow-hidden relative">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name}
            className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-forge-primary/20 font-heading text-[10px] tracking-widest text-center px-1">
              {item.name.slice(0, 3).toUpperCase()}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-grid-forge opacity-40" />
      </div>

      {/* Инфо */}
      <div className="flex-1 min-w-0">
        <p className="font-heading text-sm text-forge-text tracking-wide leading-snug line-clamp-2 mb-2">
          {item.name}
        </p>
        <p className="text-forge-muted text-xs">{price} × {item.quantity}</p>
      </div>

      {/* Правая колонка: цена + контролы */}
      <div className="flex flex-col items-end justify-between flex-shrink-0">
        <span className="font-heading font-bold text-forge-primary text-sm">{subtotal}</span>

        <div className="flex items-center gap-1 mt-2">
          {/* Кнопки ±quantity */}
          <button
            onClick={() => handleQty(-1)}
            disabled={loading}
            className="w-6 h-6 flex items-center justify-center
                       border border-white/15 text-forge-muted
                       hover:border-forge-primary/50 hover:text-forge-primary
                       transition-colors duration-150 disabled:opacity-30 text-sm leading-none"
            aria-label="Уменьшить количество"
          >
            −
          </button>
          <span className="w-6 text-center font-heading text-xs text-forge-text">
            {item.quantity}
          </span>
          <button
            onClick={() => handleQty(+1)}
            disabled={loading}
            className="w-6 h-6 flex items-center justify-center
                       border border-white/15 text-forge-muted
                       hover:border-forge-primary/50 hover:text-forge-primary
                       transition-colors duration-150 disabled:opacity-30 text-sm leading-none"
            aria-label="Увеличить количество"
          >
            +
          </button>

          {/* Удалить */}
          <button
            onClick={handleRemove}
            disabled={loading}
            className="ml-1 w-6 h-6 flex items-center justify-center
                       text-forge-muted/50 hover:text-red-500
                       transition-colors duration-150 disabled:opacity-30"
            aria-label={`Удалить «${item.name}» из корзины`}
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </li>
  )
}

/* ══════════════════════════════════════════════════════════════
   CART DRAWER
   ══════════════════════════════════════════════════════════════ */
export default function CartDrawer() {
  const dispatch  = useDispatch()
  const isOpen    = useSelector(selectIsOpen)
  const items     = useSelector(selectItems)
  const total     = useSelector(selectTotal)
  const loading   = useSelector(selectLoading)
  const navigate  = useNavigate()
  const drawerRef = useRef(null)

  /* Закрытие по Escape */
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') dispatch(closeDrawer()) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [dispatch])

  /* Блокируем прокрутку body когда открыт */
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const totalFormatted = Number(total).toLocaleString('ru-RU', {
    style: 'currency', currency: 'RUB', maximumFractionDigits: 0,
  })

  const handleCheckout = () => {
    dispatch(closeDrawer())
    navigate('/checkout')
  }

  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────────── */}
      <div
        onClick={() => dispatch(closeDrawer())}
        aria-hidden="true"
        className={`
          fixed inset-0 z-40
          bg-black/70 backdrop-blur-sm
          transition-opacity duration-300
          ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
      />

      {/* ── Drawer panel ──────────────────────────────────────────── */}
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Корзина"
        className={`
          fixed top-0 right-0 bottom-0 z-50
          w-full max-w-md
          bg-forge-bg
          border-l border-forge-primary/20
          shadow-[-8px_0_60px_rgba(0,0,0,0.8)]
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Золотая полоска сверху */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-forge-primary to-transparent flex-shrink-0" />

        {/* ── Шапка ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
          <div>
            <h2 className="font-heading font-bold text-forge-text tracking-widest uppercase text-lg">
              Корзина
            </h2>
            {items.length > 0 && (
              <p className="text-forge-muted text-xs tracking-wider mt-0.5">
                {items.length} {items.length === 1 ? 'позиция' : items.length < 5 ? 'позиции' : 'позиций'}
              </p>
            )}
          </div>
          <button
            onClick={() => dispatch(closeDrawer())}
            className="p-2 text-forge-muted hover:text-forge-primary transition-colors duration-200"
            aria-label="Закрыть корзину"
          >
            <XIcon />
          </button>
        </div>

        {/* ── Список товаров ────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-2">

          {/* Загрузка */}
          {loading && items.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <svg className="w-8 h-8 animate-spin text-forge-primary/50"
                xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          )}

          {/* Пустая корзина */}
          {!loading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-16">
              <CartEmptyIcon />
              <p className="font-heading text-forge-text text-base tracking-wider">
                Корзина пуста
              </p>
              <p className="text-forge-muted text-sm max-w-[220px]">
                Добавьте изделия из каталога — кузнец уже ждёт
              </p>
              <button
                onClick={() => dispatch(closeDrawer())}
                className="btn-outline text-xs mt-2"
              >
                <Link to="/catalog">Перейти в каталог</Link>
              </button>
            </div>
          )}

          {/* Список */}
          {items.length > 0 && (
            <ul>
              {items.map(item => (
                <CartItem key={item.product_id} item={item} />
              ))}
            </ul>
          )}
        </div>

        {/* ── Подвал: итог + кнопка ─────────────────────────────── */}
        {items.length > 0 && (
          <div className="flex-shrink-0 border-t border-white/8 px-5 py-5 space-y-4 bg-forge-surface/50">

            {/* Декоративный разделитель */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-forge-primary/30 to-transparent" />
              <span className="text-forge-primary/40 text-xs font-heading tracking-widest">⚒</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-forge-primary/30 to-transparent" />
            </div>

            {/* Итог */}
            <div className="flex items-center justify-between">
              <span className="font-heading text-forge-muted text-sm tracking-wider uppercase">
                Итого:
              </span>
              <span className="font-heading font-bold text-forge-primary text-2xl tracking-wide">
                {totalFormatted}
              </span>
            </div>

            {/* Кнопка оформить */}
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="
                w-full flex items-center justify-center gap-2
                py-4 px-6
                font-heading font-bold text-sm tracking-widest uppercase
                text-forge-text bg-forge-primary border border-forge-primary
                transition-all duration-200
                hover:bg-forge-ember hover:shadow-ember
                active:scale-[0.98]
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {loading ? (
                <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg"
                  fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                    strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007Z" />
                  </svg>
                  Оформить заказ
                </>
              )}
            </button>

            <p className="text-forge-muted/40 text-[10px] text-center tracking-wider font-heading uppercase">
              Сковано в мастерской Алдуин
            </p>
          </div>
        )}
      </aside>
    </>
  )
}
