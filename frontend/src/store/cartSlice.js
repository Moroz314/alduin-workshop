import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import axios from 'axios'

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

/* ── Инициализация session_id из localStorage ─────────────────────────────── */
function getOrCreateSessionId() {
  let id = localStorage.getItem('cart_session_id')
  if (!id) {
    id = `sess_${createSessionId()}`
    localStorage.setItem('cart_session_id', id)
  }
  return id
}

/* ══════════════════════════════════════════════════════════════
   ASYNC THUNKS
   ══════════════════════════════════════════════════════════════ */

/** Получить корзину с сервера */
export const fetchCart = createAsyncThunk(
  'cart/fetch',
  async (sessionId, { rejectWithValue }) => {
    try {
      const { data } = await axios.get(`/api/cart/${sessionId}`)
      return data
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail ?? 'Ошибка загрузки корзины')
    }
  }
)

/** Добавить товар в корзину */
export const addToCart = createAsyncThunk(
  'cart/add',
  async ({ sessionId, productId, quantity = 1 }, { rejectWithValue }) => {
    try {
      const { data } = await axios.post('/api/cart/add', {
        session_id: sessionId,
        product_id: productId,
        quantity,
      })
      return data // сервер возвращает обновлённую корзину
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail ?? 'Не удалось добавить товар')
    }
  }
)

/** Удалить позицию из корзины */
export const removeFromCart = createAsyncThunk(
  'cart/remove',
  async ({ sessionId, productId }, { rejectWithValue }) => {
    try {
      const { data } = await axios.delete('/api/cart/remove', {
        data: { session_id: sessionId, product_id: productId },
      })
      return data
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail ?? 'Не удалось удалить товар')
    }
  }
)

/** Обновить количество (удалить + добавить нужное кол-во) */
export const updateQuantity = createAsyncThunk(
  'cart/updateQuantity',
  async ({ sessionId, productId, quantity }, { dispatch, rejectWithValue }) => {
    try {
      if (quantity <= 0) {
        // Если 0 — удаляем совсем
        const result = await dispatch(removeFromCart({ sessionId, productId }))
        return result.payload
      }
      // Удаляем старую запись и добавляем с новым quantity
      await axios.delete('/api/cart/remove', {
        data: { session_id: sessionId, product_id: productId },
      })
      const { data } = await axios.post('/api/cart/add', {
        session_id: sessionId,
        product_id: productId,
        quantity,
      })
      return data
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail ?? 'Ошибка обновления количества')
    }
  }
)

/* ══════════════════════════════════════════════════════════════
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   ══════════════════════════════════════════════════════════════ */

/** Вычисляем itemCount из списка позиций */
const calcItemCount = (items) =>
  (items ?? []).reduce((sum, item) => sum + item.quantity, 0)

/** Применяем данные с сервера к состоянию */
const applyCartData = (state, cartData) => {
  state.items     = cartData.items    ?? []
  state.total     = cartData.total    ?? '0.00'
  state.itemCount = calcItemCount(cartData.items)
  state.error     = null
}

/* ══════════════════════════════════════════════════════════════
   SLICE
   ══════════════════════════════════════════════════════════════ */

const cartSlice = createSlice({
  name: 'cart',

  initialState: {
    sessionId:  getOrCreateSessionId(),
    items:      [],           // CartItemRead[]
    total:      '0.00',
    itemCount:  0,
    loading:    false,        // глобальный флаг загрузки
    adding:     {},           // { [productId]: boolean } — отдельный флаг для каждого товара
    error:      null,
    isOpen:     false,        // видимость CartDrawer
  },

  reducers: {
    /** Открыть / закрыть боковую панель */
    openDrawer:   (state) => { state.isOpen = true  },
    closeDrawer:  (state) => { state.isOpen = false },
    toggleDrawer: (state) => { state.isOpen = !state.isOpen },

    /** Сбросить ошибку */
    clearError: (state) => { state.error = null },

    /** Очистить корзину локально (после оформления заказа) */
    clearCartState: (state) => {
      state.items     = []
      state.total     = '0.00'
      state.itemCount = 0
      state.error     = null
      state.isOpen    = false
    },
  },

  extraReducers: (builder) => {
    /* ── fetchCart ─────────────────────────────────────────────── */
    builder
      .addCase(fetchCart.pending, (state) => {
        state.loading = true
        state.error   = null
      })
      .addCase(fetchCart.fulfilled, (state, { payload }) => {
        state.loading = false
        applyCartData(state, payload)
      })
      .addCase(fetchCart.rejected, (state, { payload }) => {
        state.loading = false
        state.error   = payload
      })

    /* ── addToCart ─────────────────────────────────────────────── */
    builder
      .addCase(addToCart.pending, (state, { meta }) => {
        state.adding[meta.arg.productId] = true
        state.error = null
      })
      .addCase(addToCart.fulfilled, (state, { payload, meta }) => {
        delete state.adding[meta.arg.productId]
        applyCartData(state, payload)
        state.isOpen = true  // автоматически открываем корзину
      })
      .addCase(addToCart.rejected, (state, { payload, meta }) => {
        delete state.adding[meta.arg.productId]
        state.error = payload
      })

    /* ── removeFromCart ────────────────────────────────────────── */
    builder
      .addCase(removeFromCart.pending, (state) => {
        state.loading = true
      })
      .addCase(removeFromCart.fulfilled, (state, { payload }) => {
        state.loading = false
        applyCartData(state, payload)
      })
      .addCase(removeFromCart.rejected, (state, { payload }) => {
        state.loading = false
        state.error = payload
      })

    /* ── updateQuantity ────────────────────────────────────────── */
    builder
      .addCase(updateQuantity.pending, (state) => {
        state.loading = true
      })
      .addCase(updateQuantity.fulfilled, (state, { payload }) => {
        state.loading = false
        if (payload) applyCartData(state, payload)
      })
      .addCase(updateQuantity.rejected, (state, { payload }) => {
        state.loading = false
        state.error = payload
      })
  },
})

export const { openDrawer, closeDrawer, toggleDrawer, clearError, clearCartState } = cartSlice.actions
export default cartSlice.reducer

/* ── Селекторы ───────────────────────────────────────────────────────────── */
export const selectCart      = (state) => state.cart
export const selectSessionId = (state) => state.cart.sessionId
export const selectItems     = (state) => state.cart.items
export const selectTotal     = (state) => state.cart.total
export const selectItemCount = (state) => state.cart.itemCount
export const selectIsOpen    = (state) => state.cart.isOpen
export const selectLoading   = (state) => state.cart.loading
export const selectAdding    = (productId) => (state) => !!state.cart.adding[productId]
