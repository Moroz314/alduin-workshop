import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Trash2, X, Upload, Video, Image as ImageIcon, ExternalLink, Calendar } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import { adminApi } from '../../api/axios'

function getYouTubeEmbedUrl(url) {
  if (!url) return null
  try {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
    const match = url.match(regExp)
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null
  } catch {
    return null
  }
}

export default function AdminGallery() {
  const [items,      setItems]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [modalOpen,  setModalOpen]  = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const [error,      setError]      = useState('')

  // Form state
  const [mode,        setMode]        = useState('image') // 'image' | 'video'
  const [imageUrl,    setImageUrl]    = useState('')
  const [videoUrl,    setVideoUrl]    = useState('')
  const [description, setDescription] = useState('')
  const fileInputRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await adminApi.get('/admin/gallery/')
      setItems(data)
    } catch (err) {
      console.error('Ошибка загрузки галереи:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 20 * 1024 * 1024) {
      setError('Файл слишком большой. Максимум 20 МБ')
      return
    }

    setError('')
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await adminApi.post('/admin/upload/', formData)
      setImageUrl(data.url)
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Не удалось загрузить изображение')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const resetForm = () => {
    setMode('image')
    setImageUrl('')
    setVideoUrl('')
    setDescription('')
    setError('')
    setModalOpen(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (mode === 'image' && !imageUrl) {
      setError('Загрузите фотографию')
      return
    }
    if (mode === 'video' && !videoUrl.trim()) {
      setError('Укажите ссылку на видео')
      return
    }

    setSubmitting(true)
    try {
      await adminApi.post('/admin/gallery/', {
        image_url:   mode === 'image' ? imageUrl : null,
        video_url:   mode === 'video' ? videoUrl.trim() : null,
        description: description.trim() || null,
      })
      resetForm()
      await load()
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Ошибка сохранения элемента галереи')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить этот элемент из галереи?')) return
    try {
      await adminApi.delete(`/admin/gallery/${id}`)
      setItems(prev => prev.filter(item => item.id !== id))
    } catch (err) {
      alert(err.response?.data?.detail ?? 'Ошибка удаления')
    }
  }

  return (
    <AdminLayout>
      <div className="px-4 py-4 max-w-5xl mx-auto">
        {/* Шапка раздела */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              Галерея работ
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Всего работ: {items.length}
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-orange-600 text-white text-sm font-semibold
                       px-4 py-2.5 rounded-xl active:bg-orange-700 transition-colors shadow-sm"
          >
            <Plus size={18} /> Добавить работу
          </button>
        </div>

        {/* Список работ */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white rounded-2xl h-64 animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 p-8">
            <ImageIcon size={48} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-700 font-semibold text-lg">В галерее пока нет работ</p>
            <p className="text-sm text-gray-400 mt-1 mb-5">
              Нажмите «Добавить работу», чтобы загрузить первое фото или видео
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-50 text-orange-700 font-semibold text-sm border border-orange-200"
            >
              <Plus size={16} /> Добавить сейчас
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(item => {
              const ytEmbed = getYouTubeEmbedUrl(item.video_url)
              const dateStr = new Date(item.created_at).toLocaleDateString('ru-RU', {
                day: 'numeric', month: 'short', year: 'numeric',
              })

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm flex flex-col group"
                >
                  {/* Медиа-контейнер */}
                  <div className="aspect-video w-full bg-gray-900 relative overflow-hidden flex items-center justify-center">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.description || 'Работа в галерее'}
                        className="w-full h-full object-cover"
                      />
                    ) : item.video_url ? (
                      ytEmbed ? (
                        <iframe
                          src={ytEmbed}
                          title="Видео YouTube"
                          className="w-full h-full border-0 pointer-events-none"
                        />
                      ) : (
                        <div className="text-center p-4">
                          <Video size={36} className="text-orange-400 mx-auto mb-2" />
                          <span className="text-xs text-gray-300 line-clamp-1 break-all">
                            {item.video_url}
                          </span>
                        </div>
                      )
                    ) : (
                      <ImageIcon size={32} className="text-gray-600" />
                    )}

                    {/* Бейдж типа */}
                    <span className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                      {item.video_url ? <Video size={12} /> : <ImageIcon size={12} />}
                      {item.video_url ? 'Видео' : 'Фото'}
                    </span>
                  </div>

                  {/* Описание и кнопки */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                        <Calendar size={13} />
                        <span>{dateStr}</span>
                      </div>
                      <p className="text-sm text-gray-700 leading-snug line-clamp-3">
                        {item.description || <span className="italic text-gray-400">Без описания</span>}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                      {item.video_url ? (
                        <a
                          href={item.video_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-orange-600 font-semibold inline-flex items-center gap-1 hover:underline"
                        >
                          <ExternalLink size={13} /> Открыть ссылку
                        </a>
                      ) : (
                        <span />
                      )}

                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        title="Удалить из галереи"
                        aria-label="Удалить"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Модальное окно добавления работы ─────────────────── */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
                <h2 className="text-lg font-bold text-gray-900">Добавить работу в галерею</h2>
                <button onClick={resetForm} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                  <X size={22} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                {/* Переключатель типа */}
                <div>
                  <label className="admin-label">Тип материала *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMode('image')}
                      className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                        mode === 'image'
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      <ImageIcon size={18} /> Фотография
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('video')}
                      className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                        mode === 'video'
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      <Video size={18} /> Видео (YouTube / VK)
                    </button>
                  </div>
                </div>

                {/* Если выбрано Фото */}
                {mode === 'image' && (
                  <div>
                    <label className="admin-label">Фотография *</label>
                    {imageUrl ? (
                      <div className="relative aspect-video rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                        <img src={imageUrl} alt="Превью" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setImageUrl('')}
                          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center shadow"
                          aria-label="Удалить фото"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-gray-300 hover:border-orange-500 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-gray-50"
                      >
                        {uploading ? (
                          <div className="flex flex-col items-center gap-2 text-orange-600">
                            <span className="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full" />
                            <span className="text-sm font-semibold">Загрузка изображения...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-gray-500">
                            <Upload size={28} className="text-gray-400" />
                            <span className="text-sm font-semibold text-gray-700">
                              Нажмите для выбора фото
                            </span>
                            <span className="text-xs text-gray-400">
                              JPEG, PNG, WebP до 5 МБ
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                )}

                {/* Если выбрано Видео */}
                {mode === 'video' && (
                  <div>
                    <label className="admin-label">Ссылка на видео *</label>
                    <input
                      className="admin-input"
                      required
                      placeholder="https://www.youtube.com/watch?v=... или https://vk.com/video..."
                      value={videoUrl}
                      onChange={e => setVideoUrl(e.target.value)}
                    />
                    <p className="text-xs text-gray-400 mt-1.5">
                      Поддерживаются ссылки на YouTube и VK Video.
                    </p>
                  </div>
                )}

                {/* Описание */}
                <div>
                  <label className="admin-label">Описание изделия / работы</label>
                  <textarea
                    rows={3}
                    className="admin-input resize-y text-sm py-2.5"
                    placeholder="Например: Кованый топор с руническим травлением и рукоятью из ясеня..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                </div>

                {error && (
                  <p className="text-red-600 text-sm bg-red-50 p-3 rounded-xl border border-red-100">
                    {error}
                  </p>
                )}

                <div className="pt-2 flex gap-3">
                  <button
                    type="submit"
                    disabled={submitting || uploading}
                    className="admin-btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {submitting ? 'Сохранение...' : 'Добавить в галерею'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="admin-btn-secondary px-5"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
