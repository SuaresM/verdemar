---
phase: product-stock-zones-ux
reviewed: 2026-05-09T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - api/[...route].ts
  - src/pages/supplier/ProductForm.tsx
  - src/pages/supplier/Products.tsx
  - src/pages/supplier/StoreSettings.tsx
  - src/services/supabase.ts
  - src/types/index.ts
  - supabase/migrations/20260508000000_products_sell_without_stock.sql
findings:
  critical: 4
  warning: 6
  info: 2
  total: 12
status: issues_found
---

# Phase product-stock-zones-ux: Code Review Report

**Reviewed:** 2026-05-09T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the D-02 (sell_without_stock flag) and delivery-zones UX implementation. The migration and type definitions are clean and minimal. The main problems are concentrated in the API route file: three endpoints that mutate order state have no ownership authorization checks (any authenticated user can change any order), and the order-items recalculation produces a wrong total on partial updates. On the frontend, a double-save race on the inline stock editor and a silent data-loss pattern in the zone modal catch block are the most pressing issues. Several lower-severity gaps are also documented.

---

## Critical Issues

### CR-01: Any authenticated user can change any order's status

**File:** `api/[...route].ts:65-76`
**Issue:** `PATCH /orders/:id/status` applies `requireAuth` but performs no ownership check. Any logged-in user (buyer, supplier, even a different supplier) can set any order's status to any arbitrary string, including values outside the `OrderStatus` union. There is no validation that `status` is a legal value, and no check that `userId` is either the order's `buyer_id` or `supplier_id`.
**Fix:**
```typescript
app.patch('/orders/:id/status', requireAuth, async (c) => {
  const userId = c.get('userId')
  const orderId = c.req.param('id')
  const { status } = await c.req.json<{ status: string }>()

  const VALID_STATUSES = ['pending', 'confirmed', 'in_delivery', 'delivered', 'cancelled']
  if (!VALID_STATUSES.includes(status)) {
    return c.json({ error: 'status inválido' }, 400)
  }

  // Verify the caller is the supplier for this order
  const { data: order } = await adminSupabase
    .from('orders')
    .select('supplier_id')
    .eq('id', orderId)
    .single()
  if (!order || order.supplier_id !== userId) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const { error } = await adminSupabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
  if (error) return c.json({ error: error.message }, 400)

  return c.json({ ok: true })
})
```

---

### CR-02: Any authenticated user can edit items and corrupt the total of any order

**File:** `api/[...route].ts:78-108`
**Issue:** `PATCH /orders/:id/items` has no ownership check. Any authenticated user can delete, update, and recalculate the total of any order they do not own. Combined with the recalculation bug described in WR-01, this is both an authorization bypass and a data-integrity risk.
**Fix:** Add the same ownership guard as CR-01 before performing any writes:
```typescript
const { data: order } = await adminSupabase
  .from('orders').select('supplier_id').eq('id', orderId).single()
if (!order || order.supplier_id !== userId) {
  return c.json({ error: 'Forbidden' }, 403)
}
```

---

### CR-03: Order total is silently wrong after partial item update

**File:** `api/[...route].ts:100-105`
**Issue:** `newTotal` is computed only from `toUpdate` (items passed in with quantity > 0). Items that existed in the order but were **not included** in the request payload are excluded from the sum, so their subtotals vanish from the total. The handler overwrites the stored `total_value` with this partial sum.

Example: order has items A (R$50) and B (R$30). Caller sends only item B with quantity 0 to remove it. `toUpdate = []`, `newTotal = 0`. The total is set to 0, but item A still exists in `order_items` with subtotal R$50.

**Fix:** Recalculate the total by querying the remaining items from the database after all mutations are applied, rather than summing the caller-provided subtotals:
```typescript
const { data: remaining } = await adminSupabase
  .from('order_items')
  .select('subtotal')
  .eq('order_id', orderId)
const newTotal = (remaining ?? []).reduce((sum, i) => sum + (i.subtotal ?? 0), 0)
```

---

### CR-04: PATCH /orders/:id/whatsapp-sent has no ownership check

**File:** `api/[...route].ts:110-120`
**Issue:** Any authenticated user can set `whatsapp_sent = true` on any order. While the impact is lower than CR-01/CR-02, it still allows order state pollution across tenant boundaries.
**Fix:** Add an ownership guard (same pattern as CR-01/CR-02) before the update.

---

## Warnings

### WR-01: Double-save race condition on inline stock editor (onBlur + Enter key)

**File:** `src/pages/supplier/Products.tsx:209-218`
**Issue:** The stock `<input>` fires `handleStockSave` on `onBlur` AND on `Enter` keydown. When the user presses Enter, `handleStockSave` is called, which inside its `finally` block calls `setEditingStock(...)` to delete the key — this unmounts the input, which triggers another `onBlur`, firing `handleStockSave` a second time. The second call reads `rawVal === undefined` (the key was just deleted) and returns early, so no second API call is made — but this is a fragile rely on a timing race. If the first save hasn't completed its `finally` block yet when the blur fires, `rawVal` may still exist and a second API call goes out.

**Fix:** Call `e.preventDefault()` and explicitly blur the input on Enter, and guard against concurrent saves with a ref or by checking `stockSaving[product.id]` at the top of `handleStockSave`:
```typescript
const handleStockSave = async (product: Product) => {
  if (stockSaving[product.id]) return  // guard against concurrent calls
  const rawVal = editingStock[product.id]
  if (rawVal === undefined) return
  // ...rest of handler
}
```

---

