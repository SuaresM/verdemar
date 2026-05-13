---
phase: 01-schema-api-backbone
reviewed: 2026-05-13T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - api/[...route].ts
  - src/types/index.ts
  - src/services/supabase.ts
  - supabase/migrations/20260513000000_order_flow.sql
findings:
  critical: 7
  warning: 4
  info: 2
  total: 13
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-13T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Four files were reviewed: the primary API handler, TypeScript types, the client-side service layer, and the Supabase migration. The authorization rewrite for `PATCH /orders/:id/status` is structurally correct and closes the most critical prior gap. However, the review uncovered seven blocker-level issues across the other endpoints and the migration. The most severe are: two completely unauthorized endpoints (`PATCH /orders/:id/items` and `PATCH /orders/:id/whatsapp-sent`) that any authenticated user can call against any order; broken idempotency that overwrites confirmed orders on retry; a migration that will fail at runtime if any `in_delivery` rows exist; and unvalidated role assignment in the admin panel.

---

## Critical Issues

### CR-01: `PATCH /orders/:id/items` — No Authorization Check

**File:** `api/[...route].ts:156`
**Issue:** The handler has no authorization whatsoever. It reads `orderId` from the URL and immediately modifies items and recalculates `total_value` without ever checking whether the caller is the buyer or supplier for that order. Any authenticated user — including an unrelated buyer or supplier — can silently mutate another party's order quantities and totals.

**Fix:** Fetch the order first and enforce ownership, mirroring the pattern from `PATCH /orders/:id/status`:
```typescript
app.patch('/orders/:id/items', requireAuth, async (c) => {
  const userId = c.get('userId')
  const orderId = c.req.param('id')

  // Authorization: only the supplier may adjust items
  const { data: order } = await adminSupabase
    .from('orders')
    .select('supplier_id, status')
    .eq('id', orderId)
    .single()
  if (!order) return c.json({ error: 'Pedido não encontrado' }, 404)
  if (order.supplier_id !== userId) return c.json({ error: 'Proibido' }, 403)
  // Only allow edits while order is still pending or confirmed
  if (!['pending', 'confirmed'].includes(order.status)) {
    return c.json({ error: 'Pedido não pode ser editado neste estado' }, 422)
  }

  // ... rest of handler unchanged
})
```

---

### CR-02: `PATCH /orders/:id/whatsapp-sent` — No Authorization Check

**File:** `api/[...route].ts:188`
**Issue:** No authorization check exists. Any authenticated user can set `whatsapp_sent = true` on any order. While this field is lower-stakes than status, it represents an audit trail that could be falsified, and the pattern demonstrates a systemic failure to protect order mutation endpoints.

**Fix:**
```typescript
app.patch('/orders/:id/whatsapp-sent', requireAuth, async (c) => {
  const userId = c.get('userId')
  const orderId = c.req.param('id')

  const { data: order } = await adminSupabase
    .from('orders')
    .select('buyer_id, supplier_id')
    .eq('id', orderId)
    .single()
  if (!order) return c.json({ error: 'Pedido não encontrado' }, 404)
  if (order.buyer_id !== userId && order.supplier_id !== userId) {
    return c.json({ error: 'Proibido' }, 403)
  }
  // ... rest unchanged
})
```

---

### CR-03: Idempotency Upsert Overwrites Confirmed Orders on Retry

**File:** `api/[...route].ts:39-51`
**Issue:** `ignoreDuplicates: false` on the upsert means that when a client retries with the same `idempotency_key`, the existing order row is **updated** with the fields from `orderPayload` — potentially reverting a `confirmed` or `in_route` order back to its original submitted state (e.g., overwriting `status`, `total_value`, `rejection_reason`, etc.).

Additionally, on every retry, line 49-51 unconditionally inserts items again — so a retried order creation will generate duplicate `order_items` rows regardless of whether the order already exists.

**Fix for the upsert:** Use `ignoreDuplicates: true` so a duplicate key is a no-op, then detect whether the returned row is new or existing:
```typescript
const { data: orderData, error: orderError } = await adminSupabase
  .from('orders')
  .upsert(orderPayload, {
    onConflict: 'idempotency_key',
    ignoreDuplicates: true,   // <-- do not overwrite existing row
  })
  .select()
  .single()
if (orderError) return c.json({ error: orderError.message }, 400)
```

