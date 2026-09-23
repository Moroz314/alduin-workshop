import { NavLink, useNavigate } from 'react-router-dom'
import { Package, ShoppingBag, FileText, Image as ImageIcon, LogOut, Settings } from 'lucide-react'
import { clearToken } from '../../api/axios'

const NAV = [
  { to: '/admin/products', label: 'Товары',    Icon: Package    },
  { to: '/admin/orders',   label: 'Заказы',    Icon: ShoppingBag },
  { to: '/admin/content',  label: 'Контент',   Icon: FileText   },
  { to: '/admin/gallery',  label: 'Галерея',   Icon: ImageIcon  },
  { to: '/admin/settings', label: 'Настройки', Icon: Settings   },
]

export default function AdminLayout({ children }) {
  const navigate = useNavigate()

  const handleLogout = () => {
    clearToken()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Шапка ──────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div>
          <div className="text-base font-bold text-gray-900 leading-tight">Мастерская Алдуин</div>
          <div className="text-xs text-gray-400 tracking-widest uppercase">Панель управления</div>
        </div>
        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
          <span className="text-orange-600 text-sm font-bold">A</span>
        </div>
      </header>

      {/* ── Контент ───────────────────────────────────────────── */}
      <main className="flex-1 pb-24 overflow-y-auto">
        {children}
      </main>

      {/* ── Bottom Navigation ─────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200
                      safe-bottom"
           aria-label="Навигация администратора">
        <div className="flex items-stretch h-16">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium
                 transition-colors duration-150 select-none
                 ${isActive
                   ? 'text-orange-600'
                   : 'text-gray-400 active:text-gray-600'}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`p-1 rounded-xl transition-all duration-150 ${isActive ? 'bg-orange-50' : ''}`}>
                    <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
                  </span>
                  <span className="leading-none">{label}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* Выход */}
          <button
            onClick={handleLogout}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 text-xs
                       font-medium text-gray-400 active:text-red-500 transition-colors duration-150"
            aria-label="Выйти из панели"
          >
            <span className="p-1 rounded-xl">
              <LogOut size={22} strokeWidth={1.8} />
            </span>
            <span className="leading-none">Выход</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
