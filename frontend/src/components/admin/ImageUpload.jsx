import { useState, useRef } from 'react'
import { adminApi } from '../../api/axios'

/**
 * ImageUpload — компонент загрузки фото.
 * Показывает превью, отправляет файл на /api/admin/upload/,
 * возвращает URL через onChange(url).
 */
export default function ImageUpload({ value = [], onChange }) {
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState('')
  const inputRef = useRef(null)
  const images = Array.isArray(value) ? value : value ? [value] : []

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const oversized = files.find(file => file.size > 20 * 1024 * 1024)
    if (oversized) {
      setError(`Файл «${oversized.name}» слишком большой. Максимум 20 МБ`)
      return
    }

    setError('')
    setUploading(true)

    try {
      const uploaded = await Promise.all(files.map(async file => {
        const formData = new FormData()
        formData.append('file', file)
        const { data } = await adminApi.post('/admin/upload/', formData)
        return data.url
      }))
      onChange([...images, ...uploaded])
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Ошибка загрузки')
    } finally {
      setUploading(false)
      // Сбрасываем input чтобы можно было выбрать тот же файл повторно
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const removeImage = (index) => onChange(images.filter((_, imageIndex) => imageIndex !== index))
  const makeCover = (index) => {
    if (index === 0) return
    onChange([images[index], ...images.filter((_, imageIndex) => imageIndex !== index)])
  }

  return (
    <div className="admin-field">
      <p className="text-xs text-gray-400 mb-2">Нажмите на фото, чтобы выбрать обложку каталога</p>
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          {images.map((url, index) => (
            <div key={`${url}-${index}`} className={`relative aspect-square rounded-xl overflow-hidden border-2 ${index === 0 ? 'border-orange-500' : 'border-gray-200'}`}>
              <img src={url} alt={`Фото товара ${index + 1}`} className="w-full h-full object-cover" />
              <button type="button" onClick={() => makeCover(index)} className="absolute inset-0 z-10 w-full h-full cursor-pointer" aria-label={index === 0 ? 'Обложка товара' : 'Сделать обложкой'} />
              {index === 0 && <span className="absolute left-2 bottom-2 z-20 bg-orange-600 text-white text-[10px] font-bold px-2 py-1 rounded pointer-events-none">ОБЛОЖКА</span>}
              <button type="button" onClick={() => removeImage(index)} className="absolute right-2 top-2 z-20 w-7 h-7 rounded-full bg-red-600 text-white font-bold" aria-label="Удалить фото">×</button>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="w-full py-3 rounded-xl text-sm font-semibold bg-orange-50 text-orange-700 border border-orange-200 disabled:opacity-50">
        {uploading ? 'Загружаю...' : '+ Добавить фотографии'}
      </button>

      {error && (
        <p className="text-red-600 text-xs mt-1.5">{error}</p>
      )}

      {/* Скрытый input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        onChange={handleFiles}
        className="hidden"
      />
    </div>
  )
}
