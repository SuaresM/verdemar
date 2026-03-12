import { supabase } from '../lib/supabaseClient'
import type { Profile, Buyer, Supplier, Product, Order, OrderItem } from '../types'

// ---- AUTH ----
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

// ---- PROFILES ----
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) return null
  return data
}

export async function createProfile(profile: Omit<Profile, 'created_at'>) {
  const { error } = await supabase.from('profiles').insert(profile)
  if (error) throw error
}

// ---- BUYERS ----
export async function getBuyer(userId: string): Promise<Buyer | null> {
  const { data, error } = await supabase
    .from('buyers')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) return null
  return data
}

export async function createBuyer(buyer: Buyer) {
  const { error } = await supabase.from('buyers').insert(buyer)
  if (error) throw error
}

export async function updateBuyer(id: string, updates: Partial<Buyer>) {
  const { error } = await supabase.from('buyers').update(updates).eq('id', id)
  if (error) throw error
}

// ---- SUPPLIERS ----
export async function getSupplier(userId: string): Promise<Supplier | null> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) return null
  return data
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function createSupplier(supplier: Omit<Supplier, 'total_sales' | 'created_at'>) {
  const { error } = await supabase.from('suppliers').insert({ ...supplier, total_sales: 0 })
  if (error) throw error
}

export async function updateSupplier(id: string, updates: Partial<Supplier>) {
  const { error } = await supabase.from('suppliers').update(updates).eq('id', id)
  if (error) throw error
}

export async function getFeaturedSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('is_active', true)
    .order('total_sales', { ascending: false })
    .limit(10)
  if (error) return []
  return data
}

export async function searchSuppliers(query: string, city?: string): Promise<Supplier[]> {
  let q = supabase
    .from('suppliers')
    .select('*')
    .eq('is_active', true)
    .ilike('store_name', `%${query}%`)
  if (city) q = q.ilike('address_city', `%${city}%`)
  const { data, error } = await q
  if (error) return []
  return data
}

// ---- PRODUCTS ----
export async function getProductsBySupplier(supplierId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('name')
  if (error) return []
  return data
}

export async function getProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*, supplier:suppliers(*)')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function getFeaturedProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*, supplier:suppliers(*)')
    .eq('is_featured', true)
    .eq('is_available', true)
    .order('total_sold', { ascending: false })
    .limit(20)
  if (error) return []
  return data
}

export async function searchProducts(query: string, category?: string): Promise<Product[]> {
  let q = supabase
    .from('products')
    .select('*, supplier:suppliers(*)')
    .eq('is_available', true)
    .ilike('name', `%${query}%`)
  if (category) q = q.eq('category', category)
  const { data, error } = await q
  if (error) return []
  return data
}

export async function createProduct(product: Omit<Product, 'id' | 'total_sold' | 'created_at' | 'updated_at' | 'supplier'>) {
  const { data, error } = await supabase.from('products').insert({ ...product, total_sold: 0 }).select().single()
  if (error) throw error
  return data
}

export async function updateProduct(id: string, updates: Partial<Product>) {
  const { error } = await supabase
    .from('products')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}

// ---- ORDERS ----
export async function createOrder(
  order: Omit<Order, 'id' | 'created_at' | 'updated_at' | 'items' | 'supplier' | 'buyer'>,
  items: Omit<OrderItem, 'id' | 'order_id' | 'product'>[]
): Promise<Order> {
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .insert(order)
    .select()
    .single()
  if (orderError) throw orderError

  const orderItems = items.map((item) => ({ ...item, order_id: orderData.id }))
  const { error: itemsError } = await supabase.from('order_items').insert(orderItems)
  if (itemsError) throw itemsError

  // Update supplier total_sales
  await supabase.rpc('increment_supplier_sales', { supplier_id: order.supplier_id })

  return orderData
}

export async function getOrdersByBuyer(buyerId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, supplier:suppliers(*), items:order_items(*)')
    .eq('buyer_id', buyerId)
    .order('created_at', { ascending: false })
  if (error) return []
  return data
}

export async function getOrdersBySupplier(supplierId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, buyer:buyers(*), items:order_items(*)')
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false })
  if (error) return []
  return data
}

export async function updateOrderStatus(orderId: string, status: string) {
  const { error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
  if (error) throw error
}

export async function getSupplierDashboard(supplierId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  const { data: ordersToday } = await supabase
    .from('orders')
    .select('id', { count: 'exact' })
    .eq('supplier_id', supplierId)
    .gte('created_at', today.toISOString())

  const { data: ordersPending } = await supabase
    .from('orders')
    .select('id', { count: 'exact' })
    .eq('supplier_id', supplierId)
    .eq('status', 'pending')

  const { data: monthOrders } = await supabase
    .from('orders')
    .select('total_value')
    .eq('supplier_id', supplierId)
    .gte('created_at', startOfMonth.toISOString())

  const monthTotal = monthOrders?.reduce((sum, o) => sum + (o.total_value || 0), 0) || 0

  const { data: recentOrders } = await supabase
    .from('orders')
    .select('*, buyer:buyers(*), items:order_items(*)')
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false })
    .limit(5)

  return {
    todayCount: ordersToday?.length || 0,
    pendingCount: ordersPending?.length || 0,
    monthTotal,
    recentOrders: recentOrders || [],
  }
}
