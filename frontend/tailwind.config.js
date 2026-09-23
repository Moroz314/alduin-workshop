/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],

  theme: {
    extend: {
      // ── Премиальная палитра «Северная кузница» ──────────────────────────
      colors: {
        'forge-bg':      '#000000', // строго черный
        'forge-primary': '#C49A45', // благородное золото
        'forge-text':    '#F3F4F6', // белый / светло-серый
        // Вспомогательные
        'forge-surface': '#111113', // чуть светлее фона
        'forge-border':  '#1F1F23', // тонкая рамка
        'forge-muted':   '#A7ADB8', // светлый приглушённый текст на фоне
        'forge-gold-lt': '#E4C97A', // золото — hover
        'forge-gold-dk': '#8B6A28', // тёмное золото — тень
      },

      // ── Шрифты ──────────────────────────────────────────────────────────
      fontFamily: {
        serif:   ['Playfair Display', 'Georgia', 'serif'],
        heading: ['Playfair Display', 'Georgia', 'serif'],
        body:    ['Inter', 'system-ui', 'sans-serif'],
      },

      // ── Тени ────────────────────────────────────────────────────────────
      boxShadow: {
        'gold':    '0 0 24px rgba(196,154,69,0.25)',
        'gold-sm': '0 0 10px rgba(196,154,69,0.15)',
        'dark':    '0 8px 40px rgba(0,0,0,0.8)',
      },

      // ── Анимации ────────────────────────────────────────────────────────
      keyframes: {
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)'    },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out both',
      },
    },
  },

  plugins: [],
}
