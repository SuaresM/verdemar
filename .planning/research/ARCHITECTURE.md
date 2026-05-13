# Architecture Research — Order Flow

**Codebase read:** 2026-05-13
**Confidence:** HIGH — based on direct source inspection, not inference

---

## Current Orders Data Model

### What exists (confirmed from supabase-schema.sql + src/types/index.ts)

```
orders
  id                     UUID PK
  buyer_id               UUID FK → buyers
  supplier_id            UUID FK → suppliers
  status                 TEXT  CHECK ('pending','confirmed','in_delivery','delivered','cancelled')
  total_value            DECIMAL(10,2)
  notes                  TEXT
  delivery_time_preference TEXT         -- human-readable label, e.g. "Segunda — 08:00 às 12:00"
  payment_method         TEXT           -- 'cash_on_delivery' only today
  whatsapp_sent          BOOLEAN
  created_at             TIMESTAMPTZ
  updated_at             TIMESTAMPTZ    -- auto-updated by trigger orders_updated_at

order_items
  id                     UUID PK
  order_id               UUID FK → orders (ON DELETE CASCADE)
  product_id             UUID FK → products
  product_name           TEXT           -- denormalized snapshot
  sale_unit              TEXT
  quantity               DECIMAL(10,3)
  unit_price             DECIMAL(10,2)
  subtotal               DECIMAL(10,2)
```

### What the schema does NOT have (gaps relevant to v1.1)

1. **No `rejection_reason` column** — supplier accept/reject with reason (required by milestone) has nowhere to persist the reason string. The current flow can only update `status` to `cancelled`; there is no `rejection_reason TEXT` column. Needs migration.

2. **No `confirmed_at` / `rejected_at` / `in_delivery_at` / `delivered_at` timestamps** — status transitions are implicit via `updated_at`, which only stores the last change. A proper timeline component needs per-transition timestamps, or the data must be approximated. Adding a `status_history JSONB` column or a separate `order_status_events` table is the clean solution. For MVP a JSONB column is lower overhead and sufficient.

3. **No supplier-initiated push** for buyer on status change — the existing `sendPush` function in `api/[...route].ts` is wired only to the order-creation event and only looks up the supplier's subscription (not the buyer's). The buyer's push subscription must be stored in `push_subscriptions` (same table, `user_id = buyer.id`) and the status-update handler must look it up and call `sendPush` with buyer context. The table can already hold buyer rows; no schema migration needed for this, only API code.

### Schema migrations required

```sql
-- Migration 1: rejection_reason on orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Migration 2: status_history (lightweight timeline, no extra table)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::jsonb;
-- Example value: [{"status":"confirmed","at":"2026-05-13T10:00:00Z"},...]
-- Appended via the PATCH /orders/:id/status handler before returning.
```

No new tables are needed for v1.1. The two new columns are the only schema change.

---

## Status Flow

### State machine

```
           [buyer submits cart]
                   |
              PENDING  ──────────────────────────────────────┐
                   |                                          |
         [supplier confirms]                    [supplier rejects / cancels]
                   |                                          |
            CONFIRMED  ─────────────────────────────────> CANCELLED
                   |                                     (rejection_reason stored)
         [supplier starts delivery]
                   |
            IN_DELIVERY
                   |
         [supplier marks delivered]
                   |
            DELIVERED  (terminal)
```

### Transition ownership

| Transition | Actor | Mechanism |
|-----------|-------|-----------|
| → pending | Buyer | POST /api/orders (existing) |
| pending → confirmed | Supplier | PATCH /api/orders/:id/status |
| pending → cancelled | Supplier | PATCH /api/orders/:id/status + rejection_reason |
| confirmed → in_delivery | Supplier | PATCH /api/orders/:id/status |
| in_delivery → delivered | Supplier | PATCH /api/orders/:id/status |
| any → cancelled (by buyer) | Out of scope for v1.1 | — |

The existing `STATUS_TRANSITIONS` object in `src/pages/supplier/Orders.tsx` already models this correctly. The gap is: (a) rejection reason is not persisted and (b) buyer push notifications are not sent on status change.

---

## Integration Points

### New pages

| Path | Component | Role | Status |
|------|-----------|------|--------|
| `/orders/:id` | `src/pages/buyer/OrderDetail.tsx` | Buyer | NEW |
| `/supplier/orders/:id` | `src/pages/supplier/OrderDetail.tsx` | Supplier | NEW — accept/reject with reason UI |

