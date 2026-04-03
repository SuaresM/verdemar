import { describe, it, expect, beforeEach } from 'vitest'
import { useCartStore } from './cartStore'
import type { Product, Supplier } from '../types'

const mockSupplier: Supplier = {
  id: 'sup-1',
  store_name: 'Fazenda Teste',
  description: 'Test supplier',
  whatsapp: '11999999999',
  delivery_days: ['monday'],
  delivery_hours_start: '08:00',
  delivery_hours_end: '18:00',
  address_city: 'São Paulo',
  address_state: 'SP',
  is_active: true,
  total_sales: 0,
  created_at: '2024-01-01',
}

const mockProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'prod-1',
  supplier_id: 'sup-1',
  name: 'Banana',
  description: 'Banana prata',
  category: 'fruit',
  sale_unit: 'box',
  box_price: 50,
  box_weight_kg: 20,
  is_available: true,
  is_featured: false,
  total_sold: 0,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  ...overrides,
})

describe('cartStore', () => {
  beforeEach(() => {
    useCartStore.setState({ sections: [] })
  })

  it('starts with empty cart', () => {
    expect(useCartStore.getState().sections).toHaveLength(0)
    expect(useCartStore.getState().totalItemCount()).toBe(0)
  })

  it('adds item and creates a section for the supplier', () => {
    const product = mockProduct()
    useCartStore.getState().addItem(product, 2, mockSupplier)

    const { sections } = useCartStore.getState()
    expect(sections).toHaveLength(1)
    expect(sections[0].supplier.id).toBe('sup-1')
    expect(sections[0].items).toHaveLength(1)
    expect(sections[0].items[0].quantity).toBe(2)
    expect(sections[0].items[0].subtotal).toBe(100) // 50 * 2
  })

  it('calculates subtotal correctly for box products', () => {
    const product = mockProduct({ box_price: 35.5 })
    useCartStore.getState().addItem(product, 3, mockSupplier)

    const item = useCartStore.getState().sections[0].items[0]
    expect(item.subtotal).toBe(106.5) // 35.5 * 3
  })

  it('calculates subtotal correctly for kg products', () => {
    const product = mockProduct({ sale_unit: 'kg', price_per_kg: 8.99, box_price: undefined })
    useCartStore.getState().addItem(product, 5, mockSupplier)

    const item = useCartStore.getState().sections[0].items[0]
    expect(item.subtotal).toBe(44.95) // 8.99 * 5
  })

  it('calculates subtotal correctly for unit products', () => {
    const product = mockProduct({ sale_unit: 'unit', price_per_unit: 3.5, box_price: undefined })
    useCartStore.getState().addItem(product, 10, mockSupplier)

    const item = useCartStore.getState().sections[0].items[0]
    expect(item.subtotal).toBe(35) // 3.5 * 10
  })

  it('avoids floating-point errors', () => {
    const product = mockProduct({ sale_unit: 'kg', price_per_kg: 0.1, box_price: undefined })
    useCartStore.getState().addItem(product, 3, mockSupplier)

    const item = useCartStore.getState().sections[0].items[0]
    // Without Math.round, 0.1 * 3 = 0.30000000000000004
    expect(item.subtotal).toBe(0.3)
  })

  it('increments quantity when adding same product again', () => {
    const product = mockProduct()
    useCartStore.getState().addItem(product, 2, mockSupplier)
    useCartStore.getState().addItem(product, 3, mockSupplier)

    const { sections } = useCartStore.getState()
    expect(sections).toHaveLength(1)
    expect(sections[0].items).toHaveLength(1)
    expect(sections[0].items[0].quantity).toBe(5)
    expect(sections[0].items[0].subtotal).toBe(250) // 50 * 5
  })

  it('updates quantity of an item', () => {
    const product = mockProduct()
    useCartStore.getState().addItem(product, 2, mockSupplier)
    useCartStore.getState().updateQuantity('prod-1', 'sup-1', 5)

    const item = useCartStore.getState().sections[0].items[0]
    expect(item.quantity).toBe(5)
    expect(item.subtotal).toBe(250)
  })

  it('removes item when quantity set to 0', () => {
    const product = mockProduct()
    useCartStore.getState().addItem(product, 2, mockSupplier)
    useCartStore.getState().updateQuantity('prod-1', 'sup-1', 0)

    expect(useCartStore.getState().sections).toHaveLength(0)
  })

  it('removes item by product id', () => {
    const product = mockProduct()
    useCartStore.getState().addItem(product, 2, mockSupplier)
    useCartStore.getState().removeItem('prod-1', 'sup-1')

    expect(useCartStore.getState().sections).toHaveLength(0)
  })

  it('removes section when last item is removed', () => {
    const product = mockProduct()
    useCartStore.getState().addItem(product, 1, mockSupplier)
    useCartStore.getState().removeItem('prod-1', 'sup-1')

    expect(useCartStore.getState().sections).toHaveLength(0)
  })

  it('clears specific supplier section', () => {
    const product1 = mockProduct()
    const product2 = mockProduct({ id: 'prod-2', supplier_id: 'sup-2' })
    const supplier2 = { ...mockSupplier, id: 'sup-2', store_name: 'Outra Fazenda' }

    useCartStore.getState().addItem(product1, 1, mockSupplier)
    useCartStore.getState().addItem(product2, 1, supplier2)
    expect(useCartStore.getState().sections).toHaveLength(2)

    useCartStore.getState().clearSection('sup-1')
    expect(useCartStore.getState().sections).toHaveLength(1)
    expect(useCartStore.getState().sections[0].supplier.id).toBe('sup-2')
  })

  it('clears all items', () => {
    const product = mockProduct()
    useCartStore.getState().addItem(product, 5, mockSupplier)
    useCartStore.getState().clearAll()

    expect(useCartStore.getState().sections).toHaveLength(0)
    expect(useCartStore.getState().totalItemCount()).toBe(0)
  })

  it('updates section total when items change', () => {
    const product1 = mockProduct({ box_price: 30 })
    const product2 = mockProduct({ id: 'prod-2', box_price: 20 })

    useCartStore.getState().addItem(product1, 2, mockSupplier)
    useCartStore.getState().addItem(product2, 3, mockSupplier)

    const section = useCartStore.getState().sections[0]
    expect(section.sectionTotal).toBe(120) // 30*2 + 20*3
  })

  it('counts total items across sections', () => {
    const product1 = mockProduct()
    const product2 = mockProduct({ id: 'prod-2', supplier_id: 'sup-2' })
    const supplier2 = { ...mockSupplier, id: 'sup-2' }

    useCartStore.getState().addItem(product1, 3, mockSupplier)
    useCartStore.getState().addItem(product2, 7, supplier2)

    expect(useCartStore.getState().totalItemCount()).toBe(10)
  })

  it('updates notes for a supplier section', () => {
    const product = mockProduct()
    useCartStore.getState().addItem(product, 1, mockSupplier)
    useCartStore.getState().updateNotes('sup-1', 'Sem cebola')

    expect(useCartStore.getState().sections[0].notes).toBe('Sem cebola')
  })

  it('updates delivery time preference', () => {
    const product = mockProduct()
    useCartStore.getState().addItem(product, 1, mockSupplier)
    useCartStore.getState().updateDeliveryTime('sup-1', '08:00-12:00')

    expect(useCartStore.getState().sections[0].deliveryTimePreference).toBe('08:00-12:00')
  })
})
