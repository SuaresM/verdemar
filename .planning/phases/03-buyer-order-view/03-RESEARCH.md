# Phase 03: Buyer Order Detail + Confirmation Upgrade - Research

**Researched:** 2026-05-15
**Domain:** React SPA — buyer-facing order UX, polling, vertical timeline, push deep-link
**Confidence:** HIGH

---

## Summary

Phase 03 is a pure frontend phase — no new API endpoints, no schema changes, no new service
functions needed. All server-side infrastructure (push delivery with `/orders/${id}` URL,
`status_history` JSONB append on every status change, `rejection_reason` storage) was established
in Phase 01 and verified complete. The two deliverables are:

1. **New page `src/pages/buyer/OrderDetail.tsx`** at route `/orders/:id` — shows order status,
   vertical timeline, items summary, conditional cancel button, conditional rejection block.
   Uses 15s polling via the existing `getOrderById` service. Lazy-loaded route added to BuyerLayout
   in App.tsx.

2. **Enriched `checkoutSuccess` overlay in `src/pages/buyer/Cart.tsx`** — existing success state
   already holds `{ whatsappUrl, supplierName, orderId }`. The overlay JSX is replaced in-place:
   full-screen scrollable layout, order number, items summary (from `checkoutSection` still in
   closure), delivery slot, "Ver Pedido" secondary button, WhatsApp CTA stays primary and first.

All patterns needed (polling useEffect, OrderStatusBadge, Header+back, PageLoader, EmptyState,
formatCurrency, formatDate, toast) are already present in the codebase and verified by code reads.
The UI-SPEC provides pixel-level Tailwind classes for every component — the planner can reference
it directly. No research outside the codebase was needed for stack decisions.

