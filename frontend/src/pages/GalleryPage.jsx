import { useState, useEffect } from 'react'
import { api } from '../api/axios'

/* ── Вспомогательная функция для распознавания YouTube / VK ── */
function getEmbedInfo(videoUrl) {
  if (!videoUrl) return null

  // YouTube
  const ytMatch = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/)
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0`,
      previewUrl: `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`,
      originalUrl: videoUrl,
    }
  }

  // VK Video
  const vkExtMatch = videoUrl.match(/vk\.com\/video_ext\.php\?oid=([-\d]+)&id=([-\d]+)(?:&hash=([a-f0-9]+))?/)
  if (vkExtMatch) {
    return {
      type: 'vk',
      embedUrl: videoUrl,
      originalUrl: videoUrl,
    }
  }
  const vkDirectMatch = videoUrl.match(/vk\.com\/video([-\d]+)_([-\d]+)/)
  if (vkDirectMatch) {
    const oid = vkDirectMatch[1]
    const vid = vkDirectMatch[2]
    return {
      type: 'vk',
      embedUrl: `https://vk.com/video_ext.php?oid=${oid}&id=${vid}`,
      originalUrl: videoUrl,
    }
  }

  return {
    type: 'generic',
    embedUrl: null,
    originalUrl: videoUrl,
  }
}

/* ── Иконки ── */
const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-forge-primary">
    <path d="M8 5v14l11-7z" />
  </svg>
)

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const ExternalIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
  </svg>
)

