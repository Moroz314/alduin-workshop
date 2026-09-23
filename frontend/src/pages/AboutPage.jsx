import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/axios'

/* Значения по умолчанию — страница не пуста до загрузки */
const DEFAULT_TITLE = 'О мастерской'
const DEFAULT_TEXT =
  'Мастерская Алдуин — это небольшая мастерская, которая является объединением ' +
  'друзей и мастеров, экспертов в своём деле. Мы делаем изделия из металла, дерева ' +
  'и кожи. Все изделия сделаны вручную, с любовью к ремеслу и уважением к традициям.'

export default function AboutPage() {
  const [title, setTitle] = useState(DEFAULT_TITLE)
  const [text,  setText]  = useState(DEFAULT_TEXT)

  useEffect(() => {
    api.get('/settings/')
      .then(({ data }) => {
        if (data.about_title) setTitle(data.about_title)
        if (data.about_text)  setText(data.about_text)
      })
      .catch(() => { /* оставляем defaults */ })
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
      {/* ── Заголовок ────────────────────────────────────────── */}
      <div className="max-w-2xl mb-14">
        <p className="gold-tag mb-3">◇ Мастерская Алдуин</p>
        <h1 className="font-serif font-bold text-forge-text text-4xl md:text-5xl leading-tight mb-4">
          {title}
        </h1>
        <div className="w-12 h-px bg-forge-primary mb-6" />
        <p className="text-forge-muted font-body text-base md:text-lg leading-relaxed whitespace-pre-line">
          {text}
        </p>
      </div>

      {/* ── Призыв к действию ────────────────────────────────── */}
      <div className="mt-16 pt-10 border-t border-forge-border flex flex-wrap items-center gap-4">
        <Link to="/" className="btn-gold">
          Перейти в каталог →
        </Link>
        <Link to="/contacts" className="btn-ghost">
          Связаться с нами
        </Link>
      </div>
    </div>
  )
}
