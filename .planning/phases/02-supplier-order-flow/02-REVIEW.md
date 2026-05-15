---
phase: 02-supplier-order-flow
reviewed: 2026-05-14T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/services/supabase.ts
  - src/utils/index.ts
  - api/[...route].ts
  - src/components/layout/SupplierNav.tsx
  - src/App.tsx
  - src/pages/supplier/Orders.tsx
findings:
  critical: 5
  warning: 7
  info: 3
  total: 15
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-14T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Six files implementing the supplier order flow were reviewed: the API route handler (Hono), the Supabase service layer, utility/formatting helpers, the React layout shell (`App.tsx`), the supplier bottom nav, and the Orders page (`Orders.tsx`). The state-machine transition table is correct and the idempotency logic is sound in intent, but several correctness, security, and data-integrity defects were found that must be resolved before shipping.

---

## Critical Issues

### CR-01: `/orders/:id/items` PATCH has no ownership check — any authenticated user can mutate any order's items

**File:** `api/[...route].ts:176`
**Issue:** The handler reads `orderId` from the URL param and directly updates `order_items` and `orders` using `adminSupabase` (service-role key, bypasses RLS) without first verifying that the calling user is the supplier who owns the order. An authenticated buyer or another supplier can craft a PATCH to `/api/orders/<victim_order_id>/items` and freely change quantities and the total value of someone else's confirmed order, with no authorization check whatsoever.

```
// current — no auth check
app.patch('/orders/:id/items', requireAuth, async (c) => {
  const orderId = c.req.param('id')
  // no lookup of order.supplier_id, no comparison to c.get('userId')
```

**Fix:** Fetch the order first and compare `supplier_id` to the authenticated user, identical to the pattern already in `/orders/:id/status`:

```typescript
app.patch('/orders/:id/items', requireAuth, async (c) => {
  const userId = c.get('userId')
  const orderId = c.req.param('id')
  const { items } = await c.req.json<{ ... }>()

  const { data: order } = await adminSupabase
    .from('orders')
    .select('supplier_id, status')
    .eq('id', orderId)
    .single()
  if (!order) return c.json({ error: 'Pedido não encontrado' }, 404)
  if (order.supplier_id !== userId) return c.json({ error: 'Proibido' }, 403)
  // also gate on status: only 'pending' | 'confirmed' should be editable
  if (!['pending', 'confirmed'].includes(order.status))
    return c.json({ error: 'Pedido não pode ser editado neste status' }, 422)
  // ...rest of handler
})
```

---

### CR-02: `/orders/:id/whatsapp-sent` PATCH has no ownership check

**File:** `api/[...route].ts:208`
**Issue:** Same pattern as CR-01. Any authenticated user can flip `whatsapp_sent = true` on any order. While the data sensitivity is lower, an attacker can silently suppress WhatsApp notification tracking on orders they do not own, corrupting audit trails.

**Fix:** Add the same ownership check:

```typescript
app.patch('/orders/:id/whatsapp-sent', requireAuth, async (c) => {
  const userId = c.get('userId')
  const orderId = c.req.param('id')

  const { data: order } = await adminSupabase
    .from('orders')
    .select('supplier_id')
    .eq('id', orderId)
    .single()
  if (!order) return c.json({ error: 'Pedido não encontrado' }, 404)
  if (order.supplier_id !== userId) return c.json({ error: 'Proibido' }, 403)

  // ...existing update
})
```

---

### CR-03: Order creation — supplier identity is not verified, allowing buyer to set arbitrary `supplier_id`

**File:** `api/[...route].ts:32`
**Issue:** The only authorization check on POST `/orders` is `order.buyer_id !== userId`. The `supplier_id` field in the order payload is accepted verbatim without validating that the referenced supplier exists and is active (`is_active = true`). A buyer can create a fake order for a deactivated or non-existent supplier, which will still decrement `total_sold` counters and fire push notifications (line 89-98) for an invalid `supplier_id`. More importantly, the supplier's total_sales is incremented from an unverified caller-supplied `total_value`, which is also not verified server-side (line 91).

