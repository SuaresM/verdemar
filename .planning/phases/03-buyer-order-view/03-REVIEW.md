---
phase: 03-buyer-order-view
reviewed: 2026-05-15T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - verdemar/src/pages/buyer/OrderDetail.tsx
  - verdemar/src/pages/buyer/Cart.tsx
  - verdemar/src/App.tsx
  - verdemar/src/components/shared/Badge.tsx
findings:
  critical: 3
  warning: 5
  info: 3
  total: 11
status: fixed
---

# Phase 03: Code Review Report

**Reviewed:** 2026-05-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Four files were reviewed covering the buyer order-detail view, the cart/checkout flow, the top-level routing shell, and the shared Badge component. The implementation is generally well-structured, but there are three blocker-level issues: a silent data-loss risk on the cancel action, an open-redirect / phishing vector in the WhatsApp URL construction, and an unguarded crash path when `getOrderById` returns `null` after the cancel. Five warnings cover logic gaps (no cancellation authorization check, missing `rejection_reason` guard, polling leak on missing `id`, stale-closure risk, and a suppressed TypeScript error). Three info items round out naming and dead-code concerns.

---

## Critical Issues

### CR-01: Cancel action uses stale `order.id` and silently loses the updated state if `getOrderById` returns `null`

**File:** `verdemar/src/pages/buyer/OrderDetail.tsx:71`

**Issue:** After `updateOrderStatus` succeeds, `handleCancel` calls `getOrderById(order.id)` and unconditionally calls `setOrder(updated)`. `getOrderById` returns `Order | null`; if the network request fails or the row is temporarily unavailable it returns `null`. `setOrder(null)` then drives the component into the "Pedido não encontrado" empty state — the cancel succeeded on the backend but the buyer sees an error screen with no way to tell what happened. The `toast.success('Pedido cancelado')` fires before `setOrder(updated)`, so it fires even when the subsequent fetch is about to null the state.

```typescript
// Current — can set order to null on a transient network failure
const updated = await getOrderById(order.id)
setOrder(updated)
toast.success('Pedido cancelado')

// Fix — only update state if the re-fetch actually returned data;
// fall back to a local optimistic update otherwise
const updated = await getOrderById(order.id)
if (updated) {
  setOrder(updated)
} else {
  // Optimistic: flip status locally so the UI reflects the cancel
  setOrder((prev) => prev ? { ...prev, status: 'cancelled' } : prev)
}
toast.success('Pedido cancelado')
```

---

### CR-02: WhatsApp URL built from unsanitized supplier phone number — open redirect / content-injection risk

**File:** `verdemar/src/pages/buyer/Cart.tsx:254-255`

**Issue:** The supplier's `whatsapp` field is stripped of non-digits and placed directly into the `wa.me` URL without any validation of the resulting phone number. If a malicious or misconfigured supplier stores a value like `0javascript:alert(1)` or a number that routes to an unintended recipient, the buyer silently sends order data (including CNPJ, full address, and order total) to that number. There is also no length or country-code validation: an empty phone string produces `https://wa.me/?text=…` which wa.me resolves to an arbitrary recipient selection screen.

```typescript
// Current
const phone = checkoutSection.supplier.whatsapp.replace(/\D/g, '')
const whatsappUrl = `https://wa.me/${phone}?text=${message}`

// Fix — validate the phone is a plausible E.164 number before use
const rawDigits = checkoutSection.supplier.whatsapp.replace(/\D/g, '')
// Brazilian mobile: 10–11 digits locally, or 12–13 with country code 55
if (!/^\d{10,13}$/.test(rawDigits)) {
  toast.error('Fornecedor sem número de WhatsApp válido. Contate o suporte.')
  setCheckoutLoading(false)
  return
}
const whatsappUrl = `https://wa.me/${rawDigits}?text=${message}`
```

---

### CR-03: No server-side ownership check before allowing order cancellation — any authenticated buyer can cancel any order by `id`

**File:** `verdemar/src/pages/buyer/OrderDetail.tsx:66-79`

**Issue:** `handleCancel` calls `updateOrderStatus(order.id, 'cancelled', undefined)` using `order.id` taken from the URL param. The component does not verify that `order.buyer_id === buyer?.id` before issuing the cancel. Although `getOrderById` fetches the order without a buyer filter (confirmed by `supabase.ts:260-268`), a buyer who guesses or enumerates another buyer's order UUID can navigate to `/orders/<uuid>`, see the order detail, and — if it is still `pending` — cancel it. The cancel button is shown whenever `order.status === 'pending'` with no ownership assertion.

The `getOrderById` query at line 263 does not filter by `buyer_id`:
```typescript
// supabase.ts:261 — returns any order matching the UUID, regardless of buyer
.select('*, supplier:suppliers(*), buyer:buyers(*), items:order_items(*)')
.eq('id', orderId)
```

Fix — add an ownership guard before rendering the cancel button and before calling the cancel API:

```typescript
// At the top of the component, after order is loaded:
const { buyer } = useAuthStore()   // already imported via authStore indirectly; add import

