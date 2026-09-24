import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/axios'

const DEFAULTS = {
  privacy_title: 'Политика конфиденциальности',
  privacy_text:
    'Настоящая Политика конфиденциальности описывает, какие персональные данные собирает Мастерская Алдуин, как они используются и защищаются.\n\nМы собираем только те данные, которые вы предоставляете при оформлении заказа: имя, телефон, адрес электронной почты и адрес доставки. Эти данные используются исключительно для исполнения заказа и связи с вами.\n\nМы не передаём ваши данные третьим лицам, за исключением случаев, необходимых для выполнения заказа (служба доставки, платёжный сервис). Обработка платежей осуществляется через сертифицированный сервис ЮKassa.\n\nВставьте финальный текст политики здесь.',
}

const PRIVACY_KEYS = ['privacy_title', 'privacy_text']

export default function PrivacyPage() {
  const [data, setData] = useState(DEFAULTS)

  useEffect(() => {
    api.get('/settings/')
      .then(({ data: d }) => {
        setData(prev => {
          const next = { ...prev }
          PRIVACY_KEYS.forEach(k => { if (d[k]) next[k] = d[k] })
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
          {data.privacy_title}
        </h1>
        <div className="w-12 h-px bg-forge-primary mb-6" />
      </div>

      <section className="mb-14">
        <p className="text-forge-muted font-body text-base leading-relaxed whitespace-pre-line">
          {data.privacy_text}
        </p>
      </section>

      <div className="pt-8 border-t border-forge-border flex flex-wrap items-center gap-4">
        <Link to="/" className="btn-gold">В каталог →</Link>
        <Link to="/contacts" className="btn-ghost">Контакты</Link>
      </div>
    </div>
  )
}
