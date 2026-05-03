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

export async function searchSuppliers(
  query: string,
  city?: string,
  page = 0
): Promise<{ data: Supplier[]; hasMore: boolean }> {
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  let q = supabase
    .from('suppliers')
    .select('*')
    .eq('is_active', true)
    .ilike('store_name', `%${query}%`)
  if (city) q = q.ilike('address_city', `%${city}%`)
  q = q.range(from, to + 1)
  const { data, error } = await q
  if (error) return { data: [], hasMore: false }
  const hasMore = (data?.length || 0) > PAGE_SIZE
  return { data: hasMore ? data!.slice(0, PAGE_SIZE) : data || [], hasMore }
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

const PAGE_SIZE = 20

export async function searchProducts(
  query?: string,
  category?: string,
  page = 0
): Promise<{ data: Product[]; hasMore: boolean }> {
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  let q = supabase
    .from('products')
    .select('*, supplier:suppliers(*)')
    .eq('is_available', true)
  if (query) q = q.ilike('name', `%${query}%`)
  if (category) q = q.eq('category', category)
  q = q.range(from, to + 1) // fetch one extra to detect hasMore
  const { data, error } = await q
  if (error) return { data: [], hasMore: false }
  const hasMore = (data?.length || 0) > PAGE_SIZE
  return { data: hasMore ? data!.slice(0, PAGE_SIZE) : data || [], hasMore }
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

  // Fire-and-forget push notification to supplier (total_sales updated by DB trigger)
  sendOrderPushNotification(order.supplier_id, orderData.id).catch(() => {})

  return orderData
}

export async function getOrdersByBuyer(buyerId: string, limit = 100): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, supplier:suppliers(*), items:order_items(*)')
    .eq('buyer_id', buyerId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) return []
  return data
}

export async function getOrdersBySupplier(supplierId: string, limit = 100): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, buyer:buyers(*), items:order_items(*)')
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false })
    .limit(limit)
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

export async function updateOrderItemsAndTotal(
  orderId: string,
  updatedItems: Array<{ id: string; quantity: number; subtotal: number }>
): Promise<number> {
  const toRemove = updatedItems.filter((i) => i.quantity === 0).map((i) => i.id)
  const toUpdate = updatedItems.filter((i) => i.quantity > 0)

  if (toRemove.length > 0) {
    const { error } = await supabase.from('order_items').delete().in('id', toRemove)
    if (error) throw error
  }

  for (const item of toUpdate) {
    const { error } = await supabase
      .from('order_items')
      .update({ quantity: item.quantity, subtotal: item.subtotal })
      .eq('id', item.id)
    if (error) throw error
  }

  const newTotal = toUpdate.reduce((sum, i) => sum + i.subtotal, 0)

  const { error: orderErr } = await supabase
    .from('orders')
    .update({ total_value: newTotal, updated_at: new Date().toISOString() })
    .eq('id', orderId)
  if (orderErr) throw orderErr

  return newTotal
}

// ---- ADMIN ----
export async function getAllSuppliers(page = 0): Promise<{ data: (Supplier & { profile?: Profile })[]; hasMore: boolean }> {
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const { data, error } = await supabase
    .from('suppliers')
    .select('*, profile:profiles(*)')
    .order('created_at', { ascending: false })
    .range(from, to + 1)
  if (error) return { data: [], hasMore: false }
  const hasMore = (data?.length || 0) > PAGE_SIZE
  return { data: hasMore ? data!.slice(0, PAGE_SIZE) : data || [], hasMore }
}

export async function getAllProducts(page = 0): Promise<{ data: Product[]; hasMore: boolean }> {
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const { data, error } = await supabase
    .from('products')
    .select('*, supplier:suppliers(*)')
    .order('created_at', { ascending: false })
    .range(from, to + 1)
  if (error) return { data: [], hasMore: false }
  const hasMore = (data?.length || 0) > PAGE_SIZE
  return { data: hasMore ? data!.slice(0, PAGE_SIZE) : data || [], hasMore }
}

export async function getAllOrders(page = 0): Promise<{ data: Order[]; hasMore: boolean }> {
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const { data, error } = await supabase
    .from('orders')
    .select('*, buyer:buyers(*), supplier:suppliers(*), items:order_items(*)')
    .order('created_at', { ascending: false })
    .range(from, to + 1)
  if (error) return { data: [], hasMore: false }
  const hasMore = (data?.length || 0) > PAGE_SIZE
  return { data: hasMore ? data!.slice(0, PAGE_SIZE) : data || [], hasMore }
}

export async function deactivateSupplier(id: string) {
  const { error } = await supabase
    .from('suppliers')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw error
}

export async function activateSupplier(id: string) {
  const { error } = await supabase
    .from('suppliers')
    .update({ is_active: true })
    .eq('id', id)
  if (error) throw error
}

export async function deleteSupplierAdmin(id: string) {
  const { error: prodErr } = await supabase
    .from('products')
    .delete()
    .eq('supplier_id', id)
  if (prodErr) throw prodErr

  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function getAdminDashboard() {
  const [suppliersRes, buyersRes, productsRes, ordersRes, recentOrdersRes] = await Promise.all([
    supabase.from('suppliers').select('*', { count: 'exact', head: true }),
    supabase.from('buyers').select('*', { count: 'exact', head: true }),
    supabase.from('products').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase
      .from('orders')
      .select('*, buyer:buyers(*), supplier:suppliers(*)')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  return {
    suppliersCount: suppliersRes.count || 0,
    buyersCount: buyersRes.count || 0,
    productsCount: productsRes.count || 0,
    ordersCount: ordersRes.count || 0,
    recentOrders: recentOrdersRes.data || [],
  }
}

export async function getSupplierDashboard(supplierId: string) {
  // Use local midnight so "today" and "this month" match the supplier's timezone
  const now = new Date()
  const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [todayRes, pendingRes, monthRes, recentRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', supplierId)
      .gte('created_at', todayStr),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', supplierId)
      .eq('status', 'pending'),
    supabase
      .from('orders')
      .select('total_value')
      .eq('supplier_id', supplierId)
      .gte('created_at', startOfMonth),
    supabase
      .from('orders')
      .select('*, buyer:buyers(*), items:order_items(*)')
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const monthTotal = monthRes.data?.reduce((sum, o) => sum + (o.total_value || 0), 0) || 0

  return {
    todayCount: todayRes.count || 0,
    pendingCount: pendingRes.count || 0,
    monthTotal,
    recentOrders: recentRes.data || [],
  }
}

// ---- PUSH NOTIFICATIONS ----
export async function savePushSubscription(userId: string, subscription: PushSubscriptionJSON) {
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ user_id: userId, subscription }, { onConflict: 'user_id' })
  if (error) throw error
}

async function sendOrderPushNotification(supplierId: string, orderId: string) {
  await fetch('/api/send-push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ supplierId, orderId }),
  })
}

// ---- ADMIN TEAM ----
export async function getAllProfiles(page = 0): Promise<{ data: Profile[]; hasMore: boolean }> {
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, to + 1)
  if (error) return { data: [], hasMore: false }
  const hasMore = (data?.length || 0) > PAGE_SIZE
  return { data: hasMore ? data!.slice(0, PAGE_SIZE) : data || [], hasMore }
}

export async function updateUserRole(userId: string, role: Profile['role']) {
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)
  if (error) throw error
}
