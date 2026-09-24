import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/axios'

/* ── Значения по умолчанию ─────────────────────────────────────────────────── */
const DEFAULTS = {
  contact_text:       'Купить готовые изделия или заказать что-то нестандартное можно по телефонам:',
  contact_phone1:     '+79500082208',
  contact_phone2:     '+79202091993',
  contact_address:    'Петергоф, Ропшинское ш., 8Г, 198517',
  contact_inn:        '780534396013',
  contact_ogrnip:     '325784700428266',
  contact_email:      'info@alduin-workshop.ru',
  contact_legal_name: 'ИП Морозов Владислав Сергеевич',
  social_vk:          'https://vk.com/alduin_workshop',
  social_tg:          'https://t.me/alduin_workshop',
  social_yt:          'https://youtube.com/@alduln_workshop?si=F9XkPmBBNxbPs9e2',
  social_rutube:      'https://rutube.ru/channel/48354889',
  developer_name:     'Владислав Морозов',
  developer_url:      'http://x90461p7.beget.tech/',
}

/* ── Форматирование номера для отображения ──────────────────────────────────── */
function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '7') {
    return `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`
  }
  return raw
}

/* ── Иконка ВКонтакте ──────────────────────────────────────────────────────── */
function VkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
      <path d="M12.785 16.241s.288-.032.436-.194c.136-.148.132-.427.132-.427s-.02-1.304.587-1.496c.598-.19 1.365 1.26 2.179 1.815.615.416 1.082.325 1.082.325l2.172-.03s1.135-.07.597-1.963-.917-1.31-.917-1.31c-.397-.53-2.15-2.278.096-4.617 1.37-1.47.896-3.27-.748-2.68l-2.58.667c-.48.128-.93.003-1.167-.316-.467-.62-1.108-1.02-1.923-.972-1.77.1-2.684 1.54-2.684 1.54s-1.684 3.006-2.63 4.395c-1.012 1.48-1.96 1.06-1.96 1.06l.002-7.83h-4.093l.002 8.547c0 1.53.914 2.483 1.947 2.595 1.197.132 2.1-.48 3.166-1.48L6.985 12.65s2.003-2.226 2.87-3.093" />
    </svg>
  )
}

/* ── Иконка Telegram ───────────────────────────────────────────────────────── */
function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  )
}

/* ── Иконка YouTube ────────────────────────────────────────────────────────── */
function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  )
}

/* ── Иконка Rutube ─────────────────────────────────────────────────────────── */
function RutubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm3.12 14.46c-.612.4-1.32.6-2.04.6H9.6V9h3.48c.72 0 1.428.2 2.04.6 1.14.74 1.8 2 1.8 3.42s-.66 2.7-1.8 3.44zm-1.02-5.34c-.3-.2-.66-.3-1.02-.3H11.4v3.48h1.68c.36 0 .72-.1 1.02-.3.54-.36.84-.96.84-1.56s-.3-1.2-.84-1.56v-.06z"/>
    </svg>
  )
}

/* ── Иконка стрелки ────────────────────────────────────────────────────────── */
function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      className="w-5 h-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  )
}

/* ── Социальная ссылка ─────────────────────────────────────────────────────── */
function SocialLink({ href, label, Icon }) {
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center justify-between gap-4 py-4 border-b border-forge-border/70
                 text-forge-text hover:text-forge-primary transition-colors duration-200"
    >
      <span className="flex items-center gap-3">
        <span className="text-forge-primary/70 group-hover:text-forge-primary transition-colors">
          <Icon />
        </span>
        <span className="block font-body text-sm font-semibold">{label}</span>
      </span>
      <ArrowIcon />
    </a>
  )
}