Both `/orders` and `/supplier/orders` list pages already exist. The detail view is the missing piece.

The buyer confirmation screen (post-checkout success state) already exists — it is the inline `checkoutSuccess` overlay in `src/pages/buyer/Cart.tsx`. It does not need a separate page; it just needs to be upgraded: add the order number prominently and a "Ver Pedido" link that routes to `/orders/:id`.

### New API routes

| Method | Path | Handler change | What it does |
|--------|------|---------------|-------------|
| PATCH | `/api/orders/:id/status` | MODIFY existing | Add: (1) persist rejection_reason, (2) append status_history entry, (3) call sendPushToBuyer() |
| GET | `/api/orders/:id` | NEW | Return single order with items + buyer + supplier; guards ownership |

The GET endpoint is optional for v1.1 — reads can still go direct via Supabase client using the existing RLS policies ("Buyers can view own orders", "Suppliers can view their orders"). Recommend direct Supabase read for order detail; keep PATCH going through Hono for the authorization + side-effect logic (push trigger).

### Supabase changes

1. Migration: add `rejection_reason TEXT` and `status_history JSONB DEFAULT '[]'` to `orders` table.
2. New service functions in `src/services/supabase.ts`:
   - `getOrderById(orderId: string): Promise<Order | null>` — direct Supabase read, uses RLS
   - `getOrdersBySupplierWithFilters(supplierId, status?, dateFrom?, dateTo?)` — add filter params to existing `getOrdersBySupplier` signature or extract a new function
3. Modified service function:
   - `updateOrderStatus(orderId, status, rejectionReason?)` — add optional third parameter, pass to PATCH body

### Push trigger mechanism

See dedicated section below.

---

## New vs Modified

| Component | New / Modified | Description |
|-----------|---------------|-------------|
| `supabase-schema.sql` | Modified | Document the two new columns (informational only; actual change is a migration file) |
| `supabase/migrations/YYYYMMDD_order_flow.sql` | NEW | `rejection_reason` + `status_history` columns |
| `src/types/index.ts` | Modified | Add `rejection_reason?: string` and `status_history?: {status: OrderStatus, at: string}[]` to `Order` interface |
| `src/services/supabase.ts` | Modified | Add `getOrderById()`, update `updateOrderStatus()` signature, add `getOrdersBySupplierWithFilters()` |
| `api/[...route].ts` | Modified | Update PATCH `/orders/:id/status` to: store rejection_reason, append status_history, call buyer push |
| `api/[...route].ts` | Modified | Add internal `sendPushToBuyer(orderId, newStatus)` function |
| `src/pages/buyer/Cart.tsx` | Modified | Upgrade post-checkout success overlay: show order number, add link to `/orders/:id` |
| `src/pages/buyer/OrderHistory.tsx` | Modified | Make each order card tappable, navigate to `/orders/:id` |
| `src/pages/buyer/OrderDetail.tsx` | NEW | Full order view + status timeline. Fetches via `getOrderById()` |
| `src/pages/supplier/Orders.tsx` | Modified | Add rejection reason input when cancelling. Link each order card to `/supplier/orders/:id`. Extract order card to shared component. |
| `src/pages/supplier/OrderDetail.tsx` | NEW | Full supplier view: accept/reject with reason, status action buttons, buyer info, item list |
| `src/components/shared/OrderStatusTimeline.tsx` | NEW | Shared timeline component (buyer + supplier use same component, different props) |
| `src/App.tsx` | Modified | Add routes `/orders/:id` and `/supplier/orders/:id` |

Total: 4 new files, 8 modified files.

---

## Push Notification Trigger Strategy

### Recommendation: Hono endpoint trigger (existing pattern, extend it)

**Do not use a Supabase DB trigger or Edge Function for push in this milestone.**

Rationale:

1. **The pattern already exists.** `api/[...route].ts` already has `sendPush(supplierId, orderId)` called from the POST `/orders` handler. Extending this to a `sendPushToBuyer(orderId, newStatus)` call inside the PATCH `/orders/:id/status` handler is one new internal function, consistent with the established pattern.

2. **DB triggers require deploying Supabase Edge Functions.** The project has no Edge Functions infrastructure today. Adding one for push is non-trivial: needs Supabase CLI deploy, VAPID secrets in Supabase secrets store, separate test path. This is the wrong tool for a milestone that is primarily frontend + existing backend work.

