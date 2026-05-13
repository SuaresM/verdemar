import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { cors } from 'hono/cors'
import webpush from 'web-push'
import { adminSupabase } from './_lib/supabase.js'
import { requireAuth, requireAdmin, type AuthVariables } from './_lib/auth.js'

export const config = { runtime: 'nodejs' }

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:' + (process.env.VAPID_EMAIL ?? 'admin@example.com'),
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

const app = new Hono<{ Variables: AuthVariables }>().basePath('/api')

app.use('*', cors())

// ── ORDERS ──────────────────────────────────────────────────────────────────

app.post('/orders', requireAuth, async (c) => {
  const userId = c.get('userId')
  const { order, items, idempotency_key } = await c.req.json<{
    order: Record<string, unknown>
    items: Record<string, unknown>[]
    idempotency_key?: string
  }>()

  if (order.buyer_id !== userId) return c.json({ error: 'Forbidden' }, 403)

  // idempotent upsert — duplicate idempotency_key returns existing row
  const orderPayload = idempotency_key
    ? { ...order, idempotency_key }
    : order

  const { data: orderData, error: orderError } = await adminSupabase
    .from('orders')
    .upsert(orderPayload, {
      onConflict: 'idempotency_key',
      ignoreDuplicates: false,
    })
    .select()
    .single()
  if (orderError) return c.json({ error: orderError.message }, 400)

  const orderItems = items.map((item) => ({ ...item, order_id: orderData.id }))
  const { error: itemsError } = await adminSupabase.from('order_items').insert(orderItems)
  if (itemsError) return c.json({ error: itemsError.message }, 400)

  // Increment total_sold per product (atomic via Postgres RPC)
  const quantityByProduct: Record<string, number> = {}
  for (const item of items) {
    const pid = item.product_id as string
    const qty = Number(item.quantity)
    if (pid && isFinite(qty) && qty > 0) {
      quantityByProduct[pid] = (quantityByProduct[pid] ?? 0) + qty
    }
  }
  Promise.all(
    Object.entries(quantityByProduct).map(([pid, qty]) =>
      Promise.resolve(adminSupabase.rpc('increment_product_sold', { p_id: pid, p_amount: qty })).catch(() => {})
    )
  ).catch(() => {})

  // Increment supplier total_sales
  Promise.resolve(adminSupabase.rpc('increment_supplier_sales', {
    p_id: order.supplier_id as string,
    p_amount: orderData.total_value as number,
  })).catch(() => {})

  sendPush(order.supplier_id as string, {
    title: 'Novo pedido recebido!',
    body: `Pedido #${(orderData.id as string).slice(0, 8).toUpperCase()} aguardando confirmação.`,
    url: '/supplier/orders',
  }).catch(() => {})

  return c.json(orderData, 201)
})

app.patch('/orders/:id/status', requireAuth, async (c) => {
  const userId = c.get('userId')
  const orderId = c.req.param('id')
  const { status: newStatus, reason } = await c.req.json<{ status: string; reason?: string }>()

  // 1. Validate newStatus is a known value
  const VALID_STATUSES = ['pending', 'confirmed', 'rejected', 'in_route', 'delivered', 'cancelled']
  if (!VALID_STATUSES.includes(newStatus)) {
    return c.json({ error: 'Status inválido' }, 400)
  }

  // 2. Fetch current order — need status, buyer_id, supplier_id, status_history
  const { data: order } = await adminSupabase
    .from('orders')
    .select('status, buyer_id, supplier_id, status_history')
    .eq('id', orderId)
    .single()
  if (!order) return c.json({ error: 'Pedido não encontrado' }, 404)

  // 3. Establish actor role
  const isBuyer    = order.buyer_id    === userId
  const isSupplier = order.supplier_id === userId
  if (!isBuyer && !isSupplier) return c.json({ error: 'Proibido' }, 403)

  // 4. State-machine transition table
  const ALLOWED: Record<string, { actor: 'buyer' | 'supplier'; from: string[] }> = {
    cancelled: { actor: 'buyer',    from: ['pending'] },
    confirmed: { actor: 'supplier', from: ['pending'] },
    rejected:  { actor: 'supplier', from: ['pending'] },
    in_route:  { actor: 'supplier', from: ['confirmed'] },
    delivered: { actor: 'supplier', from: ['in_route'] },
  }

  const rule = ALLOWED[newStatus]
  if (!rule) return c.json({ error: 'Transição de status não permitida' }, 422)
  if (rule.actor === 'buyer'    && !isBuyer)    return c.json({ error: 'Proibido' }, 403)
  if (rule.actor === 'supplier' && !isSupplier) return c.json({ error: 'Proibido' }, 403)
  if (!rule.from.includes(order.status)) {
    return c.json({
      error: `Não é possível passar de '${order.status}' para '${newStatus}'`
    }, 422)
  }

  // 5. Rejection requires a reason
  if (newStatus === 'rejected' && !reason?.trim()) {
    return c.json({ error: 'Motivo de recusa obrigatório' }, 400)
  }

  // 6. Build update payload — append to status_history (read from fetched row)
  const currentHistory: Array<{ status: string; at: string }> =
    Array.isArray(order.status_history) ? order.status_history : []
  const newEntry = { status: newStatus, at: new Date().toISOString() }

  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
    status_history: [...currentHistory, newEntry],
  }
  if (newStatus === 'rejected') updatePayload.rejection_reason = reason

  // 7. Apply update
  const { error } = await adminSupabase
    .from('orders')
    .update(updatePayload)
    .eq('id', orderId)
  if (error) return c.json({ error: error.message }, 400)

  // 8. Fire push to buyer (non-blocking — never fail the response over push)
  sendPushToBuyer(orderId, newStatus).catch(() => {})

  return c.json({ ok: true })
})