export default function GalleryPage() {
  const [items,         setItems]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [filter,        setFilter]        = useState('all') // 'all' | 'photo' | 'video'
  const [selectedMedia, setSelectedMedia] = useState(null) // Lightbox modal item

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    api.get('/gallery/')
      .then(({ data }) => {
        if (active) setItems(data)
      })
      .catch(() => {
        if (active) setError('Не удалось загрузить галерею. Попробуйте позже.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [])

  const filteredItems = items.filter(item => {
    if (filter === 'photo') return Boolean(item.image_url)
    if (filter === 'video') return Boolean(item.video_url)
    return true
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
      {/* ── Шапка ────────────────────────────────────────────── */}
      <div className="mb-10 max-w-2xl">
        <p className="gold-tag mb-3">◇ Мастерская Алдуин</p>
        <h1 className="font-serif font-bold text-forge-text text-4xl md:text-5xl leading-tight mb-4">
          Галерея
        </h1>
        <div className="w-12 h-px bg-forge-primary mb-4" />
        <p className="text-forge-muted font-body text-base leading-relaxed">
          Каждое изделие уникально. Здесь — процесс работы, фото готовых творений и видео из кузницы.
        </p>
      </div>

      {/* ── Фильтры ──────────────────────────────────────────── */}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-10">
          {[
            { key: 'all',   label: 'Все работы' },
            { key: 'photo', label: 'Фотографии' },
            { key: 'video', label: 'Видео'      },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`
                px-4 py-2 font-body text-xs tracking-[0.15em] uppercase border transition-all duration-200
                ${filter === key
                  ? 'bg-forge-primary border-forge-primary text-black font-semibold'
                  : 'bg-transparent border-forge-border text-forge-muted hover:border-forge-primary/50 hover:text-forge-primary'}
              `}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Состояние загрузки ───────────────────────────────── */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="aspect-square bg-forge-surface border border-forge-border animate-pulse" />
          ))}
        </div>
      )}

      {/* ── Ошибка ───────────────────────────────────────────── */}
      {error && (
        <div className="py-20 text-center text-forge-muted">
          <p className="text-red-400 mb-4">{error}</p>
        </div>
      )}

      {/* ── Пустая галерея ────────────────────────────────────── */}
      {!loading && !error && filteredItems.length === 0 && (
        <div className="py-24 text-center">
          <p className="text-forge-primary/30 text-5xl mb-4 font-serif">◇</p>
          <h2 className="font-serif text-forge-text text-2xl mb-2">Работ пока нет</h2>
          <p className="text-forge-muted font-body text-sm max-w-md mx-auto">
            Мастерская готовит новые изделия и съёмки. Скоро здесь появятся свежие фотографии и видео.
          </p>
        </div>
      )}

      {/* ── Сетка работ ───────────────────────────────────────── */}
      {!loading && !error && filteredItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map(item => {
            const embed = item.video_url ? getEmbedInfo(item.video_url) : null
            const dateStr = new Date(item.created_at).toLocaleDateString('ru-RU', {
              day: 'numeric', month: 'long', year: 'numeric',
            })

            return (
              <div
                key={item.id}
                className="group relative bg-forge-surface border border-forge-border overflow-hidden
                           hover:border-forge-primary/50 hover:shadow-gold transition-all duration-300 flex flex-col"
              >
                {/* Медиа-блок */}
                <div
                  onClick={() => setSelectedMedia(item)}
                  className="relative aspect-square overflow-hidden bg-black cursor-pointer"
                >
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.description || 'Изделие мастерской Алдуин'}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : embed?.previewUrl ? (
                    <img
                      src={embed.previewUrl}
                      alt="Превью видео"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-forge-bg text-forge-muted p-4 text-center">
                      <PlayIcon />
                      <span className="text-xs mt-2 uppercase tracking-wider text-forge-primary">Видео</span>
                    </div>
                  )}

                  {/* Оверлей при наведении */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    {item.video_url ? (
                      <div className="w-14 h-14 rounded-full bg-forge-primary/90 text-black flex items-center justify-center shadow-lg transition-transform group-hover:scale-110">
                        <PlayIcon />
                      </div>
                    ) : (
                      <span className="text-xs uppercase tracking-[0.2em] font-body bg-black/70 px-3 py-1.5 border border-forge-border text-forge-text">
                        Увеличить
                      </span>
                    )}
                  </div>

                  {/* Бейдж видео */}
                  {item.video_url && (
                    <span className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-sm text-forge-primary text-[10px] tracking-widest uppercase font-semibold px-2.5 py-1 border border-forge-primary/30">
                      Видео
                    </span>
                  )}
                </div>

                {/* Описание */}
                {item.description && (
                  <div className="p-4 border-t border-forge-border/40 flex-1 flex flex-col justify-between">
                    <p className="text-forge-muted font-body text-sm leading-relaxed whitespace-pre-line line-clamp-3">
                      {item.description}
                    </p>
                    <span className="text-forge-muted/40 font-body text-xs mt-3 block tracking-wider">
                      {dateStr}
                    </span>
                  </div>
                )}

                {/* Золотая полоска внизу */}
                <div className="h-0.5 bg-forge-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
              </div>
            )
          })}
        </div>
      )}

      {/* ── Модальное окно просмотра (Lightbox) ────────────────── */}
      {selectedMedia && (
        <div
          onClick={() => setSelectedMedia(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="relative max-w-4xl w-full max-h-[90vh] flex flex-col bg-forge-surface border border-forge-border shadow-2xl overflow-hidden"
          >
            {/* Кнопка закрытия */}
            <button
              onClick={() => setSelectedMedia(null)}
              className="absolute top-3 right-3 z-20 w-10 h-10 bg-black/70 border border-forge-border text-forge-text hover:text-forge-primary hover:border-forge-primary flex items-center justify-center transition-colors"
              aria-label="Закрыть"
            >
              <CloseIcon />
            </button>

            {/* Медиа-контент в модалке */}
            <div className="relative w-full bg-black flex items-center justify-center overflow-hidden max-h-[70vh]">
              {selectedMedia.image_url ? (
                <img
                  src={selectedMedia.image_url}
                  alt={selectedMedia.description || 'Фото работы'}
                  className="max-h-[70vh] w-auto max-w-full object-contain"
                />
              ) : selectedMedia.video_url ? (
                (() => {
                  const embed = getEmbedInfo(selectedMedia.video_url)
                  if (embed?.embedUrl) {
                    return (
                      <div className="aspect-video w-full">
                        <iframe
                          src={embed.embedUrl}
                          title="Видео"
                          className="w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    )
                  }
                  return (
                    <div className="py-20 px-4 text-center">
                      <p className="text-forge-text text-base mb-4">
                        Ссылка на видео:
                      </p>
                      <a
                        href={selectedMedia.video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-gold inline-flex items-center gap-2"
                      >
                        Перейти к просмотру видео <ExternalIcon />
                      </a>
                    </div>
                  )
                })()
              ) : null}
            </div>

            {/* Описание и ссылка */}
            {selectedMedia.description && (
              <div className="p-6 border-t border-forge-border/60 bg-forge-bg/95">
                <p className="text-forge-text font-body text-sm leading-relaxed whitespace-pre-line">
                  {selectedMedia.description}
                </p>
                {selectedMedia.video_url && (
                  <div className="mt-4 pt-3 border-t border-forge-border/40 flex justify-end">
                    <a
                      href={selectedMedia.video_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-forge-primary hover:underline inline-flex items-center gap-1.5"
                    >
                      Открыть оригинал видео <ExternalIcon />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
