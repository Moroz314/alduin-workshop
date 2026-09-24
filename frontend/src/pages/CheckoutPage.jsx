import { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { api } from '../api/axios'
import { selectItems, selectTotal, selectSessionId, clearCartState } from '../store/cartSlice'
import {
  CheckCircle,
  MapPin,
  Search,
  Clock,
  Phone,
  X,
  Truck,
  ChevronRight,
  AlertCircle,
  Loader2,
} from 'lucide-react'

/* ── Экран успеха ────────────────────────────────────────────────────────── */
function SuccessScreen({ orderId }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-20">
      <div className="text-forge-primary mb-6 animate-fade-up">
        <CheckCircle className="w-16 h-16 stroke-[1.2]" />
      </div>
      <h2 className="font-serif font-bold text-forge-text text-3xl md:text-4xl mb-3
                     animate-fade-up [animation-delay:100ms]">
        Заказ оформлен
      </h2>
      <div className="w-10 h-px bg-forge-primary mx-auto my-4
                      animate-fade-up [animation-delay:150ms]" />
      <p className="text-forge-muted font-body text-sm mb-2
                    animate-fade-up [animation-delay:200ms]">
        Номер вашего заказа:
      </p>
      <p className="font-serif font-bold text-forge-primary text-2xl mb-6
                    animate-fade-up [animation-delay:250ms]">
        {orderId}
      </p>
      <p className="text-forge-muted font-body text-sm max-w-xs leading-relaxed mb-8
                    animate-fade-up [animation-delay:300ms]">
        Мастер свяжется с вами в течение нескольких часов для подтверждения и согласования деталей.
      </p>
      <Link to="/"
        className="btn-gold animate-fade-up [animation-delay:380ms]">
        Вернуться в каталог
      </Link>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   CHECKOUT PAGE
   ══════════════════════════════════════════════════════════════ */
export default function CheckoutPage() {
  const dispatch  = useDispatch()
  const items     = useSelector(selectItems)
  const cartTotal = useSelector(selectTotal)
  const sessionId = useSelector(selectSessionId)

  // Базовые поля формы
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    payment: 'card',
    comment: '',
  })

  // Согласие с офертой и политикой конфиденциальности
  const [agreed, setAgreed] = useState(false)

  // Состояния CDEK: Поиск города
  const [cityQuery, setCityQuery]             = useState('')
  const [cities, setCities]                   = useState([])
  const [isSearchingCity, setIsSearchingCity] = useState(false)
  const [showCityDropdown, setShowCityDropdown] = useState(false)
  const [selectedCity, setSelectedCity]       = useState(null)
  const citySearchRef                         = useRef(null)

  // Состояния CDEK: ПВЗ
  const [pvzList, setPvzList]                 = useState([])
  const [isLoadingPvz, setIsLoadingPvz]       = useState(false)
  const [selectedPvz, setSelectedPvz]         = useState(null)
  const [isPvzModalOpen, setIsPvzModalOpen]   = useState(false)
  const [pvzFilterQuery, setPvzFilterQuery]   = useState('')

  // Состояния CDEK: Стоимость доставки
  const [deliveryCost, setDeliveryCost]       = useState(0)
  const [deliveryPeriod, setDeliveryPeriod]   = useState(null)
  const [isCalculating, setIsCalculating]     = useState(false)
  const [deliveryError, setDeliveryError]     = useState('')

  // Общие состояния оформления
  const [loading, setLoading]                 = useState(false)
  const [error, setError]                     = useState('')
  const [orderId, setOrderId]                 = useState(null)

  // Расчет суммарного веса товаров корзины (в граммах)
  const totalWeight = useMemo(() => {
    return Math.max(500, items.reduce((sum, it) => sum + (it.weight || 500) * it.quantity, 0))
  }, [items])

  // Общий итог (корзина + доставка)
  const finalTotal = Number(cartTotal) + (selectedPvz ? Number(deliveryCost) : 0)

  const cartTotalFormatted = Number(cartTotal).toLocaleString('ru-RU', {
    style: 'currency', currency: 'RUB', maximumFractionDigits: 0,
  })

  const deliveryCostFormatted = Number(deliveryCost).toLocaleString('ru-RU', {
    style: 'currency', currency: 'RUB', maximumFractionDigits: 0,
  })

  const finalTotalFormatted = Number(finalTotal).toLocaleString('ru-RU', {
    style: 'currency', currency: 'RUB', maximumFractionDigits: 0,
  })

  // Закрытие выпадающего списка городов по клику вне
  useEffect(() => {
    function handleClickOutside(event) {
      if (citySearchRef.current && !citySearchRef.current.contains(event.target)) {
        setShowCityDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Автопоиск городов при вводе (debounce 300ms)
  useEffect(() => {
    if (!cityQuery || cityQuery.trim().length < 2) {
      setCities([])
      setShowCityDropdown(false)
      return
    }

    // Если запрос совпадает с уже выбранным городом, не переискиваем
    if (selectedCity && cityQuery === `${selectedCity.city}${selectedCity.region ? `, ${selectedCity.region}` : ''}`) {
      return
    }

    const timer = setTimeout(async () => {
      setIsSearchingCity(true)
      try {
        const { data } = await api.get('/delivery/cities', {
          params: { query: cityQuery.trim() },
        })
        setCities(data || [])
        setShowCityDropdown(true)
      } catch (err) {
        console.error('Ошибка поиска городов СДЭК:', err)
      } finally {
        setIsSearchingCity(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [cityQuery, selectedCity])

  // Выбор города
  const handleSelectCity = async (city) => {
    setSelectedCity(city)
    const displayName = `${city.city}${city.region ? `, ${city.region}` : ''}`
    setCityQuery(displayName)
    setShowCityDropdown(false)
    setSelectedPvz(null)
    setDeliveryCost(0)
    setDeliveryPeriod(null)
    setDeliveryError('')

    // Загрузка списка ПВЗ для города
    setIsLoadingPvz(true)
    try {
      const { data } = await api.get('/delivery/pvz', {
        params: { city_code: city.code },
      })
      setPvzList(data || [])
    } catch (err) {
      console.error('Ошибка загрузки ПВЗ:', err)
      setPvzList([])
      setDeliveryError('Не удалось загрузить пункты выдачи для этого города')
    } finally {
      setIsLoadingPvz(false)
    }
  }

  // Очистка выбранного города
  const handleClearCity = () => {
    setSelectedCity(null)
    setCityQuery('')
    setCities([])
    setPvzList([])
    setSelectedPvz(null)
    setDeliveryCost(0)
    setDeliveryPeriod(null)
    setDeliveryError('')
  }

  // Выбор ПВЗ и автоматический расчёт стоимости доставки
  const handleSelectPvz = async (pvz) => {
    setSelectedPvz(pvz)
    setIsPvzModalOpen(false)
    setDeliveryError('')
    setIsCalculating(true)

    try {
      const { data } = await api.post('/delivery/calculate', {
        city_code: selectedCity.code,
        weight: totalWeight,
      })
      setDeliveryCost(Number(data.delivery_sum) || 0)
      setDeliveryPeriod({
        min: data.period_min,
        max: data.period_max,
      })
    } catch (err) {
      console.error('Ошибка расчёта доставки СДЭК:', err)
      setDeliveryError('Не удалось точно рассчитать стоимость. Будет уточнен при подтверждении.')
      setDeliveryCost(450) // стандартный базовый тариф по умолчанию
    } finally {
      setIsCalculating(false)
    }
  }

  // Фильтрация ПВЗ в модальном окне
  const filteredPvzList = useMemo(() => {
    if (!pvzFilterQuery.trim()) return pvzList
    const q = pvzFilterQuery.toLowerCase()
    return pvzList.filter(
      (p) =>
        (p.address && p.address.toLowerCase().includes(q)) ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.address_full && p.address_full.toLowerCase().includes(q))
    )
  }, [pvzList, pvzFilterQuery])

  // Отправка заказа
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!selectedCity) {
      setError('Пожалуйста, выберите город доставки СДЭК из выпадающего списка.')
      return
    }

    if (!selectedPvz) {
      setError('Пожалуйста, выберите пункт выдачи заказов (ПВЗ) СДЭК.')
      return
    }

    if (!agreed) {
      setError('Пожалуйста, подтвердите согласие с офертой и политикой конфиденциальности.')
      return
    }

    setLoading(true)

    const fullDeliveryAddress = `г. ${selectedCity.city}${selectedCity.region ? `, ${selectedCity.region}` : ''}, ПВЗ СДЭК [${selectedPvz.code}] ${selectedPvz.address}`

    try {
      const { data } = await api.post('/checkout/', {
        session_id:       sessionId,
        customer_name:    form.name,
        customer_phone:   form.phone,
        customer_email:   form.email || null,
        delivery_address: fullDeliveryAddress,
        pvz_code:         selectedPvz.code,
        delivery_cost:    deliveryCost,
        payment_method:   form.payment,
        comment:          form.comment || null,
      })

      if (data.payment_url) {
        window.location.href = data.payment_url
        return
      }

      setOrderId(data.order_id)
      dispatch(clearCartState())
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Ошибка оформления заказа. Попробуйте ещё раз.')
    } finally {
      setLoading(false)
    }
  }

  /* Успешно оформлен */
  if (orderId) return <SuccessScreen orderId={orderId} />

  /* Пустая корзина */
  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-20 bg-black">
        <p className="text-forge-primary/30 text-5xl mb-4">◇</p>
        <h2 className="font-serif text-forge-text text-2xl mb-3">Корзина пуста</h2>
        <p className="text-forge-muted font-body text-sm mb-8">
          Добавьте изделия, чтобы оформить заказ
        </p>
        <Link to="/" className="btn-gold">Перейти в каталог</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-forge-text py-12 md:py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Заголовок */}
        <div className="mb-10">
          <p className="gold-tag mb-3">◇ Оформление</p>
          <h1 className="font-serif font-bold text-forge-text text-3xl md:text-4xl mb-4">
            Ваш заказ
          </h1>
          <div className="w-10 h-px bg-forge-primary" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">

          {/* ── Левая колонка: Форма заказа (3/5) ────────────────── */}
          <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-6">

            {/* Контактные данные */}
            <div className="space-y-4">
              <h2 className="text-sm font-serif uppercase tracking-[0.15em] text-forge-primary flex items-center gap-2 border-b border-forge-border pb-2">
                <span>1. Контактные данные</span>
              </h2>

              {/* Имя */}
              <div>
                <label className="block text-forge-muted text-xs tracking-[0.15em] uppercase font-body mb-2">
                  Имя и Фамилия *
                </label>
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Как к вам обращаться"
                  className="w-full bg-transparent border-b border-forge-border
                             px-0 py-2.5 text-forge-text font-body text-base
                             placeholder:text-forge-muted/40
                             focus:outline-none focus:border-forge-primary
                             transition-colors duration-200"
                />
              </div>

              {/* Телефон */}
              <div>
                <label className="block text-forge-muted text-xs tracking-[0.15em] uppercase font-body mb-2">
                  Телефон *
                </label>
                <input
                  required
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+7 (999) 000-00-00"
                  className="w-full bg-transparent border-b border-forge-border
                             px-0 py-2.5 text-forge-text font-body text-base
                             placeholder:text-forge-muted/40
                             focus:outline-none focus:border-forge-primary
                             transition-colors duration-200"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-forge-muted text-xs tracking-[0.15em] uppercase font-body mb-2">
                  Email <span className="normal-case text-forge-muted/50">(для фискального чека и трек-номера)</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="name@example.com"
                  className="w-full bg-transparent border-b border-forge-border
                             px-0 py-2.5 text-forge-text font-body text-base
                             placeholder:text-forge-muted/40
                             focus:outline-none focus:border-forge-primary
                             transition-colors duration-200"
                />
              </div>
            </div>

            {/* ── Блок Доставки СДЭК ────────────────────────────── */}
            <div className="space-y-4 pt-2">
              <h2 className="text-sm font-serif uppercase tracking-[0.15em] text-forge-primary flex items-center gap-2 border-b border-forge-border pb-2">
                <Truck className="w-4 h-4 text-forge-primary" />
                <span>2. Доставка СДЭК (ПВЗ)</span>
              </h2>

              {/* Интерактивный поиск города */}
              <div ref={citySearchRef} className="relative">
                <label className="block text-forge-muted text-xs tracking-[0.15em] uppercase font-body mb-2">
                  Город доставки *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={cityQuery}
                    onChange={(e) => {
                      setCityQuery(e.target.value)
                      if (selectedCity) setSelectedCity(null)
                    }}
                    onFocus={() => {
                      if (cities.length > 0) setShowCityDropdown(true)
                    }}
                    placeholder="Введите город (например, Москва, Санкт-Петербург...)"
                    className="w-full bg-transparent border-b border-forge-border
                               pl-8 pr-8 py-2.5 text-forge-text font-body text-base
                               placeholder:text-forge-muted/40
                               focus:outline-none focus:border-forge-primary
                               transition-colors duration-200"
                  />
                  <Search className="w-4 h-4 text-forge-muted/60 absolute left-0 top-3" />
                  {isSearchingCity && (
                    <Loader2 className="w-4 h-4 text-forge-primary animate-spin absolute right-2 top-3" />
                  )}
                  {!isSearchingCity && cityQuery && (
                    <button
                      type="button"
                      onClick={handleClearCity}
                      className="absolute right-2 top-3 text-forge-muted/60 hover:text-forge-text transition-colors"
                      title="Очистить"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Выпадающий список городов */}
                {showCityDropdown && cities.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-[#111113] border border-forge-border shadow-2xl z-30 max-h-56 overflow-y-auto divide-y divide-forge-border/40">
                    {cities.map((c) => (
                      <button
                        key={`${c.code}-${c.city}`}
                        type="button"
                        onClick={() => handleSelectCity(c)}
                        className="w-full text-left px-4 py-2.5 hover:bg-forge-primary/10 transition-colors flex items-center justify-between group"
                      >
                        <div>
                          <span className="text-forge-text font-body text-sm group-hover:text-forge-primary">
                            {c.city}
                          </span>
                          {c.region && (
                            <span className="block text-forge-muted/60 text-xs font-body">
                              {c.region}, {c.country || 'Россия'}
                            </span>
                          )}
                        </div>
                        <span className="text-forge-muted/40 text-[10px] font-mono">
                          #{c.code}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {showCityDropdown && !isSearchingCity && cities.length === 0 && cityQuery.trim().length >= 2 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-[#111113] border border-forge-border shadow-2xl z-30 p-3 text-center text-xs text-forge-muted">
                    Город не найден в базе СДЭК
                  </div>
                )}
              </div>

              {/* Секция выбора ПВЗ */}
              {selectedCity && (
                <div className="pt-2 animate-fade-up">
                  <label className="block text-forge-muted text-xs tracking-[0.15em] uppercase font-body mb-2">
                    Пункт выдачи заказа (ПВЗ) *
                  </label>

                  {isLoadingPvz ? (
                    <div className="border border-forge-border p-4 flex items-center gap-3 text-forge-muted text-sm">
                      <Loader2 className="w-4 h-4 text-forge-primary animate-spin" />
                      <span>Загружаем пункты выдачи в г. {selectedCity.city}...</span>
                    </div>
                  ) : pvzList.length === 0 ? (
                    <div className="border border-forge-border p-4 text-sm text-amber-300/80 bg-amber-950/20">
                      В данном населенном пункте нет пунктов выдачи СДЭК. Выберите ближайший крупный город или свяжитесь с мастером.
                    </div>
                  ) : !selectedPvz ? (
                    <div>
                      <button
                        type="button"
                        onClick={() => setIsPvzModalOpen(true)}
                        className="w-full border border-forge-primary/50 hover:border-forge-primary bg-forge-primary/5 hover:bg-forge-primary/10 text-forge-primary px-4 py-3.5 flex items-center justify-between transition-all group"
                      >
                        <span className="flex items-center gap-2 font-body text-sm font-medium">
                          <MapPin className="w-4 h-4 text-forge-primary" />
                          Выбрать пункт выдачи СДЭК ({pvzList.length} доступно)
                        </span>
                        <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  ) : (
                    /* Карточка выбранного ПВЗ */
                    <div className="border border-forge-primary/40 bg-forge-surface/80 p-4 space-y-3 relative group">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-2.5">
                          <MapPin className="w-5 h-5 text-forge-primary flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-forge-text font-body text-sm font-medium">
                                {selectedPvz.address}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 border border-forge-primary/40 text-forge-primary bg-forge-primary/10">
                                {selectedPvz.code}
                              </span>
                            </div>
                            <p className="text-forge-muted text-xs mt-1 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-forge-muted/60" />
                              {selectedPvz.work_time || 'Пн-Вс 10:00 - 20:00'}
                            </p>
                            {selectedPvz.phone && (
                              <p className="text-forge-muted/60 text-xs mt-0.5 flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-forge-muted/40" />
                                {selectedPvz.phone}
                              </p>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsPvzModalOpen(true)}
                          className="text-xs text-forge-primary hover:underline flex-shrink-0"
                        >
                          Изменить
                        </button>
                      </div>

                      {/* Статус расчета доставки */}
                      <div className="pt-2 border-t border-forge-border/40 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Truck className="w-3.5 h-3.5 text-forge-primary" />
                          {isCalculating ? (
                            <span className="text-forge-muted flex items-center gap-1.5">
                              <Loader2 className="w-3 h-3 animate-spin text-forge-primary" />
                              Рассчитываем доставку...
                            </span>
                          ) : deliveryPeriod ? (
                            <span className="text-forge-muted">
                              Срок доставки: <strong className="text-forge-text">{deliveryPeriod.min}–{deliveryPeriod.max}</strong> раб. дн.
                            </span>
                          ) : (
                            <span className="text-forge-muted">СДЭК Посылка (склад-склад)</span>
                          )}
                        </div>

                        <span className="text-forge-primary font-semibold text-sm">
                          {isCalculating ? '—' : `${deliveryCost} ₽`}
                        </span>
                      </div>
                    </div>
                  )}

                  {deliveryError && (
                    <p className="text-xs text-amber-400 mt-2 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {deliveryError}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Способ оплаты */}
            <div className="space-y-3 pt-2">
              <h2 className="text-sm font-serif uppercase tracking-[0.15em] text-forge-primary border-b border-forge-border pb-2">
                3. Способ оплаты *
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { value: 'card', label: 'Банковская карта (ЮKassa)' },
                  { value: 'sbp', label: 'Система быстрых платежей (СБП)' },
                ].map(option => (
                  <label
                    key={option.value}
                    className={`flex items-center gap-3 border px-4 py-3 cursor-pointer transition-colors ${
                      form.payment === option.value
                        ? 'border-forge-primary text-forge-primary bg-forge-primary/5'
                        : 'border-forge-border text-forge-muted hover:border-forge-primary/60'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment_method"
                      value={option.value}
                      checked={form.payment === option.value}
                      onChange={e => setForm(f => ({ ...f, payment: e.target.value }))}
                      className="accent-forge-primary"
                    />
                    <span className="font-body text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Комментарий */}
            <div>
              <label className="block text-forge-muted text-xs tracking-[0.15em] uppercase font-body mb-2">
                Комментарий к заказу
              </label>
              <textarea
                rows={2}
                value={form.comment}
                onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
                placeholder="Пожелания по гравировке, размеру или доставке..."
                className="w-full bg-transparent border-b border-forge-border
                           px-0 py-2.5 text-forge-text font-body text-sm
                           placeholder:text-forge-muted/40 resize-none
                           focus:outline-none focus:border-forge-primary
                           transition-colors duration-200"
              />
            </div>

            {error && (
              <div className="p-3 border border-red-900/40 bg-red-950/20 text-red-400 font-body text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Согласие с офертой */}
            <div className="pt-2">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 flex-shrink-0 accent-amber-500 cursor-pointer"
                />
                <span className="text-forge-muted font-body text-xs leading-relaxed">
                  Я ознакомился(ась) с{' '}
                  <Link
                    to="/payment"
                    target="_blank"
                    className="text-forge-primary hover:text-forge-gold-lt underline underline-offset-2 transition-colors"
                  >
                    условиями оплаты и доставки
                  </Link>{' '}
                  и{' '}
                  <Link
                    to="/privacy"
                    target="_blank"
                    className="text-forge-primary hover:text-forge-gold-lt underline underline-offset-2 transition-colors"
                  >
                    политикой конфиденциальности
                  </Link>
                  , и даю согласие на обработку персональных данных.
                </span>
              </label>
            </div>

            {/* Кнопка отправки */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || isCalculating || !agreed}
                className="btn-gold w-full sm:w-auto justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Оформляем заказ…
                  </span>
                ) : (
                  `Оформить заказ на ${finalTotalFormatted} →`
                )}
              </button>
              <p className="mt-2">
                <Link
                  to="/warranty"
                  className="text-forge-muted/50 hover:text-forge-primary font-body text-xs
                             underline underline-offset-2 transition-colors"
                >
                  Гарантия 12 месяцев · Условия возврата
                </Link>
              </p>
            </div>
          </form>

          {/* ── Правая колонка: Состав заказа (2/5) ────────────────── */}
          <div className="lg:col-span-2">
            <div className="border border-forge-border bg-[#0d0d0f] p-6 sticky top-24">
              <h3 className="font-serif text-forge-text text-lg mb-5 border-b border-forge-border pb-3">
                Состав заказа
              </h3>

              {/* Список позиций */}
              <ul className="space-y-4 mb-6 max-h-72 overflow-y-auto pr-1">
                {items.map(item => {
                  const subtotal = Number(item.subtotal ?? item.price * item.quantity)
                    .toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
                  return (
                    <li
                      key={item.product_id}
                      className="flex items-start gap-3 pb-3 border-b border-forge-border/40 last:border-0 last:pb-0"
                    >
                      <div className="w-12 h-12 bg-forge-surface flex-shrink-0 flex items-center justify-center border border-forge-border/60 overflow-hidden">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name}
                            className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-forge-primary/20 text-[9px] font-body uppercase">
                            {item.name?.slice(0,2)}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-forge-text font-body text-sm line-clamp-1">{item.name}</p>
                        <p className="text-forge-muted font-body text-xs mt-0.5">× {item.quantity}</p>
                      </div>
                      <span className="text-forge-text font-body text-sm font-medium flex-shrink-0">
                        {subtotal}
                      </span>
                    </li>
                  )
                })}
              </ul>

              {/* Расчет стоимости */}
              <div className="space-y-2.5 pt-4 border-t border-forge-border text-sm">
                <div className="flex items-center justify-between text-forge-muted">
                  <span>Товары ({items.reduce((s, i) => s + i.quantity, 0)} шт.)</span>
                  <span className="text-forge-text font-medium">{cartTotalFormatted}</span>
                </div>

                <div className="flex items-center justify-between text-forge-muted">
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-forge-primary" />
                    Доставка СДЭК:
                  </span>
                  {selectedPvz ? (
                    <span className="text-forge-primary font-medium">
                      {isCalculating ? 'расчёт...' : `${deliveryCost} ₽`}
                    </span>
                  ) : (
                    <span className="text-forge-muted/50 text-xs italic">
                      выберите ПВЗ
                    </span>
                  )}
                </div>

                {deliveryPeriod && (
                  <div className="text-[11px] text-forge-muted/60 pl-5">
                    Срок: {deliveryPeriod.min}–{deliveryPeriod.max} раб. дней
                  </div>
                )}
              </div>

              {/* Итог */}
              <div className="flex items-center justify-between pt-5 mt-4 border-t border-forge-primary/20">
                <span className="text-forge-muted font-body text-xs tracking-wider uppercase">
                  Итого к оплате
                </span>
                <span className="font-serif font-bold text-forge-primary text-2xl">
                  {finalTotalFormatted}
                </span>
              </div>

              <div className="mt-6 pt-4 border-t border-forge-border/40 text-center">
                <p className="text-forge-muted/40 font-body text-[10px] tracking-wider uppercase">
                  Отправка из Санкт-Петербурга (мастерская Алдуин)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Модальное окно выбора ПВЗ СДЭК ────────────────────────── */}
      {isPvzModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111113] border border-forge-primary/40 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-fade-up">
            
            {/* Шапка модалки */}
            <div className="p-5 border-b border-forge-border flex items-center justify-between">
              <div>
                <h3 className="font-serif text-forge-text text-lg font-bold flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-forge-primary" />
                  Пункты выдачи СДЭК — {selectedCity?.city}
                </h3>
                <p className="text-forge-muted text-xs mt-0.5">
                  Доступно {filteredPvzList.length} из {pvzList.length} пунктов выдачи
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPvzModalOpen(false)}
                className="text-forge-muted hover:text-forge-text p-1.5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Поиск по адресу внутри модалки */}
            <div className="p-4 border-b border-forge-border/60 bg-black/40">
              <div className="relative">
                <input
                  type="text"
                  value={pvzFilterQuery}
                  onChange={(e) => setPvzFilterQuery(e.target.value)}
                  placeholder="Поиск по улице, номеру дома или коду ПВЗ..."
                  className="w-full bg-[#18181b] border border-forge-border pl-9 pr-4 py-2 text-sm text-forge-text placeholder:text-forge-muted/50 focus:outline-none focus:border-forge-primary transition-colors"
                />
                <Search className="w-4 h-4 text-forge-muted/50 absolute left-3 top-2.5" />
                {pvzFilterQuery && (
                  <button
                    type="button"
                    onClick={() => setPvzFilterQuery('')}
                    className="absolute right-3 top-2.5 text-forge-muted/50 hover:text-forge-text"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Список пунктов выдачи */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-forge-border/20">
              {filteredPvzList.length === 0 ? (
                <div className="text-center py-10 text-forge-muted text-sm">
                  Ничего не найдено по запросу «{pvzFilterQuery}»
                </div>
              ) : (
                filteredPvzList.map((pvz) => {
                  const isSelected = selectedPvz?.code === pvz.code
                  return (
                    <div
                      key={pvz.code}
                      onClick={() => handleSelectPvz(pvz)}
                      className={`pt-2.5 first:pt-0 p-3 rounded-none cursor-pointer border transition-all ${
                        isSelected
                          ? 'border-forge-primary bg-forge-primary/10'
                          : 'border-forge-border/60 hover:border-forge-primary/60 bg-black/20 hover:bg-forge-primary/5'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-forge-primary font-bold px-1.5 py-0.5 bg-forge-primary/10 border border-forge-primary/30">
                              {pvz.code}
                            </span>
                            <span className="text-forge-text text-sm font-medium">
                              {pvz.address}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-forge-muted pt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-forge-muted/60" />
                              {pvz.work_time || '10:00 - 20:00'}
                            </span>
                            {pvz.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3.5 h-3.5 text-forge-muted/60" />
                                {pvz.phone}
                              </span>
                            )}
                          </div>

                          {pvz.note && (
                            <p className="text-[11px] text-forge-muted/60 italic pt-0.5">
                              {pvz.note}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          className={`text-xs px-3 py-1.5 flex-shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-forge-primary text-black font-semibold'
                              : 'border border-forge-border text-forge-muted hover:border-forge-primary hover:text-forge-primary'
                          }`}
                        >
                          {isSelected ? 'Выбран' : 'Выбрать'}
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Подвал модалки */}
            <div className="p-3 border-t border-forge-border bg-black/50 text-right">
              <button
                type="button"
                onClick={() => setIsPvzModalOpen(false)}
                className="text-xs text-forge-muted hover:text-forge-text px-4 py-1.5"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
