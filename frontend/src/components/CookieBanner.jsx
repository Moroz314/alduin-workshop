import { useState, useEffect } from 'react'

const COOKIE_STORAGE_KEY = 'alduin_cookie_consent'

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    try {
      const consent = localStorage.getItem(COOKIE_STORAGE_KEY)
      if (!consent) {
        setIsVisible(true)
      }
    } catch {
      // If localStorage is unavailable, default to showing
      setIsVisible(true)
    }
  }, [])

  const handleAccept = () => {
    try {
      localStorage.setItem(COOKIE_STORAGE_KEY, 'accepted')
    } catch {
      // Ignore write errors
    }
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div
      role="region"
      aria-label="Уведомление об использовании cookie"
      className="fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-md border-t border-forge-border shadow-2xl py-4 px-4 sm:px-6 lg:px-8 transition-all duration-300 animate-fade-up"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-forge-text font-body text-sm text-center sm:text-left leading-relaxed">
          Мы используем файлы cookie для улучшения работы сайта.
        </p>
        <button
          type="button"
          onClick={handleAccept}
          className="px-6 py-2.5 bg-forge-primary hover:bg-forge-gold-lt text-black font-body font-semibold text-xs tracking-wider uppercase transition-colors duration-200 cursor-pointer whitespace-nowrap shadow-sm active:scale-95"
        >
          Понятно
        </button>
      </div>
    </div>
  )
}
