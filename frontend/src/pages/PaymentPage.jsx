import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/axios'

const DEFAULTS = {
  payment_title: 'Оплата и доставка',
  payment_text:
    'Раздел «Оплата и доставка» — вставьте финальный текст здесь.\n\nСпособы оплаты:\n— Банковская карта онлайн (через ЮKassa)\n— Наличными или переводом при самовывозе\n\nДоставка:\n— СДЭК по всей России до пункта выдачи\n— Стоимость и сроки рассчитываются при оформлении заказа в зависимости от города\n\nВставьте актуальные условия доставки и оплаты здесь.',
}

const PAYMENT_KEYS = ['payment_title', 'payment_text']

export default function PaymentPage() {
  const [data, setData] = useState(DEFAULTS)

  useEffect(() => {
    api.get('/settings/')
      .then(({ data: d }) => {
        setData(prev => {
          const next = { ...prev }
          PAYMENT_KEYS.forEach(k => { if (d[k]) next[k] = d[k] })
          return next
        })
      })
      .catch(() => {})
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
      <div className="mb-14">
        <p className="gold-tag mb-3">◇ Мастерская Алдуин</p>
        <h1 className="font-serif font-bold text-forge-text text-4xl md:text-5xl leading-tight mb-4">
          {data.payment_title}
        </h1>
        <div className="w-12 h-px bg-forge-primary mb-6" />
      </div>

      <section className="mb-14">
        <p className="text-forge-muted font-body text-base leading-relaxed whitespace-pre-line">
          {data.payment_text}
        </p>
      </section>

      <div className="pt-8 border-t border-forge-border flex flex-wrap items-center gap-4">
        <Link to="/" className="btn-gold">В каталог →</Link>
        <Link to="/contacts" className="btn-ghost">Связаться с нами</Link>
      </div>
    </div>
  )
}