// In handleCancel:
const handleCancel = async () => {
  if (!order || cancelling) return
  if (order.buyer_id !== buyer?.id) {
    toast.error('Você não tem permissão para cancelar este pedido.')
    return
  }
  // ... rest unchanged
}

// In the JSX guard for the cancel button:
{order.status === 'pending' && order.buyer_id === buyer?.id && (
  <button ...>Cancelar pedido</button>
)}
```

The backend API route for `PATCH /orders/:id/status` must also enforce ownership — this review only covers the client code, but the absence of a client-side guard is independently exploitable if RLS is misconfigured.

---

## Warnings

### WR-01: `order.rejection_reason` rendered without null guard — displays "Motivo: undefined" when field is absent

**File:** `verdemar/src/pages/buyer/OrderDetail.tsx:142`

**Issue:** When `order.status === 'rejected'` the component renders `{order.rejection_reason}` directly. The type declares `rejection_reason?: string` (optional). If a row was rejected without a reason being set (e.g., by a legacy migration path, or a supplier tool that does not pass a reason), the element renders the literal text "Motivo: undefined".

```tsx
// Current
<p className="text-sm text-red-600">
  Motivo: {order.rejection_reason}
</p>

// Fix
<p className="text-sm text-red-600">
  Motivo: {order.rejection_reason ?? 'Não informado'}
