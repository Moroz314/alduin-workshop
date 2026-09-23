import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { addToCart, selectAdding, selectSessionId } from '../store/cartSlice'

/* ── SVG placeholder ─────────────────────────────────────────────────────── */
const ImagePlaceholder = ({ name }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-forge-surface/80 gap-3">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
      strokeWidth={0.8} stroke="currentColor" className="w-10 h-10 text-forge-primary/20">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5
           1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5
           0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5
           1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375
           0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
    <span className="text-forge-primary/20 font-body text-[10px] tracking-[0.2em] uppercase px-4 text-center">
      {name.slice(0, 20)}
    </span>
  </div>
)

function stripHtml(html) {
  if (!html) return ''
  const clean = html.replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ')
  try {
    const doc = new DOMParser().parseFromString(clean, 'text/html')
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim()
  } catch {
    return clean.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  }
}

export default function ProductCard({ product }) {
  const dispatch   = useDispatch()
  const sessionId  = useSelector(selectSessionId)
  const isAdding   = useSelector(selectAdding(product.id))
  const [added,    setAdded]    = useState(false)
  const [imgError, setImgError] = useState(false)

  const price = Number(product.price).toLocaleString('ru-RU', {
    style: 'currency', currency: 'RUB', maximumFractionDigits: 0,
  })

  const handleAdd = async () => {
    if (isAdding) return
    const result = await dispatch(addToCart({ sessionId, productId: product.id, quantity: 1 }))
    if (addToCart.fulfilled.match(result)) {
      setAdded(true)
      setTimeout(() => setAdded(false), 2200)
    }
  }

  return (
    <article
      className="
        group relative flex flex-col
        bg-forge-surface border border-forge-border
        transition-all duration-400 ease-out
        hover:border-forge-primary/50 hover:shadow-gold hover:-translate-y-0.5
      "
      aria-label={`Товар: ${product.name}`}
    >
      {/* ── Изображение ───────────────────────────────────────── */}
      <Link to={`/product/${product.slug}`} className="relative block w-full aspect-[4/3] overflow-hidden bg-forge-bg flex-shrink-0">
        {product.image_url && !imgError ? (
          <img
            src={product.image_url}
            alt={product.name}
            onError={() => setImgError(true)}
            className="absolute inset-0 w-full h-full object-cover
                       transition-transform duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <ImagePlaceholder name={product.name} />
        )}

        {/* Затемнение снизу */}
        <div className="absolute inset-0 bg-gradient-to-t
                        from-forge-surface/80 via-transparent to-transparent
                        opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Бейдж «Под заказ» */}
        {!product.in_stock && (
          <div className="absolute top-3 right-3 z-10
                          bg-forge-bg/90 border border-forge-border
                          px-2.5 py-1 text-[10px] tracking-[0.2em] uppercase
                          text-forge-muted font-body">
            Под заказ
          </div>
        )}

        {/* Золотая полоска сверху при hover */}
        <div className="absolute top-0 left-0 right-0 h-0.5
                        bg-forge-primary scale-x-0 group-hover:scale-x-100
                        transition-transform duration-300 origin-left" />
      </Link>

      {/* ── Контент ───────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 p-5 gap-3">
        <Link to={`/product/${product.slug}`} className="font-serif font-semibold text-forge-text text-lg leading-snug
                       line-clamp-2 group-hover:text-forge-primary transition-colors duration-200">
          {product.name}
        </Link>

        {product.description && (
          <p className="text-forge-muted text-sm leading-relaxed line-clamp-2 font-body flex-1 break-words">
            {stripHtml(product.description)}
          </p>
        )}

        {/* Категория */}
        {product.category && (
          <span className="text-forge-primary/60 text-[10px] tracking-[0.2em] uppercase font-body">
            {product.category.name}
          </span>
        )}

        {/* ── Цена + кнопка ─────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 mt-auto pt-4
                        border-t border-forge-border/60">
          <span className="font-serif font-bold text-forge-primary text-xl tracking-tight">
            {price}
          </span>

          <button
            onClick={handleAdd}
            disabled={isAdding}
            aria-label={`Добавить «${product.name}» в корзину`}
            className={`
              flex items-center gap-1.5 px-4 py-2.5
              font-body font-semibold text-xs tracking-[0.12em] uppercase
              rounded-none transition-all duration-200
              disabled:opacity-40 disabled:cursor-not-allowed active:scale-95
              ${added
                ? 'bg-green-800/70 text-green-300 border border-green-700/50'
                : 'bg-forge-primary text-black hover:bg-forge-gold-lt'
              }
            `}
          >
            {isAdding ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : added ? (
              <>
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd"
                    d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                    clipRule="evenodd" />
                </svg>
                Добавлено
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none"
                  viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                  className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                {product.in_stock ? 'В корзину' : 'Под заказ'}
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  )
}
