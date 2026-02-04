import { create } from 'zustand'
import type { CartItem, Product } from '@/types/database'

interface POSState {
  cart: CartItem[]
  globalDiscount: number
  taxRate: number
  addItem: (product: Product, qty?: number) => void
  removeItem: (productId: string) => void
  updateQty: (productId: string, qty: number) => void
  updateItemDiscount: (productId: string, discount: number) => void
  setGlobalDiscount: (value: number) => void
  setTaxRate: (value: number) => void
  clearCart: () => void
  /** Jumlah item sebelum diskon global (subtotal beneran) */
  getItemsSubtotal: () => number
  /** Jumlah setelah diskon global (untuk pajak) */
  getSubtotal: () => number
  getTotal: () => number
}

export const usePOSStore = create<POSState>((set, get) => ({
  cart: [],
  globalDiscount: 0,
  taxRate: 0,

  addItem(product, qty = 1) {
    set((state) => {
      const existing = state.cart.find((c) => c.product.id === product.id)
      let next: CartItem[]
      if (existing) {
        next = state.cart.map((c) =>
          c.product.id === product.id
            ? { ...c, qty: c.qty + qty }
            : c
        )
      } else {
        next = [...state.cart, { product, qty, unit_price: product.price, discount: 0 }]
      }
      return { cart: next }
    })
  },

  removeItem(productId) {
    set((state) => ({ cart: state.cart.filter((c) => c.product.id !== productId) }))
  },

  updateQty(productId, qty) {
    if (qty <= 0) {
      get().removeItem(productId)
      return
    }
    set((state) => ({
      cart: state.cart.map((c) =>
        c.product.id === productId ? { ...c, qty } : c
      ),
    }))
  },

  updateItemDiscount(productId, discount) {
    set((state) => ({
      cart: state.cart.map((c) =>
        c.product.id === productId ? { ...c, discount } : c
      ),
    }))
  },

  setGlobalDiscount(value) {
    set({ globalDiscount: value })
  },

  setTaxRate(value) {
    set({ taxRate: value })
  },

  clearCart() {
    set({ cart: [], globalDiscount: 0 })
  },

  /** Subtotal sebelum diskon global: sum(qty*unit_price - item discount) */
  getItemsSubtotal() {
    const { cart } = get()
    return cart.reduce((sum, c) => sum + c.qty * c.unit_price - c.discount, 0)
  },

  /** Setelah diskon global (dipakai untuk dasar pajak) */
  getSubtotal() {
    const itemsTotal = get().getItemsSubtotal()
    const { globalDiscount } = get()
    return Math.max(0, itemsTotal - globalDiscount)
  },

  getTotal() {
    const subtotal = get().getSubtotal()
    const { taxRate } = get()
    const tax = (subtotal * taxRate) / 100
    return subtotal + tax
  },
}))