export default function ContactsPage() {
  const [s, setS] = useState(DEFAULTS)

  useEffect(() => {
    api.get('/settings/')
      .then(({ data }) => setS(prev => ({ ...prev, ...data })))
      .catch(() => { /* оставляем defaults */ })
  }, [])

  const phone1 = s.contact_phone1
  const phone2 = s.contact_phone2

  const socials = [
    { key: 'social_vk',     label: 'ВКонтакте', Icon: VkIcon      },
    { key: 'social_tg',     label: 'Telegram',  Icon: TelegramIcon },
    { key: 'social_yt',     label: 'YouTube',   Icon: YouTubeIcon  },
    { key: 'social_rutube', label: 'Rutube',    Icon: RutubeIcon   },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
      <div className="max-w-xl mb-12">
        <p className="gold-tag mb-3">◇ Мастерская Алдуин</p>
        <h1 className="font-serif font-bold text-forge-text text-4xl md:text-5xl leading-tight mb-4">
          Контакты
        </h1>
        <div className="w-12 h-px bg-forge-primary mb-4" />
        <p className="text-forge-muted font-body text-base leading-relaxed">
          {s.contact_text}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
        {/* ── Телефоны ───────────────────────────────────────────────── */}
        <div>
          <p className="text-forge-muted text-xs tracking-[0.2em] uppercase font-body mb-4">
            Телефон
          </p>
          <div className="space-y-3">
            {phone1 && (
              <a
                href={`tel:${phone1}`}
                className="flex items-center gap-3 text-forge-primary font-serif text-2xl md:text-3xl
                           hover:text-forge-gold-lt transition-colors duration-200"
              >
                {formatPhone(phone1)}
                <ArrowIcon />
              </a>
            )}
            {phone2 && (
              <a
                href={`tel:${phone2}`}
                className="flex items-center gap-3 text-forge-primary font-serif text-2xl md:text-3xl
                           hover:text-forge-gold-lt transition-colors duration-200"
              >
                {formatPhone(phone2)}
                <ArrowIcon />
              </a>
            )}
          </div>

          {/* E-mail */}
          {s.contact_email && (
            <div className="mt-6">
              <p className="text-forge-muted text-xs tracking-[0.2em] uppercase font-body mb-2">
                E-mail
              </p>
              <a
                href={`mailto:${s.contact_email}`}
                className="text-forge-muted font-body text-sm hover:text-forge-primary transition-colors duration-200"
              >
                {s.contact_email}
              </a>
            </div>
          )}

          {/* Адрес */}
          {s.contact_address && (
            <div className="mt-6">
              <p className="text-forge-muted text-xs tracking-[0.2em] uppercase font-body mb-2">
                Адрес
              </p>
              <p className="text-forge-text font-body text-sm leading-relaxed">
                {s.contact_address}
              </p>
            </div>
          )}

          {/* Реквизиты */}
          {(s.contact_legal_name || s.contact_inn || s.contact_ogrnip) && (
            <div className="mt-6">
              <p className="text-forge-muted text-xs tracking-[0.2em] uppercase font-body mb-2">
                Реквизиты
              </p>
              {s.contact_legal_name && (
                <p className="text-forge-muted font-body text-xs mb-1">{s.contact_legal_name}</p>
              )}
              {s.contact_inn && (
                <p className="text-forge-muted font-body text-xs">ИНН {s.contact_inn}</p>
              )}
              {s.contact_ogrnip && (
                <p className="text-forge-muted font-body text-xs">ОГРНИП {s.contact_ogrnip}</p>
              )}
            </div>
          )}

          {/* Разработчик */}
          {s.developer_name && (
            <div className="mt-4">
              <p className="text-forge-muted font-body text-xs">
                Сайт разработан:{' '}
                {s.developer_url ? (
                  <a
                    href={s.developer_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-forge-primary transition-colors duration-200 underline underline-offset-2"
                  >
                    {s.developer_name}
                  </a>
                ) : (
                  s.developer_name
                )}
              </p>
            </div>
          )}

          {/* Юридические ссылки */}
          <div className="mt-8 pt-6 border-t border-forge-border/40 flex flex-col gap-2">
            <Link to="/warranty"
              className="text-forge-muted font-body text-xs hover:text-forge-primary transition-colors underline underline-offset-2">
              Гарантия и возврат
            </Link>
            <Link to="/privacy"
              className="text-forge-muted font-body text-xs hover:text-forge-primary transition-colors underline underline-offset-2">
              Политика конфиденциальности
            </Link>
            <Link to="/payment"
              className="text-forge-muted font-body text-xs hover:text-forge-primary transition-colors underline underline-offset-2">
              Оплата и доставка
            </Link>
          </div>
        </div>

        {/* ── Социальные сети ────────────────────────────────────────── */}
        <div>
          <p className="text-forge-muted text-xs tracking-[0.2em] uppercase font-body mb-4">
            Социальные сети
          </p>
          <div className="border-t border-forge-border/70">
            {socials.map(({ key, label, Icon }) => (
              <SocialLink key={key} href={s[key]} label={label} Icon={Icon} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