app.patch('/orders/:id/items', requireAuth, async (c) => {
  const orderId = c.req.param('id')
  const { items } = await c.req.json<{
    items: Array<{ id: string; quantity: number; subtotal: number }>
  }>()

  const toRemove = items.filter((i) => i.quantity === 0).map((i) => i.id)
  const toUpdate = items.filter((i) => i.quantity > 0)

  if (toRemove.length > 0) {
    const { error } = await adminSupabase.from('order_items').delete().in('id', toRemove)
    if (error) return c.json({ error: error.message }, 400)
  }

  for (const item of toUpdate) {
    const { error } = await adminSupabase
      .from('order_items')
      .update({ quantity: item.quantity, subtotal: item.subtotal })
      .eq('id', item.id)
    if (error) return c.json({ error: error.message }, 400)
  }

  const newTotal = toUpdate.reduce((sum, i) => sum + i.subtotal, 0)
  const { error: orderErr } = await adminSupabase
    .from('orders')
    .update({ total_value: newTotal, updated_at: new Date().toISOString() })
    .eq('id', orderId)
  if (orderErr) return c.json({ error: orderErr.message }, 400)

  return c.json({ newTotal })
})

app.patch('/orders/:id/whatsapp-sent', requireAuth, async (c) => {
  const orderId = c.req.param('id')

  const { error } = await adminSupabase
    .from('orders')
    .update({ whatsapp_sent: true })
    .eq('id', orderId)
  if (error) return c.json({ error: error.message }, 400)

  return c.json({ ok: true })
})

// ── PRODUCTS ────────────────────────────────────────────────────────────────

app.patch('/products/:id/stock', requireAuth, async (c) => {
  const userId = c.get('userId')
  const productId = c.req.param('id')
  const { stock_quantity } = await c.req.json<{ stock_quantity: number }>()

  if (typeof stock_quantity !== 'number' || !isFinite(stock_quantity) || stock_quantity < 0) {
    return c.json({ error: 'stock_quantity inválido' }, 400)
  }

  const { error, count } = await adminSupabase
    .from('products')
    .update({ stock_quantity, updated_at: new Date().toISOString() })
    .eq('id', productId)
    .eq('supplier_id', userId)
    .select('id', { count: 'exact', head: true })
  if (error) return c.json({ error: error.message }, 400)
  if (!count || count === 0) return c.json({ error: 'Produto não encontrado ou sem permissão' }, 404)

  return c.json({ ok: true })
})

app.patch('/products/:id/sell-without-stock', requireAuth, async (c) => {
  const userId = c.get('userId')
  const productId = c.req.param('id')
  const { sell_without_stock } = await c.req.json<{ sell_without_stock: boolean }>()

  if (typeof sell_without_stock !== 'boolean') {
    return c.json({ error: 'sell_without_stock inválido' }, 400)
  }

  const { error, count } = await adminSupabase
    .from('products')
    .update({ sell_without_stock, updated_at: new Date().toISOString() })
    .eq('id', productId)
    .eq('supplier_id', userId)
    .select('id', { count: 'exact', head: true })
  if (error) return c.json({ error: error.message }, 400)
  if (!count || count === 0) return c.json({ error: 'Produto não encontrado ou sem permissão' }, 404)

  return c.json({ ok: true })
})

// ── PUSH ─────────────────────────────────────────────────────────────────────

app.post('/push/subscribe', requireAuth, async (c) => {
  const userId = c.get('userId')
  const { subscription } = await c.req.json<{ subscription: webpush.PushSubscription }>()

  const endpoint = (subscription as { endpoint?: string }).endpoint ?? ''
  const { error } = await adminSupabase
    .from('push_subscriptions')
    .upsert(
      { user_id: userId, endpoint, subscription },
      { onConflict: 'user_id,endpoint' }
    )
  if (error) return c.json({ error: error.message }, 400)

  return c.json({ ok: true })
})

// ── DELIVERY ZONES ───────────────────────────────────────────────────────────

app.post('/supplier/delivery-zones', requireAuth, async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json<{
    city: string
    state: string
    days: string[]
    hours_start: string
    hours_end: string
  }>()

  const { data, error } = await adminSupabase
    .from('delivery_zones')
    .insert({ city: body.city, state: body.state, days: body.days, hours_start: body.hours_start, hours_end: body.hours_end, supplier_id: userId })
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 400)

  return c.json(data, 201)
})

