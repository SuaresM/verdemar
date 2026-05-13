# Phase 01: Schema + API Backbone — Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 4
**Analogs found:** 4 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `api/[...route].ts` | controller (API route) | request-response + event-driven (push) | `api/[...route].ts` itself (existing handlers) | exact — modify in place |
| `src/services/supabase.ts` | service | CRUD | `src/services/supabase.ts` itself (existing functions) | exact — add to existing module |
| `src/types/index.ts` | model (type definitions) | — | `src/types/index.ts` itself (`Order` interface) | exact — extend existing interface |
| `supabase/migrations/YYYYMMDD_order_flow.sql` | migration | batch (DDL) | `supabase/migrations/20260508000000_products_sell_without_stock.sql` + `20260505000000_delivery_zones.sql` | role-match |

---

## Pattern Assignments

### `api/[...route].ts` — PATCH /orders/:id/status rewrite + sendPushToBuyer()

**Analog:** same file — learn from sibling handlers already in it

**Imports pattern** (lines 1–6 of current file — no new imports needed):
```typescript
import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { cors } from 'hono/cors'
import webpush from 'web-push'
import { adminSupabase } from './_lib/supabase.js'
import { requireAuth, requireAdmin, type AuthVariables } from './_lib/auth.js'
```
No new imports are required. `webpush` and `adminSupabase` are already available.

**Auth pattern — requireAuth middleware** (lines 6–17 of `api/_lib/auth.ts`):
```typescript
// requireAuth extracts JWT, calls adminSupabase.auth.getUser(token),
// and sets c.set('userId', user.id). All route handlers that need userId do:
const userId = c.get('userId')
```
The PATCH rewrite must call `requireAuth` (already does) and then fetch the order row to derive ownership, exactly like `/products/:id/stock` does at lines 126–144.

**Ownership/authorization guard — closest existing pattern** (`api/[...route].ts` lines 126–144):
```typescript
// products/:id/stock uses .eq('supplier_id', userId) as ownership filter.
// For orders, we cannot filter in the UPDATE because buyer/supplier IDs differ.
// Instead, fetch first, then check ownership:

const { data: order } = await adminSupabase
  .from('orders')
  .select('status, buyer_id, supplier_id')
  .eq('id', orderId)
  .single()
if (!order) return c.json({ error: 'Not found' }, 404)

const isBuyer    = order.buyer_id    === userId
const isSupplier = order.supplier_id === userId
if (!isBuyer && !isSupplier) return c.json({ error: 'Forbidden' }, 403)
```

**State-machine transition guard — new pattern (no analog, use PITFALLS.md spec verbatim)**:
```typescript
const VALID_STATUSES = ['pending', 'confirmed', 'rejected', 'in_route', 'delivered', 'cancelled']
if (!VALID_STATUSES.includes(newStatus)) return c.json({ error: 'Status inválido' }, 400)

const ALLOWED: Record<string, { actor: 'buyer' | 'supplier'; from: string[] }> = {
  cancelled: { actor: 'buyer',     from: ['pending'] },
  confirmed: { actor: 'supplier',  from: ['pending'] },
  rejected:  { actor: 'supplier',  from: ['pending'] },
  in_route:  { actor: 'supplier',  from: ['confirmed'] },
  delivered: { actor: 'supplier',  from: ['in_route'] },
}
const rule = ALLOWED[newStatus]
if (!rule) return c.json({ error: 'Transição não permitida' }, 422)
if (rule.actor === 'buyer'    && !isBuyer)    return c.json({ error: 'Forbidden' }, 403)
if (rule.actor === 'supplier' && !isSupplier) return c.json({ error: 'Forbidden' }, 403)
if (!rule.from.includes(order.status))
  return c.json({ error: `Não é possível passar de ${order.status} para ${newStatus}` }, 422)

// Rejection reason required
if (newStatus === 'rejected' && !reason?.trim())
  return c.json({ error: 'Motivo de recusa obrigatório' }, 400)
```

