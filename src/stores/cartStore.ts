import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product, Supplier, CartSection, CartItem } from '../types'

interface CartStore {
  sections: CartSection[]
  addItem: (product: Product, quantity: number, supplier: Supplier) => void
  removeItem: (productId: string, supplierId: string) => void
  updateQuantity: (productId: string, supplierId: string, quantity: number) => void
  updateNotes: (supplierId: string, notes: string) => void
  updateDeliveryTime: (supplierId: string, time: string) => void
  clearSection: (supplierId: string) => void
  clearAll: () => void
  totalItemCount: () => number
}

function calculateSubtotal(product: Product, quantity: number): number {
  if (product.sale_unit === 'box') return (product.box_price || 0) * quantity
  if (product.sale_unit === 'kg') return (product.price_per_kg || 0) * quantity
  if (product.sale_unit === 'unit') return (product.price_per_unit || 0) * quantity
  return 0
}

function getUnitPrice(product: Product): number {
  if (product.sale_unit === 'box') return product.box_price || 0
  if (product.sale_unit === 'kg') return product.price_per_kg || 0
  if (product.sale_unit === 'unit') return product.price_per_unit || 0
  return 0
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      sections: [],

      addItem: (product, quantity, supplier) => {
        set((state) => {
          const sections = [...state.sections]
          const sectionIdx = sections.findIndex((s) => s.supplier.id === supplier.id)

          const cartItem: CartItem = {
            product,
            quantity,
            subtotal: calculateSubtotal(product, quantity),
          }

          if (sectionIdx === -1) {
            sections.push({
              supplier,
              items: [cartItem],
              sectionTotal: cartItem.subtotal,
              notes: '',
              deliveryTimePreference: '',
            })
          } else {
            const section = { ...sections[sectionIdx] }
            const itemIdx = section.items.findIndex((i) => i.product.id === product.id)
            if (itemIdx === -1) {
              section.items = [...section.items, cartItem]
            } else {
              const newQty = section.items[itemIdx].quantity + quantity
              section.items = section.items.map((item, idx) =>
                idx === itemIdx
                  ? { ...item, quantity: newQty, subtotal: calculateSubtotal(product, newQty) }
                  : item
              )
            }
            section.sectionTotal = section.items.reduce((sum, i) => sum + i.subtotal, 0)
            sections[sectionIdx] = section
          }

          return { sections }
        })
      },

      removeItem: (productId, supplierId) => {
        set((state) => {
          const sections = state.sections
            .map((section) => {
              if (section.supplier.id !== supplierId) return section
              const items = section.items.filter((i) => i.product.id !== productId)
              return {
                ...section,
                items,
                sectionTotal: items.reduce((sum, i) => sum + i.subtotal, 0),
              }
            })
            .filter((s) => s.items.length > 0)
          return { sections }
        })
      },

      updateQuantity: (productId, supplierId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId, supplierId)
          return
        }
        set((state) => {
          const sections = state.sections.map((section) => {
            if (section.supplier.id !== supplierId) return section
            const items = section.items.map((item) =>
              item.product.id === productId
                ? {
                    ...item,
                    quantity,
                    subtotal: calculateSubtotal(item.product, quantity),
                  }
                : item
            )
            return {
              ...section,
              items,
              sectionTotal: items.reduce((sum, i) => sum + i.subtotal, 0),
            }
          })
          return { sections }
        })
      },

      updateNotes: (supplierId, notes) => {
        set((state) => ({
          sections: state.sections.map((s) =>
            s.supplier.id === supplierId ? { ...s, notes } : s
          ),
        }))
      },

      updateDeliveryTime: (supplierId, time) => {
        set((state) => ({
          sections: state.sections.map((s) =>
            s.supplier.id === supplierId ? { ...s, deliveryTimePreference: time } : s
          ),
        }))
      },

      clearSection: (supplierId) => {
        set((state) => ({
          sections: state.sections.filter((s) => s.supplier.id !== supplierId),
        }))
      },

      clearAll: () => set({ sections: [] }),

      totalItemCount: () => {
        return get().sections.reduce(
          (total, section) => total + section.items.reduce((sum, item) => sum + item.quantity, 0),
          0
        )
      },
    }),
    {
      name: 'verdemar-cart',
    }
  )
)

export function getUnitPriceFromProduct(product: Product): number {
  return getUnitPrice(product)
}