**Fix for duplicate items:** After the upsert, check whether the returned order already has items before inserting:
```typescript
// Only insert items if this is a new order (not a replay)
const { count: existingItems } = await adminSupabase
  .from('order_items')
  .select('id', { count: 'exact', head: true })
  .eq('order_id', orderData.id)

if (!existingItems || existingItems === 0) {
  const orderItems = items.map((item) => ({ ...item, order_id: orderData.id }))
  const { error: itemsError } = await adminSupabase.from('order_items').insert(orderItems)
  if (itemsError) return c.json({ error: itemsError.message }, 400)
}
```

Note: With `ignoreDuplicates: true`, Supabase/PostgREST may return an empty result for the duplicate row (it depends on the PostgREST version). The implementation may need to fall back to a `select` after the upsert if `orderData` is null on a duplicate.

---

### CR-04: Migration Will Fail if Any `in_delivery` Rows Exist

**File:** `supabase/migrations/20260513000000_order_flow.sql:27-31`
**Issue:** The new CHECK constraint at line 27 excludes `'in_delivery'`. Line 31 (`VALIDATE CONSTRAINT`) scans all existing rows. If any order currently has `status = 'in_delivery'` (the old value), the `VALIDATE CONSTRAINT` statement will raise an error and the entire migration will be rolled back. The migration does not migrate those rows before adding the constraint.

**Fix:** Add a data migration step before the constraint validation:
```sql
-- Migrate legacy 'in_delivery' rows to 'in_route' before validating the constraint
UPDATE orders
  SET status = 'in_route',
      updated_at = NOW()
  WHERE status = 'in_delivery';

-- Now it is safe to validate
ALTER TABLE orders VALIDATE CONSTRAINT orders_status_check;
```

---

### CR-05: Admin Role Assignment Accepts Arbitrary String Values

**File:** `api/[...route].ts:344`
**Issue:** `PATCH /admin/users/:id/role` writes the `role` field to `profiles` with no validation. An admin can set `role` to any string: `'superadmin'`, `'god'`, empty string, etc. If the `profiles.role` column has no DB-level CHECK constraint, this silently corrupts the role field and can break all role checks downstream (including `requireAdmin`).

**Fix:**
```typescript
const VALID_ROLES = ['buyer', 'supplier', 'admin']
const { role } = await c.req.json<{ role: string }>()
if (!VALID_ROLES.includes(role)) {
  return c.json({ error: 'Role inválido' }, 400)
}
```

---

### CR-06: `POST /push/subscribe` — Empty Endpoint Accepted

**File:** `api/[...route].ts:250-258`
**Issue:** If the client sends a `subscription` object that lacks an `endpoint` field (malformed or missing), `endpoint` is coerced to `''` (empty string). An upsert with `endpoint = ''` succeeds, occupying the `(user_id, '')` slot in the unique index. A second device with a missing endpoint would conflict with the first. Legitimate subscriptions with a real endpoint on the same user would be in separate rows, so the silent deduplication on the composite key silently discards real push subscriptions.

**Fix:** Validate that `endpoint` is a non-empty string before upserting:
```typescript
const endpoint = (subscription as { endpoint?: string }).endpoint ?? ''
if (!endpoint) return c.json({ error: 'Subscription endpoint ausente' }, 400)
```

---

### CR-07: `PATCH /orders/:id/status` — Database Error on Fetch Silently Returns 404

**File:** `api/[...route].ts:95-100`
**Issue:** The fetch of the current order destructures only `data`, discarding the `error` object:
```typescript
const { data: order } = await adminSupabase
  .from('orders')
  .select('status, buyer_id, supplier_id, status_history')
  .eq('id', orderId)
  .single()
if (!order) return c.json({ error: 'Pedido não encontrado' }, 404)
```
If Supabase returns a database error (network partition, permission denied, etc.), `data` will be `null` and `error` will be non-null. The handler returns `404 Not Found` instead of `500 Internal Server Error`. This misleads callers into thinking the order doesn't exist when the real problem is infrastructure.