**status_history append pattern — new (use ARCHITECTURE.md sketch)**:
```typescript
// Fetch existing history, append new entry, write back atomically with status
const newEntry = { status: newStatus, at: new Date().toISOString() }
const updatePayload: Record<string, unknown> = {
  status: newStatus,
  updated_at: new Date().toISOString(),
  // Postgres jsonb concatenation via raw expression is not directly available in
  // supabase-js; read current status_history first, append in JS, write full array.
}
if (newStatus === 'rejected') updatePayload.rejection_reason = reason
// status_history: read from the order row fetched above (add to SELECT),
// push newEntry, include in updatePayload.
```
Note: add `status_history` to the SELECT at the fetch step so you can append without a second query.

**Error handling pattern — matches every existing handler** (`api/[...route].ts` lines 35, 75, 99, 141):
```typescript
const { error } = await adminSupabase.from('orders').update(updatePayload).eq('id', orderId)
if (error) return c.json({ error: error.message }, 400)
return c.json({ ok: true })
```

**sendPush() rewrite — multi-device + 410 purge** (replace lines 309–325 of current file):
```typescript
// BEFORE (single-device, silently ignores 410):
async function sendPush(supplierId: string, orderId: string) {
  const { data, error } = await adminSupabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', supplierId)
    .single()                      // BUG: drops all but last device
  if (error || !data) return
  await webpush.sendNotification(data.subscription as webpush.PushSubscription, ...)
}

// AFTER (iterate rows, purge stale 410/404):
async function sendPush(userId: string, payload: object) {
  const { data } = await adminSupabase
    .from('push_subscriptions')
    .select('id, subscription')    // include 'id' so we can delete stale rows
    .eq('user_id', userId)
  for (const row of data ?? []) {
    try {
      await webpush.sendNotification(row.subscription as webpush.PushSubscription, JSON.stringify(payload))
    } catch (err: any) {
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await adminSupabase.from('push_subscriptions').delete().eq('id', row.id)
      }
    }
  }
}
```

**sendPushToBuyer() new helper** (add after the rewritten sendPush):
```typescript
async function sendPushToBuyer(orderId: string, newStatus: string) {
  const { data: order } = await adminSupabase
    .from('orders')
    .select('buyer_id')
    .eq('id', orderId)
    .single()
  if (!order) return

  const statusLabels: Record<string, string> = {
    confirmed:  'Pedido confirmado pelo fornecedor!',
    in_route:   'Seu pedido saiu para entrega.',
    delivered:  'Pedido entregue. Bom apetite!',
    rejected:   'Pedido recusado pelo fornecedor.',
    cancelled:  'Pedido cancelado.',
  }

  await sendPush(order.buyer_id, {
    title: statusLabels[newStatus] ?? 'Atualização no seu pedido',
    body:  `Pedido #${orderId.slice(0, 8).toUpperCase()}`,
    url:   `/orders/${orderId}`,
  })
}
// Call from the PATCH handler after successful DB write:
// sendPushToBuyer(orderId, newStatus).catch(() => {})
```

**Idempotency key on POST /orders — upsert pattern** (analogous to `push/subscribe` upsert at lines 170–180):
```typescript
// push/subscribe upsert (lines 173-177) — same shape for order idempotency:
const { error } = await adminSupabase
  .from('push_subscriptions')
  .upsert({ user_id: userId, subscription }, { onConflict: 'user_id' })

// For orders: if idempotency_key column added by migration, use:
const { data: orderData, error: orderError } = await adminSupabase
  .from('orders')
  .upsert({ ...order, idempotency_key: idempotencyKey }, { onConflict: 'idempotency_key' })
  .select()
  .single()
// Returns existing row on duplicate key — frontend gets 201 either way.
```

**push/subscribe upsert fix — composite key** (lines 170–180, replace `onConflict` after migration):
```typescript
// BEFORE:
.upsert({ user_id: userId, subscription }, { onConflict: 'user_id' })

// AFTER (once migration adds UNIQUE(user_id, endpoint)):
.upsert(
  { user_id: userId, endpoint: (subscription as any).endpoint, subscription },
  { onConflict: 'user_id,endpoint' }
)
```

---

### `src/services/supabase.ts` — add getOrderById(), update updateOrderStatus()

**Analog:** same file — copy from sibling functions `getSupplierById()` (lines 77–85) and `updateOrderStatus()` (lines 234–236).

**getOrderById() — copy getSupplierById() pattern** (lines 77–85):
```typescript
// EXISTING ANALOG:
export async function getSupplierById(id: string): Promise<Supplier | null> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

