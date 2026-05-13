export type UserRole = 'buyer' | 'supplier' | 'admin'
export type SaleUnit = 'box' | 'kg' | 'unit'
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'in_route'       // v1.1: replaces in_delivery in CHECK constraint
  | 'in_delivery'    // legacy: kept for backward compat with rows created before migration
  | 'delivered'
  | 'cancelled'
  | 'rejected'       // v1.1: supplier refusal terminal state
export type ProductCategory = 'fruit' | 'vegetable' | 'greens' | 'other'

export interface Profile {
  id: string
  role: UserRole
  full_name: string
  phone: string
  created_at?: string
}

export interface Buyer {
  id: string
  company_name: string
  cnpj: string
  state_registration?: string
  email: string
  address_street: string
  address_number: string
  address_complement?: string
  address_neighborhood: string
  address_city: string
  address_state: string
  address_zip: string
  business_hours: string
  contact_phone: string
}

export interface Supplier {
  id: string
  store_name: string
  description?: string
  logo_url?: string
  banner_url?: string
  whatsapp: string
  min_order_value?: number
  min_order_quantity?: number
  delivery_days?: string[]
  delivery_hours_start?: string
  delivery_hours_end?: string
  address_city: string
  address_state: string
  is_active: boolean
  total_sales: number
  created_at?: string
}

export interface Product {
  id: string
  supplier_id: string
  name: string
  description?: string
  category: ProductCategory
  image_url?: string
  sale_unit: SaleUnit
  box_weight_kg?: number
  box_unit_quantity?: number
  box_price?: number
  price_per_kg?: number
  price_per_unit?: number
  unit_description?: string
  is_available: boolean
  is_featured: boolean
  stock_quantity?: number
  sell_without_stock: boolean
  total_sold: number
  created_at?: string
  updated_at?: string
  supplier?: Supplier
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  product_name: string
  sale_unit: SaleUnit
  quantity: number
  unit_price: number
  subtotal: number
  product?: Product
}

export interface StatusHistoryEntry {
  status: OrderStatus
  at: string   // ISO 8601 timestamp — e.g. "2026-05-13T10:00:00Z"
}

export interface Order {
  id: string
  buyer_id: string
  supplier_id: string
  status: OrderStatus
  total_value: number
  notes?: string
  delivery_time_preference?: string
  payment_method: string
  whatsapp_sent: boolean
  created_at?: string
  updated_at?: string
  // v1.1 additions (Phase 01 migration):
  rejection_reason?: string           // populated when status === 'rejected'
  status_history?: StatusHistoryEntry[] // JSONB array; may be empty on old rows
  idempotency_key?: string            // client-generated UUID; used for dedup
  items?: OrderItem[]
  supplier?: Supplier
  buyer?: Buyer
}

export interface CartItem {
  product: Product
  quantity: number
  subtotal: number
}

export interface CartSection {
  supplier: Supplier
  items: CartItem[]
  sectionTotal: number
  notes: string
  deliveryTimePreference: string
}

export interface DeliveryZone {
  id: string
  supplier_id: string
  city: string
  state: string
  days: string[]
  hours_start: string
  hours_end: string
  created_at?: string
}