3. **Supabase Realtime (postgres_changes) is a separate approach** that would let the client subscribe to order row changes and update UI, but it doesn't replace the push notification — the app must be backgrounded when the notification fires, so a server-side push call is mandatory. Realtime for live order status updates is a v1.2 feature, not needed now.

4. **Authorization is already in Hono.** The status-update endpoint already validates the JWT and will have the supplier's user ID. The buyer's `push_subscription` row can be fetched by looking up `push_subscriptions` WHERE `user_id = order.buyer_id`. The `adminSupabase` client (service role) used in Hono bypasses RLS, so this lookup works without any additional policy.

### Implementation sketch

```typescript
// In api/[...route].ts — add after the existing sendPush function

async function sendPushToBuyer(orderId: string, newStatus: string) {
  // Look up the order to get buyer_id
  const { data: order } = await adminSupabase
    .from('orders')
    .select('buyer_id')
    .eq('id', orderId)
    .single()
  if (!order) return

  const { data: sub } = await adminSupabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', order.buyer_id)
    .single()
  if (!sub) return

  const statusLabels: Record<string, string> = {
    confirmed: 'Pedido confirmado pelo fornecedor!',
    in_delivery: 'Seu pedido saiu para entrega.',
    delivered: 'Pedido entregue. Bom apetite!',
    cancelled: 'Pedido cancelado pelo fornecedor.',
  }

  await webpush.sendNotification(
    sub.subscription as webpush.PushSubscription,
    JSON.stringify({
      title: statusLabels[newStatus] ?? 'Atualização no seu pedido',
      body: `Pedido #${orderId.slice(0, 8).toUpperCase()}`,
      url: `/orders/${orderId}`,
    }),
  )
}

// In the PATCH /orders/:id/status handler, add after the DB update:
sendPushToBuyer(orderId, status).catch(() => {})
```

This keeps push handling entirely in one file, uses the existing webpush initialization, and adds no new infrastructure.

---

## Suggested Build Order

### Why this order

The dependency chain is: schema migration → service functions → API change → pages. The supplier order detail must exist before you can test push (you need to trigger a status change). The buyer detail depends on the API push being wired.

### Phase A — Schema + API backbone (ship first)

1. Create migration: `rejection_reason` + `status_history` columns
2. Update `src/types/index.ts` with new fields
3. Update `updateOrderStatus()` in services to accept `rejectionReason?`
4. Update PATCH `/orders/:id/status` in Hono: persist rejection_reason, append status_history, call `sendPushToBuyer()`
5. Add `getOrderById()` to services

Rationale: Unblocks all page work. Pages can be developed and tested as soon as the data layer is stable. Without the schema, any page that shows rejection reason or timeline will have to stub data.

### Phase B — Supplier order flow (ship second)

1. Add rejection reason input to cancel flow in `src/pages/supplier/Orders.tsx` (modal pattern already used for EditOrderModal — reuse it)
2. Create `src/pages/supplier/OrderDetail.tsx` — full detail view with all action buttons
3. Add route `/supplier/orders/:id` to App.tsx
4. Make order cards in `SupplierOrders` navigate to detail

Rationale: Supplier interaction drives push notifications to buyers. Must exist before buyer push can be end-to-end tested.

### Phase C — Shared timeline + buyer detail (ship third)

1. Create `src/components/shared/OrderStatusTimeline.tsx`
2. Create `src/pages/buyer/OrderDetail.tsx` — uses timeline, shows rejection reason if cancelled
3. Add route `/orders/:id` to App.tsx
4. Modify buyer `OrderHistory.tsx` to navigate to detail on card tap
5. Upgrade Cart.tsx success overlay with order number + link to detail

Rationale: Buyer detail uses the timeline component. Building timeline first prevents duplication. The buyer can now receive push notifications (from Phase A) that deep-link to `/orders/:id` — this completes the loop.

---

## Data Flow Diagram

```
BUYER CREATES ORDER
──────────────────
Cart.tsx
  └─ createOrder(order, items)  [src/services/supabase.ts]
       └─ apiClient.post('/orders', ...)  [src/lib/apiClient.ts]
            └─ POST /api/orders  [api/[...route].ts]
                 ├─ INSERT orders row  (status = 'pending')
                 ├─ INSERT order_items rows
                 ├─ RPC increment_product_sold (fire-and-forget)
                 ├─ RPC increment_supplier_sales (fire-and-forget)
                 └─ sendPush(supplierId, orderId)  ──► Supplier browser push
                      └─ push_subscriptions WHERE user_id = supplier_id