</p>
```

---

### WR-02: Polling interval starts even when `id` is undefined — interval never cleared on that code path

**File:** `verdemar/src/pages/buyer/OrderDetail.tsx:53-64`

**Issue:** The `useEffect` returns early (`if (!id) return`) before setting up the interval, which means the cleanup function is never registered for that branch. React will attempt to call the returned cleanup (`() => { cancelled = true; clearInterval(interval) }`) but the early return yields `undefined` — this is correct. However, the `setInterval` on line 62 is set inside the `load` branch and `interval` is referenced in the closure, which is fine. The real issue is subtler: if `id` is initially `undefined` and later becomes defined, the effect re-runs — but if `id` is always truthy (as guaranteed by the route), the early return is dead code that could mask a future regression if the route becomes optional. More importantly, `load()` at line 61 is called with no error-recovery before the interval starts. If `load()` throws synchronously (not just rejects), the `clearInterval` is never reached.

This is a warning rather than a blocker because `getOrderById` is async and will not throw synchronously in practice. However, the interval should be set up after confirming the initial call, and `setInterval` should be conditional on `!cancelled` to avoid races on fast unmounts:

```typescript
useEffect(() => {
  if (!id) return
  let cancelled = false
  const load = () =>
    getOrderById(id)
      .then((data) => { if (!cancelled) setOrder(data) })
      .catch(() => { if (!cancelled) toast.error('Erro ao carregar pedido') })
      .finally(() => { if (!cancelled) setLoading(false) })

  load()
  const interval = setInterval(() => { if (!cancelled) load() }, 15000)
  return () => { cancelled = true; clearInterval(interval) }
}, [id])
```

---

### WR-03: `@ts-expect-error` suppresses a real type gap — `size` prop is not declared on `OrderStatusBadge` signature

**File:** `verdemar/src/pages/buyer/OrderDetail.tsx:123-125`

**Issue:** The comment claims `size` was "added in Plan 03-03". Looking at `Badge.tsx:33`, `OrderStatusBadge` does accept `size?: 'sm' | 'md'` — so the prop is present. The `@ts-expect-error` comment is therefore incorrect: there is no actual type error to suppress. Using `@ts-expect-error` when there is no error causes TypeScript to emit a new error in `--strict` mode ("Unused '@ts-expect-error' directive"). This will break builds with `noUnusedLocals` / strict TS config and masks the real state of the type definitions.

```tsx
// Remove the suppression comment entirely — the prop is already typed:
<OrderStatusBadge status={order.status} size="md" />
```

---

### WR-04: `useEffect` in `App.tsx` has stale-closure risk — `loadProfile` and `setUser` not in dependency array

**File:** `verdemar/src/App.tsx:166-198`

**Issue:** The `useEffect` on line 166 uses `loadProfile` and `setUser` from `useAuthStore()` but omits them from the dependency array (`}, []`). If either function identity changes between renders (e.g., due to a store re-initialisation), the effect closure captures the stale version. In practice Zustand store actions are stable references, but this is an ESLint `react-hooks/exhaustive-deps` violation that can mask real bugs in future refactors.

```typescript
// Fix — add stable store functions to the dependency array, or extract them
// outside the component with useRef if truly meant to run once:
useEffect(() => {
  // ...
}, [loadProfile, setUser])
```

---

### WR-05: Cart checkout silently proceeds when `buyer` is null — order is created with `null` buyer_id

**File:** `verdemar/src/pages/buyer/Cart.tsx:211-212`

**Issue:** `handleCheckout` guards with `if (!checkoutSection || !buyer) return`, which prevents the API call from being made when `buyer` is null. This is correct. However, the `CheckoutDrawer` can be opened (via `setCheckoutSection(section)`) and displayed to the user even when `buyer` is null. The confirm button in the drawer will call `handleCheckout`, hit the early return silently, and appear to do nothing — the drawer stays open with no feedback. The user has no indication of why the order did not process.

```typescript
// In handleCheckout, add a user-visible error when buyer is missing:
if (!checkoutSection || !buyer) {
  toast.error('Sessão expirada. Faça login novamente.')
  return
}
```

---

## Info

### IN-01: `console.error(err)` left in production code

**File:** `verdemar/src/pages/buyer/Cart.tsx:272`

**Issue:** `console.error(err)` is called inside the checkout catch block. In production this leaks internal error details (including potential stack traces and API response bodies) to the browser console. Use a proper error-reporting integration or remove it.

```typescript
// Remove or replace with a structured logger:
} catch (err) {
  toast.error('Erro ao finalizar pedido. Tente novamente.')
  // console.error(err)  <-- remove before shipping
}
```

---

### IN-02: Magic inline `id: ''` creates a misleading `OrderItem` stub

**File:** `verdemar/src/pages/buyer/Cart.tsx:243-246`

**Issue:** `orderItems` is constructed with `id: ''` as a placeholder. This array is only passed to `formatWhatsAppMessage` which never uses the `id` field, so it is not a runtime bug. However, the empty string silently satisfies the `OrderItem.id: string` type contract, making it unclear whether this is intentional. A named constant or a comment explaining the stub would prevent future misuse (e.g., if `formatWhatsAppMessage` is later modified to include `item.id` in the message).

```typescript
// Add a clarifying comment:
const orderItems = itemsData.map((item) => ({
  ...item,
  id: '',          // stub — id not needed for WhatsApp message formatting
  order_id: order.id,
}))
```

---

### IN-03: `formatDate('')` called with empty string produces "Invalid Date" in the timeline

**File:** `verdemar/src/pages/buyer/OrderDetail.tsx:85`

**Issue:** The fallback timeline entry uses `order.updated_at ?? order.created_at ?? ''`. If both timestamps are absent (possible for rows inserted before the migration that added `created_at`), `formatDate('')` is called. `new Date('')` returns `Invalid Date`, and `Intl.DateTimeFormat.format(Invalid Date)` returns the literal string "Invalid Date" (in V8) or throws in some environments.

```typescript
// In utils/formatDate — guard against empty/invalid input:
export function formatDate(dateString: string): string {
  if (!dateString) return '—'
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', { ... }).format(d)
}

// Or, at the call site:
{ status: order.status, at: order.updated_at ?? order.created_at ?? new Date().toISOString() }
```

---

_Reviewed: 2026-05-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