// NEW FUNCTION — same shape, richer select, returns Order | null:
export async function getOrderById(orderId: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, supplier:suppliers(*), buyer:buyers(*), items:order_items(*)')
    .eq('id', orderId)
    .single()
  if (error) return null
  return data
}
```
Uses direct Supabase client (RLS-protected) — no Hono needed for reads.

**updateOrderStatus() signature update** (lines 234–236):
```typescript
// EXISTING:
export async function updateOrderStatus(orderId: string, status: string) {
  await apiClient.patch(`/orders/${orderId}/status`, { status })
}

// UPDATED — add optional rejectionReason param:
export async function updateOrderStatus(
  orderId: string,
  status: string,
  rejectionReason?: string
) {
  await apiClient.patch(`/orders/${orderId}/status`, {
    status,
    ...(rejectionReason ? { reason: rejectionReason } : {}),
  })
}
```
The field name in the request body is `reason` (matches the Hono handler destructure: `{ status, reason }`).

**Import line** (line 3 — add OrderStatus to existing import once OrderStatus type is expanded):
```typescript
import type { Profile, Buyer, Supplier, Product, Order, OrderItem, DeliveryZone } from '../types'
// No change needed — Order type is already imported; the new fields are on Order.
```

---

### `src/types/index.ts` — extend Order interface + expand OrderStatus union

**Analog:** same file — existing `Order` interface at lines 86–101.

**OrderStatus union — add new statuses** (line 4):
```typescript
// EXISTING:
export type OrderStatus = 'pending' | 'confirmed' | 'in_delivery' | 'delivered' | 'cancelled'

// UPDATED — add 'rejected' and 'in_route'; deprecate 'in_delivery' → 'in_route' per PITFALLS matrix:
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'in_route'       // replaces in_delivery (migration changes the CHECK constraint)
  | 'delivered'
  | 'cancelled'
  | 'rejected'       // new terminal state for supplier refusal
```
Note: the existing schema uses `'in_delivery'` in the CHECK constraint. The migration changes it to `'in_route'`. Update the type to match after the migration runs. If backward compat with old data is needed, keep `'in_delivery'` in the union temporarily.

**StatusHistoryEntry — new inline type** (add before Order interface):
```typescript
export interface StatusHistoryEntry {
  status: OrderStatus
  at: string   // ISO 8601 timestamp string
}
```

**Order interface additions** (after line 98, within the existing interface at lines 86–101):
```typescript
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
  // v1.1 additions:
  rejection_reason?: string                  // populated when status === 'rejected'
  status_history?: StatusHistoryEntry[]      // JSONB array, may be empty or absent on old rows
  idempotency_key?: string                   // client-generated UUID, used for dedup
  items?: OrderItem[]
  supplier?: Supplier
  buyer?: Buyer
}
```
Pattern: all new optional fields use `?:` suffix, consistent with `notes?`, `delivery_time_preference?`, `created_at?` already in the interface.

---

### `supabase/migrations/YYYYMMDD_order_flow.sql` — new migration file

**Analog:** `supabase/migrations/20260508000000_products_sell_without_stock.sql` (single `ALTER TABLE ADD COLUMN IF NOT EXISTS`) and `supabase/migrations/20260505000000_delivery_zones.sql` (includes RLS + REVOKE/GRANT patterns).

**File header comment pattern** (from 20260508 migration, line 1–2):
```sql
-- supabase/migrations/YYYYMMDD_order_flow.sql
-- Phase 01: Add rejection_reason, status_history, idempotency_key to orders;
--           fix status CHECK constraint; change push_subscriptions PK to (user_id, endpoint).
```

**ADD COLUMN pattern** (from 20260508 migration, line 5):
```sql
-- Use IF NOT EXISTS on every ALTER to make the migration re-runnable
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS status_history JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS idempotency_key UUID;
```

**CHECK constraint replacement** (no existing analog — follows Postgres NOT VALID pattern from PITFALLS.md CP-1 spec):
```sql
-- Drop old constraint first (it exists from supabase-schema.sql line 89)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add new constraint covering all v1.1 statuses, using NOT VALID to avoid table lock
ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'confirmed', 'in_route', 'delivered', 'cancelled', 'rejected'))
  NOT VALID;

