import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Newspaper,
  BookOpen,
  Image as ImageIcon,
  Upload,
  FolderPlus,
  Tag,
} from 'lucide-react'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import AdminLayout from '../../components/admin/AdminLayout'
import { adminApi } from '../../api/axios'

const TYPE_CONFIG = {
  news:     { label: 'Новость',  Icon: Newspaper, color: 'bg-blue-100 text-blue-700 border-blue-200'   },
  training: { label: 'Обучение', Icon: BookOpen,  color: 'bg-purple-100 text-purple-700 border-purple-200' },
}

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'link', 'image'],
    ['clean'],
  ],
}

const stripHtml = (html) => {
  if (!html) return ''
  const clean = html.replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ')
  try {
    const doc = new DOMParser().parseFromString(clean, 'text/html')
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim()
  } catch {
    return clean.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  }
}

/* ══════════════════════════════════════════════════════════════
   МОДАЛЬНОЕ ОКНО СОЗДАНИЯ/УПРАВЛЕНИЯ РАЗДЕЛАМИ ОБУЧЕНИЯ
   ══════════════════════════════════════════════════════════════ */
function SectionManagerModal({ sections, onClose, onUpdated }) {
  const [name, setName]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setError('')
    setLoading(true)
    try {
      await adminApi.post('/admin/articles/sections/training', { name: name.trim() })
      setName('')
      onUpdated()
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Ошибка создания раздела')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить этот раздел? Статьи останутся, но будут без раздела.')) return
    try {
      await adminApi.delete(`/admin/articles/sections/training/${id}`)
      onUpdated()
    } catch (err) {
      alert(err.response?.data?.detail ?? 'Ошибка удаления раздела')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-fade-up">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-gray-900 text-lg">Разделы обучения</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={20} />
          </button>
        </div>

        {/* Форма создания нового раздела */}
        <form onSubmit={handleCreate} className="space-y-3">
          <label className="block text-xs font-semibold uppercase text-gray-500">
            Новый раздел
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Напр. Работа с кожей, Ковка..."
              className="flex-1 bg-white border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-purple-500 transition-colors"
              style={{ color: '#111827', backgroundColor: '#ffffff' }}
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-purple-600 text-white font-semibold text-sm px-4 py-2 rounded-xl hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? '...' : 'Создать'}
            </button>
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
        </form>

        {/* Список существующих разделов */}
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <label className="block text-xs font-semibold uppercase text-gray-400">
            Существующие разделы ({sections.length})
          </label>
          {sections.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-2">Разделов пока нет</p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {sections.map(s => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-sm group"
                >
                  <span className="font-medium text-gray-800">{s.name}</span>
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id)}
                    className="text-gray-400 hover:text-red-600 p-1 transition-colors"
                    title="Удалить раздел"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2 text-right border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   ФОРМА СТАТЬИ — полноэкранное модальное окно
   ══════════════════════════════════════════════════════════════ */