app.put('/supplier/delivery-zones/:id', requireAuth, async (c) => {
  const userId = c.get('userId')
  const zoneId = c.req.param('id')
  const body = await c.req.json<{
    city: string
    state: string
    days: string[]
    hours_start: string
    hours_end: string
  }>()

  const { error, count } = await adminSupabase
    .from('delivery_zones')
    .update({ city: body.city, state: body.state, days: body.days, hours_start: body.hours_start, hours_end: body.hours_end })
    .eq('id', zoneId)
    .eq('supplier_id', userId)
    .select('id', { count: 'exact', head: true })
  if (error) return c.json({ error: error.message }, 400)
  if (!count || count === 0) return c.json({ error: 'Zona não encontrada ou sem permissão' }, 404)

  return c.json({ ok: true })
})

app.delete('/supplier/delivery-zones/:id', requireAuth, async (c) => {
  const userId = c.get('userId')
  const zoneId = c.req.param('id')

  const { error } = await adminSupabase
    .from('delivery_zones')
    .delete()
    .eq('id', zoneId)
    .eq('supplier_id', userId)
  if (error) return c.json({ error: error.message }, 400)

  return c.json({ ok: true })
})

// ── ADMIN ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

app.get('/admin/users', requireAuth, requireAdmin, async (c) => {
  const page = Number(c.req.query('page') ?? '0')
  const from = page * PAGE_SIZE

  const { data, error } = await adminSupabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE)
  if (error) return c.json({ error: error.message }, 400)

  const hasMore = (data?.length ?? 0) > PAGE_SIZE
  return c.json({ data: hasMore ? data!.slice(0, PAGE_SIZE) : (data ?? []), hasMore })
})

app.patch('/admin/users/:id/role', requireAuth, requireAdmin, async (c) => {
  const userId = c.req.param('id')
  const { role } = await c.req.json<{ role: string }>()

  const { error } = await adminSupabase.from('profiles').update({ role }).eq('id', userId)
  if (error) return c.json({ error: error.message }, 400)

  return c.json({ ok: true })
})

app.post('/admin/reset-password', requireAuth, requireAdmin, async (c) => {
  const { userId } = await c.req.json<{ userId: string }>()

  const { data: { user }, error: userErr } = await adminSupabase.auth.admin.getUserById(userId)
  if (userErr || !user?.email) return c.json({ error: 'User not found' }, 404)

  const { error: linkErr } = await adminSupabase.auth.admin.generateLink({
    type: 'recovery',
    email: user.email,
  })
  if (linkErr) return c.json({ error: linkErr.message }, 400)

  return c.json({ ok: true })
})

app.patch('/admin/suppliers/:id/status', requireAuth, requireAdmin, async (c) => {
  const id = c.req.param('id')
  const { is_active } = await c.req.json<{ is_active: boolean }>()

  const { error } = await adminSupabase.from('suppliers').update({ is_active }).eq('id', id)
  if (error) return c.json({ error: error.message }, 400)

  return c.json({ ok: true })
})

app.delete('/admin/suppliers/:id', requireAuth, requireAdmin, async (c) => {
  const id = c.req.param('id')

  const { error: prodErr } = await adminSupabase.from('products').delete().eq('supplier_id', id)
  if (prodErr) return c.json({ error: prodErr.message }, 400)

  const { error } = await adminSupabase.from('suppliers').delete().eq('id', id)
  if (error) return c.json({ error: error.message }, 400)

  return c.json({ ok: true })
})

// ── INTERNAL ─────────────────────────────────────────────────────────────────

async function sendPush(userId: string, payload: object): Promise<void> {
  const { data } = await adminSupabase
    .from('push_subscriptions')
    .select('id, subscription')
    .eq('user_id', userId)

  for (const row of data ?? []) {
    try {
      await webpush.sendNotification(
        row.subscription as webpush.PushSubscription,
        JSON.stringify(payload)
      )
    } catch (err: unknown) {
      const pushErr = err as { statusCode?: number }
      if (pushErr?.statusCode === 410 || pushErr?.statusCode === 404) {
        // Subscription expired or revoked — purge the stale row
        await adminSupabase
          .from('push_subscriptions')
          .delete()
          .eq('id', row.id)
      }
    }
  }
}

async function sendPushToBuyer(orderId: string, newStatus: string): Promise<void> {
  const { data: order } = await adminSupabase
    .from('orders')
    .select('buyer_id')
    .eq('id', orderId)
    .single()
  if (!order?.buyer_id) return

  const statusLabels: Record<string, string> = {
    confirmed: 'Pedido confirmado pelo fornecedor!',
    in_route:  'Seu pedido saiu para entrega.',
    delivered: 'Pedido entregue. Bom apetite!',
    rejected:  'Pedido recusado pelo fornecedor.',
    cancelled: 'Pedido cancelado.',
  }

  await sendPush(order.buyer_id, {
    title: statusLabels[newStatus] ?? 'Atualização no seu pedido',
    body:  `Pedido #${orderId.slice(0, 8).toUpperCase()}`,
    url:   `/orders/${orderId}`,
  })
}

export default handle(app)