**Primary recommendation:** Plan as 3 tasks in 2 waves — Wave 1: OrderDetail page (new file); Wave 2 (parallel): Cart overlay enrichment + App.tsx route registration.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** New page `src/pages/buyer/OrderDetail.tsx` at route `/orders/:id`. Added to BuyerLayout in App.tsx as lazy-loaded Route.
- **D-02:** Page shows: Header+back, OrderStatusBadge, vertical timeline (D-05), cancel button when `status === 'pending'` (D-06), rejection reason block when `status === 'rejected'` (D-07), items summary.
- **D-03:** 15s polling via `getOrderById(id)` — same pattern as supplier Orders.tsx. No Supabase Realtime (bug #35195).
- **D-04:** Enrich existing `checkoutSuccess` overlay in Cart.tsx — no new route, no navigate() after checkout. Add order#, items list, delivery slot, "Ver Pedido" button. Keep WhatsApp CTA primary.
- **D-05:** Timeline = vertical dots + connecting line. Uses `status_history: StatusHistoryEntry[]`, newest-first. Fallback to single entry `{ status: order.status, at: order.updated_at ?? order.created_at }` when `status_history` is empty/undefined.
- **D-06:** Cancel button — visible only when `status === 'pending'`, single tap (no confirmation dialog), calls `updateOrderStatus(id, 'cancelled', undefined)`.
- **D-07:** Rejection reason block when `status === 'rejected'` — highlighted block with AlertTriangle icon + "Motivo: {order.rejection_reason}".
- **D-08:** PUSH-02 already wired — `sendPushToBuyer` sends `url: /orders/${orderId}` from Phase 01. No API changes. Only the new `/orders/:id` page needs to exist.

### Claude's Discretion

- Layout visual of timeline (spacing, dot sizes, colors) — follow `OrderStatusBadge` in Badge.tsx for color consistency. (Note: UI-SPEC provides exact Tailwind classes — use them.)
- Scroll to top on OrderDetail mount (avoid inheriting Cart scroll position).
- Toast on fetch error and cancel error.

### Deferred Ideas (OUT OF SCOPE)

- Reorder button on OrderDetail — Phase 04 or unscoped
- Rating/feedback after delivery — v1.2
- Countdown timer for estimated delivery — v1.2
- Pre-delivery push reminder — v1.2
- Full order history with filters — Phase 04
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONF-01 | Comprador vê tela de confirmação com número do pedido após checkout | Overlay enrichment in Cart.tsx lines 437-484; `orderId` already in `checkoutSuccess` state |
| CONF-02 | Confirmação mostra resumo por fornecedor (itens, quantidade, preço unitário, total) | `checkoutSection.items` still in scope when overlay renders; `checkoutSection` cleared BEFORE `checkoutSuccess` is set — CRITICAL finding, see Pitfall 1 |
| CONF-03 | Confirmação mostra janela de entrega agendada por fornecedor | `checkoutSection.deliveryTimePreference` — same closure issue as CONF-02 |
| CONF-04 | Confirmação mostra link "Ver Pedido" que abre detalhes com status atual | `navigate('/orders/${orderId}')` secondary button; OrderDetail page must exist |
| TRACK-01 | Comprador vê status atual do pedido | `OrderStatusBadge` in status card; updated by 15s polling |
| TRACK-02 | Comprador vê histórico de estados com timestamps | Vertical timeline from `status_history[]`; fallback to current status if empty |
| TRACK-03 | Comprador pode cancelar pedido enquanto status = pendente | Cancel button conditional on `status === 'pending'`; calls `updateOrderStatus` |
| TRACK-04 | Comprador vê motivo da recusa quando pedido é recusado | Rejection reason block conditional on `status === 'rejected'` |
| PUSH-02 | Comprador recebe push quando pedido muda de status; tap abre detalhe | Already wired in API (Phase 01 line 453); just needs the `/orders/:id` page to exist |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Order detail display | Browser/Client | — | Read-only fetch + render; no server rendering needed in this SPA |
| 15s polling | Browser/Client | — | `setInterval` in useEffect; same pattern as supplier Orders.tsx |
| Cancel action | API/Backend | Browser/Client | PATCH /orders/:id/status with auth+state machine already in api/[...route].ts |
| Push deep-link routing | Browser/Client (SW) | — | SW `notificationclick` passes `data.url` → BrowserRouter handles `/orders/:id` |
| Confirmation overlay | Browser/Client | — | JSX enrichment only; no server call; reads local state closure |
| Timeline rendering | Browser/Client | — | Pure computation from `status_history[]` JSONB; no new queries |

---

## Standard Stack

### Core — Already in Project

| Library | Verified Version | Purpose | Source |
|---------|-----------------|---------|--------|
| React | 19.x | UI rendering | [VERIFIED: package.json] |
| React Router v6 | 6.x | `useParams`, `useNavigate`, lazy Route | [VERIFIED: App.tsx imports] |
| TypeScript | 5.x | Types — `Order`, `OrderStatus`, `StatusHistoryEntry` | [VERIFIED: tsconfig] |
| Tailwind CSS | 4.x (Vite plugin) | All styling — mobile-first | [VERIFIED: existing components] |
| Sonner | current | `toast.success`, `toast.error` | [VERIFIED: Cart.tsx, Orders.tsx imports] |
| Lucide React | current | `CalendarClock`, `XCircle`, `AlertTriangle`, `PackageOpen` | [VERIFIED: Cart.tsx, Orders.tsx, EmptyState.tsx] |
| Supabase JS | current | `getOrderById` direct query in supabase.ts | [VERIFIED: supabase.ts line 260] |

### No New Dependencies Needed

All libraries, components, services, and utilities required for Phase 03 are already installed
and verified in the codebase. No `npm install` step needed in any plan.

---

## Architecture Patterns

### Recommended Project Structure

```
src/pages/buyer/
├── OrderDetail.tsx          ← NEW (this phase)
├── Cart.tsx                 ← MODIFY: lines 437-484 (checkoutSuccess overlay)
├── OrderHistory.tsx         ← UNCHANGED (reference pattern)
└── ...

src/App.tsx                  ← ADD: lazy import + Route for /orders/:id in BuyerLayout
```

### Pattern 1: Lazy Route Registration (App.tsx)

**What:** Add OrderDetail as a lazy-loaded route inside the existing BuyerLayout block.

**Exact change to App.tsx:**

Add lazy import at top with other buyer lazy imports (line ~22 area):
```typescript
// Source: verified App.tsx lines 18-34
const OrderDetail = lazy(() => import('./pages/buyer/OrderDetail'))
```

Add route inside BuyerLayout block (line ~133 area):
```typescript
// Source: verified App.tsx lines 128-136
<Route path="/orders/:id" element={<OrderDetail />} />
```

The route must be placed before or after `/orders` (the `OrderHistory` route) — React Router v6
matches by specificity so `/orders/:id` and `/orders` coexist without conflict.
[VERIFIED: existing BuyerLayout route block in App.tsx]

### Pattern 2: 15s Polling in OrderDetail

**What:** Load once on mount, then poll every 15s silently. Never show PageLoader on polling
refresh — only during initial `order === null` state.

**Verified pattern from supplier Orders.tsx and App.tsx SupplierLayout:**
```typescript
// Source: verified App.tsx lines 59-67 (SupplierLayout polling)
const [order, setOrder] = useState<Order | null>(null)
const [loading, setLoading] = useState(true)

useEffect(() => {
  if (!id) return
  let cancelled = false
  const fetch = () => getOrderById(id).then((data) => {
    if (!cancelled) setOrder(data)
  }).catch(() => {
    if (!cancelled) toast.error('Erro ao carregar pedido')
  })
  fetch()
  setLoading(false)  // show content after first fetch attempt
  const interval = setInterval(fetch, 15000)
  return () => { cancelled = true; clearInterval(interval) }
}, [id])
```

**Key nuance:** Set `loading = false` after first fetch completes (not on mount), so PageLoader
shows during initial fetch. On subsequent polls, `order` is already non-null, so PageLoader
never re-appears. [VERIFIED: App.tsx polling pattern; ASSUMED: exact variable structure —
adapt based on what looks cleanest]

### Pattern 3: Cancel Action with Race Condition Guard

**What:** Cancel action must clear the poll interval (or guard against race) so a polling
response does not re-render "pending" cancel button after user has tapped.

**Pattern used in Phase 02 Orders.tsx (WR-05 fix):**
- Maintain separate `cancelling` boolean state
- On cancel: set `cancelling = true` → call API → on success: `setOrder(updated)` + toast → set `cancelling = false`
- On poll: the updated `order.status` will be `'cancelled'` after success, so button disappears naturally
- No explicit interval clear needed — polling just reads the new cancelled state

```typescript
// Source: established Orders.tsx pattern
const [cancelling, setCancelling] = useState(false)

const handleCancel = async () => {
  if (!order || cancelling) return
  setCancelling(true)
  try {
    await updateOrderStatus(order.id, 'cancelled', undefined)
    const updated = await getOrderById(order.id)
    setOrder(updated)
    toast.success('Pedido cancelado')
  } catch {
    toast.error('Erro ao cancelar pedido. Tente novamente.')
  } finally {
    setCancelling(false)
  }
}
```

[VERIFIED: updateOrderStatus signature supabase.ts line 235; Orders.tsx pattern verified]

### Pattern 4: Timeline Construction

**What:** Derive `timelineEntries` from `status_history` JSONB with fallback.

```typescript
// Source: D-05 locked decision + UI-SPEC timeline construction logic
const timelineEntries: StatusHistoryEntry[] =
  (order.status_history && order.status_history.length > 0)
    ? [...order.status_history].reverse()   // spread to avoid mutating original
    : [{ status: order.status, at: order.updated_at ?? order.created_at ?? '' }]
```

The `[...arr].reverse()` spread is important — `Array.reverse()` mutates the original array,
which would cause React to not detect the state change on re-render.
[VERIFIED: StatusHistoryEntry interface types/index.ts lines 93-96]

### Pattern 5: checkoutSuccess Overlay Enrichment

**Critical finding:** `clearSection(checkoutSection.supplier.id)` is called BEFORE
`setCheckoutSuccess(...)` in `handleCheckout` (Cart.tsx line 250). This means by the time the
overlay renders, `checkoutSection` from cart store is already cleared.

**Solution already designed in CONTEXT.md D-04 and UI-SPEC:** The overlay reads from the
`checkoutSection` React state variable (local to Cart.tsx, not the cart store), which is set in
`useState` at the top of Cart: `const [checkoutSection, setCheckoutSection] = useState<CartSection | null>(null)`.

Looking at handleCheckout:
- Line 251: `setCheckoutSection(null)` — clears the LOCAL state
- Line 252: `setCheckoutSuccess({ ... })` — sets success state

This means `checkoutSection` local state is also null when the overlay renders.

**Actual fix required:** The overlay needs the items and delivery slot CAPTURED at checkout time,
not read from live state. Two options:
1. Enrich `checkoutSuccess` state to include `items`, `sectionTotal`, `deliveryTimePreference`
   (capture at line 252 before clearing)
2. Read from `checkoutSection` before `setCheckoutSection(null)` and pass to success state

**Option 1 is cleaner and is what the UI-SPEC implies:**
```typescript
// Capture before clearing (handleCheckout, after line 250)
setCheckoutSuccess({
  whatsappUrl,
  supplierName: checkoutSection.supplier.store_name,
  orderId: order.id,
  items: checkoutSection.items,
  sectionTotal: checkoutSection.sectionTotal,
  deliveryTimePreference: checkoutSection.deliveryTimePreference ?? null,
})
```

The `checkoutSuccess` state type must be updated:
```typescript
// Current (Cart.tsx line 165):
{ whatsappUrl: string; supplierName: string; orderId: string }

// New:
{
  whatsappUrl: string
  supplierName: string
  orderId: string
  items: CartSection['items']
  sectionTotal: number
  deliveryTimePreference: string | null
}
```

[VERIFIED: Cart.tsx handleCheckout lines 204-259; checkoutSection cleared at line 251]

### Pattern 6: Push Deep-Link — Auth Guard in OrderDetail

**What:** Push taps from a logged-out or different-role user must be handled gracefully.

**How BuyerLayout already handles it:** BuyerLayout (App.tsx line 36-51) checks `profile.role`.
If `!profile` → redirects to `/login`. If wrong role → redirects to `/supplier/dashboard`.
After login, the user lands at `/` not `/orders/:id` — this means the deep-link is lost after
forced login.

**Acceptable for MVP:** The push notification will only fire when the user has a valid session
(push subscription is tied to user_id). The scenario where a buyer receives a push but is logged
out is rare and acceptable to handle by showing the login page. Post-login navigation is a v1.2
concern.

**"Wrong buyer" case:** `getOrderById` queries `orders` table with RLS — Supabase RLS policies
restrict each buyer to their own orders. If a buyer tries to access another buyer's order,
`getOrderById` will return `null`. The EmptyState handles this case correctly.
[VERIFIED: getOrderById uses supabase client (not admin) in supabase.ts line 260; ASSUMED: RLS
on orders table restricts buyers to own records — verify in Supabase dashboard if needed]

### Pattern 7: OrderStatusBadge — No `size` Prop

**Critical finding:** The UI-SPEC specifies `<OrderStatusBadge status={order.status} size="md" />`,
but the actual `OrderStatusBadge` component signature is:
```typescript
// Verified: Badge.tsx line 33
export function OrderStatusBadge({ status }: { status: OrderStatus })
```

`OrderStatusBadge` does NOT accept a `size` prop — it hardcodes no size and renders `<Badge>`
with default `size="sm"`. The inner `Badge` component accepts `size?: 'sm' | 'md'` (line 3-7).

**Options:**
1. Pass `size` prop through `OrderStatusBadge` (small change to Badge.tsx)
2. Use `<Badge variant={...} size="md">` directly in OrderDetail instead of `OrderStatusBadge`
3. Accept default `size="sm"` — still functional, just smaller badge on detail page

Option 1 is cleanest (one-line prop passthrough). Option 3 is zero-risk if visual weight is acceptable.
[VERIFIED: Badge.tsx full file read]

### Anti-Patterns to Avoid

- **Reading `checkoutSection` store state in the overlay:** The cart store section is cleared before `checkoutSuccess` is set. Read from captured closure values, not live state.
- **Showing PageLoader on every poll tick:** Only show `<PageLoader />` during initial load (`order === null && loading`). Silent refresh after first load.
- **Mutating `status_history` with `.reverse()`:** Always spread first: `[...arr].reverse()`.
- **Using `navigate(-1)` vs `navigate('/orders')` for back:** The Header uses `navigate(-1)` which is correct — works for both push deep-link entry (browser history has a back entry) and in-app navigation. Do not change this.
- **Placing `/orders/:id` inside a nested route of `/orders`:** It should be a sibling route, not a child. App.tsx uses flat routes inside BuyerLayout — match that pattern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Order status display | Custom status chip | `OrderStatusBadge` in Badge.tsx | Already has all 7 statuses with correct PT-BR labels and colors |
| Date formatting | Custom formatter | `formatDate(dateString)` in utils/index.ts | Uses Intl.DateTimeFormat pt-BR with day/month/year/hour/minute — exactly what timeline needs |
| Currency display | Custom formatter | `formatCurrency(value)` in utils/index.ts | BRL formatting with Intl.NumberFormat |
| Loading full page | Custom spinner | `<PageLoader />` from LoadingSpinner.tsx | Matches all other pages in the app |
| Empty/not-found state | Custom empty UI | `<EmptyState>` from EmptyState.tsx | Has title, description, icon, action slots |
| Back navigation header | Custom back button | `<Header showBack title="..." />` | Already has ArrowLeft + navigate(-1) + aria-label |
| Push delivery | Custom web-push | Already done — api/[...route].ts sendPushToBuyer | Phase 01 wired, unconditional on every PATCH |
| Status colors for timeline | Custom color map | UI-SPEC `STATUS_DOT_CLASSES` constant | Derived from OrderStatusBadge variants — maintains visual consistency |

---

## Common Pitfalls

### Pitfall 1: checkoutSection is null when overlay renders
**What goes wrong:** Developer reads `checkoutSection.items` inside the `checkoutSuccess` overlay,
gets a null reference crash — because `setCheckoutSection(null)` runs before `setCheckoutSuccess`.
**Why it happens:** handleCheckout clears the checkout drawer state (line 251) before setting
success state (line 252). Both are in the same try block.
**How to avoid:** Capture `items`, `sectionTotal`, and `deliveryTimePreference` inside
`checkoutSuccess` state object at the moment of checkout (before clearing). Update the state type.
**Warning signs:** TypeScript will warn if you access `checkoutSection?.items` inside the overlay
conditional — if `checkoutSection` is nullable and not narrowed, it's a red flag.
[VERIFIED: Cart.tsx handleCheckout lines 250-252]

### Pitfall 2: status_history may be empty [] or undefined on legacy orders
**What goes wrong:** `.reverse()` on undefined throws; `[].reverse()` returns empty array,
timeline shows nothing.
**Why it happens:** Rows created before Phase 01 migration have no `status_history` JSONB value.
**How to avoid:** Always use the fallback:
```typescript
const entries = (order.status_history?.length ?? 0) > 0
  ? [...order.status_history!].reverse()
  : [{ status: order.status, at: order.updated_at ?? order.created_at ?? '' }]
```
[VERIFIED: Order interface types/index.ts line 112 — `status_history?: StatusHistoryEntry[]`]

### Pitfall 3: OrderStatusBadge missing size prop
**What goes wrong:** UI-SPEC says `size="md"` but the component doesn't accept it — prop silently
ignored (TypeScript error in strict mode), renders `size="sm"`.
**Why it happens:** OrderStatusBadge wraps Badge but doesn't forward `size`.
**How to avoid:** Either add size passthrough to OrderStatusBadge, or use Badge directly with
explicit variant on the detail page.
[VERIFIED: Badge.tsx — OrderStatusBadge has no size prop]

### Pitfall 4: `in_delivery` status — legacy value
**What goes wrong:** STATUS_DOT_CLASSES or STATUS_LABELS_PT missing `in_delivery` key causes
runtime key-miss (returns `undefined` Tailwind class → no styling or error).
**Why it happens:** `in_delivery` is the legacy alias for `in_route` — both are valid OrderStatus
values in the type union.
**How to avoid:** Include `in_delivery` in all Record<OrderStatus, ...> constants. UI-SPEC already
accounts for this — copy the constants verbatim.
[VERIFIED: types/index.ts OrderStatus union (implicitly — in_delivery appears in Orders.tsx STATUS_TRANSITIONS)]

### Pitfall 5: Polling cleanup on unmount
**What goes wrong:** User navigates away; interval continues firing; setOrder called on unmounted
component → React warning (non-fatal in React 18+ but noisy); or stale order data re-appears.
**Why it happens:** `clearInterval` not called on cleanup.
**How to avoid:** Return cleanup from useEffect:
```typescript
return () => clearInterval(interval)
```
[VERIFIED: App.tsx SupplierLayout useEffect line 67 returns clearInterval]

### Pitfall 6: pb-24 missing — content hidden under bottom nav
**What goes wrong:** Last item (cancel button) is hidden behind the BuyerNav on iOS.
**Why it happens:** BuyerNav is `fixed bottom-0` with `h-16` (64px) plus iOS home indicator.
**How to avoid:** Use `pb-24` on the scroll container (matches existing pages). UI-SPEC specifies
this explicitly.
[VERIFIED: BuyerLayout wraps Outlet in `pb-16` div but inner pages can add more — see OrderHistory pattern]

---

## Code Examples

All examples are verified against the actual codebase.

### Complete OrderDetail.tsx Skeleton

```typescript
// src/pages/buyer/OrderDetail.tsx
// Source: verified against all referenced patterns

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { CalendarClock, XCircle, AlertTriangle, PackageOpen } from 'lucide-react'
import { getOrderById, updateOrderStatus } from '../../services/supabase'
import type { Order, OrderStatus, StatusHistoryEntry } from '../../types'
import { Header } from '../../components/layout/Header'
import { OrderStatusBadge } from '../../components/shared/Badge'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { EmptyState } from '../../components/shared/EmptyState'
import { formatCurrency, formatDate } from '../../utils'

// Inline constants — see UI-SPEC for complete values
const STATUS_DOT_CLASSES: Record<OrderStatus, string> = { ... }
const STATUS_LABEL_CLASSES: Record<OrderStatus, string> = { ... }
const STATUS_LABELS_PT: Record<OrderStatus, string> = { ... }

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const load = () =>
      getOrderById(id)
        .then((data) => { if (!cancelled) setOrder(data) })
        .catch(() => { if (!cancelled) toast.error('Erro ao carregar pedido') })
        .finally(() => { if (!cancelled) setLoading(false) })
    load()
    const interval = setInterval(load, 15000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [id])

  const handleCancel = async () => { ... }

  const timelineEntries: StatusHistoryEntry[] =
    order && order.status_history?.length
      ? [...order.status_history].reverse()
      : order
      ? [{ status: order.status, at: order.updated_at ?? order.created_at ?? '' }]
      : []

  if (loading && !order) return <PageLoader />
  if (!order) return <EmptyState ... />

  return (
    <div className="min-h-screen bg-background">
      <Header title="Detalhe do Pedido" showBack />
      <div className="px-4 py-4 space-y-4 pb-24">
        {/* status card, rejection block, items card, timeline card, cancel button */}
      </div>
    </div>
  )
}
```

### checkoutSuccess State Type Expansion

```typescript
// Cart.tsx — update line 165
const [checkoutSuccess, setCheckoutSuccess] = useState<{
  whatsappUrl: string
  supplierName: string
  orderId: string
  items: CartSection['items']
  sectionTotal: number
  deliveryTimePreference: string | null
} | null>(null)
```

### checkoutSuccess State Capture (handleCheckout)

```typescript
// Cart.tsx handleCheckout — replace lines 252 (after clearSection call)
// Capture BEFORE clearing checkoutSection local state
const capturedItems = checkoutSection.items
const capturedTotal = checkoutSection.sectionTotal
const capturedSlot = checkoutSection.deliveryTimePreference ?? null

clearSection(checkoutSection.supplier.id)
setCheckoutSection(null)
setCheckoutSuccess({
  whatsappUrl,
  supplierName: checkoutSection.supplier.store_name,
  orderId: order.id,
  items: capturedItems,
  sectionTotal: capturedTotal,
  deliveryTimePreference: capturedSlot,
})
```

### "Ver Pedido" Button

```typescript
// Cart.tsx overlay — secondary CTA
<button
  onClick={() => {
    setCheckoutSuccess(null)
    setWhatsappOpened(false)
    navigate(`/orders/${checkoutSuccess.orderId}`)
  }}
  className="w-full py-3 border border-primary/30 text-primary font-bold
             rounded-2xl text-sm active:bg-primary/5 transition-colors"
>
  Ver Pedido
</button>
```

---

## Runtime State Inventory

> This is not a rename/refactor phase. Section omitted — not applicable.

---

## Environment Availability

> This phase is purely frontend (TypeScript + React) with no new external dependencies.
> All tooling (Node, npm, Vite) was verified as functional during Phase 02 execution.
> Step 2.6: SKIPPED (no new external dependencies identified).

---

## State of the Art

| Old Approach (pre-Phase 03) | New Approach (Phase 03) | Impact |
|-----------------------------|-------------------------|--------|
| `checkoutSuccess` overlay: basic, no order details, "Ver meus pedidos" disabled until WhatsApp | Enriched overlay: order#, items, delivery slot, "Ver Pedido" always enabled | CONF-01..04 satisfied |
| No `/orders/:id` route — push notification opens app at `/` | `/orders/:id` route exists — push deep-link lands on correct order | PUSH-02 satisfied end-to-end |
| Order status visible only in OrderHistory list (collapsed) | Dedicated detail page with badge + vertical timeline | TRACK-01..04 satisfied |

---

## Open Questions

1. **OrderStatusBadge size prop**
   - What we know: `OrderStatusBadge` does not accept `size`; Badge does; UI-SPEC calls for `size="md"` on detail page.
   - What's unclear: Whether the planner should add `size` passthrough to `OrderStatusBadge` or use `Badge` directly in OrderDetail.
   - Recommendation: Add `size?: 'sm' | 'md'` prop to OrderStatusBadge and forward to Badge — one-line change, keeps component consistent with all future callers. If planner wants minimal diff, use Badge directly with explicit variant.

2. **RLS policy for buyer order access**
   - What we know: `getOrderById` uses the Supabase client (user JWT), not admin. Supabase RLS should restrict buyers to `buyer_id = auth.uid()`.
   - What's unclear: Whether the RLS policy for `SELECT` on orders was explicitly set to restrict by buyer_id in Phase 01 migrations.
   - Recommendation: The EmptyState + null-return from `getOrderById` already handles unauthorized access safely. A buyer seeing a null result instead of a 403 is acceptable for MVP. No blocking concern.

3. **`formatDate` precision for timeline timestamps**
   - What we know: `formatDate` outputs `dd/mm/yyyy HH:mm` (day, month, year, hour, minute via Intl.DateTimeFormat). `StatusHistoryEntry.at` is ISO 8601.
   - What's unclear: Whether seconds precision is desired for timeline entries.
   - Recommendation: `HH:mm` is sufficient for a produce delivery app. Use `formatDate` as-is.

---

## Validation Architecture

> No config.json found — treating nyquist_validation as enabled (absent = enabled).

### Test Framework

This project has no test infrastructure detected.

| Property | Value |
|----------|-------|
| Framework | None detected (no jest.config, vitest.config, or test directories found) |
| Config file | None |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| CONF-01 | Order number shown in overlay | manual-only | — | No test framework; verify in browser |
| CONF-02 | Items summary shown in overlay | manual-only | — | |
| CONF-03 | Delivery slot shown in overlay | manual-only | — | |
| CONF-04 | "Ver Pedido" navigates to `/orders/:id` | manual-only | — | |
| TRACK-01 | Status badge displayed and polled | manual-only | — | |
| TRACK-02 | Timeline renders with status history | manual-only | — | |
| TRACK-03 | Cancel button visible/hidden by status | manual-only | — | |
| TRACK-04 | Rejection reason block conditional | manual-only | — | |
| PUSH-02 | Push tap navigates to order detail | manual-only | — | Requires PWA installed on device |

### Wave 0 Gaps

None — no test framework exists in this project. All validation is manual UAT (consistent with
Phases 01 and 02 which documented human UAT items in separate HUMAN-UAT.md files).

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | BuyerLayout redirect handles unauthenticated access |
| V3 Session Management | No | Supabase JWT managed by existing auth store |
| V4 Access Control | Yes (minor) | `getOrderById` via Supabase client — RLS restricts to own orders; cancel action goes through API which validates actor role (Phase 01 API-01) |
| V5 Input Validation | No | Read-only display page; cancel has no input fields |
| V6 Cryptography | No | No new crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Buyer accesses another buyer's order via URL manipulation | Information disclosure | Supabase RLS on SELECT; `getOrderById` returns null → EmptyState shown |
| Buyer calls cancel on non-pending or non-owned order | Tampering | API state machine in api/[...route].ts (Phase 01 API-01): validates actor role and allowed transition; returns 403/400 |
| Push notification URL manipulated to arbitrary route | Spoofing | Push payload URL is `/orders/${orderId}` — controlled by server (api/[...route].ts line 453); client only follows the URL, does not execute it |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | RLS on `orders` table restricts SELECT to `buyer_id = auth.uid()` — so `getOrderById` returns null for wrong-owner access | Open Questions #2, Security | Low: even if RLS allows cross-buyer reads, OrderDetail renders whatever data it gets; no PII exposure beyond what buyer could already GET via direct Supabase client call. Fix: verify RLS in Supabase dashboard |
| A2 | `CartSection['items']` type is compatible with overlay render (has `product.id`, `product.name`, `quantity`, `subtotal` fields) | Code Examples — checkoutSuccess capture | Medium: if CartSection items shape differs from OrderItem, the overlay render may crash. Fix: verify CartSection type in types/index.ts before implementing |
| A3 | `in_delivery` is in the OrderStatus union | Pitfall 4 | Low: if missing, TypeScript will error on STATUS_DOT_CLASSES Record key. Already appears in Orders.tsx STATUS_TRANSITIONS — low risk |

---

## Sources

### Primary (HIGH confidence)

- [VERIFIED: src/pages/buyer/Cart.tsx lines 158-487] — checkoutSuccess state shape, handleCheckout flow, overlay JSX
- [VERIFIED: src/App.tsx lines 1-145] — BuyerLayout, existing routes, lazy import pattern, 15s polling pattern
- [VERIFIED: src/services/supabase.ts lines 235-268] — updateOrderStatus signature, getOrderById implementation
- [VERIFIED: src/types/index.ts lines 93-117] — StatusHistoryEntry, Order interface, all fields
- [VERIFIED: src/components/shared/Badge.tsx] — OrderStatusBadge (no size prop), Badge (has size prop)
- [VERIFIED: src/components/layout/Header.tsx] — Header props, showBack behavior
- [VERIFIED: src/components/shared/EmptyState.tsx] — EmptyState component API
- [VERIFIED: src/components/shared/LoadingSpinner.tsx] — PageLoader implementation
- [VERIFIED: src/utils/index.ts] — formatCurrency, formatDate, formatOrderStatusMessage
- [VERIFIED: src/pages/supplier/Orders.tsx lines 1-22] — imports pattern, STATUS_TRANSITIONS reference
- [VERIFIED: src/pages/buyer/OrderHistory.tsx lines 1-38] — import pattern, polling-free (one-shot fetch)
- [VERIFIED: api/[...route].ts lines 155-172, 440-455] — sendPushToBuyer with url:/orders/${id}, status_history append
- [VERIFIED: .planning/phases/03-buyer-order-view/03-CONTEXT.md] — all locked decisions
- [VERIFIED: .planning/phases/03-buyer-order-view/03-UI-SPEC.md] — pixel-level Tailwind classes, all copy, state machine

### Secondary (MEDIUM confidence)

- [CITED: .planning/STATE.md] — 15s polling established in Phase 02; no Supabase Realtime

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in codebase
- Architecture: HIGH — patterns verified against actual source files
- Pitfalls: HIGH — all identified from direct code reads, not assumptions
- Cart overlay closure bug: HIGH — verified exact line order in handleCheckout

**Research date:** 2026-05-15
**Valid until:** 2026-06-15 (stable codebase; no fast-moving external dependencies)
