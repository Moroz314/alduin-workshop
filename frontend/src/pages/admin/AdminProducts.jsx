import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  ImageOff,
  ChevronDown,
  ChevronUp,
  Package,
  Tag,
  Upload,
  Image as ImageIcon,
  GripVertical,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import AdminLayout from '../../components/admin/AdminLayout'
import ImageUpload from '../../components/admin/ImageUpload'
import { adminApi } from '../../api/axios'

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'link'],
    ['clean'],
  ],
}

/* ══════════════════════════════════════════════════════════════
   SLUGIFY
   ══════════════════════════════════════════════════════════════ */
const slugify = (s) =>
  s.toLowerCase()
    .replace(/[а-яё]/g, (c) => ({
      'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z',
      'и':'i','й':'j','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r',
      'с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh',
      'щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
    }[c] ?? c))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/* ══════════════════════════════════════════════════════════════
   КАРТОЧКА ТОВАРА
   ══════════════════════════════════════════════════════════════ */
function SortableProductCard({
  product,
  index,
  total,
  categoryName,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 40 : 'auto',
  }

  const price = Number(product.price).toLocaleString('ru-RU', {
    style: 'currency', currency: 'RUB', maximumFractionDigits: 0,
  })

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-2xl shadow-sm border transition-shadow ${
        isDragging ? 'border-orange-500 shadow-lg' : 'border-gray-100'
      } overflow-hidden`}
    >
      <div className="flex items-center gap-2 p-3 sm:p-4">
        {/* Ручка Drag-and-Drop */}
        <div
          {...attributes}
          {...listeners}
          className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-700 active:text-orange-600 cursor-grab active:cursor-grabbing touch-none select-none rounded-lg"
          title="Перетащите мышью или пальцем для изменения порядка"
          aria-label="Перетащить товар"
        >
          <GripVertical size={20} />
        </div>

        {/* Запасной вариант для мобильных: стрелки "вверх/вниз" */}
        <div className="flex flex-col items-center justify-center gap-0.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => onMoveUp(index)}
            disabled={index === 0}
            className={`p-1 rounded-md transition-colors ${
              index === 0
                ? 'text-gray-200 cursor-not-allowed'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200'
            }`}
            title="Переместить выше"
            aria-label="Переместить выше"
          >
            <ChevronUp size={18} />
          </button>
          <button
            type="button"
            onClick={() => onMoveDown(index)}
            disabled={index === total - 1}
            className={`p-1 rounded-md transition-colors ${
              index === total - 1
                ? 'text-gray-200 cursor-not-allowed'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200'
            }`}
            title="Переместить ниже"
            aria-label="Переместить ниже"
          >
            <ChevronDown size={18} />
          </button>
        </div>

        {/* Номер позиции */}
        <div
          className="flex-shrink-0 w-7 h-7 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-mono font-bold"
          title={`Порядковый номер: #${index + 1}`}
        >
          {index + 1}
        </div>

        {/* Миниатюра */}
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover pointer-events-none" />
          ) : (
            <ImageOff size={20} className="text-gray-300" />
          )}
        </div>

        {/* Инфо */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 mb-1">
            {product.name}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold text-orange-600">{price}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              product.in_stock ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {product.in_stock ? 'В наличии' : 'Под заказ'}
            </span>
          </div>
          {categoryName && (
            <div className="text-xs text-gray-400 mt-0.5 truncate">
              {categoryName}
            </div>
          )}
        </div>
      </div>

      {/* Кнопки */}
      {!confirmDelete ? (
        <div className="flex border-t border-gray-100">
          <button onClick={() => onEdit(product)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3
                       text-sm font-semibold text-blue-600 active:bg-blue-50 transition-colors">
            <Pencil size={16} /> Изменить
          </button>
          <div className="w-px bg-gray-100" />
          <button onClick={() => setConfirmDelete(true)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3
                       text-sm font-semibold text-red-500 active:bg-red-50 transition-colors">
            <Trash2 size={16} /> Удалить
          </button>
        </div>
      ) : (
        <div className="flex border-t border-gray-100 bg-red-50">
          <button onClick={() => setConfirmDelete(false)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3
                       text-sm font-semibold text-gray-500">
            <X size={16} /> Отмена
          </button>
          <div className="w-px bg-red-100" />
          <button onClick={() => { setConfirmDelete(false); onDelete(product.id) }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3
                       text-sm font-bold text-red-600">
            <Trash2 size={16} /> Удалить!
          </button>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   МОДАЛ ТОВАРА
   ══════════════════════════════════════════════════════════════ */
const EMPTY_PRODUCT = {
  name: '', slug: '', price: '', description: '',
  image_url: '', in_stock: true, category_id: '',
}

function ProductModal({ product, categories, onClose, onSaved }) {
  const [form,    setForm]    = useState(product ? {
    name:        product.name,
    slug:        product.slug,
    price:       String(product.price),
    description: product.description ?? '',
    image_url:   product.image_url ?? '',
    images:      product.images?.length ? product.images.map(image => image.url) : (product.image_url ? [product.image_url] : []),
    in_stock:    product.in_stock,
    category_id: product.category_id ? String(product.category_id) : '',
  } : { ...EMPTY_PRODUCT })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const handleNameChange = (value) => {
    setForm(f => ({
      ...f,
      name: value,
      slug: !f.slug || f.slug === slugify(f.name) ? slugify(value) : f.slug,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const cleanDesc = form.description
        ? form.description.replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ').trim()
        : ''
      const isDescEmpty = !cleanDesc || cleanDesc === '<p><br></p>' || cleanDesc === '<p></p>'
      const payload = {
        ...form,
        price:       parseFloat(form.price),
        category_id: form.category_id ? parseInt(form.category_id) : null,
        image_url:   form.image_url   || null,
        images:      form.images,
        description: isDescEmpty ? null : cleanDesc,
      }
      if (product) {
        await adminApi.patch(`/admin/products/${product.id}`, payload)
      } else {
        await adminApi.post('/admin/products/', payload)
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 sticky top-0 z-10 bg-white">
        <h2 className="text-lg font-bold text-gray-900">
          {product ? 'Редактировать товар' : 'Новый товар'}
        </h2>
        <button onClick={onClose} className="p-2 -mr-2 text-gray-400 active:text-gray-700">
          <X size={24} />
        </button>
      </div>

      {/* Форма */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-4 space-y-5 pb-28">

        {/* ── Загрузка фото ──────────────────────────────────── */}
        <ImageUpload
          value={form.images}
          onChange={(images) => setForm(f => ({ ...f, images, image_url: images[0] ?? '' }))}
        />

        {/* Название */}
        <div className="admin-field">
          <label className="admin-label">Название *</label>
          <input className="admin-input" required
            value={form.name} onChange={e => handleNameChange(e.target.value)}
            placeholder="Кошелёк «Берсерк»" />
        </div>

        {/* Slug */}
        <div className="admin-field">
          <label className="admin-label">Slug *</label>
          <input className="admin-input font-mono text-sm" required
            value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
            placeholder="koshelek-berserk" />
          <p className="text-xs text-gray-400 mt-1">Только латиница, цифры и дефис</p>
        </div>

        {/* Цена */}
        <div className="admin-field">
          <label className="admin-label">Цена (₽) *</label>
          <input className="admin-input text-xl font-bold" required type="number"
            min="1" step="0.01"
            value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
            placeholder="2490" />
        </div>

        {/* Категория */}
        <div className="admin-field">
          <label className="admin-label">Категория</label>
          <div className="relative">
            <select
              className="admin-input appearance-none pr-10"
              value={form.category_id}
              onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
            >
              <option value="">— Без категории —</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Описание */}
        <div className="admin-field">
          <label className="admin-label">Описание изделия (HTML-редактор)</label>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden text-gray-900">
            <ReactQuill
              theme="snow"
              className="quill-editor"
              value={form.description}
              onChange={val => setForm(f => ({ ...f, description: val }))}
              modules={QUILL_MODULES}
              placeholder="Подробное описание изделия, характеристики, материалы..."
            />
          </div>
        </div>

        {/* Наличие */}
        <div className="flex items-center justify-between py-2">
          <div>
            <span className="admin-label mb-0">В наличии</span>
            <p className="text-xs text-gray-400 mt-0.5">
              {form.in_stock ? 'Товар есть на складе' : 'Товар принимается под заказ'}
            </p>
          </div>
          <button type="button"
            onClick={() => setForm(f => ({ ...f, in_stock: !f.in_stock }))}
            className={`relative w-14 h-7 rounded-full transition-colors duration-200
                        ${form.in_stock ? 'bg-green-500' : 'bg-amber-400'}`}
            role="switch" aria-checked={form.in_stock}>
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow
                              transition-transform duration-200
                              ${form.in_stock ? 'translate-x-7' : 'translate-x-0'}`} />
          </button>
        </div>

        {error && (
          <p className="text-red-600 text-sm bg-red-50 rounded-xl p-3">{error}</p>
        )}
      </form>

      {/* Sticky кнопка */}
      <div className="sticky bottom-0 px-4 py-3 bg-white border-t border-gray-200 safe-bottom">
        <button onClick={handleSubmit} disabled={loading}
          className="admin-btn-primary w-full flex items-center justify-center gap-2">
          {loading
            ? <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
            : <Check size={20} />}
          {loading ? 'Сохранение...' : 'Сохранить товар'}
        </button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   УПРАВЛЕНИЕ КАТЕГОРИЯМИ
   ══════════════════════════════════════════════════════════════ */
function CategoriesTab() {
  const [categories, setCategories] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [newName,    setNewName]    = useState('')
  const [newSlug,    setNewSlug]    = useState('')
  const [newImage,   setNewImage]   = useState(null)
  const [uploadingNew, setUploadingNew] = useState(false)
  const [adding,     setAdding]     = useState(false)
  const [editId,     setEditId]     = useState(null)
  const [editName,   setEditName]   = useState('')
  const [editSlug,   setEditSlug]   = useState('')
  const [editImage,  setEditImage]  = useState(null)
  const [uploadingEdit, setUploadingEdit] = useState(false)
  const [error,      setError]      = useState('')

  const newFileInputRef = useRef(null)
  const editFileInputRef = useRef(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await adminApi.get('/admin/categories/')
      setCategories(data)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const uploadPhoto = async (file) => {
    if (!file) return null
    if (file.size > 20 * 1024 * 1024) {
      throw new Error('Файл слишком большой. Максимум 20 МБ')
    }
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await adminApi.post('/admin/upload/', formData)
    return data.url
  }

  const handleNewFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setUploadingNew(true)
    try {
      const url = await uploadPhoto(file)
      setNewImage(url)
    } catch (err) {
      setError(err.response?.data?.detail ?? err.message ?? 'Ошибка загрузки фото')
    } finally {
      setUploadingNew(false)
      if (newFileInputRef.current) newFileInputRef.current.value = ''
    }
  }

  const handleEditFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setUploadingEdit(true)
    try {
      const url = await uploadPhoto(file)
      setEditImage(url)
    } catch (err) {
      setError(err.response?.data?.detail ?? err.message ?? 'Ошибка загрузки фото')
    } finally {
      setUploadingEdit(false)
      if (editFileInputRef.current) editFileInputRef.current.value = ''
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    setError('')
    try {
      await adminApi.post('/admin/categories/', {
        name: newName.trim(),
        slug: newSlug.trim() || slugify(newName.trim()),
        image_url: newImage || null,
      })
      setNewName('')
      setNewSlug('')
      setNewImage(null)
      await load()
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Ошибка')
    } finally { setAdding(false) }
  }

  const handleSaveEdit = async (id) => {
    try {
      await adminApi.patch(`/admin/categories/${id}`, {
        name: editName.trim(),
        slug: editSlug.trim() || slugify(editName.trim()),
        image_url: editImage || null,
      })
      setEditId(null)
      await load()
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Ошибка')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить категорию? Это не удалит товары.')) return
    try {
      await adminApi.delete(`/admin/categories/${id}`)
      setCategories(c => c.filter(x => x.id !== id))
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Ошибка')
    }
  }

  return (
    <div className="px-4 py-4">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Категории</h2>

      {/* Форма добавления */}
      <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Новая категория</p>
        <input
          className="admin-input"
          placeholder="Название"
          value={newName}
          onChange={e => {
            setNewName(e.target.value)
            if (!newSlug) setNewSlug(slugify(e.target.value))
          }}
        />
        <input
          className="admin-input font-mono text-sm"
          placeholder="slug (авто)"
          value={newSlug}
          onChange={e => setNewSlug(e.target.value)}
        />

        {/* Загрузка фото категории */}
        <div className="pt-1">
          <p className="text-xs font-semibold text-gray-500 mb-2">Фото категории (необязательно)</p>
          {newImage ? (
            <div className="relative inline-block">
              <img src={newImage} alt="Фото категории" className="w-24 h-24 rounded-xl object-cover border border-gray-200" />
              <button
                type="button"
                onClick={() => setNewImage(null)}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-bold shadow"
                aria-label="Удалить фото"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => newFileInputRef.current?.click()}
                disabled={uploadingNew}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-gray-300 text-gray-600 text-sm hover:border-orange-500 hover:text-orange-600 transition-colors"
              >
                {uploadingNew ? (
                  <span className="animate-spin w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full" />
                ) : (
                  <Upload size={16} />
                )}
                <span>{uploadingNew ? 'Загрузка фото...' : 'Загрузить фото категории'}</span>
              </button>
            </div>
          )}
          <input
            ref={newFileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleNewFileSelect}
            className="hidden"
          />
        </div>

        {error && <p className="text-red-600 text-xs">{error}</p>}
        <button type="submit" disabled={adding || !newName.trim() || uploadingNew}
          className="admin-btn-primary w-full flex items-center justify-center gap-2">
          {adding
            ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            : <Plus size={18} />}
          Добавить категорию
        </button>
      </form>

      {/* Список категорий */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="bg-white rounded-xl h-14 animate-pulse" />)}
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Tag size={36} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Категорий пока нет</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map(cat => (
            <div key={cat.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {editId === cat.id ? (
                /* Режим редактирования */
                <div className="p-3 space-y-3">
                  <input className="admin-input text-sm py-2.5" value={editName}
                    onChange={e => setEditName(e.target.value)} />
                  <input className="admin-input font-mono text-xs py-2.5" value={editSlug}
                    onChange={e => setEditSlug(e.target.value)} />

                  {/* Редактирование фото */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1.5">Фото категории:</p>
                    {editImage ? (
                      <div className="relative inline-block">
                        <img src={editImage} alt="Фото категории" className="w-20 h-20 rounded-xl object-cover border border-gray-200" />
                        <button
                          type="button"
                          onClick={() => setEditImage(null)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-xs shadow"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => editFileInputRef.current?.click()}
                        disabled={uploadingEdit}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-gray-300 text-xs text-gray-600 hover:border-orange-500 hover:text-orange-600"
                      >
                        {uploadingEdit ? (
                          <span className="animate-spin w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full" />
                        ) : (
                          <Upload size={14} />
                        )}
                        <span>{uploadingEdit ? 'Загрузка...' : '+ Добавить фото'}</span>
                      </button>
                    )}
                    <input
                      ref={editFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleEditFileSelect}
                      className="hidden"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => handleSaveEdit(cat.id)}
                      className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold active:bg-green-700">
                      Сохранить
                    </button>
                    <button onClick={() => setEditId(null)}
                      className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold">
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                /* Обычный вид */
                <div className="flex items-center px-4 py-3 gap-3">
                  {cat.image_url ? (
                    <img src={cat.image_url} alt={cat.name} className="w-12 h-12 rounded-xl object-cover bg-gray-100 border border-gray-200 flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0 text-gray-400">
                      <ImageIcon size={20} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm leading-tight">{cat.name}</p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{cat.slug}</p>
                  </div>
                  <button onClick={() => { setEditId(cat.id); setEditName(cat.name); setEditSlug(cat.slug); setEditImage(cat.image_url || null) }}
                    className="p-2 text-blue-500 active:bg-blue-50 rounded-lg" aria-label="Редактировать категорию">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => handleDelete(cat.id)}
                    className="p-2 text-red-500 active:bg-red-50 rounded-lg" aria-label="Удалить категорию">
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   ВКЛАДКА ТОВАРОВ
   ══════════════════════════════════════════════════════════════ */
function ProductsTab() {
  const [products,           setProducts]           = useState([])
  const [categories,         setCategories]         = useState([])
  const [loading,            setLoading]            = useState(true)
  const [modal,              setModal]              = useState(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState('all')
  const [saveStatus,         setSaveStatus]         = useState(null) // null | 'saving' | 'saved' | 'error'
  const [errorMessage,       setErrorMessage]       = useState('')

  const debounceTimeoutRef  = useRef(null)
  const previousProductsRef = useRef([])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pr, cr] = await Promise.all([
        adminApi.get('/admin/products/'),
        adminApi.get('/admin/categories/'),
      ])
      setProducts(pr.data)
      previousProductsRef.current = pr.data
      setCategories(cr.data)
    } catch (err) {
      console.error('Ошибка загрузки:', err)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const categoriesMap = useMemo(() => {
    const map = {}
    categories.forEach(c => { map[c.id] = c.name })
    return map
  }, [categories])

  const filteredProducts = useMemo(() => {
    if (selectedCategoryId === 'all') return products
    if (selectedCategoryId === 'none') return products.filter(p => !p.category_id)
    return products.filter(p => p.category_id === selectedCategoryId)
  }, [products, selectedCategoryId])

  const handleReorder = (newFilteredItems) => {
    const rollbackSnapshot = [...products]

    let updatedAllProducts
    if (selectedCategoryId === 'all') {
      updatedAllProducts = newFilteredItems.map((p, idx) => ({
        ...p,
        sort_order: idx + 1,
      }))
    } else {
      const updatedMap = new Map()
      newFilteredItems.forEach((p, idx) => {
        updatedMap.set(p.id, { ...p, sort_order: idx + 1 })
      })
      updatedAllProducts = products.map(p => updatedMap.get(p.id) || p)
      updatedAllProducts.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
    }

    setProducts(updatedAllProducts)
    setSaveStatus('saving')

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        const payload = newFilteredItems.map((p, idx) => ({
          id: p.id,
          sort_order: idx + 1,
        }))
        await adminApi.patch('/admin/products/reorder', payload)
        previousProductsRef.current = updatedAllProducts
        setSaveStatus('saved')
        setTimeout(() => {
          setSaveStatus(s => s === 'saved' ? null : s)
        }, 2500)
      } catch (err) {
        console.error('Ошибка сохранения порядка:', err)
        setProducts(rollbackSnapshot)
        setSaveStatus('error')
        setErrorMessage(err.response?.data?.detail ?? 'Не удалось сохранить порядок. Позиции возвращены.')
        setTimeout(() => {
          setSaveStatus(s => s === 'error' ? null : s)
          setErrorMessage('')
        }, 4000)
      }
    }, 400)
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = filteredProducts.findIndex(p => p.id === active.id)
    const newIndex = filteredProducts.findIndex(p => p.id === over.id)

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(filteredProducts, oldIndex, newIndex)
      handleReorder(reordered)
    }
  }

  const handleMoveUp = (index) => {
    if (index <= 0) return
    const reordered = arrayMove(filteredProducts, index, index - 1)
    handleReorder(reordered)
  }

  const handleMoveDown = (index) => {
    if (index >= filteredProducts.length - 1) return
    const reordered = arrayMove(filteredProducts, index, index + 1)
    handleReorder(reordered)
  }

  const handleDelete = async (id) => {
    try {
      await adminApi.delete(`/admin/products/${id}`)
      setProducts(p => p.filter(x => x.id !== id))
    } catch (err) {
      alert(err.response?.data?.detail ?? 'Ошибка удаления')
    }
  }

  return (
    <div className="px-4 py-4">
      {/* Шапка вкладки */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Товары {!loading && <span className="text-gray-400 font-normal text-base">({products.length})</span>}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Перетаскивайте карточки мышью или используйте стрелки для задания порядка
          </p>
        </div>
        <button onClick={() => setModal('new')}
          className="flex items-center gap-2 bg-orange-600 text-white text-sm font-semibold
                     px-4 py-2.5 rounded-xl active:bg-orange-700 transition-colors flex-shrink-0">
          <Plus size={18} /> Создать товар
        </button>
      </div>

      {/* Индикатор сохранения порядка */}
      {saveStatus && (
        <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold mb-4 transition-all duration-300 ${
          saveStatus === 'saving'
            ? 'bg-blue-50 text-blue-700 border border-blue-100 shadow-sm'
            : saveStatus === 'saved'
            ? 'bg-green-50 text-green-700 border border-green-200 shadow-sm'
            : 'bg-red-50 text-red-700 border border-red-200 shadow-sm'
        }`}>
          {saveStatus === 'saving' && (
            <>
              <span className="animate-spin w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full flex-shrink-0" />
              <span>Сохранение нового порядка...</span>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <Check size={16} className="text-green-600 flex-shrink-0" />
              <span>Порядок сохранён</span>
            </>
          )}
          {saveStatus === 'error' && (
            <>
              <X size={16} className="text-red-600 flex-shrink-0" />
              <span>{errorMessage || 'Ошибка сохранения порядка. Позиции возвращены назад.'}</span>
            </>
          )}
        </div>
      )}

      {/* Фильтр по категориям для настройки порядка внутри каждой категории */}
      {categories.length > 0 && (
        <div className="mb-4 bg-gray-50 p-2.5 rounded-2xl border border-gray-100">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Настройка порядка по категориям:
            </span>
            {selectedCategoryId !== 'all' && (
              <span className="text-[11px] text-orange-600 font-medium">
                Порядок уникален внутри выбранной категории
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedCategoryId('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategoryId === 'all'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300'
              }`}
            >
              Все ({products.length})
            </button>
            {categories.map(c => {
              const count = products.filter(p => p.category_id === c.id).length
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(c.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                    selectedCategoryId === c.id
                      ? 'bg-orange-600 text-white shadow-sm'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300'
                  }`}
                >
                  {c.name} ({count})
                </button>
              )
            })}
            {products.some(p => !p.category_id) && (
              <button
                type="button"
                onClick={() => setSelectedCategoryId('none')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCategoryId === 'none'
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300'
                }`}
              >
                Без категории ({products.filter(p => !p.category_id).length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Список товаров */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="bg-white rounded-2xl h-24 animate-pulse" />)}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Package size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">В этой категории пока нет товаров</p>
          <p className="text-sm mt-1">Нажмите «Создать товар», чтобы добавить первый</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredProducts.map(p => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {filteredProducts.map((p, idx) => (
                <SortableProductCard
                  key={p.id}
                  product={p}
                  index={idx}
                  total={filteredProducts.length}
                  categoryName={categoriesMap[p.category_id] || ''}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                  onEdit={() => setModal(p)}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {modal && (
        <ProductModal
          product={modal === 'new' ? null : modal}
          categories={categories}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE — вкладки Товары / Категории
   ══════════════════════════════════════════════════════════════ */
export default function AdminProducts() {
  const [tab, setTab] = useState('products')

  return (
    <AdminLayout>
      {/* Переключатель вкладок */}
      <div className="flex border-b border-gray-200 bg-white sticky top-0 z-20">
        <button
          onClick={() => setTab('products')}
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold
                      border-b-2 transition-all duration-150
                      ${tab === 'products'
                        ? 'border-orange-500 text-orange-600 bg-orange-50/50'
                        : 'border-transparent text-gray-500'}`}
        >
          <Package size={17} /> Товары
        </button>
        <button
          onClick={() => setTab('categories')}
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold
                      border-b-2 transition-all duration-150
                      ${tab === 'categories'
                        ? 'border-orange-500 text-orange-600 bg-orange-50/50'
                        : 'border-transparent text-gray-500'}`}
        >
          <Tag size={17} /> Категории
        </button>
      </div>

      {tab === 'products'   && <ProductsTab />}
      {tab === 'categories' && <CategoriesTab />}
    </AdminLayout>
  )
}
