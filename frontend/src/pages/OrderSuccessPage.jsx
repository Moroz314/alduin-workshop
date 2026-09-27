import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../api/axios'
import {
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Truck,
  RotateCcw,
  ShoppingBag,
  ExternalLink,
} from 'lucide-react'

const MAX_POLLING_SECONDS = 30
const POLLING_INTERVAL_MS = 2500

export default function OrderSuccessPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()

  // Статусы интерфейса: 'loading' | 'checking' | 'paid' | 'pending_timeout' | 'failed' | 'not_found' | 'error'
  const [uiState, setUiState] = useState('loading')
  const [order, setOrder] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [isRetrying, setIsRetrying] = useState(false)
  const [retryError, setRetryError] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [copied, setCopied] = useState(false)

  const pollingTimerRef = useRef(null)
  const secondsTimerRef = useRef(null)
  const isMountedRef = useRef(true)

  // Очистка таймеров
  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current)
      pollingTimerRef.current = null
    }
    if (secondsTimerRef.current) {
      clearInterval(secondsTimerRef.current)
      secondsTimerRef.current = null
    }
  }, [])

  // Запрос статуса с бэкенда (источник истины — БД)
  const checkStatus = useCallback(async () => {
    if (!orderId) return null
    try {
      const { data } = await api.get(`/orders/${encodeURIComponent(orderId)}/status`)
      if (!isMountedRef.current) return null
      setOrder(data)

      const status = data.status
      if (status === 'paid' || status === 'in_production' || status === 'shipped') {
        setUiState('paid')
        stopPolling()
        return data
      } else if (status === 'cancelled' || status === 'canceled' || status === 'failed') {
        setUiState('failed')
        stopPolling()
        return data
      } else if (status === 'pending') {
        // Заказ ожидает оплаты или вебхука
        setUiState((prev) => (prev === 'pending_timeout' ? 'pending_timeout' : 'checking'))
        return data
      }
      return data
    } catch (err) {
      if (!isMountedRef.current) return null
      console.error('Ошибка проверки статуса заказа:', err)
      if (err.response?.status === 404) {
        setUiState('not_found')
        stopPolling()
      } else {
        setErrorMessage(err.response?.data?.detail || 'Не удалось получить статус заказа')
      }
      return null
    }
  }, [orderId, stopPolling])

  // Запуск опроса при монтировании
  const startPollingFlow = useCallback(() => {
    stopPolling()
    setElapsedSeconds(0)
    setUiState('checking')

    // 1. Первый запрос сразу
    checkStatus().then((data) => {
      if (!data) return
      const s = data.status
      if (s !== 'pending') return

      // 2. Таймер секунд для прогресса
      secondsTimerRef.current = setInterval(() => {
        setElapsedSeconds((sec) => {
          const next = sec + 1
          if (next >= MAX_POLLING_SECONDS) {
            stopPolling()
            setUiState('pending_timeout')
          }
          return next
        })
      }, 1000)

      // 3. Интервал опроса статуса каждые 2.5 секунды
      pollingTimerRef.current = setInterval(() => {
        checkStatus()
      }, POLLING_INTERVAL_MS)
    })
  }, [checkStatus, stopPolling])

  useEffect(() => {
    isMountedRef.current = true
    if (orderId) {
      startPollingFlow()
    } else {
      setUiState('not_found')
    }

    return () => {
      isMountedRef.current = false
      stopPolling()
    }
  }, [orderId, startPollingFlow, stopPolling])

  // Повторить попытку оплаты
  const handleRetryPayment = async () => {
    if (!orderId) return
    setIsRetrying(true)
    setRetryError('')
    try {
      const { data } = await api.post(`/orders/${encodeURIComponent(orderId)}/retry-payment`)
      if (data.payment_url) {
        window.location.href = data.payment_url
        return
      }
      // Если URL не вернулся, перезапускаем опрос
      startPollingFlow()
    } catch (err) {
      console.error('Ошибка повтора оплаты:', err)
      const msg = err.response?.data?.detail || 'Не удалось создать новый платеж. Попробуйте оформить заказ заново.'
      setRetryError(msg)
    } finally {
      setIsRetrying(false)
    }
  }

  // Копирование номера заказа
  const handleCopyOrderId = () => {
    if (!orderId) return
    navigator.clipboard?.writeText(orderId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Форматирование сумм
  const formatMoney = (val) => {
    return Number(val || 0).toLocaleString('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0,
    })
  }

  // Форматирование даты
  const formatDate = (isoString) => {
    if (!isoString) return ''
    try {
      return new Date(isoString).toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return isoString
    }
  }

  return (
    <div className="min-h-screen bg-black text-forge-text py-12 md:py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">

        {/* ══════════════════════════════════════════════════════════
            1. ЭКРАН ПРОВЕРКИ СТАТУСА (PENDING POLLING)
           ══════════════════════════════════════════════════════════ */}
        {uiState === 'checking' && (
          <div className="text-center py-12 animate-fade-up">
            <div className="relative inline-flex items-center justify-center mb-6">
              <div className="w-20 h-20 rounded-full border-2 border-forge-primary/20 border-t-forge-primary animate-spin" />
              <Loader2 className="w-8 h-8 text-forge-primary absolute animate-pulse" />
            </div>

            <p className="gold-tag mb-3">◇ Проверка оплаты</p>
            <h1 className="font-serif font-bold text-forge-text text-3xl md:text-4xl mb-4">
              Проверяем оплату…
            </h1>
            <div className="w-12 h-px bg-forge-primary mx-auto mb-6" />

            <p className="text-forge-muted font-body text-sm max-w-md mx-auto leading-relaxed mb-6">
              Пожалуйста, подождите, мы связываемся с платёжным шлюзом ЮKassa для подтверждения транзакции.
            </p>

            {/* Прогресс-бар опроса */}
            <div className="max-w-xs mx-auto mb-8">
              <div className="w-full bg-forge-surface h-1.5 border border-forge-border overflow-hidden">
                <div
                  className="bg-forge-primary h-full transition-all duration-1000 ease-linear"
                  style={{ width: `${Math.min(100, (elapsedSeconds / MAX_POLLING_SECONDS) * 100)}%` }}
                />
              </div>
              <p className="text-forge-muted/60 text-[11px] font-mono mt-2">
                Ожидание ответа: {elapsedSeconds} сек / {MAX_POLLING_SECONDS} сек
              </p>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-forge-border bg-forge-surface/60 text-xs text-forge-muted">
              <span>Заказ:</span>
              <strong className="text-forge-text font-mono">{orderId}</strong>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            2. ТАЙМАУТ ПРОВЕРКИ (PENDING TIMEOUT > 30s)
           ══════════════════════════════════════════════════════════ */}
        {uiState === 'pending_timeout' && (
          <div className="text-center py-12 animate-fade-up">
            <div className="text-amber-400 mb-6 flex justify-center">
              <Clock className="w-16 h-16 stroke-[1.3] animate-pulse" />
            </div>

            <p className="gold-tag mb-3">⏱ Платёж обрабатывается</p>
            <h1 className="font-serif font-bold text-forge-text text-3xl md:text-4xl mb-4">
              Ожидаем подтверждения от банка
            </h1>
            <div className="w-12 h-px bg-forge-primary mx-auto mb-6" />

            <div className="bg-forge-surface border border-forge-border p-6 mb-8 max-w-lg mx-auto text-left space-y-3">
              <p className="text-forge-text font-body text-base font-medium">
                Если оплата прошла, вы получите письмо. Проверьте позже.
              </p>
              <p className="text-forge-muted font-body text-sm leading-relaxed">
                Иногда банку требуется чуть больше времени на подтверждение транзакции. 
                Чек и информация о заказе поступят на вашу почту сразу после завершения обработки.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <button
                type="button"
                onClick={startPollingFlow}
                className="btn-gold w-full sm:w-auto"
              >
                <RotateCcw className="w-4 h-4" />
                Проверить снова
              </button>

              <button
                type="button"
                onClick={() => setShowDetails((v) => !v)}
                className="btn-ghost w-full sm:w-auto"
              >
                {showDetails ? 'Скрыть детали' : 'Детали заказа'}
                {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            <p className="text-forge-muted/60 text-xs">
              Номер вашего заказа:{' '}
              <button
                type="button"
                onClick={handleCopyOrderId}
                className="font-mono text-forge-primary hover:underline ml-1"
                title="Скопировать"
              >
                {orderId}
              </button>
            </p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            3. ЭКРАН УСПЕШНОЙ ОПЛАТЫ (PAID / IN_PRODUCTION)
           ══════════════════════════════════════════════════════════ */}
        {uiState === 'paid' && (
          <div className="text-center py-10 animate-fade-up">
            <div className="text-forge-primary mb-6 flex justify-center">
              <CheckCircle className="w-16 h-16 stroke-[1.2]" />
            </div>

            <p className="gold-tag mb-3">✓ Оплата подтверждена</p>
            <h1 className="font-serif font-bold text-forge-text text-3xl md:text-4xl mb-3">
              Заказ оплачен, номер № {orderId}
            </h1>
            <div className="w-12 h-px bg-forge-primary mx-auto mb-6" />

            {/* Плашка с номером и статусом */}
            <div className="bg-forge-surface border border-forge-primary/40 p-6 max-w-lg mx-auto mb-8 text-left space-y-4 shadow-gold-sm">
              <div className="flex items-center justify-between border-b border-forge-border pb-3">
                <span className="text-forge-muted text-xs uppercase tracking-wider">Номер заказа</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-forge-primary text-lg">{orderId}</span>
                  <button
                    type="button"
                    onClick={handleCopyOrderId}
                    className="text-forge-muted hover:text-forge-primary transition-colors p-1"
                    title="Скопировать номер"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {order?.status === 'in_production' ? (
                <div className="text-sm text-forge-gold-lt bg-forge-primary/10 border border-forge-primary/30 p-3">
                  В заказе есть изделия индивидуального изготовления. Заказ передан мастерам в производство.
                </div>
              ) : (
                <p className="text-forge-muted font-body text-sm leading-relaxed">
                  Чек и детали заказа отправлены на вашу электронную почту. Мастерская приступает к упаковке и передаче в доставку.
                </p>
              )}

              {order?.total_amount && (
                <div className="flex items-center justify-between pt-1 text-sm">
                  <span className="text-forge-muted">Итого оплачено:</span>
                  <span className="font-serif font-bold text-forge-text text-lg">
                    {formatMoney(order.total_amount)}
                  </span>
                </div>
              )}
            </div>

            {/* Кнопки действий */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <a
                href="#order-details"
                onClick={(e) => {
                  e.preventDefault()
                  setShowDetails(true)
                  setTimeout(() => {
                    document.getElementById('order-details')?.scrollIntoView({ behavior: 'smooth' })
                  }, 100)
                }}
                className="btn-gold w-full sm:w-auto"
              >
                Детали заказа ↓
              </a>

              <Link to="/" className="btn-ghost w-full sm:w-auto">
                <ShoppingBag className="w-4 h-4" />
                Вернуться в каталог
              </Link>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            4. ЭКРАН НЕУДАЧНОЙ ОПЛАТЫ (FAILED / CANCELED)
           ══════════════════════════════════════════════════════════ */}
        {uiState === 'failed' && (
          <div className="text-center py-10 animate-fade-up">
            <div className="text-red-400 mb-6 flex justify-center">
              <XCircle className="w-16 h-16 stroke-[1.2]" />
            </div>

            <p className="text-xs uppercase tracking-[0.2em] font-serif text-red-400 mb-3">
              ✕ Транзакция отклонена
            </p>
            <h1 className="font-serif font-bold text-forge-text text-3xl md:text-4xl mb-4">
              Оплата не прошла
            </h1>
            <div className="w-12 h-px bg-red-400/40 mx-auto mb-6" />

            <div className="bg-red-950/20 border border-red-900/40 p-6 max-w-lg mx-auto mb-8 text-left space-y-3">
              <p className="text-forge-text font-body text-base">
                К сожалению, платёж по заказу <strong className="font-mono text-forge-primary">{orderId}</strong> не был завершён.
              </p>
              <p className="text-forge-muted font-body text-sm leading-relaxed">
                Деньги с вашей карты не были списаны. Возможно, истёк срок сессии, не хватило средств на балансе или банк отклонил операцию.
              </p>
              {retryError && (
                <div className="text-xs text-red-300 bg-red-900/30 p-2.5 border border-red-800/40 mt-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{retryError}</span>
                </div>
              )}
            </div>

            {/* Кнопка «Попробовать снова» */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <button
                type="button"
                onClick={handleRetryPayment}
                disabled={isRetrying}
                className="btn-gold w-full sm:w-auto"
              >
                {isRetrying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Создаем платеж…
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Попробовать снова
                  </>
                )}
              </button>

              <Link to="/checkout" className="btn-ghost w-full sm:w-auto">
                Изменить способ оплаты
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="text-xs text-forge-muted hover:text-forge-primary transition-colors underline underline-offset-4"
            >
              {showDetails ? 'Скрыть детали заказа' : 'Посмотреть детали заказа'}
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            5. ЭКРАН "ЗАКАЗ НЕ НАЙДЕН"
           ══════════════════════════════════════════════════════════ */}
        {uiState === 'not_found' && (
          <div className="text-center py-16 animate-fade-up">
            <div className="text-forge-primary/40 mb-6 flex justify-center">
              <AlertCircle className="w-16 h-16 stroke-[1.2]" />
            </div>

            <h1 className="font-serif font-bold text-forge-text text-3xl mb-4">
              Заказ не найден
            </h1>
            <p className="text-forge-muted font-body text-sm max-w-md mx-auto mb-8">
              Заказ с номером <strong className="font-mono text-forge-text">{orderId}</strong> не существует или был удален.
            </p>

            <Link to="/" className="btn-gold">
              Перейти в каталог
            </Link>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            6. КАРТОЧКА ДЕТАЛЕЙ ЗАКАЗА (ДЛЯ ВСЕХ СОСТОЯНИЙ С ORDER)
           ══════════════════════════════════════════════════════════ */}
        {order && (
          <div
            id="order-details"
            className={`mt-12 pt-8 border-t border-forge-border transition-all duration-300 ${
              uiState === 'paid' || showDetails ? 'block' : 'hidden'
            }`}
          >
            <div className="bg-[#0e0e11] border border-forge-border p-6 md:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-forge-border pb-5 mb-6">
                <div>
                  <h2 className="font-serif font-bold text-forge-text text-xl md:text-2xl">
                    Состав и детали заказа
                  </h2>
                  <p className="text-forge-muted text-xs font-mono mt-1">
                    {order.order_id} · {formatDate(order.created_at)}
                  </p>
                </div>

                {/* Бейдж статуса */}
                <div>
                  {order.status === 'paid' && (
                    <span className="px-3 py-1 bg-green-950/60 border border-green-700/50 text-green-300 text-xs font-medium uppercase tracking-wider">
                      Оплачен
                    </span>
                  )}
                  {order.status === 'in_production' && (
                    <span className="px-3 py-1 bg-amber-950/60 border border-amber-700/50 text-amber-300 text-xs font-medium uppercase tracking-wider">
                      В производстве
                    </span>
                  )}
                  {order.status === 'pending' && (
                    <span className="px-3 py-1 bg-yellow-950/60 border border-yellow-700/50 text-yellow-300 text-xs font-medium uppercase tracking-wider">
                      Ожидает оплаты
                    </span>
                  )}
                  {order.status === 'cancelled' && (
                    <span className="px-3 py-1 bg-red-950/60 border border-red-700/50 text-red-300 text-xs font-medium uppercase tracking-wider">
                      Отменён
                    </span>
                  )}
                  {order.status === 'shipped' && (
                    <span className="px-3 py-1 bg-blue-950/60 border border-blue-700/50 text-blue-300 text-xs font-medium uppercase tracking-wider">
                      Отправлен СДЭК
                    </span>
                  )}
                </div>
              </div>

              {/* Позиции заказа */}
              <div className="mb-6">
                <h3 className="text-xs uppercase tracking-wider text-forge-primary font-serif mb-3">
                  Товары ({order.items?.length || 0})
                </h3>
                <div className="divide-y divide-forge-border/40">
                  {order.items?.map((item) => (
                    <div key={item.id} className="py-3 flex items-center justify-between text-sm">
                      <div className="pr-4">
                        <span className="text-forge-text font-body font-medium">{item.product_name}</span>
                        <div className="text-xs text-forge-muted mt-0.5">
                          {formatMoney(item.product_price)} × {item.quantity} шт.
                        </div>
                      </div>
                      <span className="font-medium text-forge-text font-mono flex-shrink-0">
                        {formatMoney(Number(item.product_price) * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Доставка и Получатель */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5 border-t border-forge-border text-sm mb-6">
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-forge-primary font-serif mb-2 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5" />
                    Доставка СДЭК
                  </h3>
                  <p className="text-forge-muted text-xs leading-relaxed">
                    {order.delivery_address}
                  </p>
                  {order.cdek_number && (
                    <p className="text-xs text-forge-text mt-2 font-mono flex items-center gap-1.5">
                      <span>Трек-номер:</span>
                      <a
                        href={`https://www.cdek.ru/ru/tracking?order_id=${order.cdek_number}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-forge-primary underline flex items-center gap-1"
                      >
                        {order.cdek_number}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="text-xs uppercase tracking-wider text-forge-primary font-serif mb-2">
                    Получатель
                  </h3>
                  <p className="text-forge-text text-xs font-medium">{order.guest_name}</p>
                  <p className="text-forge-muted text-xs">{order.guest_phone}</p>
                  {order.guest_email && (
                    <p className="text-forge-muted text-xs">{order.guest_email}</p>
                  )}
                  {order.comment && (
                    <p className="text-forge-muted/70 text-xs italic mt-2 border-l border-forge-primary/30 pl-2">
                      «{order.comment}»
                    </p>
                  )}
                </div>
              </div>

              {/* Итоги */}
              <div className="pt-4 border-t border-forge-border space-y-2 text-sm">
                <div className="flex justify-between text-forge-muted text-xs">
                  <span>Доставка СДЭК</span>
                  <span>{formatMoney(order.delivery_cost)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-forge-border/40">
                  <span className="text-xs uppercase tracking-wider text-forge-muted">Итого</span>
                  <span className="font-serif font-bold text-forge-primary text-xl">
                    {formatMoney(order.total_amount)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
