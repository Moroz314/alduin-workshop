import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const CartContext = createContext(null)

function createSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(8)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

export function CartProvider({ children }) {
  const [sessionId] = useState(() => {
    const stored = localStorage.getItem('cart_session_id')
    if (stored) return stored
    const generated = `sess_${createSessionId()}`
    localStorage.setItem('cart_session_id', generated)
    return generated
  })

  const [itemCount, setItemCount] = useState(0)
  const [cartTotal, setCartTotal] = useState(0)

  const refreshCart = useCallback(async () => {
    try {
      const res = await fetch(`/api/cart/${sessionId}`)
      if (!res.ok) return
      const data = await res.json()
      const count = (data.items ?? []).reduce((acc, item) => acc + item.quantity, 0)
      setItemCount(count)
      setCartTotal(data.total ?? 0)
    } catch {
      /* сервер недоступен — не крашим UI */
    }
  }, [sessionId])

  useEffect(() => { refreshCart() }, [refreshCart])

  return (
    <CartContext.Provider value={{ sessionId, itemCount, cartTotal, refreshCart }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}
