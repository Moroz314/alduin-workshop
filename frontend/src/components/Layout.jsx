import { useState, useEffect } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  toggleDrawer,
  fetchCart,
  selectItemCount,
  selectSessionId,
} from '../store/cartSlice'
import CartDrawer from './CartDrawer'
import CookieBanner from './CookieBanner'
import logo from './logo.png'
import { api } from '../api/axios'

/* ── Иконки (inline SVG) ─────────────────────────────────────────────────── */
const ShieldIcon = () => (
  <svg viewBox="0 0 36 42" fill="none" xmlns="http://www.w3.org/2000/svg"
    className="w-8 h-9" aria-hidden="true">
    <path d="M18 2L3 8V20C3 29.5 10 38 18 40C26 38 33 29.5 33 20V8L18 2Z"
      stroke="currentColor" strokeWidth="1.5" fill="none" />
    <path d="M11 20L15.5 25L25 15" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const CartIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
    strokeWidth={1.4} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M2.25 3h1.386c.51 0 .955.343 1.087.836l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
  </svg>
)

const BurgerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
    strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
)

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
    strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
)

/* Пункты навигации строго по требованию:
   Каталог, Новости, О мастерской, Обучение, Галерея, Контакты */
const NAV_ITEMS = [
  { to: '/',         label: 'Каталог' },
  { to: '/news',     label: 'Новости' },
  { to: '/about',    label: 'О мастерской' },
  { to: '/training', label: 'Обучение' },
  { to: '/gallery',  label: 'Галерея' },
  { to: '/contacts', label: 'Контакты' },
]

/* ══════════════════════════════════════════════════════════════
   TOP BAR
   ══════════════════════════════════════════════════════════════ */
function TopBar() {
  return (
    <div className="relative z-10 hidden sm:block bg-black border-b border-forge-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8
                      flex items-center justify-between h-8">
        <span className="text-forge-muted text-[10px] tracking-[0.3em] uppercase font-body">
          Кожа · Дерево · Металл
        </span>
        <a href="tel:+79500082208"
          className="text-forge-muted text-[10px] tracking-wider font-body
                     hover:text-forge-primary transition-colors duration-200">
          +7 950 008-22-08
        </a>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   MOBILE MENU OVERLAY
   ══════════════════════════════════════════════════════════════ */
function MobileMenu({ isOpen, onClose }) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/80 backdrop-blur-sm
                    transition-opacity duration-300
                    ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />
      {/* Panel */}
      <div className={`
        fixed top-0 right-0 bottom-0 z-50 w-72
        bg-black border-l border-forge-border
        flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Шапка */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-forge-border">
          <span className="text-forge-primary text-xs tracking-[0.25em] uppercase font-body">
            Меню
          </span>
          <button onClick={onClose} className="p-1 text-forge-muted hover:text-forge-text">
            <XIcon />
          </button>
        </div>

        {/* Ссылки */}
        <nav className="flex-1 flex flex-col px-6 py-6 gap-1 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `py-3.5 border-b border-forge-border/50 font-serif text-lg tracking-wide
                 transition-colors duration-200
                 ${isActive ? 'text-forge-primary font-bold' : 'text-forge-text hover:text-forge-primary'}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Телефон внизу */}
        <div className="px-6 py-6 border-t border-forge-border">
          <p className="text-forge-muted text-xs tracking-wider uppercase mb-1 font-body">Связаться</p>
          <a href="tel:+79500082208"
            className="text-forge-primary font-body text-base hover:text-forge-gold-lt transition-colors">
            +7 950 008-22-08
          </a>
        </div>
      </div>
    </>
  )
}

/* ══════════════════════════════════════════════════════════════
   HEADER
   ══════════════════════════════════════════════════════════════ */
