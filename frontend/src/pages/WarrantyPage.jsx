import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/axios'

/* ── Значения по умолчанию ─────────────────────────────────────────────────── */
const DEFAULTS = {
  warranty_return_title: 'Возврат товара',
  warranty_return_text:
    'Дорогие покупатели Мастерской Алдуин! В соответствии со ст. 26.1 Закона ' +
    '«О защите прав потребителей» вы можете вернуть товар, если он не относится ' +
    'к категории изделий с индивидуально-определёнными свойствами, не был в употреблении, ' +
    'полностью сохранены его товарный вид, потребительские качества, все бирки, ' +
    'документы об оплате и заводская упаковка.',
  warranty_period_title: 'Гарантийный срок',
  warranty_period_text:
    'Срок гарантии — 12 месяцев. Если за этот период обнаружится производственный брак, ' +
    'мы проведём бесплатный ремонт. В случае невозможности ремонта — заменим изделие ' +
    'новым аналогом либо вернём полную стоимость. Гарантия не действует при естественном ' +
    'износе, возникшем в процессе использования, а также при поломках из-за неправильной ' +
    'эксплуатации. Мы дорожим своей репутацией и делаем всё, чтобы вы остались довольны ' +
    'качеством нашей продукции.',
}

const WARRANTY_KEYS = [
  'warranty_return_title', 'warranty_return_text',
  'warranty_period_title', 'warranty_period_text',
]

export default function WarrantyPage() {
  const [data, setData] = useState(DEFAULTS)

  useEffect(() => {
    api.get('/settings/')
      .then(({ data: d }) => {
        setData(prev => {
          const next = { ...prev }
          WARRANTY_KEYS.forEach(k => { if (d[k]) next[k] = d[k] })
          return next
        })
      })
      .catch(() => { /* оставляем defaults */ })
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
      {/* ── Заголовок страницы ────────────────────────────────────── */}
      <div className="mb-14">
        <p className="gold-tag mb-3">◇ Мастерская Алдуин</p>
        <h1 className="font-serif font-bold text-forge-text text-4xl md:text-5xl leading-tight mb-4">
          Гарантийные обязательства
        </h1>
        <div className="w-12 h-px bg-forge-primary mb-6" />
      </div>

      {/* ── Раздел «Возврат товара» ────────────────────────────────── */}
      <section className="mb-12">
        <h2 className="font-serif font-bold text-forge-text text-2xl sm:text-3xl mb-5">
          {data.warranty_return_title}
        </h2>
        <p className="text-forge-muted font-body text-base leading-relaxed whitespace-pre-line">
          {data.warranty_return_text}
        </p>
      </section>

      {/* Разделитель */}
      <div className="rune-divider my-10">
        <span className="text-forge-primary/40 text-xs font-heading tracking-widest">⚒</span>
      </div>

      {/* ── Раздел «Гарантийный срок» ─────────────────────────────── */}
      <section className="mb-14">
        <h2 className="font-serif font-bold text-forge-text text-2xl sm:text-3xl mb-5">
          {data.warranty_period_title}
        </h2>
        <p className="text-forge-muted font-body text-base leading-relaxed whitespace-pre-line">
          {data.warranty_period_text}
        </p>
      </section>

      {/* ── Навигация ─────────────────────────────────────────────── */}
      <div className="pt-8 border-t border-forge-border flex flex-wrap items-center gap-4">
        <Link to="/" className="btn-gold">
          В каталог →
        </Link>
        <Link to="/contacts" className="btn-ghost">
          Связаться с нами
        </Link>
      </div>
    </div>
  )
}
