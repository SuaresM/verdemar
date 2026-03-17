export type UserRole = 'buyer' | 'supplier' | 'admin'
export type SaleUnit = 'box' | 'kg' | 'unit'
export type OrderStatus = 'pending' | 'confirmed' | 'in_delivery' | 'delivered' | 'cancelled'
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
  delivery_days: string[]
  delivery_hours_start: string
  delivery_hours_end: string
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
