import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { cors } from 'hono/cors'
import webpush from 'web-push'
import { adminSupabase } from './_lib/supabase'
import { requireAuth, requireAdmin, type AuthVariables } from './_lib/auth'

export const config = { runtime: 'nodejs' }

webpush.setVapidDetails(
  'mailto:' + process.env.VAPID_EMAIL!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

const app = new Hono<{ Variables: AuthVariables }>().basePath('/api')

app.use('*', cors())

// ── ORDERS ──────────────────────────────────────────────────────────────────

app.post('/orders', requireAuth, async (c) => {
  const userId = c.get('userId')
  const { order, items } = await c.req.json<{ order: Record<string, unknown>; items: Record<string, unknown>[] }>()

  if (order.buyer_id !== userId) return c.json({ error: 'Forbidden' }, 403)

  const { data: orderData, error: orderError } = await adminSupabase
    .from('orders')
    .insert(order)
    .select()
    .single()
  if (orderError) return c.json({ error: orderError.message }, 400)

  const orderItems = items.map((item) => ({ ...item, order_id: orderData.id }))
  const { error: itemsError } = await adminSupabase.from('order_items').insert(orderItems)
  if (itemsError) return c.json({ error: itemsError.message }, 400)

  sendPush(order.supplier_id as string, orderData.id as string).catch(() => {})

  return c.json(orderData, 201)
})

app.patch('/orders/:id/status', requireAuth, async (c) => {
  const orderId = c.req.param('id')
  const { status } = await c.req.json<{ status: string }>()

  const { error } = await adminSupabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
  if (error) return c.json({ error: error.message }, 400)

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

// ── PUSH ─────────────────────────────────────────────────────────────────────

app.post('/push/subscribe', requireAuth, async (c) => {
  const userId = c.get('userId')
  const { subscription } = await c.req.json<{ subscription: webpush.PushSubscription }>()

  const { error } = await adminSupabase
    .from('push_subscriptions')
    .upsert({ user_id: userId, subscription }, { onConflict: 'user_id' })
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

async function sendPush(supplierId: string, orderId: string) {
  const { data, error } = await adminSupabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', supplierId)
    .single()
  if (error || !data) return

  await webpush.sendNotification(
    data.subscription as webpush.PushSubscription,
    JSON.stringify({
      title: 'Novo pedido recebido!',
      body: `Pedido #${orderId.slice(0, 8).toUpperCase()} aguardando confirmação.`,
      url: '/supplier/orders',
    }),
  )
}

export default handle(app)
