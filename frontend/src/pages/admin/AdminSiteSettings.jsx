import { useState, useEffect, useCallback } from 'react'
import { Save, Check, Settings } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import { adminApi } from '../../api/axios'

/* ── Значения по умолчанию ─────────────────────────────────────────────────── */
const DEFAULTS = {
  about_title:            'О мастерской',
  about_text:             'Мастерская Алдуин — это небольшая мастерская, которая является объединением друзей и мастеров, экспертов в своём деле. Мы делаем изделия из металла, дерева и кожи. Все изделия сделаны вручную, с любовью к ремеслу и уважением к традициям.',
  contact_text:           'Купить готовые изделия или заказать что-то нестандартное можно по телефонам:',
  contact_phone1:         '+79500082208',
  contact_phone2:         '+79202091993',
  contact_address:        'Петергоф, Ропшинское ш., 8Г, 198517',
  contact_inn:            '780534396013',
  contact_ogrnip:         '325784700428266',
  social_vk:              'https://vk.com/alduin_workshop',
  social_tg:              'https://t.me/alduin_workshop',
  social_yt:              'https://youtube.com/@alduln_workshop?si=F9XkPmBBNxbPs9e2',
  social_rutube:          'https://rutube.ru/channel/48354889',
  warranty_return_title:  'Возврат товара',
  warranty_return_text:   'Дорогие покупатели Мастерской Алдуин! В соответствии со ст. 26.1 Закона «О защите прав потребителей» вы можете вернуть товар, если он не относится к категории изделий с индивидуально-определёнными свойствами, не был в употреблении, полностью сохранены его товарный вид, потребительские качества, все бирки, документы об оплате и заводская упаковка.',
  warranty_period_title:  'Гарантийный срок',
  warranty_period_text:   'Срок гарантии — 12 месяцев. Если за этот период обнаружится производственный брак, мы проведём бесплатный ремонт. В случае невозможности ремонта — заменим изделие новым аналогом либо вернём полную стоимость. Гарантия не действует при естественном износе, возникшем в процессе использования, а также при поломках из-за неправильной эксплуатации. Мы дорожим своей репутацией и делаем всё, чтобы вы остались довольны качеством нашей продукции.',
  developer_name:         'Владислав Морозов',
  developer_url:          'http://x90461p7.beget.tech/',
}

/* ── Вкладки ───────────────────────────────────────────────────────────────── */
const TABS = [
  { key: 'about',    label: 'О мастерской' },
  { key: 'contacts', label: 'Контакты'     },
  { key: 'warranty', label: 'Гарантия'     },
]

/* ── Поле формы ────────────────────────────────────────────────────────────── */
function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
        {label}
        {hint && <span className="ml-1 text-gray-400 normal-case tracking-normal font-normal">— {hint}</span>}
      </label>
      {children}
    </div>
  )
}

/* ── Стили для инпутов ─────────────────────────────────────────────────────── */
const inputCls = "w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-orange-400 transition-colors"
const textareaCls = inputCls + " resize-y min-h-[80px]"