**Fix:**
```typescript
const { data: order, error: fetchError } = await adminSupabase
  .from('orders')
  .select('status, buyer_id, supplier_id, status_history')
  .eq('id', orderId)
  .single()
if (fetchError && fetchError.code !== 'PGRST116') {
  return c.json({ error: 'Erro interno ao buscar pedido' }, 500)
}
if (!order) return c.json({ error: 'Pedido não encontrado' }, 404)
```
(`PGRST116` is PostgREST's "no rows returned" code for `.single()`.)

---

## Warnings

### WR-01: `PAGE_SIZE` Used Before Declaration in `supabase.ts`

**File:** `src/services/supabase.ts:113,121`
**Issue:** `PAGE_SIZE` is declared at line 162 but first referenced at line 113 (inside `searchSuppliers`). In JavaScript/TypeScript, `const` declarations are not hoisted — this is a temporal dead zone violation that will throw `ReferenceError: Cannot access 'PAGE_SIZE' before initialization` at runtime when `searchSuppliers` is called.

**Fix:** Move the `PAGE_SIZE` constant to the top of the file, before any function that uses it:
```typescript
// ---- CONSTANTS ----
const PAGE_SIZE = 20
```
Remove the declaration at line 162.

---

### WR-02: `increment_supplier_sales` Called with Unvalidated `supplier_id`

**File:** `api/[...route].ts:69-72`
**Issue:** `order.supplier_id` is taken directly from the client-supplied request body and passed to the RPC. The handler already checks `order.buyer_id === userId` (line 32), but there is no validation that `order.supplier_id` is a real supplier UUID. A malicious buyer can supply any string (or UUID) as `supplier_id` and increment that entity's `total_sales` counter arbitrarily.

**Fix:** After creating the order, use `orderData.supplier_id` (the value stored by the DB) for the RPC call, not `order.supplier_id` from the raw request body. The DB insert already received the value, so trust the stored version:
```typescript
Promise.resolve(adminSupabase.rpc('increment_supplier_sales', {
  p_id: orderData.supplier_id as string,   // use DB-stored value, not raw input
  p_amount: orderData.total_value as number,
})).catch(() => {})
```

---

### WR-03: CORS Configured to Allow All Origins

**File:** `api/[...route].ts:20`
**Issue:** `app.use('*', cors())` applies the hono CORS middleware with default settings, which sets `Access-Control-Allow-Origin: *`. This allows any website to make credentialed-like requests to the API. For a B2B marketplace, the API origin should be locked to the production frontend domain.

**Fix:**
```typescript
app.use('*', cors({
  origin: process.env.ALLOWED_ORIGIN ?? 'https://verdemar.app',
  allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
}))
```

---

### WR-04: `admin/users` Range Fetches One Row Too Many

**File:** `api/[...route].ts:330`
**Issue:** All other paginated endpoints use the pattern `range(from, to + 1)` (fetching `PAGE_SIZE + 1` rows to detect `hasMore`). The admin users endpoint uses `range(from, from + PAGE_SIZE)`, which is equivalent and correct — but the `hasMore` check on line 336 (`data.length > PAGE_SIZE`) then slices `data.slice(0, PAGE_SIZE)`. This works correctly but returns `PAGE_SIZE` items with one extra row fetched and discarded. This is consistent with other endpoints and not a bug per se, but the sentinel row is included in `.select('*')` which fetches all profile columns for a row that is immediately thrown away. This is minor but wasteful.

No immediate action required; acceptable as-is given the existing pattern.

---

## Info

### IN-01: `OrderStatus` Type Includes Legacy `in_delivery` with No Migration Guard

**File:** `src/types/index.ts:7`
**Issue:** The `OrderStatus` union type retains `'in_delivery'` as a valid value for backward compatibility. However, after the migration runs, the DB CHECK constraint rejects `in_delivery` for new rows. Frontend code that ever sets `status = 'in_delivery'` in a new API call will be rejected at the DB level, and the type system gives no warning because it's still valid TypeScript. The comment explains the intent but does not prevent misuse.

**Suggestion:** Mark the legacy value with a `@deprecated` JSDoc tag to surface it at call sites:
```typescript
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'in_route'
  | /** @deprecated use 'in_route' — only valid on rows created before Phase 01 migration */ 'in_delivery'
  | 'delivered'
  | 'cancelled'
  | 'rejected'
```

---

### IN-02: VAPID Initialization Silently Skipped When Env Vars Are Absent

**File:** `api/[...route].ts:10-16`
**Issue:** If `VAPID_PUBLIC_KEY` or `VAPID_PRIVATE_KEY` are not set, `webpush.setVapidDetails` is never called. All subsequent `webpush.sendNotification` calls will throw with an uninitialized VAPID error — but since every call site wraps in `.catch(() => {})`, push notifications silently fail with no log output and no observable error to the operator.

**Suggestion:** Log a startup warning when VAPID env vars are missing so the condition is visible in deployment logs:
```typescript
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:' + (process.env.VAPID_EMAIL ?? 'admin@example.com'),
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
} else {
  console.warn('[push] VAPID env vars not set — push notifications are disabled')
}
```

---

_Reviewed: 2026-05-13T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
