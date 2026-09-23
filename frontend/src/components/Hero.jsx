import { Link } from 'react-router-dom'

import heroAxe from './oboi.jpg'

/**
 * Hero.jsx — Главный экран.
 * Фон: затемнённое изображение с градиентом.
 * Замени HERO_IMAGE_URL на реальное фото.
 */

const HERO_IMAGE_URL =
  'https://img.goodfon.ru/wallpaper/big/1/18/topor-boevoi-vikingi.webp'

export default function Hero() {
  return (
    <section className="relative min-h-[92svh] md:min-h-screen flex items-center overflow-hidden">

      {/* ── Фон ────────────────────────────────────────────────── */}
      <div className="absolute inset-0">
        <img
          src={heroAxe}
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover object-center"
          loading="eager"
        />
        {/* Многослойный градиент для глубины */}
        <div className="absolute inset-0 bg-gradient-to-r
                        from-black/90 via-black/60 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-t
                        from-forge-bg via-transparent to-transparent" />
      </div>

      {/* ── Контент ────────────────────────────────────────────── */}
      <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-20 md:py-32">
        <div className="max-w-xl">

          {/* Золотой над-тег */}
          <p className="gold-tag animate-fade-up mb-5 [animation-delay:0ms]">
            ◇ Мастерская Алдуин
          </p>

          {/* Главный заголовок */}
          <h1 className="
            font-serif font-bold text-forge-text
            text-4xl sm:text-5xl md:text-6xl lg:text-7xl
            leading-[1.1] tracking-tight
            animate-fade-up [animation-delay:120ms]
          ">
            
Мастерская
            <br />
            <span className="text-forge-primary text-glow-gold">
              АЛДУИН
            </span>
          </h1>

          {/* Золотой разделитель */}
          <div className="w-16 h-px bg-forge-primary my-7 animate-fade-up [animation-delay:200ms]" />

          {/* Описание */}
          <p className="
            font-body text-forge-muted text-base sm:text-lg
            leading-relaxed max-w-md
            animate-fade-up [animation-delay:260ms]
          ">
            Всё, что можно представить, можно осуществить.
          </p>

          {/* CTA кнопка */}
          <div className="mt-10 flex flex-wrap gap-4 animate-fade-up [animation-delay:340ms]">
            <a href="#catalog-section" className="btn-gold">
              Перейти к изделиям ↓
            </a>
            <Link to="/about" className="btn-ghost">
              О мастерской
            </Link>
          </div>
        </div>
      </div>

      {/* ── Стрелка вниз ────────────────────────────────────────── */}
      <a
        href="#catalog-section"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10
                   animate-bounce text-forge-primary/40 hover:text-forge-primary
                   transition-colors cursor-pointer"
        aria-label="Прокрутить к изделиям"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
          strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </a>
    </section>
  )
}