function ArticleModal({ article, sections, onClose, onSaved, onOpenSectionManager }) {
  const [form, setForm] = useState(
    article
      ? {
          title: article.title,
          content: article.content,
          type: article.type,
          image_url: article.image_url || '',
          section_id: article.section_id || '',
        }
      : { title: '', content: '', type: 'news', image_url: '', section_id: '' }
  )
  const [loading,       setLoading]       = useState(false)
  const [uploadingImg,  setUploadingImg]  = useState(false)
  const [error,         setError]         = useState('')
  const fileInputRef                      = useRef(null)
  const quillRef                          = useRef(null)

  // Кастомный обработчик вставки фото прямо в текст статьи через /api/admin/upload/
  const imageHandler = useCallback(() => {
    const input = document.createElement('input')
    input.setAttribute('type', 'file')
    input.setAttribute('accept', 'image/*')
    input.click()

    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      if (file.size > 20 * 1024 * 1024) {
        setError('Изображение для текста слишком большое. Максимум 20 МБ')
        return
      }
      try {
        const formData = new FormData()
        formData.append('file', file)
        const { data } = await adminApi.post('/admin/upload/', formData)
        const quill = quillRef.current?.getEditor()
        if (quill) {
          const range = quill.getSelection(true) || { index: 0, length: 0 }
          quill.insertEmbed(range.index, 'image', data.url)
          quill.setSelection(range.index + 1)
        }
      } catch (err) {
        setError(err.response?.data?.detail ?? 'Ошибка загрузки изображения в текст')
      }
    }
  }, [])

  const quillModules = useMemo(() => ({
    toolbar: {
      container: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['blockquote', 'link', 'image'],
        ['clean'],
      ],
      handlers: {
        image: imageHandler,
      },
    },
  }), [imageHandler])

  // Загрузка фото на сервер (/api/admin/upload/)
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 20 * 1024 * 1024) {
      setError('Файл слишком большой. Максимум 20 МБ')
      return
    }

    setUploadingImg(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)

      const { data } = await adminApi.post('/admin/upload/', formData)
      setForm(f => ({ ...f, image_url: data.url }))
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Ошибка загрузки изображения')
    } finally {
      setUploadingImg(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('Заголовок обязателен')
      return
    }
    if (!stripHtml(form.content)) {
      setError('Текст статьи обязателен')
      return
    }
    setError('')
    setLoading(true)
    try {
      const payload = {
        title: form.title.trim(),
        content: (form.content || '').replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' '),
        type: form.type,
        image_url: form.image_url ? form.image_url.trim() : null,
        section_id: form.type === 'training' && form.section_id ? Number(form.section_id) : null,
      }
      if (article) {
        await adminApi.patch(`/admin/articles/${article.id}`, payload)
      } else {
        await adminApi.post('/admin/articles/', payload)
      }
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Ошибка сохранения')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Шапка */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 sticky top-0 bg-white z-10">
        <h2 className="text-lg font-bold text-gray-900">
          {article ? 'Редактировать публикацию' : 'Новая публикация'}
        </h2>
        <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-gray-600">
          <X size={24} />
        </button>
      </div>

      {/* Форма */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-5 space-y-6 pb-28 max-w-3xl mx-auto w-full">

        {/* Тип статьи */}
        <div className="admin-field">
          <label className="admin-label">Тип публикации *</label>
          <div className="flex gap-3">
            {Object.entries(TYPE_CONFIG).map(([key, { label, Icon }]) => (
              <button
                key={key}
                type="button"
                onClick={() => setForm(f => ({ ...f, type: key }))}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl
                            text-sm font-semibold border-2 transition-all
                            ${form.type === key
                              ? 'border-orange-500 bg-orange-50 text-orange-700'
                              : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
              >
                <Icon size={18} /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Раздел обучения (показывается только для обучающих статей) */}
        {form.type === 'training' && (
          <div className="admin-field bg-purple-50/60 p-4 rounded-xl border border-purple-100">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase text-purple-900 flex items-center gap-1.5">
                <Tag size={14} className="text-purple-600" />
                Раздел обучения
              </label>
              <button
                type="button"
                onClick={onOpenSectionManager}
                className="text-xs font-semibold text-purple-700 hover:underline flex items-center gap-1"
              >
                <Plus size={13} /> Управление разделами
              </button>
            </div>
            <select
              value={form.section_id}
              onChange={e => setForm(f => ({ ...f, section_id: e.target.value }))}
              className="w-full bg-white border border-purple-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-purple-500"
            >
              <option value="">-- Без раздела (общие материалы) --</option>
              {sections.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Заголовок */}
        <div className="admin-field">
          <label className="admin-label">Заголовок *</label>
          <input
            className="admin-input"
            required
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Напр. Новая коллекция ремней или Уроки тиснения..."
          />
        </div>

        {/* Обложка / Изображение публикации */}
        <div className="admin-field">
          <label className="admin-label flex items-center gap-1.5">
            <ImageIcon size={15} className="text-gray-500" />
            Изображение / обложка статьи
          </label>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />

          {form.image_url ? (
            <div className="relative border border-gray-200 rounded-xl overflow-hidden group max-w-md bg-gray-50">
              <img
                src={form.image_url}
                alt="Обложка"
                className="w-full h-48 object-cover"
              />
              <div className="p-2.5 flex items-center justify-between bg-white border-t border-gray-100">
                <span className="text-xs text-gray-500 truncate max-w-[240px]">
                  {form.image_url}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImg}
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    Заменить
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, image_url: '' }))}
                    className="text-xs text-red-600 hover:underline font-medium"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImg}
                className="flex items-center gap-2 border-2 border-dashed border-gray-300 hover:border-orange-500 bg-gray-50 hover:bg-orange-50/40 text-gray-700 px-5 py-3 rounded-xl text-sm font-medium transition-colors"
              >
                <Upload size={18} className="text-orange-600" />
                {uploadingImg ? 'Загрузка...' : 'Загрузить фото с устройства'}
              </button>
              <span className="text-xs text-gray-400">или введите URL ниже</span>
            </div>
          )}

          {!form.image_url && (
            <input
              type="text"
              value={form.image_url}
              onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
              placeholder="https://example.com/photo.jpg или /uploads/..."
              className="admin-input mt-2 text-xs"
            />
          )}
        </div>

        {/* Текст статьи (WYSIWYG с поддержкой картинок) */}
        <div className="admin-field">
          <label className="admin-label">
            Текст статьи (HTML) *
            <span className="text-xs font-normal text-gray-400 ml-2">
              (можно вставлять изображения прямо в текст по иконке в панели)
            </span>
          </label>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden text-gray-900">
            <ReactQuill
              ref={quillRef}
              theme="snow"
              className="quill-editor"
              value={form.content}
              onChange={content => setForm(f => ({ ...f, content }))}
              modules={quillModules}
              placeholder="Полный текст статьи... Используйте форматирование (заголовки, жирный текст, списки, картинки)"
            />
          </div>
        </div>

        {error && (
          <p className="text-red-600 text-sm bg-red-50 rounded-xl p-3">{error}</p>
        )}
      </form>

      {/* Кнопка Сохранить — sticky bottom */}
      <div className="sticky bottom-0 px-4 py-3 bg-white border-t border-gray-200 safe-bottom">
        <button
          onClick={handleSubmit}
          disabled={loading || uploadingImg}
          className="admin-btn-primary w-full flex items-center justify-center gap-2 max-w-3xl mx-auto"
        >
          {loading
            ? <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
            : <Check size={20} />}
          {loading ? 'Сохранение...' : 'Сохранить публикацию'}
        </button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   КАРТОЧКА СТАТЬИ
   ══════════════════════════════════════════════════════════════ */
function ArticleCard({ article, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const cfg  = TYPE_CONFIG[article.type]
  const Icon = cfg.Icon

  const date = new Date(article.created_at).toLocaleDateString('ru-RU', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col md:flex-row">
      {/* Обложка статьи, если есть */}
      {article.image_url && (
        <div className="md:w-48 h-36 md:h-auto bg-gray-100 flex-shrink-0">
          <img
            src={article.image_url}
            alt={article.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold
                              px-2.5 py-0.5 rounded-full border ${cfg.color}`}>
              <Icon size={13} /> {cfg.label}
            </span>

            {article.section && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                {article.section.name}
              </span>
            )}

            <span className="text-xs text-gray-400">{date}</span>
          </div>

          <div className="font-semibold text-gray-900 leading-snug mb-1 text-base">{article.title}</div>
          <p className="text-sm text-gray-500 line-clamp-2">{stripHtml(article.content)}</p>
        </div>

        {/* Действия */}
        <div className="pt-3 mt-3 border-t border-gray-100 flex items-center justify-end gap-2">
          {!confirmDelete ? (
            <>
              <button
                onClick={() => onEdit(article)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Pencil size={15} /> Редактировать
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={15} /> Удалить
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Точно удалить?</span>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Отмена
              </button>
              <button
                onClick={() => { setConfirmDelete(false); onDelete(article.id) }}
                className="px-2.5 py-1 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg"
              >
                Да, удалить
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════ */
export default function AdminContent() {
  const [articles,         setArticles]         = useState([])
  const [sections,         setSections]         = useState([])
  const [typeFilter,       setTypeFilter]       = useState(null)
  const [selectedSection,  setSelectedSection]  = useState(null)
  const [loading,          setLoading]          = useState(true)
  const [modal,            setModal]            = useState(null)
  const [showSectionModal, setShowSectionModal] = useState(false)

  // Загрузка разделов обучения
  const loadSections = useCallback(async () => {
    try {
      const { data } = await adminApi.get('/admin/articles/sections/training')
      setSections(data || [])
    } catch { }
  }, [])

  // Загрузка списка статей
  const loadArticles = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (typeFilter) params.type = typeFilter
      if (typeFilter === 'training' && selectedSection) params.section_id = selectedSection

      const { data } = await adminApi.get('/admin/articles/', { params })
      setArticles(data)
    } catch { }
    finally { setLoading(false) }
  }, [typeFilter, selectedSection])

  useEffect(() => { loadSections() }, [loadSections])
  useEffect(() => { loadArticles() }, [loadArticles])

  const handleDelete = async (id) => {
    try {
      await adminApi.delete(`/admin/articles/${id}`)
      setArticles(a => a.filter(x => x.id !== id))
    } catch (err) { alert(err.response?.data?.detail ?? 'Ошибка') }
  }

  return (
    <AdminLayout>
      <div className="px-4 py-4 max-w-5xl mx-auto">
        {/* Шапка */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Контент и статьи</h1>
            <p className="text-xs text-gray-500 mt-0.5">Управление новостями и материалами обучения мастерской</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSectionModal(true)}
              className="flex items-center gap-1.5 border border-purple-200 bg-purple-50 text-purple-700 text-sm font-semibold px-3.5 py-2 rounded-xl hover:bg-purple-100 transition-colors"
            >
              <FolderPlus size={16} /> Разделы обучения
            </button>
            <button
              onClick={() => setModal('new')}
              className="flex items-center gap-1.5 bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl active:bg-orange-700 transition-colors shadow-sm"
            >
              <Plus size={17} /> Создать публикацию
            </button>
          </div>
        </div>

        {/* Фильтр типов */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {[null, 'news', 'training'].map(t => (
            <button
              key={t ?? 'all'}
              onClick={() => {
                setTypeFilter(t)
                if (t !== 'training') setSelectedSection(null)
              }}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors
                          ${typeFilter === t
                            ? 'bg-gray-900 text-white'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
            >
              {t === null ? 'Все материалы' : TYPE_CONFIG[t].label}
            </button>
          ))}
        </div>

        {/* Подфильтр по разделам (если выбрано Обучение) */}
        {typeFilter === 'training' && sections.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4">
            <span className="text-xs text-gray-400 font-medium">Раздел:</span>
            <button
              onClick={() => setSelectedSection(null)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                selectedSection === null
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Все разделы
            </button>
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedSection(s.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  selectedSection === s.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        {/* Список материалов */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-28 animate-pulse" />)}
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-20 text-gray-400 bg-white rounded-2xl border border-gray-100">
            <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Публикаций пока нет</p>
          </div>
        ) : (
          <div className="space-y-3">
            {articles.map(a => (
              <ArticleCard
                key={a.id}
                article={a}
                onEdit={() => setModal(a)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Модальное окно создания/редактирования статьи */}
      {modal && (
        <ArticleModal
          article={modal === 'new' ? null : modal}
          sections={sections}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); loadArticles() }}
          onOpenSectionManager={() => setShowSectionModal(true)}
        />
      )}

      {/* Модальное окно управления разделами */}
      {showSectionModal && (
        <SectionManagerModal
          sections={sections}
          onClose={() => setShowSectionModal(false)}
          onUpdated={() => { loadSections(); loadArticles() }}
        />
      )}
    </AdminLayout>
  )
}