-- Validate separately (uses SHARE UPDATE EXCLUSIVE lock, allows concurrent reads)
ALTER TABLE orders VALIDATE CONSTRAINT orders_status_check;
```

**Idempotency key unique constraint**:
```sql
-- Partial unique index — only non-NULL keys are deduplicated
CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_idx
  ON orders (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
```

**push_subscriptions composite key migration** (more complex than existing migrations — no direct analog, follows patterns from the CREATE TABLE in supabase-push-subscriptions.sql):
```sql
-- Remove old single-column UNIQUE constraint on user_id
ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_key;

-- Add endpoint TEXT column (extract from JSONB for indexing)
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS endpoint TEXT
  GENERATED ALWAYS AS (subscription->>'endpoint') STORED;

-- New composite unique constraint
ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_user_endpoint_key
  UNIQUE (user_id, endpoint);
```
If GENERATED ALWAYS AS STORED is not desired (adds complexity), alternatively populate endpoint on upsert from the application side and add it as a regular column:
```sql
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS endpoint TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_endpoint_idx
  ON public.push_subscriptions (user_id, endpoint);
```

---

## Shared Patterns

### requireAuth middleware
**Source:** `api/_lib/auth.ts` lines 6–18
**Apply to:** All Hono route handlers (already applied; PATCH rewrite must not remove it)
```typescript
export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)
  const { data: { user }, error } = await adminSupabase.auth.getUser(token)
  if (error || !user) return c.json({ error: 'Unauthorized' }, 401)
  c.set('userId', user.id)
  await next()
})
```

### adminSupabase vs supabase client choice
**Source:** `api/[...route].ts` (adminSupabase) vs `src/services/supabase.ts` (supabase)
**Rule:**
- Use `adminSupabase` (service role) **only** in `api/[...route].ts` — bypasses RLS, correct for server-side writes with custom authorization logic.
- Use `supabase` (anon key + JWT) in `src/services/supabase.ts` — relies on RLS, correct for client-side reads.
- `getOrderById()` uses `supabase` (RLS enforces ownership automatically).
- The PATCH handler uses `adminSupabase` (needs to write rejection_reason, status_history without RLS interference).

### Error handling in Hono handlers
**Source:** `api/[...route].ts` lines 35, 75, 99, 107, 141
**Apply to:** Every DB call in the PATCH rewrite
```typescript
const { error } = await adminSupabase.from('...').update(...).eq('id', id)
if (error) return c.json({ error: error.message }, 400)
return c.json({ ok: true })
```

### Service function error pattern (services module)
**Source:** `src/services/supabase.ts` lines 30–38 (getProfile), 46–53 (getBuyer)
**Apply to:** `getOrderById()`
```typescript
// On Supabase error: return null (never throw)
if (error) return null
return data
```
Functions that write and must surface errors use `throw error` (see `createBuyer`, line 58). `getOrderById` is a read — return null on error.

### Migration file conventions
**Source:** `supabase/migrations/20260508000000_products_sell_without_stock.sql`
- File name: `YYYYMMDD000000_descriptive_name.sql`
- Comment header: `-- supabase/migrations/FILENAME.sql\n-- Description of change.`
- Every ALTER uses `IF NOT EXISTS` / `IF EXISTS` for idempotency
- No `BEGIN` / `COMMIT` — Supabase CLI wraps each migration in a transaction automatically

---

## No Analog Found

No files in this phase are entirely greenfield — all four files either already exist or have a closely related existing migration. The closest to "no analog" situations are:

| Pattern | Reason |
|---|---|
| State-machine transition guard in PATCH handler | No existing handler performs actor+state validation; derive from PITFALLS.md RLS Security Gaps section |
| `status_history` JSONB append | No existing JSONB column or array-append pattern in codebase; use JS-side read-append-write |
| Generated column for `push_subscriptions.endpoint` | No existing generated column in schema; use simpler application-side approach if Postgres version < 12 |

---

## Metadata

**Analog search scope:** `api/`, `api/_lib/`, `src/services/`, `src/types/`, `supabase/migrations/`, `supabase-schema.sql`, `supabase-push-subscriptions.sql`
**Files read:** 11
**Pattern extraction date:** 2026-05-13
