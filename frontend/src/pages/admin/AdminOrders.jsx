import { useState, useEffect, useCallback } from 'react'
import {
  Phone,
  Clock,
  ShoppingBag,
  MapPin,
  Truck,
  Mail,
  ExternalLink,
  Printer,
  RefreshCw,
  PackageCheck,
  AlertCircle,
} from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import { adminApi } from '../../api/axios'

const STATUS_CONFIG = {
  pending:       { label: 'Новый',           color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  paid:          { label: 'Оплачен',         color: 'bg-blue-100 text-blue-800 border-blue-200'       },
  in_production: { label: 'В изготовлении',   color: 'bg-purple-100 text-purple-800 border-purple-200' },
  shipped:       { label: 'Отправлен',       color: 'bg-green-100 text-green-800 border-green-200'    },
  cancelled:     { label: 'Отменён',         color: 'bg-red-100 text-red-800 border-red-200'          },
}

/* Допустимые переходы статуса */
const NEXT_STATUSES = {
  pending:       ['paid', 'in_production', 'cancelled'],
  paid:          ['in_production', 'shipped', 'cancelled'],
  in_production: ['shipped', 'cancelled'],
  shipped:       [],
  cancelled:     [],
}

/* ══════════════════════════════════════════════════════════════
   КАРТОЧКА ЗАКАЗА
   ══════════════════════════════════════════════════════════════ */
function OrderCard({ order, onOrderUpdated }) {
  const [loading, setLoading] = useState(false)

  const cfg   = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
  const nexts = NEXT_STATUSES[order.status] || []

  const total = Number(order.total_amount).toLocaleString('ru-RU', {
    style: 'currency', currency: 'RUB', maximumFractionDigits: 0,
  })

  const date = new Date(order.created_at).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })

  const handleStatus = async (status) => {
    setLoading(true)
    try {
      const { data } = await adminApi.patch(`/admin/orders/${order.id}/status`, { status })
      onOrderUpdated(data)
    } catch (err) {
      alert(err.response?.data?.detail ?? 'Ошибка смены статуса')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCdek = async () => {
    setLoading(true)
    try {
      const { data } = await adminApi.post(`/admin/orders/${order.id}/create-cdek`)
      onOrderUpdated(data)
      alert(data.cdek_number ? `Заказ успешно оформлен в СДЭК! Трек-номер: ${data.cdek_number}` : 'Заказ отправлен в СДЭК на обработку.')
    } catch (err) {
      alert(err.response?.data?.detail ?? 'Ошибка при обращении к СДЭК')
      // Обновляем заказ чтобы отобразилась ошибка cdek_error
      try {
        const { data: refreshed } = await adminApi.get(`/admin/orders/${order.id}`)
        onOrderUpdated(refreshed)
      } catch { /* ignore */ }
    } finally {
      setLoading(false)
    }
  }

  const handlePrintCdek = async () => {
    try {
      const { data } = await adminApi.get(`/admin/orders/${order.id}/cdek-print`)
      if (data.print_url) {
        window.open(data.print_url, '_blank')
      } else {
        alert('Ссылка на печать еще не готова, попробуйте через несколько секунд')
      }
    } catch (err) {
      alert(err.response?.data?.detail ?? 'Не удалось получить квитанцию СДЭК')
    }
  }

  const handleRefreshCdek = async () => {
    setLoading(true)
    try {
      const { data } = await adminApi.post(`/admin/orders/${order.id}/cdek-refresh`)
      onOrderUpdated(data)
    } catch (err) {
      alert(err.response?.data?.detail ?? 'Ошибка обновления данных СДЭК')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-5">
        {/* Шапка карточки */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <div className="text-xs text-gray-400 font-mono mb-0.5">{order.order_id}</div>
            <div className="text-lg font-bold text-gray-900">{order.guest_name}</div>
          </div>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full border flex-shrink-0 ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>

        {/* Контакты: Телефон и Email */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4">
          <a
            href={`tel:${order.guest_phone}`}
            className="flex items-center gap-1.5 text-orange-600 font-semibold text-sm hover:underline transition-opacity"
          >
            <Phone size={15} />
            {order.guest_phone}
          </a>
          {order.guest_email && (
            <a
              href={`mailto:${order.guest_email}`}
              className="flex items-center gap-1.5 text-gray-500 text-xs hover:text-gray-700"
            >
              <Mail size={13} />
              {order.guest_email}
            </a>
          )}
        </div>

        {/* ── ТОВАРЫ В ЗАКАЗЕ ──────── */}
        <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3.5 mb-3.5">
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-amber-200/50">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
              <ShoppingBag size={14} className="text-amber-700" />
              Товары в заказе ({order.items?.length ?? 0} шт.)
            </span>
          </div>

          {order.items && order.items.length > 0 ? (
            <div className="space-y-2.5 divide-y divide-amber-200/40">
              {order.items.map(item => (
                <div key={item.id} className="pt-2 first:pt-0 flex items-center justify-between text-sm">
                  <div className="flex-1 min-w-0 pr-3">
                    <span className="text-gray-900 font-bold block leading-snug">
                      {item.product_name}
                    </span>
                    <span className="text-xs text-gray-500 font-medium">
                      {Number(item.product_price).toLocaleString('ru-RU')} ₽ / шт.
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="bg-amber-100 text-amber-900 text-xs font-extrabold px-2 py-0.5 rounded border border-amber-300">
                      ×{item.quantity}
                    </span>
                    <span className="text-gray-900 font-bold text-sm">
                      {Number(item.product_price * item.quantity).toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-400 italic py-1">
              Информация о товарах не найдена
            </div>
          )}
        </div>

        {/* Доставка СДЭК и адрес */}
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 mb-4 text-xs space-y-2">
          <div className="flex items-start gap-1.5 text-gray-800">
            <MapPin size={14} className="text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-gray-900">{order.delivery_address}</div>
              {order.pvz_code && (
                <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                  Код ПВЗ СДЭК: <span className="font-bold text-orange-600">{order.pvz_code}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-gray-500 pt-1.5 border-t border-gray-200/50">
            <span className="flex items-center gap-1 font-medium">
              <Truck size={13} className="text-gray-600" />
              Доставка СДЭК: {Number(order.delivery_cost || 0).toLocaleString('ru-RU')} ₽
            </span>
            <span className="uppercase font-semibold text-[10px] px-2 py-0.5 bg-gray-200 text-gray-700 rounded">
              {order.payment_method === 'sbp' ? 'СБП' : 'Банковская карта'}
            </span>
          </div>

          {/* Отображение статуса СДЭК и номера накладной */}
          {order.cdek_number && (
            <div className="mt-2 pt-2 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">№ СДЭК:</span>
                <a
                  href={`https://www.cdek.ru/ru/tracking?order_id=${order.cdek_number}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono font-bold text-orange-600 hover:underline flex items-center gap-1"
                >
                  {order.cdek_number} <ExternalLink size={12} />
                </a>
                {order.cdek_status && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {order.cdek_status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePrintCdek}
                  className="px-2.5 py-1 text-[11px] font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1 shadow-2xs"
                >
                  <Printer size={12} /> Квитанция
                </button>
                <button
                  type="button"
                  onClick={handleRefreshCdek}
                  disabled={loading}
                  title="Обновить статус СДЭК"
                  className="p-1 text-gray-500 hover:text-gray-800 rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
          )}

          {/* Ошибка СДЭК */}
          {order.cdek_error && (
            <div className="mt-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-1.5">
                  <AlertCircle size={14} className="text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Ошибка СДЭК:</span> {order.cdek_error}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCreateCdek}
                  disabled={loading}
                  className="shrink-0 px-2.5 py-1 bg-red-600 text-white font-bold rounded text-[11px] hover:bg-red-700 transition"
                >
                  {loading ? '...' : 'Повторить'}
                </button>
              </div>
            </div>
          )}

          {order.comment && (
            <div className="text-gray-600 italic pt-1.5 border-t border-gray-200/50">
              «{order.comment}»
            </div>
          )}
        </div>

        {/* Дата и Общий итог */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Clock size={14} />
            {date}
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-gray-400 block -mb-1">
              Итого к оплате
            </span>
            <span className="text-2xl font-black text-gray-900">{total}</span>
          </div>
        </div>
      </div>

      {/* Кнопка «Готово к отправке» для товаров в изготовлении */}
      {order.status === 'in_production' && (
        <div className="px-5 pb-3">
          <button
            type="button"
            onClick={handleCreateCdek}
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center justify-center gap-2 transition active:scale-98 disabled:opacity-50"
          >
            <PackageCheck size={16} />
            {loading ? 'Регистрация в СДЭК...' : '📦 Готово к отправке (оформить СДЭК)'}
          </button>
        </div>
      )}

      {/* Кнопка создания заказа СДЭК для оплаченных заказов без трек-номера */}
      {order.status === 'paid' && !order.cdek_number && (
        <div className="px-5 pb-3">
          <button
            type="button"
            onClick={handleCreateCdek}
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center justify-center gap-2 transition active:scale-98 disabled:opacity-50"
          >
            <Truck size={16} />
            {loading ? 'Создание в СДЭК...' : '🚚 Создать заказ в СДЭК'}
          </button>
        </div>
      )}

      {/* Кнопки смены статуса */}
      {nexts.length > 0 && (
        <div className="flex gap-2 px-5 pb-4 pt-1 border-t border-gray-50 flex-wrap">
          {nexts.map(s => {
            const c = STATUS_CONFIG[s]
            return (
              <button
                key={s}
                onClick={() => handleStatus(s)}
                disabled={loading}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border-2 transition-all active:scale-95 disabled:opacity-50 ${c.color}`}
              >
                {loading ? '...' : `→ ${c.label}`}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   ФИЛЬТР СТАТУСОВ
   ══════════════════════════════════════════════════════════════ */
function StatusFilter({ active, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      <button
        onClick={() => onChange(null)}
        className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors
                    ${active === null ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
      >
        Все заказы
      </button>
      {Object.entries(STATUS_CONFIG).map(([key, { label, color }]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all
                      ${active === key ? color + ' border-current' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════ */
export default function AdminOrders() {
  const [orders,       setOrders]       = useState([])
  const [statusFilter, setStatusFilter] = useState(null)
  const [loading,      setLoading]      = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = statusFilter ? { status: statusFilter } : {}
      const { data } = await adminApi.get('/admin/orders/', { params })
      setOrders(data)
    } catch { /* 401 handled */ }
    finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const handleOrderUpdated = (updatedOrder) => {
    setOrders(prev => prev.map(o =>
      o.id === updatedOrder.id ? updatedOrder : o
    ))
  }

  return (
    <AdminLayout>
      <div className="px-4 py-4 max-w-5xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900 mb-4">Управление заказами</h1>

        <div className="mb-4">
          <StatusFilter active={statusFilter} onChange={setStatusFilter} />
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-44 animate-pulse" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 text-gray-400 bg-white rounded-2xl border border-gray-100">
            <ShoppingBag size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Заказов нет</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onOrderUpdated={handleOrderUpdated}
              />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