**Fix:**
```typescript
// After the buyer_id check, before upsert:
const { data: supplier } = await adminSupabase
  .from('suppliers')
  .select('id, is_active')
  .eq('id', order.supplier_id)
  .single()
if (!supplier?.is_active) return c.json({ error: 'Fornecedor inativo ou não encontrado' }, 422)
```
Also recompute `total_value` server-side from the submitted item prices rather than trusting the client-supplied `order.total_value`.

---

### CR-04: `EditOrderModal` — `onSaved` is called before the save operation completes, using stale pre-DB total

**File:** `src/pages/supplier/Orders.tsx:83`
**Issue:** `onSaved(newTotalFromDb, items)` (line 83) is called _before_ `handleEditSaved` applies the new items to local state, which is correct, but `newTotalFromDb` comes from `updateOrderItemsAndTotal` which itself returns `newTotal` computed by the **API** as `toUpdate.reduce((sum, i) => sum + i.subtotal, 0)` (api line 198). This total excludes removed items (quantity 0), which is also correct. However, the `items` argument passed to `onSaved` still contains items with `editQty === 0`, and `handleEditSaved` uses `filter(i => i.editQty > 0)` to strip them — so the parent list state will be correct.

The real bug is more subtle: if `updateOrderItemsAndTotal` **throws** after the DB write partially succeeds (e.g., some item updates succeeded but the order total update failed — api lines 190-203), `onSaved` is never called and the modal stays open, but the database is now in a partially-updated state (some item rows mutated, `total_value` not updated). The modal shows the old total; the next polling cycle (15s) will pull the partially-updated items but the stale `total_value` from the DB, creating a visible discrepancy.

**Fix:** The API should wrap the item updates and the order total update in a single database transaction (Postgres RPC) to ensure atomicity. As a client-side defence, always refresh the order list immediately after a successful edit rather than relying solely on local state mutation:

```typescript
// After onSaved():
await load() // re-fetch from server to get authoritative state
```

---

### CR-05: `formatWhatsAppMessage` / `formatOrderStatusMessage` — buyer phone number is URL-encoded without length/format validation

**File:** `src/utils/index.ts:81` and `src/pages/supplier/Orders.tsx:344`
**Issue:** `order.buyer.contact_phone.replace(/\D/g, '')` produces the digits, but there is no check that the result has 10-13 digits (valid E.164 range). A phone stored as `"0000000000"` (a common placeholder from registration forms) or an empty string will silently construct `https://wa.me/0000000000?text=...`, sending the supplier to a dead WhatsApp link with no error. In `formatPhone` (utils line 24-28), a phone that is neither 10 nor 11 digits long will apply the 10-digit regex to an 8-digit or 9-digit string and produce an empty/corrupt display string without any indication of the error.

**Fix:** Add a minimum-length guard before constructing WhatsApp URLs:

```typescript
const digits = order.buyer.contact_phone.replace(/\D/g, '')
if (digits.length < 10) {
  toast.error('Telefone do comprador inválido — notificação WhatsApp não enviada.')
  return
}
const whatsappUrl = `https://wa.me/${digits}?text=${message}`
```

---

## Warnings

### WR-01: `useEffect` in `App.tsx` has missing dependency (`loadProfile`, `setUser`)

**File:** `src/App.tsx:163`
**Issue:** The `useEffect` that sets up the Supabase auth listener lists `[]` as its dependency array (line 195), but it closes over `loadProfile` and `setUser` from `useAuthStore()`. If the store reference changes between renders (e.g., due to a hot-reload or store reset), the stale closure will continue to call the old references. In Zustand stores these typically are stable, but the pattern is fragile — the React compiler and exhaustive-deps lint rule will flag this.

**Fix:**
```typescript
const { loadProfile, setUser } = useAuthStore()
// ...
useEffect(() => {
  // ...
}, [loadProfile, setUser])
```
Or extract them via `useCallback`/stable selectors to confirm they are intentionally stable.

---

### WR-02: `SupplierLayout` polling interval may fire after unmount if `supplier` changes identity

**File:** `src/App.tsx:59-66`
**Issue:** The `useEffect` for `getPendingOrderCount` correctly returns `() => clearInterval(interval)` as a cleanup. However, the effect depends on `[supplier]`. If the supplier object reference changes (e.g., after a profile refresh that returns a new object with the same `id`) without the component unmounting, React will run the old cleanup _and_ immediately start a new interval. During the brief window between the old cleanup and the new `refresh()` call completing, the component can re-render with `pendingCount` from the previous supplier. This is a minor timing issue but if supplier identity actually changes (logout + re-login as a different supplier in the same session), the old interval fires one extra time against the old `supplier.id` after cleanup begins but before the clearInterval executes.

**Fix:** Depend on `supplier?.id` rather than the entire `supplier` object reference, and validate the id inside the callback:

```typescript
useEffect(() => {
  if (!supplier?.id) return
  const id = supplier.id
  const refresh = () =>
    getPendingOrderCount(id).then(setPendingCount).catch(() => {})
  refresh()
  const interval = setInterval(refresh, 15000)
  return () => clearInterval(interval)
}, [supplier?.id])
```

---

### WR-03: `getOrdersBySupplier` silently discards error — caller cannot distinguish "no orders" from "network error"

**File:** `src/services/supabase.ts:223`
**Issue:** On Supabase error the function returns `[]`. `SupplierOrders` (Orders.tsx line 302) catches a thrown error to show `toast.error('Erro ao carregar pedidos')`, but this toast will never appear for Supabase failures because the service function swallows the error and returns an empty array. The supplier sees an empty orders list with no feedback on a network failure or permission error.

**Fix:** Throw on error instead of returning `[]`:
```typescript
export async function getOrdersBySupplier(supplierId: string, limit = 100): Promise<Order[]> {
  const { data, error } = await supabase...
  if (error) throw error
  return data
}
```
Apply the same pattern to all service functions that currently return `[]` on error where callers expect to show error UI: `getProductsBySupplier`, `getFeaturedProducts`, etc.

---

### WR-04: `admin/users` page size off-by-one — returns PAGE_SIZE+1 rows to client

**File:** `api/[...route].ts:353`
**Issue:** `.range(from, from + PAGE_SIZE)` fetches `PAGE_SIZE + 1` rows (Supabase range is inclusive on both ends, so range(0, 20) = 21 rows). The `hasMore` logic on line 356 then checks `data.length > PAGE_SIZE`, which is correct, but the slice on line 357 is `data!.slice(0, PAGE_SIZE)` which is also correct. However, when `hasMore` is false, the full `data` array (potentially PAGE_SIZE+1 rows = 21) is returned to the client without slicing. On the last page where there are exactly PAGE_SIZE+1 rows, the caller receives 21 records instead of 20.

Compare to the correct pattern in `src/services/supabase.ts` (e.g., line 123: `.range(from, to + 1)` where `to = from + PAGE_SIZE - 1`, so `to + 1 = from + PAGE_SIZE`). Both approaches fetch one extra to detect `hasMore`, but the service layer slices correctly on both branches. The API handler only slices on the `hasMore = true` branch.

**Fix:**
```typescript
return c.json({
  data: hasMore ? data!.slice(0, PAGE_SIZE) : (data ?? []).slice(0, PAGE_SIZE),
  hasMore
})
```

---

### WR-05: `handleUpdateStatus` passes `order` (pre-update snapshot) to `formatOrderStatusMessage` after local state update

**File:** `src/pages/supplier/Orders.tsx:338-343`
**Issue:** After `updateOrderStatus` succeeds, `setOrders` applies an optimistic update setting `o.status = nextStatus`. Then `formatOrderStatusMessage(nextStatus, order, supplier)` is called with the original `order` object (captured in the closure), which still has `order.status = 'pending'` (or whatever the old status was). The message text is built from `nextStatus` correctly, but the message builder also reads `order.total_value` and other order fields — these are fine. The real problem arises if the polling `load()` fires between the `updateOrderStatus` call and the `setOrders` call, producing a race where the list briefly shows the old status before snapping back to the new one via the optimistic update. This is a classic stale-closure race with polling.

**Fix:** Cancel/skip the polling load while an `updating` flag is active for any order, or gate the polling update to skip orders currently being mutated:

```typescript
.then((data) => setOrders((prev) =>
  data.map((serverOrder) =>
    updating[serverOrder.id] ? (prev.find(p => p.id === serverOrder.id) ?? serverOrder) : serverOrder
  )
))
```

---

### WR-06: `canReject` allows rejecting a `confirmed` order but the state machine only allows rejection from `pending`

**File:** `src/pages/supplier/Orders.tsx:418` and `api/[...route].ts:129`
**Issue:** `canReject` is set to `order.status === 'pending' || order.status === 'confirmed'` (line 418). The UI renders a "Recusar" button for `confirmed` orders. However, the server-side state machine (api line 129) defines `rejected: { actor: 'supplier', from: ['pending'] }` — rejection is only allowed from `pending`. If a supplier taps "Recusar" on a confirmed order, the API will return a 422 error ("Não é possível passar de 'confirmed' para 'rejected'") and the UI will show `toast.error('Erro ao recusar pedido')` with no explanation. The "Recusar" button is visible but non-functional for confirmed orders, creating a confusing UX and a needless round trip.

**Fix:** Align `canReject` with the state machine:
```typescript
const canReject = order.status === 'pending'
```

---

### WR-07: `formatDate` and `formatDateShort` will throw on invalid/null date strings

**File:** `src/utils/index.ts:134-150`
**Issue:** `new Date(dateString)` silently produces an `Invalid Date` object when `dateString` is `undefined`, `null`, or a malformed ISO string. `Intl.DateTimeFormat.format(Invalid Date)` throws a `RangeError` in all major browsers. In `Orders.tsx` line 440, the caller guards with `order.created_at ? formatDate(order.created_at) : ''`, but other callers may not apply this guard. The functions themselves should be defensive.

**Fix:**
```typescript
export function formatDate(dateString: string): string {
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', { ... }).format(d)
}
```

---

## Info

### IN-01: `console.error(err)` left in production `handleSave`

**File:** `src/pages/supplier/Orders.tsx:96`
**Issue:** `console.error(err)` inside `EditOrderModal.handleSave` is a debug artifact that will log stack traces to the browser console in production builds. This leaks internal error details to end users who open dev tools.

**Fix:** Remove the `console.error(err)` line. The `toast.error` on line 97 already provides user-facing feedback. Consider a structured logging approach if server-side tracing is needed.

---

### IN-02: VAPID setup silently falls back to `admin@example.com` contact email

**File:** `api/[...route].ts:14`
**Issue:** `process.env.VAPID_EMAIL ?? 'admin@example.com'` means that if `VAPID_EMAIL` is not set in the environment, web-push notifications will advertise `admin@example.com` as the contact. This is a spec violation (RFC 8030 requires a reachable contact), and some push gateways may reject the VAPID subscription outright in production.

**Fix:** Require `VAPID_EMAIL` to be set alongside `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`, or throw a startup error if it is missing:
```typescript
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  if (!process.env.VAPID_EMAIL) throw new Error('VAPID_EMAIL env var required')
  webpush.setVapidDetails(
    'mailto:' + process.env.VAPID_EMAIL,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}
```

---

### IN-03: `updateUserRole` accepts any string `role` — not validated against the allowed enum

**File:** `api/[...route].ts:362`
**Issue:** `PATCH /admin/users/:id/role` reads `role` from the request body as `string` and writes it directly to the `profiles` table. Although the route is gated behind `requireAdmin`, an admin can accidentally (or intentionally) write an arbitrary role string (e.g., `"superadmin"`, `""`) that the application does not handle, potentially bypassing the `BuyerLayout`/`SupplierLayout`/`AdminLayout` guards which use strict equality checks.

**Fix:**
```typescript
const VALID_ROLES = ['buyer', 'supplier', 'admin']
if (!VALID_ROLES.includes(role)) return c.json({ error: 'Role inválido' }, 400)
```

---

_Reviewed: 2026-05-14T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