Cart.tsx receives order.id
  └─ Shows success overlay with order number + WhatsApp link
  └─ [v1.1] "Ver pedido" link → /orders/:id


SUPPLIER UPDATES STATUS
───────────────────────
supplier/Orders.tsx or supplier/OrderDetail.tsx
  └─ updateOrderStatus(orderId, nextStatus, rejectionReason?)
       └─ apiClient.patch('/orders/:id/status', { status, rejection_reason })
            └─ PATCH /api/orders/:id/status  [api/[...route].ts]
                 ├─ UPDATE orders SET status, rejection_reason, updated_at
                 ├─ UPDATE orders SET status_history = status_history || new_entry
                 └─ sendPushToBuyer(orderId, newStatus)  ──► Buyer browser push
                      └─ push_subscriptions WHERE user_id = order.buyer_id

supplier/Orders.tsx optimistic update
  └─ setOrders(prev.map update)
  └─ WhatsApp toast (existing behavior, keep as fallback)


BUYER VIEWS ORDER STATUS
────────────────────────
buyer/OrderHistory.tsx
  └─ getOrdersByBuyer(buyer.id)  [direct Supabase, RLS-protected]
       └─ orders JOIN order_items JOIN suppliers
  └─ [v1.1] tap card → navigate('/orders/:id')

buyer/OrderDetail.tsx  [NEW]
  └─ getOrderById(orderId)  [direct Supabase, RLS-protected]
       └─ orders JOIN order_items JOIN suppliers JOIN buyers
  └─ OrderStatusTimeline (reads status_history JSONB)
  └─ Shows rejection_reason if status === 'cancelled'


PUSH NOTIFICATION DEEP LINK
────────────────────────────
Service worker receives push
  └─ payload.url = '/orders/:id'  (buyer) or '/supplier/orders' (supplier)
  └─ Browser navigates to URL on notification click
       └─ buyer/OrderDetail.tsx loads, fetches order by route param id
```

---

## Answers to Specific Questions

**Q1: Should order status updates go through Hono API or direct Supabase?**

Through Hono. The existing PATCH `/orders/:id/status` in Hono already handles this. The Supabase RLS policy "Suppliers can update order status" (`FOR UPDATE USING (supplier_id = auth.uid())`) would technically allow direct client updates, but: (a) direct updates skip the push notification side-effect, (b) Hono can enforce that only valid transitions are applied (add a whitelist check), (c) the rejection_reason must be written atomically with the status change. Keep it in Hono.

**Q2: How to trigger push notifications on status change?**

Extend the PATCH `/orders/:id/status` handler in `api/[...route].ts` with `sendPushToBuyer()`. See Push Notification Trigger Strategy above.

**Q3: Does the existing `orders` table need new columns?**

Yes, two columns: `rejection_reason TEXT` and `status_history JSONB DEFAULT '[]'`. No new tables are needed.

**Q4: Should there be an `orderStore.ts` in Zustand or fetch-on-demand?**

Fetch-on-demand. Do not create an `orderStore.ts`.

Reason: Orders are mutable server state — the canonical source of truth is Supabase, not a Zustand snapshot. The existing pages (`OrderHistory.tsx`, `supplier/Orders.tsx`) already use local `useState` + `useEffect` with a fetch-on-mount pattern. This is correct. A Zustand order store would need cache invalidation logic every time a status changes (supplier action → buyer store stale), which adds complexity with no real benefit at this scale. If real-time order list updates become a requirement, use Supabase Realtime's `postgres_changes` channel scoped to the user's orders — that is a v1.2 concern.

The only exception is the post-checkout success overlay in Cart.tsx, which already holds the `orderId` in a transient `checkoutSuccess` local state variable. That pattern is correct and should stay.

**Q5: What new pages/routes are needed?**

Two new pages, two new routes:
- `src/pages/buyer/OrderDetail.tsx` → route `/orders/:id` (under BuyerLayout)
- `src/pages/supplier/OrderDetail.tsx` → route `/supplier/orders/:id` (under SupplierLayout)

The existing `/orders` (buyer history) and `/supplier/orders` (supplier list) pages stay as-is and are augmented only with navigation to the detail routes.