### WR-02: Zone modal closes and discards user input silently on save error

**File:** `src/pages/supplier/StoreSettings.tsx:130-136`
**Issue:** In the `catch` block of `handleSaveZone`, both `setShowZoneModal(false)` and `setEditingZone(null)` are called. This means if the API call to save a delivery zone fails, the modal is immediately closed and the user loses all their input with no way to correct and retry. The success path at line 128 also closes the modal — the modal close is not conditional on success vs. failure.
**Fix:** Remove the modal-close calls from the `catch` block:
```typescript
} catch {
  toast.error('Erro ao salvar zona')
  // Do NOT close modal — let the user retry with their input intact
} finally {
  setZoneSaving(false)
}
```

---

### WR-03: Fire-and-forget RPC calls lose errors silently on order creation

**File:** `api/[...route].ts:48-58`
**Issue:** `increment_product_sold` (lines 48-52) and `increment_supplier_sales` (lines 55-58) are not awaited. Failures are swallowed by `.catch(() => {})`. The outer `Promise.all(...)` result is not awaited either (line 48 — the return value is discarded). This means that after an order is successfully created, `total_sold` and supplier `total_sales` counters can silently fall out of sync without any log, alert, or retry mechanism.
**Fix:** At minimum, log failures so they are observable:
```typescript
await Promise.all(
  Object.entries(quantityByProduct).map(([pid, qty]) =>
    adminSupabase.rpc('increment_product_sold', { p_id: pid, p_amount: qty })
      .catch((e) => console.error('increment_product_sold failed', pid, e))
  )
)
```

---

### WR-04: Partial supplier delete can cause FK violation after products are already deleted

**File:** `api/[...route].ts:293-303`
**Issue:** The `DELETE /admin/suppliers/:id` handler manually deletes products first, then the supplier. If there are delivery zones, push subscriptions, or orders referencing the supplier via FK without CASCADE, the `suppliers` delete at line 299 will fail with a FK violation — but the products are already permanently deleted. This leaves the system in an inconsistent state: products gone, supplier still exists.
**Fix:** Either (a) add `ON DELETE CASCADE` to all FK references to `suppliers` in the schema, or (b) wrap the entire sequence in a Postgres transaction using a DB function/RPC so partial failure rolls back:
```typescript
// Option: use a single RPC that runs inside a transaction
const { error } = await adminSupabase.rpc('delete_supplier_cascade', { p_supplier_id: id })
if (error) return c.json({ error: error.message }, 400)
return c.json({ ok: true })
```

---

### WR-05: sell_without_stock is unset (missing) in ProductForm — silently reverts to DB default on create

**File:** `src/pages/supplier/ProductForm.tsx:145-161`
**Issue:** The `ProductForm` schema and `productData` object never include `sell_without_stock`. When creating a new product, the field defaults to `false` (DB default). When updating, the field is simply omitted from the PATCH payload, so whatever the supplier set via the inline toggle in the product list is preserved. This is not clearly wrong, but it means the `ProductForm` is the only screen for editing a product and it has no UI control for `sell_without_stock`. If a supplier creates a product intending to sell without stock, they must save first, then find the product card and tap the inline toggle — a non-obvious two-step process that is never explained.

This is a functional gap: the product edit form is incomplete relative to the product's data model.
**Fix:** Add `sell_without_stock: z.boolean()` to the form schema and include it in `productData`, wired up with the same toggle pattern already used for `is_available` and `is_featured`.

---

### WR-06: updateProduct bypasses row-ownership check — any supplier can update any product

**File:** `src/services/supabase.ts:191-197`
**Issue:** `updateProduct` issues `supabase.from('products').update(updates).eq('id', id)` using the **anon/user** Supabase client. It relies on RLS policies to enforce that only the owning supplier can update their own products. If RLS is misconfigured or disabled, any supplier can overwrite any product. More importantly, this means the frontend's `handleToggleAvailability` in `Products.tsx:50-59` calls `updateProduct` directly via the client SDK (not via the API route which enforces `.eq('supplier_id', userId)`), creating a dual-path inconsistency: stock updates go through the API (which checks `supplier_id`), but availability toggles go through the client SDK (which relies on RLS). If RLS policies are ever relaxed or there is a regression, availability can be toggled cross-tenant.

This is a defense-in-depth issue. Centralizing all writes through the authenticated API is the safer architecture.

---

## Info

### IN-01: console.error debug calls remain in production code

**File:** `src/pages/supplier/ProductForm.tsx:113`, `src/pages/supplier/StoreSettings.tsx:207`
**Issue:** `console.error('Erro ao carregar produto:', err)` and `console.error('Erro ao salvar loja:', err)` are present. These may leak internal error details and stack traces to the browser console in production.
**Fix:** Remove or replace with a structured logging utility that is silent in production.

---

### IN-02: PAGE_SIZE constant is declared after its first use

**File:** `src/services/supabase.ts:162`
**Issue:** `PAGE_SIZE` is declared at line 162 but is used at line 113 (`searchSuppliers`). JavaScript hoisting does not apply to `const` — this will cause a `ReferenceError: Cannot access 'PAGE_SIZE' before initialization` at runtime if `searchSuppliers` is called before `PAGE_SIZE` is initialized. In practice, module-level `const` is evaluated top-to-bottom when the module loads, so the reference at line 113 inside a function body is safe (the function is not called until after module initialization). However, it is still a code quality issue and will confuse future readers. Move `PAGE_SIZE` to the top of the file, before its first use.

---

_Reviewed: 2026-05-09T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