export default function AdminSiteSettings() {
  const [form,    setForm]    = useState(DEFAULTS)
  const [tab,     setTab]     = useState('about')
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState('')

  /* Загрузка текущих настроек */
  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await adminApi.get('/admin/settings/')
      setForm(prev => ({ ...prev, ...data }))
    } catch {
      /* оставляем defaults */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSettings() }, [loadSettings])

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  /* Сохранение */
  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await adminApi.patch('/admin/settings/', { settings: form })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(
        Array.isArray(detail)
          ? detail.map(d => d.msg).join('; ')
          : (detail ?? 'Ошибка сохранения')
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="px-4 py-8 text-center text-gray-400">Загрузка настроек...</div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="px-4 py-4 max-w-2xl mx-auto">
        {/* Шапка */}
        <div className="flex items-center gap-2 mb-5">
          <Settings size={20} className="text-orange-500" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Настройки сайта</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Тексты, контакты, соцсети, гарантия
            </p>
          </div>
        </div>

        {/* Вкладки */}
        <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors
                ${tab === t.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── ВКЛАДКА: О мастерской ─────────────────────────── */}
        {tab === 'about' && (
          <div className="space-y-5 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <Field label="Заголовок раздела">
              <input
                className={inputCls}
                value={form.about_title}
                onChange={set('about_title')}
                placeholder="О мастерской"
              />
            </Field>
            <Field label="Основной текст">
              <textarea
                className={textareaCls}
                rows={6}
                value={form.about_text}
                onChange={set('about_text')}
                placeholder="Расскажите о мастерской..."
              />
            </Field>
          </div>
        )}

        {/* ── ВКЛАДКА: Контакты ────────────────────────────── */}
        {tab === 'contacts' && (
          <div className="space-y-5 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <Field label="Вводный текст">
              <textarea
                className={textareaCls}
                rows={3}
                value={form.contact_text}
                onChange={set('contact_text')}
                placeholder="Купить готовые изделия или заказать..."
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Телефон 1" hint="формат +7XXXXXXXXXX">
                <input className={inputCls} value={form.contact_phone1} onChange={set('contact_phone1')} placeholder="+79500082208" />
              </Field>
              <Field label="Телефон 2" hint="необязательно">
                <input className={inputCls} value={form.contact_phone2} onChange={set('contact_phone2')} placeholder="+79202091993" />
              </Field>
            </div>

            <Field label="Адрес">
              <input className={inputCls} value={form.contact_address} onChange={set('contact_address')} placeholder="Петергоф, Ропшинское ш., 8Г" />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="ИНН">
                <input className={inputCls} value={form.contact_inn} onChange={set('contact_inn')} placeholder="780534396013" />
              </Field>
              <Field label="ОГРНИП">
                <input className={inputCls} value={form.contact_ogrnip} onChange={set('contact_ogrnip')} placeholder="325784700428266" />
              </Field>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                Социальные сети <span className="font-normal normal-case tracking-normal text-gray-400">— порядок: ВКонтакте → Telegram → YouTube → Rutube</span>
              </p>
              <div className="space-y-3">
                <Field label="ВКонтакте" hint="https://vk.com/...">
                  <input className={inputCls} value={form.social_vk} onChange={set('social_vk')} placeholder="https://vk.com/alduin_workshop" />
                </Field>
                <Field label="Telegram" hint="https://t.me/...">
                  <input className={inputCls} value={form.social_tg} onChange={set('social_tg')} placeholder="https://t.me/alduin_workshop" />
                </Field>
                <Field label="YouTube" hint="https://youtube.com/...">
                  <input className={inputCls} value={form.social_yt} onChange={set('social_yt')} placeholder="https://youtube.com/@..." />
                </Field>
                <Field label="Rutube" hint="https://rutube.ru/...">
                  <input className={inputCls} value={form.social_rutube} onChange={set('social_rutube')} placeholder="https://rutube.ru/channel/..." />
                </Field>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                Разработчик{' '}
                <span className="font-normal normal-case tracking-normal text-gray-400">
                  — строка в подвале страницы контактов; оставьте пустым, чтобы скрыть
                </span>
              </p>
              <div className="space-y-3">
                <Field label="Имя разработчика">
                  <input
                    className={inputCls}
                    value={form.developer_name}
                    onChange={set('developer_name')}
                    placeholder="Владислав Морозов"
                  />
                </Field>
                <Field label="Ссылка" hint="http:// или https://">
                  <input
                    className={inputCls}
                    value={form.developer_url}
                    onChange={set('developer_url')}
                    placeholder="http://x90461p7.beget.tech/"
                  />
                </Field>
              </div>
            </div>
          </div>
        )}

        {/* ── ВКЛАДКА: Гарантия ────────────────────────────── */}
        {tab === 'warranty' && (
          <div className="space-y-5 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <Field label="Заголовок раздела «Возврат»">
              <input className={inputCls} value={form.warranty_return_title} onChange={set('warranty_return_title')} placeholder="Возврат товара" />
            </Field>
            <Field label="Текст раздела «Возврат»">
              <textarea
                className={textareaCls}
                rows={6}
                value={form.warranty_return_text}
                onChange={set('warranty_return_text')}
                placeholder="Условия возврата..."
              />
            </Field>

            <div className="pt-2 border-t border-gray-100">
              <Field label="Заголовок раздела «Гарантия»">
                <input className={inputCls} value={form.warranty_period_title} onChange={set('warranty_period_title')} placeholder="Гарантийный срок" />
              </Field>
            </div>
            <Field label="Текст раздела «Гарантия»">
              <textarea
                className={textareaCls}
                rows={6}
                value={form.warranty_period_text}
                onChange={set('warranty_period_text')}
                placeholder="Гарантийные условия..."
              />
            </Field>
          </div>
        )}

        {/* Ошибка */}
        {error && (
          <p className="mt-3 text-red-600 text-sm bg-red-50 rounded-xl p-3">{error}</p>
        )}

        {/* Кнопка сохранить */}
        <div className="sticky bottom-16 mt-5 pb-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl
                        text-sm font-bold transition-colors shadow-sm
                        ${saved
                          ? 'bg-green-600 text-white'
                          : 'bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60'}`}
          >
            {saving
              ? <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
              : saved
                ? <Check size={20} />
                : <Save size={20} />}
            {saving ? 'Сохранение...' : saved ? 'Сохранено!' : 'Сохранить настройки'}
          </button>
        </div>
      </div>
    </AdminLayout>
  )
}