function Header() {
  const dispatch  = useDispatch()
  const itemCount = useSelector(selectItemCount)
  const sessionId = useSelector(selectSessionId)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    dispatch(fetchCart(sessionId))
  }, [dispatch, sessionId])

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 16)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <>
      <header className={`
        sticky top-0 z-30
        transition-all duration-300
        ${scrolled
          ? 'bg-black/95 backdrop-blur-md border-b border-forge-border shadow-dark'
          : 'bg-black border-b border-forge-border/60'}
      `}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">

            {/* ── Логотип ─────────────────────────────────── */}
            <Link to="/"
              className="flex items-center gap-3 text-forge-primary group"
              aria-label="Мастерская Алдуин — на главную">
              <span className="group-hover:text-forge-gold-lt transition-colors duration-200">
                <img className='w-15 h-20' src={logo}/>
              </span>
              <div className="leading-none">
                <div className="font-serif font-bold text-forge-text text-lg md:text-xl
                                tracking-[0.08em] leading-none">
                  АЛДУИН
                </div>
                <div className="font-body text-forge-primary text-[10px] tracking-[0.3em]
                                uppercase leading-none mt-0.5">
                  Мастерская
                </div>
              </div>
            </Link>

            {/* ── Десктопная навигация: 6 прямых пунктов ──────── */}
            <nav className="hidden md:flex items-center gap-6 lg:gap-8" aria-label="Основная навигация">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `nav-link text-xs tracking-[0.18em] uppercase ${
                      isActive ? 'active text-forge-primary font-semibold' : 'text-forge-muted hover:text-forge-text'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* ── Правая панель (Корзина и бургер) ─────────────── */}
            <div className="flex items-center gap-2">
              {/* Корзина — квадратный контур */}
              <button
                onClick={() => dispatch(toggleDrawer())}
                className="relative w-10 h-10 flex items-center justify-center
                           border border-forge-border/80
                           text-forge-muted hover:text-forge-primary hover:border-forge-primary/50
                           transition-all duration-200"
                aria-label={`Корзина${itemCount > 0 ? `, ${itemCount} товаров` : ''}`}
              >
                <CartIcon />
                {itemCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5
                                   w-4 h-4 flex items-center justify-center
                                   bg-forge-primary text-black
                                   text-[9px] font-bold leading-none">
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </button>

              {/* Бургер — мобайл */}
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="md:hidden w-10 h-10 flex items-center justify-center
                           border border-forge-border/80
                           text-forge-muted hover:text-forge-primary hover:border-forge-primary/50
                           transition-all duration-200"
                aria-label="Открыть меню"
                aria-expanded={menuOpen}
              >
                {menuOpen ? <XIcon /> : <BurgerIcon />}
              </button>
            </div>
          </div>
        </div>
      </header>

      <MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  )
}

/* ── Иконки соцсетей ─────────────────────────────────────────────────────── */
const VkIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
    <path d="M12.785 16.241s.288-.032.436-.194c.136-.148.132-.427.132-.427s-.02-1.304.587-1.496c.598-.19 1.365 1.26 2.179 1.815.615.416 1.082.325 1.082.325l2.172-.03s1.135-.07.597-1.963-.917-1.31-.917-1.31c-.397-.53-2.15-2.278.096-4.617 1.37-1.47.896-3.27-.748-2.68l-2.58.667c-.48.128-.93.003-1.167-.316-.467-.62-1.108-1.02-1.923-.972-1.77.1-2.684 1.54-2.684 1.54s-1.684 3.006-2.63 4.395c-1.012 1.48-1.96 1.06-1.96 1.06l.002-7.83h-4.093l.002 8.547c0 1.53.914 2.483 1.947 2.595 1.197.132 2.1-.48 3.166-1.48L6.985 12.65s2.003-2.226 2.87-3.093" />
  </svg>
)
const TgIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
)
const YtIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
)
const RtIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm3.12 14.46c-.612.4-1.32.6-2.04.6H9.6V9h3.48c.72 0 1.428.2 2.04.6 1.14.74 1.8 2 1.8 3.42s-.66 2.7-1.8 3.44zm-1.02-5.34c-.3-.2-.66-.3-1.02-.3H11.4v3.48h1.68c.36 0 .72-.1 1.02-.3.54-.36.84-.96.84-1.56s-.3-1.2-.84-1.56v-.06z"/>
  </svg>
)

/* ── Значения по умолчанию для футера ────────────────────────────────────── */
const FOOTER_DEFAULTS = {
  contact_phone1:  '+79500082208',
  contact_phone2:  '+79202091993',
  contact_inn:     '780534396013',
  contact_ogrnip:  '325784700428266',
  social_vk:       'https://vk.com/alduin_workshop',
  social_tg:       'https://t.me/alduin_workshop',
  social_yt:       'https://youtube.com/@alduln_workshop?si=F9XkPmBBNxbPs9e2',
  social_rutube:   'https://rutube.ru/channel/48354889',
}

function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '7') {
    return `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`
  }
  return raw
}

/* ══════════════════════════════════════════════════════════════
   FOOTER
   ══════════════════════════════════════════════════════════════ */
function Footer() {
  const year = new Date().getFullYear()
  const [s, setS] = useState(FOOTER_DEFAULTS)

  useEffect(() => {
    api.get('/settings/')
      .then(({ data }) => setS(prev => ({ ...prev, ...data })))
      .catch(() => {})
  }, [])

  const socials = [
    { key: 'social_vk',     label: 'ВКонтакте', Icon: VkIcon },
    { key: 'social_tg',     label: 'Telegram',  Icon: TgIcon },
    { key: 'social_yt',     label: 'YouTube',   Icon: YtIcon },
    { key: 'social_rutube', label: 'Rutube',    Icon: RtIcon },
  ]

  return (
    <footer className="relative z-10 bg-black border-t border-forge-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-10">

          {/* Бренд */}
          <div className="max-w-md space-y-4">
            <div className="flex items-center gap-3 text-forge-primary">
              <ShieldIcon />
              <div>
                <div className="font-serif font-bold text-forge-text text-xl">АЛДУИН</div>
                <div className="text-forge-primary text-[10px] tracking-[0.3em] uppercase font-body">Мастерская</div>
              </div>
            </div>
            <p className="text-forge-muted text-sm leading-relaxed font-body">
              Изделия из металла, дерева и кожи.<br />
              Всё, что можно представить, можно осуществить.
            </p>
            {/* Телефоны */}
            <div className="space-y-1 pt-1">
              {s.contact_phone1 && (
                <a href={`tel:${s.contact_phone1}`}
                  className="block text-forge-primary hover:text-forge-gold-lt font-body text-sm font-semibold tracking-wider transition-colors">
                  {formatPhone(s.contact_phone1)}
                </a>
              )}
              {s.contact_phone2 && (
                <a href={`tel:${s.contact_phone2}`}
                  className="block text-forge-primary hover:text-forge-gold-lt font-body text-sm font-semibold tracking-wider transition-colors">
                  {formatPhone(s.contact_phone2)}
                </a>
              )}
            </div>
          </div>

          {/* Соцсети */}
          <div className="space-y-4">
            <h4 className="text-forge-primary text-xs tracking-[0.25em] uppercase font-body font-semibold">
              Мы в сети
            </h4>
            <div className="flex flex-wrap gap-3 font-body text-sm">
              {socials.map(({ key, label, Icon }) =>
                s[key] ? (
                  <a
                    key={key}
                    href={s[key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-forge-surface border border-forge-border
                               text-forge-text hover:text-forge-primary hover:border-forge-primary/50 transition-colors"
                    aria-label={label}
                  >
                    <Icon />
                    {label}
                  </a>
                ) : null
              )}
            </div>
          </div>
        </div>

        {/* Копирайт + реквизиты + гарантия */}
        <div className="mt-10 pt-6 border-t border-forge-border/60
                        flex flex-col sm:flex-row items-center justify-between
                        gap-3 text-forge-muted/50 text-xs tracking-wider font-body">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <span>© {year} Мастерская Алдуин. Все права защищены.</span>
            {(s.contact_inn || s.contact_ogrnip) && (
              <span className="hidden sm:inline">·</span>
            )}
            {s.contact_inn && <span>ИНН {s.contact_inn}</span>}
            {s.contact_ogrnip && <span>ОГРНИП {s.contact_ogrnip}</span>}
          </div>
          <Link
            to="/warranty"
            className="hover:text-forge-primary transition-colors whitespace-nowrap"
          >
            Гарантия · Возврат
          </Link>
        </div>
      </div>
    </footer>
  )
}

/* ══════════════════════════════════════════════════════════════
   LAYOUT
   ══════════════════════════════════════════════════════════════ */
export default function Layout({ children }) {
  return (
    <div className="relative flex flex-col min-h-svh bg-black text-forge-text">
      <TopBar />
      <Header />
      <main className="relative z-10 flex-1 w-full">{children}</main>
      <Footer />
      <CookieBanner />
      <CartDrawer />
    </div>
  )
}
