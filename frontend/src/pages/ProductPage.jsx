import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/axios'
import { addToCart, selectAdding, selectSessionId } from '../store/cartSlice'

function cleanHtmlContent(html) {
  if (!html) return ''
  return html.replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ')
}

function ImagePlaceholder({ name }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-forge-surface">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8"
        className="w-20 h-20 text-forge-primary/20" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Z" />
      </svg>
      <span className="text-forge-muted/50 text-xs tracking-[0.2em] uppercase">{name}</span>
    </div>
  )
}

export default function ProductPage() {
  const { slug } = useParams()
  const dispatch = useDispatch()
  const sessionId = useSelector(selectSessionId)
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [added, setAdded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const isAdding = useSelector(state => product ? selectAdding(product.id)(state) : false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    api.get(`/products/${slug}`)
      .then(({ data }) => { if (active) setProduct(data) })
      .catch(err => {
        if (active) setError(err.response?.status === 404 ? 'Товар не найден' : 'Не удалось загрузить товар')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [slug])

  const handleAdd = async () => {
    if (isAdding) return
    const result = await dispatch(addToCart({ sessionId, productId: product.id, quantity: 1 }))
    if (addToCart.fulfilled.match(result)) {
      setAdded(true)
      setTimeout(() => setAdded(false), 2200)
    }
  }

  if (loading) {
    return <div className="max-w-7xl mx-auto px-4 py-24 text-center text-forge-muted">Загрузка товара...</div>
  }

  if (error || !product) {
    return <div className="max-w-7xl mx-auto px-4 py-24 text-center text-forge-muted">{error || 'Товар не найден'}</div>
  }

  const price = Number(product.price).toLocaleString('ru-RU', {
    style: 'currency', currency: 'RUB', maximumFractionDigits: 0,
  })
  const gallery = product.images?.length ? product.images : (product.image_url ? [{ url: product.image_url, is_cover: true }] : [])
  const activeImage = gallery[activeImageIndex] ?? gallery[0]

  const showPreviousImage = () => {
    setImageError(false)
    setActiveImageIndex(index => index === 0 ? gallery.length - 1 : index - 1)
  }

  const showNextImage = () => {
    setImageError(false)
    setActiveImageIndex(index => (index + 1) % gallery.length)
  }

  /* Метка статуса */
  const statusLabel = product.in_stock ? 'В корзину' : 'Под заказ'

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
        {/* ── Галерея ───────────────────────────────────────── */}
        <div>
          <div className="relative aspect-[4/3] lg:aspect-square overflow-hidden bg-forge-surface border border-forge-border">
            {activeImage?.url && !imageError ? (
              <img src={activeImage.url} alt={`${product.name}, фото ${activeImageIndex + 1}`} onError={() => setImageError(true)} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <ImagePlaceholder name={product.name} />
            )}
            {gallery.length > 1 && (
              <>
                <button type="button" onClick={showPreviousImage} aria-label="Предыдущее фото"
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-forge-bg/75 text-forge-text border border-white/20 hover:bg-forge-primary hover:text-black transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <button type="button" onClick={showNextImage} aria-label="Следующее фото"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-forge-bg/75 text-forge-text border border-white/20 hover:bg-forge-primary hover:text-black transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
                  </svg>
                </button>
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-forge-bg/75 text-forge-text text-xs px-3 py-1 border border-white/20">
                  {activeImageIndex + 1} / {gallery.length}
                </span>
              </>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="grid grid-cols-4 gap-2 mt-2">
              {gallery.map((image, index) => (
                <button key={image.id ?? image.url} type="button" onClick={() => { setImageError(false); setActiveImageIndex(index) }}
                  aria-label={`Показать фото ${index + 1}`}
                  className={`aspect-square overflow-hidden border-2 ${index === activeImageIndex ? 'border-forge-primary' : 'border-forge-border opacity-60 hover:opacity-100'} transition-all`}>
                  <img src={image.url} alt={`${product.name}, фото ${index + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Информация ────────────────────────────────────── */}
        <div className="lg:pt-5">
          {product.category && <p className="gold-tag mb-4">{product.category.name}</p>}
          <h1 className="font-serif font-bold text-forge-text text-4xl md:text-5xl leading-tight mb-5">{product.name}</h1>
          <div className="w-12 h-px bg-forge-primary mb-6" />
          <p className="font-serif font-bold text-forge-primary text-3xl mb-6">{price}</p>

          {!product.in_stock && (
            <p className="text-forge-muted font-body text-sm mb-4">
              ◇ Товар изготавливается под заказ
            </p>
          )}

          {product.description && (
            /[a-z][\s\S]*>/i.test(product.description) ? (
              <div
                className="article-html-content font-body text-base leading-relaxed mb-8 break-words"
                dangerouslySetInnerHTML={{ __html: cleanHtmlContent(product.description) }}
              />
            ) : (
              <p className="text-forge-muted font-body text-base leading-relaxed mb-8 whitespace-pre-line break-words">
                {product.description}
              </p>
            )
          )}

          <button
            onClick={handleAdd}
            disabled={isAdding}
            className={`w-full sm:w-auto min-w-[220px] btn-gold justify-center ${added ? 'bg-green-700 text-green-50 hover:bg-green-700' : ''}`}
          >
            {isAdding ? 'Добавление...' : added ? 'Добавлено в корзину' : statusLabel}
          </button>

          {/* Ссылка на гарантию */}
          <p className="mt-4 text-forge-muted/60 font-body text-xs">
            <Link to="/warranty" className="hover:text-forge-primary transition-colors underline underline-offset-2">
              Гарантия 12 месяцев · Условия возврата
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
