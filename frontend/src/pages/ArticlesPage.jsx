import { useState, useEffect } from 'react'
import { api } from '../api/axios'

/* ── Иконки ─────────────────────────────────────────────────────────────── */
const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
    strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
  </svg>
)

function decodeHtmlText(html) {
  if (!html) return ''
  const clean = html.replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ')
  try {
    const doc = new DOMParser().parseFromString(clean, 'text/html')
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim()
  } catch {
    return clean.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  }
}

function cleanHtmlContent(html) {
  if (!html) return ''
  return html.replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ')
}

/* ── Карточка статьи ─────────────────────────────────────────────────────── */
function ArticleCard({ article }) {
  const [expanded, setExpanded] = useState(false)

  const date = new Date(article.created_at).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const plainText = decodeHtmlText(article.content)
  const isHtml = Boolean(article.content && /<[a-z][\s\S]*>/i.test(article.content))
  const preview = plainText.slice(0, 260)
  const hasMore = plainText.length > 260 || isHtml
  const formattedHtml = cleanHtmlContent(article.content)

  return (
    <article className="border-b border-forge-border/60 py-8 first:pt-0 last:border-0 overflow-hidden">
      
      {/* Обложка статьи */}
      {article.image_url && (
        <div
          onClick={() => setExpanded(e => !e)}
          className="mb-5 overflow-hidden border border-forge-border cursor-pointer group bg-black"
        >
          <img
            src={article.image_url}
            alt={article.title}
            className="w-full h-56 sm:h-72 md:h-80 object-cover transform group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
          />
        </div>
      )}

      {/* Метаданные: Дата и Раздел */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-1.5 text-forge-muted text-xs font-body tracking-wider">
          <CalendarIcon />
          <span>{date}</span>
        </div>

        {article.section && (
          <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 border border-forge-primary/40 text-forge-primary bg-forge-primary/10">
            {article.section.name}
          </span>
        )}
      </div>

      {/* Заголовок */}
      <h2 className="font-serif font-semibold text-forge-text text-xl md:text-2xl
                     leading-snug mb-3 hover:text-forge-primary transition-colors duration-200
                     cursor-pointer break-words"
        onClick={() => setExpanded(e => !e)}>
        {article.title}
      </h2>

      {/* Разделитель */}
      <div className="w-8 h-px bg-forge-primary/50 mb-4" />

      {/* Текст */}
      {expanded ? (
        isHtml ? (
          <div
            className="article-html-content font-body text-sm leading-relaxed break-words space-y-4 [&_img]:max-w-full [&_img]:rounded-none [&_img]:border [&_img]:border-forge-border/60 [&_img]:my-4"
            dangerouslySetInnerHTML={{ __html: formattedHtml }}
          />
        ) : (
          <div className="text-forge-muted font-body text-sm leading-relaxed whitespace-pre-line break-words">
            {formattedHtml}
          </div>
        )
      ) : (
        <div className="text-forge-muted font-body text-sm leading-relaxed break-words">
          {preview}
          {hasMore && <span className="text-forge-muted/50">…</span>}
        </div>
      )}

      {hasMore && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-4 text-forge-primary text-xs font-body tracking-[0.15em]
                     uppercase hover:text-forge-gold-lt transition-colors duration-200"
        >
          {expanded ? '↑ Свернуть' : 'Читать далее →'}
        </button>
      )}
    </article>
  )
}

/* ── Скелетон загрузки ───────────────────────────────────────────────────── */
function ArticleSkeleton() {
  return (
    <div className="border-b border-forge-border/60 py-8 animate-pulse">
      <div className="h-44 w-full bg-forge-border/40 rounded mb-4" />
      <div className="h-3 w-24 bg-forge-border rounded mb-3" />
      <div className="h-6 w-3/4 bg-forge-border rounded mb-3" />
      <div className="h-px w-8 bg-forge-border mb-4" />
      <div className="space-y-2">
        <div className="h-3 bg-forge-border rounded" />
        <div className="h-3 bg-forge-border rounded w-5/6" />
        <div className="h-3 bg-forge-border rounded w-4/6" />
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   SHARED ARTICLES PAGE COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function ArticlesPage({ type, title, subtitle, emptyText }) {
  const [articles,        setArticles]        = useState([])
  const [sections,        setSections]        = useState([])
  const [selectedSection, setSelectedSection] = useState(null)
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState(null)

  // Загрузка разделов для обучения
  useEffect(() => {
    if (type === 'training') {
      api.get('/articles/sections/training')
        .then(({ data }) => setSections(data || []))
        .catch(() => setSections([]))
    }
  }, [type])

  // Загрузка статей
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = {}
        if (type) params.type = type
        if (type === 'training' && selectedSection) params.section_id = selectedSection

        const { data } = await api.get('/articles/', { params })
        setArticles(data)
      } catch {
        setError('Не удалось загрузить материалы. Попробуйте позже.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [type, selectedSection])

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
      {/* Шапка секции */}
      <div className="mb-10">
        <p className="gold-tag mb-3">◇ Мастерская Алдуин</p>
        <h1 className="font-serif font-bold text-forge-text text-4xl md:text-5xl leading-tight mb-4">
          {title}
        </h1>
        <div className="w-12 h-px bg-forge-primary" />
        {subtitle && (
          <p className="text-forge-muted font-body text-base mt-4 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {/* Табы разделов (для страницы обучения) */}
      {type === 'training' && sections.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-8 border-b border-forge-border/40 pb-4">
          <button
            onClick={() => setSelectedSection(null)}
            className={`px-4 py-2 text-xs font-body tracking-wider uppercase transition-colors ${
              selectedSection === null
                ? 'bg-forge-primary text-black font-semibold'
                : 'border border-forge-border text-forge-muted hover:border-forge-primary hover:text-forge-text'
            }`}
          >
            Все разделы
          </button>
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedSection(s.id)}
              className={`px-4 py-2 text-xs font-body tracking-wider uppercase transition-colors ${
                selectedSection === s.id
                  ? 'bg-forge-primary text-black font-semibold'
                  : 'border border-forge-border text-forge-muted hover:border-forge-primary hover:text-forge-text'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Состояния */}
      {loading && (
        <div>
          {[1,2,3].map(i => <ArticleSkeleton key={i} />)}
        </div>
      )}

      {error && (
        <div className="py-12 text-center">
          <p className="text-forge-muted font-body">{error}</p>
        </div>
      )}

      {!loading && !error && articles.length === 0 && (
        <div className="py-16 text-center border border-forge-border/40">
          <p className="text-forge-primary/40 text-3xl mb-3" aria-hidden>◇</p>
          <p className="text-forge-muted font-body">{emptyText ?? 'Материалы скоро появятся'}</p>
        </div>
      )}

      {!loading && !error && articles.length > 0 && (
        <div>
          {articles.map(a => <ArticleCard key={a.id} article={a} />)}
        </div>
      )}
    </div>
  )
}
