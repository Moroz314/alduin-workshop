import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, saveToken } from '../../api/axios'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [form,    setForm]    = useState({ username: '', password: '' })
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', form)
      saveToken(data.access_token)
      navigate('/admin/products', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Ошибка входа. Проверьте логин и пароль.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      {/* Логотип */}
      <div className="mb-10 text-center">
        <div className="text-3xl font-bold text-gray-900 tracking-tight">Алдуин</div>
        <div className="text-sm text-gray-400 mt-1 tracking-widest uppercase">Панель управления</div>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Логин</label>
          <input
            type="text"
            value={form.username}
            onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
            required
            autoComplete="username"
            className="admin-input"
            placeholder="alduin"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Пароль</label>
          <input
            type="password"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            required
            autoComplete="current-password"
            className="admin-input"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="text-red-600 text-sm bg-red-50 rounded-lg p-3 border border-red-100">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="admin-btn-primary w-full mt-2"
        >
          {loading ? 'Вход...' : 'Войти'}
        </button>
      </form>
    </div>
  )
}
