import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import ProductCard from './ProductCard'
import Hero from './Hero'

/* ══════════════════════════════════════════════════════════════
   СКЕЛЕТОН — заглушка карточки при загрузке
   ══════════════════════════════════════════════════════════════ */
function SkeletonCard() {
  return (
    <div className="flex flex-col bg-forge-bg border border-white/8 overflow-hidden animate-pulse">
      {/* Изображение */}
      <div className="w-full aspect-[4/3] bg-forge-surface" />
      {/* Контент */}
      <div className="p-4 flex flex-col gap-3">
        <div className="h-4 bg-forge-surface rounded-sm w-3/4" />
        <div className="h-3 bg-forge-surface rounded-sm w-full" />
        <div className="h-3 bg-forge-surface rounded-sm w-5/6" />
        <div className="flex items-center justify-between mt-2 pt-3 border-t border-white/6">
          <div className="h-6 bg-forge-surface rounded-sm w-1/3" />
          <div className="h-8 bg-forge-surface rounded-sm w-1/3" />
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   ФИЛЬТР КАТЕГОРИЙ
   ══════════════════════════════════════════════════════════════ */
function CategoryFilter({ categories, activeId, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Фильтр по категории">
      <button
        onClick={() => onChange(null)}
        className={`
          px-4 py-1.5 font-heading text-rune-sm tracking-widest uppercase
          border transition-all duration-200
          ${activeId === null
            ? 'bg-forge-primary border-forge-primary text-white'
            : 'bg-transparent border-white/15 text-forge-muted hover:border-forge-primary/50 hover:text-forge-primary'}
        `}
      >
        Все
      </button>

      {categories.map(cat => (
        <button
          key={cat.id}
          onClick={() => onChange(cat.id)}
          className={`
            px-4 py-1.5 font-heading text-rune-sm tracking-widest uppercase
            border transition-all duration-200
            ${activeId === cat.id
              ? 'bg-forge-primary border-forge-primary text-white'
              : 'bg-transparent border-white/15 text-forge-muted hover:border-forge-primary/50 hover:text-forge-primary'}
          `}
        >
          {cat.name}
        </button>
      ))}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   БЛОК ОШИБКИ
   ══════════════════════════════════════════════════════════════ */
function ErrorBlock({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
      {/* Иконка — сломанный молот */}
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
        strokeWidth={1.2} stroke="currentColor" className="w-16 h-16 text-forge-primary/40">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" />
      </svg>

      <div>
        <p className="font-heading text-forge-text text-lg tracking-wider mb-2">
          Не удалось загрузить каталог
        </p>
        <p className="text-forge-muted text-sm max-w-sm">
          {message || 'Проверьте, запущен ли бэкенд на порту 8000.'}
        </p>
      </div>

      <button onClick={onRetry} className="btn-outline">
        Попробовать снова
      </button>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   ПУСТОЙ КАТАЛОГ
   ══════════════════════════════════════════════════════════════ */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <p className="text-forge-primary/30 text-5xl font-heading tracking-widest">᛬</p>
      <p className="font-heading text-forge-text text-lg tracking-wider">
        Товаров пока нет
      </p>
      <p className="text-forge-muted text-sm">
        Мастерская готовит новые изделия — загляните позже
      </p>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   CATALOG — главный компонент
   ══════════════════════════════════════════════════════════════ */
const SKELETON_COUNT = 6

export default function Catalog() {
  const [products, setProducts]     = useState([])
  const [categories, setCategories] = useState([])
  const [activeCategory, setActiveCategory] = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)

  /* Загрузка категорий */
  useEffect(() => {
    axios.get('/api/categories/')
      .then(res => setCategories(res.data))
      .catch(() => { /* категории не критичны */ })
  }, [])

  /* Загрузка товаров */
  const fetchProducts = useCallback(async (categoryId = null) => {
    setLoading(true)
    setError(null)
    try {
      const params = {}
      if (categoryId !== null) params.category_id = categoryId

      const { data } = await axios.get('/api/products/', { params })
      setProducts(data)
    } catch (err) {
      const msg = err.response
        ? `Ошибка сервера: ${err.response.status}`
        : 'Сервер недоступен. Убедитесь что бэкенд запущен (порт 8000).'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts(activeCategory)
  }, [activeCategory, fetchProducts])

  const handleCategoryChange = (id) => {
    setActiveCategory(id)
  }

  return (
    <div>
      <Hero />

      <section id="catalog-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 scroll-mt-20">

      {/* ── Заголовок ───────────────────────────────────────────────── */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-forge-primary/50 font-heading text-rune-xs tracking-[0.3em] uppercase">
            ᚱ Мастерская Алдуин
          </span>
        </div>
        <h1 className="section-title text-glow mb-6">Каталог изделий</h1>

        {/* Разделитель */}
        <div className="rune-divider mb-8">
          <span className="text-forge-primary/40 text-xs font-heading tracking-widest">⚒</span>
        </div>

        {/* Фильтр по категориям */}
        {categories.length > 0 && (
          <CategoryFilter
            categories={categories}
            activeId={activeCategory}
            onChange={handleCategoryChange}
          />
        )}
      </div>

      {/* ── Ошибка ──────────────────────────────────────────────────── */}
      {error && (
        <ErrorBlock message={error} onRetry={() => fetchProducts(activeCategory)} />
      )}

      {/* ── Сетка: скелетоны при загрузке ───────────────────────────── */}
      {!error && (
        <div className="
          grid
          grid-cols-1
          sm:grid-cols-2
          lg:grid-cols-3
          gap-6
        ">
          {loading
            ? Array.from({ length: SKELETON_COUNT }, (_, i) => <SkeletonCard key={i} />)
            : products.length > 0
              ? products.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))
              : <div className="col-span-full"><EmptyState /></div>
          }
        </div>
      )}

      {/* Счётчик результатов */}
      {!loading && !error && products.length > 0 && (
        <p className="text-forge-muted/50 text-xs font-heading tracking-widest uppercase text-center mt-10">
          Показано изделий: {products.length}
        </p>
      )}
    </section>
  </div>
  )
}
