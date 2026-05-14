# Phase 02: Supplier Order Flow — Research

**Researched:** 2026-05-14
**Domain:** React 19 + React Router 7 + Supabase (direct client) + Zustand — supplier-side order management UI
**Confidence:** HIGH (all findings are from direct codebase inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Two vertical sections on one page (no tabs): "Pendentes" (`status = 'pending'`) and "Em andamento" (`status = 'confirmed'` or `status = 'in_route'`)
- **D-02:** Orders with `status = 'delivered'`, `'cancelled'` or `'rejected'` do not appear. History is Phase 04.
- **D-03:** `STATUS_TRANSITIONS` uses `in_delivery` — must be updated to `in_route`.
- **D-04:** Badge = count of all orders with `status = 'pending'`. No read/unread tracking.
- **D-05:** Badge on the ClipboardList Orders icon in `SupplierNav` — visible from any screen.
- **D-06:** 15s polling — same project pattern. Badge updates with the list refresh.
- **D-07:** "Recusar" opens a bottom sheet — same pattern as `EditOrderModal`.
- **D-08:** Reason list: Sem estoque, Fora de temporada, Região/dia inválido, Pedido mínimo não atingido, Preço desatualizado, Outro (+ required free-text field).
- **D-09:** "Recusar" button available on `pending` AND `confirmed` orders. Not on `in_route`.
- **D-10:** After rejection: push to buyer (already wired via `sendPushToBuyer`) + WhatsApp toast.
- **D-11:** Push deep-link URL = `/supplier/orders?order=<id>`
- **D-12:** Auto-scroll + expand card when `?order=<id>` is present in URL.
- **D-13:** Fix `api/[...route].ts` line 97: change `url: '/supplier/orders'` to `url: \`/supplier/orders?order=${order.id}\``

### Claude's Discretion

- Visual layout of two sections (divider, section title, spacing) — follow existing app patterns.
- Scroll animation for deep-link — use `scrollIntoView` or equivalent.

### Deferred Ideas (OUT OF SCOPE)

- Partial acceptance (counter-offer quantity) — PART-01/02 in v1.2
- Push reminder after 2h without action on pending order — QOL-03 in v1.2
- Full supplier history — HIST-02 in Phase 04
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SUPP-01 | Supplier sees pending orders list with unread counter | D-04/D-05/D-06: badge via polling; `getOrdersBySupplier` needs status filter + new `getPendingOrderCount` service function |
| SUPP-02 | Supplier accepts order with one tap (no confirm dialog) | Existing `handleUpdateStatus` does `pending → confirmed`; keep behaviour, update label copy |
| SUPP-03 | Supplier rejects order with mandatory reason (preset list + free text) | New `RejectOrderModal` bottom sheet; calls `updateOrderStatus(id, 'rejected', reason)` — signature already correct |
| SUPP-04 | Supplier marks order as "Em rota" | Existing `handleUpdateStatus` does `confirmed → in_route`; update `STATUS_TRANSITIONS` label |
| SUPP-05 | Supplier marks order as "Entregue" | Existing `handleUpdateStatus` does `in_route → delivered`; update `STATUS_TRANSITIONS` label |
| PUSH-01 | Supplier receives push when new order arrives; tap opens the order directly | Fix line 97 of `api/[...route].ts`; SW already handles `data.url`; add deep-link scroll to `Orders.tsx` |
</phase_requirements>

---

## Summary

Phase 02 is a focused extension of the existing `src/pages/supplier/Orders.tsx` page. The existing file already contains the correct shell: expandable cards, `STATUS_TRANSITIONS`, `updateOrderStatus` calls, `EditOrderModal` bottom-sheet pattern, and WhatsApp toast pattern. No new routes, no new services beyond minor additions, no schema changes.

The three main change areas are: (1) restructuring `Orders.tsx` from a flat list to two filtered sections with polling and deep-link handling; (2) adding a `RejectOrderModal` component inside `Orders.tsx` mirroring `EditOrderModal`; and (3) threading the pending count through `SupplierLayout` → `SupplierNav` as a prop.

The push deep-link fix is a one-line change in `api/[...route].ts` line 97.

**Primary recommendation:** Implement as surgical diffs to `Orders.tsx`, `SupplierNav.tsx`, and `api/[...route].ts`. No new files required except the badge sub-component which lives inline. The service layer needs one new function (`getPendingOrderCount`) and a status-filter parameter on the orders query.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Order list display (two sections) | Frontend (React) | — | Client-side filter of already-fetched data |
| Order status transitions | API (Hono) | Frontend (optimistic local state) | State machine enforced server-side; local state synced after success |
| Rejection reason submission | API (Hono) | — | `PATCH /orders/:id/status` already validates `reason` required for `rejected` |
| Pending count badge | Frontend (React) | Supabase direct (count query) | Badge count derived from polling same query or a dedicated count query |
| Push notification deep-link | API (Hono) + SW | Frontend | API builds URL payload; SW routes tap; React reads `?order=` query param |
| 15s polling | Frontend (React) | — | `setInterval` in `useEffect`; no server-push needed |
| Scroll-to-card on deep-link | Browser / Client | — | `scrollIntoView` after DOM paint |

---

## Standard Stack

All libraries already installed. No new dependencies.

### Core (already in project)

| Library | Version | Purpose | Relevant to Phase |
|---------|---------|---------|-------------------|
| React | 19.2.0 | Component rendering | All UI work |
| react-router-dom | 7.13.1 | Routing + `useSearchParams` | Reading `?order=` param |
| Zustand | 5.0.11 | Auth store (`supplier` identity) | `useAuthStore` in `Orders.tsx` |
| sonner | 2.0.7 | Toast notifications | WhatsApp toasts, error toasts |
| lucide-react | 0.577.0 | Icons | `CheckCircle`, `PackageOpen` for empty states |
| @supabase/supabase-js | 2.99.0 | DB queries | `getOrdersBySupplier`, new count query |

[VERIFIED: package.json]

### No New Installations Required

All needed primitives exist. The planner should not add any `npm install` steps.

---

## Architecture Patterns

### Recommended Project Structure

No new files needed at the page level. All new components are inline in `Orders.tsx` (matching `EditOrderModal` precedent). The service layer gets one new exported function.

```
src/
├── pages/supplier/Orders.tsx     — primary change target (~443 lines → ~620 lines)
├── components/layout/SupplierNav.tsx — add pendingCount prop
├── services/supabase.ts          — add getPendingOrderCount()
├── App.tsx                       — SupplierLayout: fetch count, pass to SupplierNav
└── api/[...route].ts             — line 97 one-line fix
```

### Pattern 1: Polling with setInterval

**What:** `useEffect` with `setInterval` for 15s background refresh. Cleanup on unmount.
**When to use:** D-06 mandates this. Supabase Realtime is explicitly out of scope.

```typescript
// Source: project pattern (Dashboard.tsx shows one-shot load; Orders.tsx needs polling added)
useEffect(() => {
  if (!supplier) return
  const load = () => {
    getOrdersBySupplier(supplier.id)
      .then((data) => setOrders(data))
      .catch(() => toast.error('Erro ao carregar pedidos'))
      .finally(() => setLoading(false))
  }
  load()
  const interval = setInterval(load, 15000)
  return () => clearInterval(interval)
}, [supplier])
```

Note: `setLoading(false)` should only fire on the FIRST load. Subsequent polls must update `orders` silently. Use a `hasLoaded` ref or call `setLoading(false)` only when `loading === true`.

[VERIFIED: codebase inspection — no polling yet in Orders.tsx; pattern derived from project conventions]

### Pattern 2: Bottom Sheet (mirror of EditOrderModal)

**What:** Fixed overlay with `justify-end`, white rounded-top sheet, drag handle, backdrop tap to close.
**When to use:** D-07: `RejectOrderModal` must mirror `EditOrderModal` exactly.

Shell (from Orders.tsx lines 104-178 — EditOrderModal):
```tsx
// Source: src/pages/supplier/Orders.tsx — EditOrderModal
<div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={onClose}>
  <div
    className="bg-white rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto"
    onClick={(e) => e.stopPropagation()}
  >
    <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
    {/* content */}
  </div>
</div>
```

### Pattern 3: Per-Card Loading State

**What:** `updating: Record<string, boolean>` keyed by `order.id`; spinner replaces button label.
**When to use:** Every status-change button uses this. Do not add a full-page loading overlay.

```tsx
// Source: src/pages/supplier/Orders.tsx lines 398-402
{isUpdating ? (
  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
) : (
  transition.label
)}
```

### Pattern 4: useSearchParams for Deep-Link

**What:** `useSearchParams` from `react-router-dom` reads `?order=<id>` without mutating the URL.
**When to use:** PUSH-01/D-12 require auto-scroll + card expand when URL contains the param.

```tsx
// Source: src/pages/buyer/Search.tsx line 2 (pattern confirmed in codebase)
import { useSearchParams } from 'react-router-dom'
const [searchParams] = useSearchParams()
const targetOrderId = searchParams.get('order')
```

The deep-link `useEffect` depends on both `orders` (populated after fetch) and `targetOrderId`. Sequence:
1. `setExpanded(prev => ({ ...prev, [targetOrderId]: true }))`
2. 200ms `setTimeout` then `document.getElementById(\`order-card-${targetOrderId}\`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })`
3. Set `highlightedId = targetOrderId`; 1500ms `setTimeout` then `setHighlightedId(null)`

### Pattern 5: WhatsApp Toast Action

**What:** `toast.success(...)` with `action: { label: '💬 Abrir WhatsApp', onClick: () => window.open(url, '_blank') }` and `duration: 15000`.
**When to use:** Every status change (accept, dispatch, deliver, reject). Already used for `EditOrderModal`.

```tsx
// Source: src/pages/supplier/Orders.tsx lines 213-220
toast.success('Status atualizado!', {
  description: 'Toque abaixo para notificar o comprador via WhatsApp.',
  action: {
    label: '💬 Abrir WhatsApp',
    onClick: () => window.open(whatsappUrl, '_blank'),
  },
  duration: 15000,
})
```

For rejection: use `'Pedido recusado.'` as the toast message. The WhatsApp link uses `formatOrderStatusMessage` — but `formatOrderStatusMessage` in `utils/index.ts` does NOT have a case for `'rejected'`. This is a gap that must be addressed (see Pitfalls section).

### Pattern 6: SupplierNav Badge Prop Threading

**What:** `SupplierLayout` in `App.tsx` fetches `pendingCount` via a new service function and passes it as a prop to `SupplierNav`.
**When to use:** D-05: Badge must be visible from any supplier screen.

`SupplierNav` currently accepts no props. The change:
- Add `pendingCount: number` prop to `SupplierNav`
- Wrap the `ClipboardList` icon render in a `relative` div with the badge element
- `SupplierLayout` in `App.tsx` becomes the polling host for count (shares 15s cadence)

**Alternative considered:** Use a Zustand store slice for `pendingCount`. Rejected — too much indirection for a single integer. Prop threading through layout is simpler and matches React Router's layout component pattern already in use.

### Anti-Patterns to Avoid

- **Showing delivered/cancelled/rejected in either section:** D-02 excludes them. Filter at the service layer (add `.in('status', ['pending','confirmed','in_route'])` to `getOrdersBySupplier`).
- **Using STATUS_TRANSITIONS.label directly for button copy:** The existing labels ('Confirmar Pedido', 'Iniciar Entrega', 'Marcar Entregue') do not match UI-SPEC copy ('Aceitar', 'Em rota', 'Entregue'). Update the map.
- **Keeping the `handleCancel` function:** It transitions to `'cancelled'` — a buyer action. Per CONTEXT.md, the supplier action is `'rejected'` via `RejectOrderModal`. The "Cancelar" button in the current UI must be replaced with "Recusar". `handleCancel` can be removed (or kept but never called from supplier UI).
- **Not clearing the setInterval on unmount:** React strict mode double-mounts; missing cleanup causes double polling.
- **Showing a loading spinner during the 15s refresh:** Silent background refresh per UI-SPEC. Only show `<PageLoader />` on initial load.
- **Mutating `loading` state on every poll cycle:** Use a `hasLoaded` ref to guard `setLoading(false)` to first load only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom toast component | `sonner` (already in use) | Edge cases: stacking, dismiss, positioning |
| Bottom sheet | Custom drawer from scratch | Copy `EditOrderModal` shell verbatim | Pattern already tested on iOS Safari |
| Query param parsing | `window.location.search.split('?')` | `useSearchParams` from react-router-dom | Handles encoding, integrates with router lifecycle |
| Push notification routing | Intercept fetch in SW | Existing `notificationclick` handler already routes `data.url` | Already works; only fix is the URL value |
| Pending count query | Count all fetched orders client-side | `getSupplierDashboard` already runs this exact count query — extract it | Avoids over-fetching full order rows just for a count |

**Key insight:** The `getSupplierDashboard` function in `supabase.ts` already runs `supabase.from('orders').select('id', { count: 'exact', head: true }).eq('supplier_id', supplierId).eq('status', 'pending')`. A new `getPendingOrderCount(supplierId)` function can be a thin wrapper around the same query.

---

## Exact Code Analysis (answers to research questions)

### Q1: What exactly needs to change in Orders.tsx?

The existing component has 443 lines. Changes required (diffs, not rewrites):

1. **Imports:** Add `useSearchParams` from `react-router-dom`; add `CheckCircle`, `PackageOpen` from `lucide-react`; add `useRef` from `react`.
2. **`STATUS_TRANSITIONS` map:** Remove `in_delivery` entry (legacy — the type still includes it for backwards compat but the UI should not render the old label). Update labels: `pending.label → 'Aceitar'`, `confirmed.label → 'Em rota'`, `in_route.label → 'Entregue'`.
3. **State additions:** `rejectingOrder: Order | null` (which order's reject sheet is open), `highlightedId: string | null` (for deep-link ring), `hasLoaded: React.MutableRefObject<boolean>`.
4. **`useEffect` (load + polling):** Add `setInterval(load, 15000)`, `return () => clearInterval(interval)`. Guard `setLoading(false)` with `if (!hasLoaded.current)`.
5. **`useEffect` (deep-link):** New effect depending on `[orders, targetOrderId]`; expand + scroll + highlight.
6. **Remove `handleCancel`:** No longer needed in supplier UI.
7. **Add `handleReject(order, reason)`:** Calls `updateOrderStatus(order.id, 'rejected', reason)`, updates local state, shows WhatsApp toast.
8. **Render restructure:** Replace flat `orders.map()` with two filtered sections. Add `SectionHeader`, `EmptyState` per section, `<hr>` divider. Add `id={...}` and highlight ring class to each card wrapper. Replace "Cancelar" button with "Recusar" (opens `RejectOrderModal`). Button layout per `status` (pending: Aceitar+Recusar; confirmed: Em rota+Recusar; in_route: Entregue only — per UI-SPEC).
9. **Header title:** Change `"Pedidos Recebidos"` → `"Pedidos"`.
10. **Add `RejectOrderModal`** component (inline, before `SupplierOrders`).
11. **Add `RejectOrderModal` usage** at bottom of return (parallel to `EditOrderModal`).

[VERIFIED: direct codebase inspection]

### Q2: Does getOrdersBySupplier need a status filter?

Yes. Currently `getOrdersBySupplier` (supabase.ts line 223) fetches ALL orders for a supplier with no status filter, ordered by `created_at DESC`, limit 100. It will return delivered, cancelled, and rejected orders — which D-02 says must not appear in Phase 02.

**Required change:** Add `.in('status', ['pending', 'confirmed', 'in_route'])` to the query. This keeps the limit=100 useful and avoids returning stale terminal-state orders.

```typescript
// Current (line 223-232 of supabase.ts):
export async function getOrdersBySupplier(supplierId: string, limit = 100): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, buyer:buyers(*), items:order_items(*)')
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false })
    .limit(limit)
  // ...
}

// Required change: add before .order():
.in('status', ['pending', 'confirmed', 'in_route'])
```

Note: `in_delivery` (legacy status) does NOT need to be included in this filter. Per D-03, the UI should only handle `in_route`. Old `in_delivery` rows are terminal-state for display purposes — they will be excluded from the active list correctly. [ASSUMED] (no orders with `in_delivery` status currently exist in production — based on Phase 01 migration renaming the status; if legacy rows exist, they would need `in_delivery` included in the filter or a separate migration to update them.)

### Q3: How does SupplierNav work — where to inject the badge?

`SupplierNav` (SupplierNav.tsx, 33 lines) renders a `<nav>` with 4 `NavLink` items via a `navItems` array. Each item renders `<Icon size={22} strokeWidth={2} />` directly.

The badge must wrap only the `ClipboardList` icon. The cleanest approach given the array structure: keep the array for non-orders items, render the orders item specially, OR accept `pendingCount` prop and conditionally wrap the icon in a `relative` div when `to === '/supplier/orders'`.

Recommended: add `pendingCount: number` prop, add conditional render inside the existing `navItems.map()` using `to === '/supplier/orders'` check:

```tsx
// In SupplierNav.tsx
export function SupplierNav({ pendingCount = 0 }: { pendingCount?: number }) {
  // ...
  {to === '/supplier/orders' ? (
    <div className="relative">
      <Icon size={22} strokeWidth={2} />
      {pendingCount > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-danger text-white flex items-center justify-center text-[9px] font-bold leading-none">
          {pendingCount > 9 ? '9+' : pendingCount}
        </span>
      )}
    </div>
  ) : (
    <Icon size={22} strokeWidth={2} />
  )}
```

`SupplierLayout` in `App.tsx` is the caller. It currently renders `<SupplierNav />` with no props. It must: (a) import the new service function, (b) hold `pendingCount` state, (c) poll it on 15s interval, (d) pass it to `<SupplierNav pendingCount={pendingCount} />`.

[VERIFIED: direct codebase inspection]

### Q4: What service function is needed for the badge count?

A new `getPendingOrderCount(supplierId: string): Promise<number>` function in `supabase.ts`:

```typescript
// Source: pattern from getSupplierDashboard (supabase.ts lines 356-360)
export async function getPendingOrderCount(supplierId: string): Promise<number> {
  const { count } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('supplier_id', supplierId)
    .eq('status', 'pending')
  return count || 0
}
```

This exact query already exists inside `getSupplierDashboard`. Extract it as a standalone function.

Alternatively, `SupplierLayout` can derive `pendingCount` from the same `orders` array that `Orders.tsx` fetches — but since `SupplierLayout` wraps all supplier pages (not just Orders), it needs an independent count query for the badge to work on Dashboard, Products, and Settings screens too.

[VERIFIED: getSupplierDashboard in supabase.ts uses this exact query pattern]

### Q5: Is polling already used anywhere in supplier pages?

**No.** Dashboard.tsx (lines 29-43) and Orders.tsx (lines 191-197) both load once in `useEffect` with no `setInterval`. The 15s polling in CONTEXT.md D-06 is not yet implemented anywhere. Phase 02 introduces it for the first time.

[VERIFIED: direct codebase inspection of Orders.tsx and Dashboard.tsx]

### Q6: Current push payload at api/[...route].ts line 97

The current payload (lines 94-98):
```typescript
sendPush(order.supplier_id as string, {
  title: 'Novo pedido recebido!',
  body: `Pedido #${(orderData.id as string).slice(0, 8).toUpperCase()} aguardando confirmação.`,
  url: '/supplier/orders',   // ← line 97: this is the fix target
}).catch(() => {})
```

Required change (D-13):
```typescript
url: `/supplier/orders?order=${orderData.id}`,
```

Note: Also update `title` and `body` to match UI-SPEC copy:
- `title: 'Novo pedido recebido'` (remove exclamation mark per UI-SPEC)
- `body: \`${buyerCompanyName} fez um pedido de R$ ${totalValue}\`` — this requires fetching the buyer's `company_name` at push-send time. The current body only uses `orderData.id`. The `POST /orders` handler does NOT join buyer data — only `order.supplier_id` and `orderData.id` are easily available. [ASSUMED: the UI-SPEC copy requires buyer name, but fetching it adds a DB roundtrip. The planner must decide: either fetch buyer at line ~94, or keep the simpler `Pedido #XXXXX aguardando confirmação` body.]

[VERIFIED: direct codebase inspection of api/[...route].ts lines 94-98]

### Q7: React Router setup — special config needed for ?order= query params?

No special config needed. React Router 7 passes query params through the existing SPA fallback correctly. The service worker's `NavigationRoute` with `createHandlerBoundToURL('index.html')` in `sw.ts` (lines 24-29) handles all navigation routes and will serve `index.html` for `/supplier/orders?order=abc123`.

The `notificationclick` handler in `sw.ts` (lines 63-75) already correctly:
1. Reads `event.notification.data?.url`
2. Checks if an existing window has that URL open with `c.url.includes(url)`
3. Focuses the existing window or opens a new one

The `includes(url)` check at line 70 will match `/supplier/orders?order=abc123` only if the window URL includes the full string. If the supplier already has `/supplier/orders` open, `c.url.includes('/supplier/orders?order=abc123')` will be false and it opens a new window (correct behaviour). No change needed to `sw.ts`.

[VERIFIED: src/sw.ts lines 50-75]

### Q8: TypeScript types that need updating

`src/types/index.ts` already has a comprehensive `OrderStatus` type (lines 3-10):
```typescript
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'in_route'       // v1.1
  | 'in_delivery'    // legacy
  | 'delivered'
  | 'cancelled'
  | 'rejected'       // v1.1
```

All statuses are already present. No type changes needed.

The `Order` interface (line 98-117) already includes `rejection_reason?: string` and `status_history?: StatusHistoryEntry[]` from Phase 01.

`STATUS_TRANSITIONS` in `Orders.tsx` covers all statuses including `in_delivery` and `rejected`. The `rejected` and `delivered` and `cancelled` entries have `next: null` which is correct.

`formatOrderStatusMessage` in `utils/index.ts` has a gap: it handles `confirmed`, `in_delivery`, `delivered`, `cancelled` — but NOT `in_route` (renamed from `in_delivery`) and NOT `rejected`. Two updates needed:
1. Add `in_route` case (copy from `in_delivery` but with the new status name)
2. Add `rejected` case for the WhatsApp toast after rejection

[VERIFIED: src/types/index.ts, src/utils/index.ts]

---

## Common Pitfalls

### Pitfall 1: Loading state on every poll cycle

**What goes wrong:** `setLoading(true)` called on every 15s refresh causes the page to flash `<PageLoader />` every 15 seconds, wiping the card list.
**Why it happens:** Naively copying the existing `useEffect` logic which sets `loading = true` before every fetch.
**How to avoid:** Use a `useRef` guard: `const hasLoaded = useRef(false)`. Set `hasLoaded.current = true` and `setLoading(false)` only on the first successful load. Subsequent polls only call `setOrders(data)`.
**Warning signs:** Page blinks to spinner every 15 seconds during testing.

### Pitfall 2: formatOrderStatusMessage missing 'in_route' and 'rejected'

**What goes wrong:** After supplier taps "Em rota" or "Recusar", the WhatsApp toast fires but `formatOrderStatusMessage` returns the fallback string `"Atualização do seu pedido na ${storeName}: in_route"` instead of a human-readable message.
**Why it happens:** `formatOrderStatusMessage` in `utils/index.ts` only covers `confirmed`, `in_delivery`, `delivered`, `cancelled`. `in_route` and `rejected` are missing.
**How to avoid:** Add both cases to the `messages` map in `formatOrderStatusMessage` before implementing the action handlers.
**Warning signs:** WhatsApp URL contains raw status string in the message.

### Pitfall 3: getOrdersBySupplier returns terminal-state orders

**What goes wrong:** After adding status filter to `getOrdersBySupplier`, any other caller that expects ALL orders (including delivered/cancelled) will get a filtered subset. Currently the only caller is `Orders.tsx` — but check before applying the filter.
**Why it happens:** Shared service function modified without checking all callers.
**How to avoid:** Grep for `getOrdersBySupplier` before modifying. Currently: only one caller in `Orders.tsx`. The filter change is safe. Alternatively, add an optional `activeOnly?: boolean` param to avoid breaking future callers.
**Warning signs:** TypeScript won't catch this — it's a behavioral regression.

### Pitfall 4: Badge count stale on non-Orders screens

**What goes wrong:** User is on Dashboard screen. A new order arrives. Badge doesn't update for 15s because count polling is tied only to `Orders.tsx` mount.
**Why it happens:** If `pendingCount` polling lives inside `Orders.tsx` instead of `SupplierLayout`, it only runs while Orders is mounted.
**How to avoid:** Put the `pendingCount` polling in `SupplierLayout` in `App.tsx`. This component wraps ALL supplier routes and stays mounted during navigation.
**Warning signs:** Badge shows 0 while on Dashboard even when Orders page shows pending items.

### Pitfall 5: Deep-link scroll before DOM paint

**What goes wrong:** `scrollIntoView` is called immediately after `setExpanded` but the card hasn't re-rendered with expanded content yet, so scroll target is at wrong position or has wrong height.
**Why it happens:** State update (expand) and DOM layout happen asynchronously.
**How to avoid:** Add `setTimeout(() => scrollIntoView(...), 200)` as specified in UI-SPEC. The 200ms delay allows React to re-render the expanded card before scrolling.
**Warning signs:** Card scrolls to top of collapsed state rather than full expanded height.

### Pitfall 6: handleCancel left in codebase causes confusion

**What goes wrong:** The existing `handleCancel` function (Orders.tsx lines 231-264) transitions to `'cancelled'`. If accidentally wired to any button, it would let a supplier cancel (buyer-only action). The API would reject it (403), but it's confusing.
**Why it happens:** Refactoring the action buttons while leaving `handleCancel` in place.
**How to avoid:** Remove `handleCancel` entirely. It is a buyer action, not a supplier action.
**Warning signs:** TypeScript won't catch this.

### Pitfall 7: Push body requiring buyer name

**What goes wrong:** UI-SPEC specifies push body `"{buyer.company_name} fez um pedido de R$ {total_value}"`, but the `POST /orders` handler at the push-send site (line ~94) does not have `buyer.company_name` — only `order.supplier_id` and `orderData`.
**Why it happens:** The `POST /orders` endpoint receives `{ order, items }` where `order.buyer_id` is present but buyer details are not joined.
**How to avoid:** Either (a) add a DB query for the buyer name before calling `sendPush`, or (b) use the simpler existing body `"Pedido #XXXXX aguardando confirmação"`. Option (b) is lower risk. The planner must decide.
**Warning signs:** If option (a) is chosen and the query fails, the push fails silently (already wrapped in `.catch(() => {})`).

---

## Code Examples

### Adding status filter to getOrdersBySupplier

```typescript
// Source: src/services/supabase.ts — existing function, add .in() call
export async function getOrdersBySupplier(supplierId: string, limit = 100): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, buyer:buyers(*), items:order_items(*)')
    .eq('supplier_id', supplierId)
    .in('status', ['pending', 'confirmed', 'in_route'])   // ← add this line
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) return []
  return data
}
```

### New getPendingOrderCount function

```typescript
// Source: pattern from getSupplierDashboard (supabase.ts lines 356-360)
export async function getPendingOrderCount(supplierId: string): Promise<number> {
  const { count } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('supplier_id', supplierId)
    .eq('status', 'pending')
  return count || 0
}
```

### SupplierLayout with pendingCount polling (App.tsx)

```tsx
// Source: existing SupplierLayout in App.tsx — add state, polling, pass prop
function SupplierLayout() {
  const { profile, isLoading, supplier } = useAuthStore()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!supplier) return
    const refresh = () => getPendingOrderCount(supplier.id).then(setPendingCount).catch(() => {})
    refresh()
    const interval = setInterval(refresh, 15000)
    return () => clearInterval(interval)
  }, [supplier])

  // ... guard checks ...
  return (
    <div className="flex flex-col h-dvh max-w-lg mx-auto relative">
      <div className="flex-1 overflow-y-auto pb-16">
        <ErrorBoundary><Outlet /></ErrorBoundary>
      </div>
      <SupplierNav pendingCount={pendingCount} />
    </div>
  )
}
```

### Deep-link useEffect in Orders.tsx

```tsx
// Source: project pattern (useSearchParams from Search.tsx + scrollIntoView browser API)
const [searchParams] = useSearchParams()
const targetOrderId = searchParams.get('order')
const [highlightedId, setHighlightedId] = useState<string | null>(null)

useEffect(() => {
  if (!targetOrderId || orders.length === 0) return
  const found = orders.find((o) => o.id === targetOrderId)
  if (!found) return
  setExpanded((prev) => ({ ...prev, [targetOrderId]: true }))
  setTimeout(() => {
    document.getElementById(`order-card-${targetOrderId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
    setHighlightedId(targetOrderId)
    setTimeout(() => setHighlightedId(null), 1500)
  }, 200)
}, [orders, targetOrderId])
```

### STATUS_TRANSITIONS update

```typescript
// Source: src/pages/supplier/Orders.tsx lines 13-21 — updated labels per UI-SPEC
const STATUS_TRANSITIONS: Record<OrderStatus, { label: string; next: OrderStatus | null }> = {
  pending:     { label: 'Aceitar',   next: 'confirmed' },
  confirmed:   { label: 'Em rota',   next: 'in_route' },
  in_route:    { label: 'Entregue',  next: 'delivered' },
  in_delivery: { label: 'Entregue',  next: 'delivered' }, // legacy — keep for type safety
  delivered:   { label: 'Entregue',  next: null },
  cancelled:   { label: 'Cancelado', next: null },
  rejected:    { label: 'Recusado',  next: null },
}
```

### api/[...route].ts line 97 fix

```typescript
// Source: api/[...route].ts line 97 — one-line change
// Before:
url: '/supplier/orders',
// After:
url: `/supplier/orders?order=${orderData.id}`,
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `in_delivery` status | `in_route` status | Phase 01 migration | `STATUS_TRANSITIONS` must use `in_route`; `in_delivery` kept for type compat only |
| No rejection reason | `rejection_reason` column + API validation | Phase 01 | `updateOrderStatus(id, 'rejected', reason)` signature already correct |
| Orders page loads once | Orders page polls 15s | Phase 02 (this phase) | Add `setInterval` in `useEffect` |
| Push URL = `/supplier/orders` | Push URL = `/supplier/orders?order=<id>` | Phase 02 (this phase) | One-line fix in API |

**Deprecated/outdated:**
- `in_delivery` label in `STATUS_TRANSITIONS`: still present in code but should not render in the UI for any new orders. The label `'Iniciar Entrega'` is replaced by `'Em rota'` for `in_route` orders.
- `handleCancel` function in `Orders.tsx`: buyer action mistakenly placed in supplier UI. Remove.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | No `in_delivery` rows exist in production (Phase 01 migrated all status values to `in_route`) | Q2 / getOrdersBySupplier filter | If legacy rows exist, they need `.in('status', ['pending','confirmed','in_route','in_delivery'])` or a data migration; otherwise those orders vanish from the UI |
| A2 | Push body can use the simpler existing format instead of fetching buyer name | Q6 / Push payload | If product requires buyer name in push body, a DB roundtrip is needed in the POST /orders handler |

**Risk level:** A1 is LOW risk (Phase 01 includes a migration that should have renamed all statuses). A2 is a product decision, not a technical risk.

---

## Open Questions

1. **Push notification body — buyer name or order ID?**
   - What we know: UI-SPEC says `"{buyer.company_name} fez um pedido de R$ {total_value}"`. Current code only has `orderData.id` at push-send time.
   - What's unclear: Is adding a buyer-name DB roundtrip in the POST /orders handler acceptable?
   - Recommendation: Use the simpler `"Pedido #XXXXX aguardando confirmação"` body for Phase 02. Richer notification copy is a QOL improvement for a later phase.

2. **Should SupplierLayout also pass pendingCount to Dashboard for the pending-orders stat card?**
   - What we know: `Dashboard.tsx` already shows `data?.pendingCount` from `getSupplierDashboard`. It has its own count.
   - What's unclear: Whether to consolidate or keep two independent count fetches.
   - Recommendation: Keep them independent. Dashboard has its own rich data load; badge count is a separate concern.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 02 is a frontend + one-line API change only. No new external dependencies, runtimes, or services required beyond the existing Supabase connection and Vercel deployment already operational.

---

## Validation Architecture

No `vitest.config.*` found and no test files in `src/`. `package.json` has `"test": "vitest run"` and devDependencies include `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`. Framework is installed but not configured — no `vitest.config.ts` or setup file exists.

Given that no test infrastructure exists and the phase is UI-focused component work, automated testing for Phase 02 is manual-only. The planner should include a Wave 0 task to optionally scaffold vitest config if desired, but it is not a blocker.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Notes |
|--------|----------|-----------|-------|
| SUPP-01 | Pending count badge visible on nav | Manual | PWA UI; automated render test would need jsdom + router setup |
| SUPP-02 | Accept tap → confirmed, toast shown | Manual | Requires live Supabase connection |
| SUPP-03 | Reject with reason → rejected status, reason persisted | Manual | Requires live API |
| SUPP-04 | Em rota button → in_route | Manual | Requires live API |
| SUPP-05 | Entregue button → delivered | Manual | Requires live API |
| PUSH-01 | Tap on push opens correct order card | Manual | Requires PWA install + push subscription |

### Wave 0 Gaps

- No `vitest.config.ts` — no automated tests can run until this is created
- No test files for any supplier page components

*Recommendation: Omit automated test scaffolding from Phase 02 plans. Manual verification is sufficient. Flag for Phase 05 as a dedicated testing wave.*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Not changed — auth flow unchanged |
| V3 Session Management | No | Not changed |
| V4 Access Control | Yes | API already validates actor role in `PATCH /orders/:id/status`; supplier cannot cancel (buyer-only); server enforces |
| V5 Input Validation | Yes | `reason` for rejection: API validates non-empty (`if (newStatus === 'rejected' && !reason?.trim())`); UI validates before submit (button disabled) |
| V6 Cryptography | No | No new cryptographic operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Supplier rejecting another supplier's order | Tampering | `isSupplier` check in API validates `order.supplier_id === userId` |
| Empty rejection reason bypass | Tampering | API rejects with 400; client-side button disabled state is defense-in-depth |
| XSS via rejection reason displayed in buyer UI | Tampering | Stored in DB; rendered in React (JSX escapes by default); no `dangerouslySetInnerHTML` |

No security changes required in Phase 02. All controls are inherited from Phase 01's API implementation.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)

- `src/pages/supplier/Orders.tsx` — existing component structure, patterns, state, handlers
- `src/components/layout/SupplierNav.tsx` — current nav structure, no props accepted
- `src/services/supabase.ts` — `getOrdersBySupplier`, `updateOrderStatus`, `getPendingOrderCount` pattern from `getSupplierDashboard`
- `api/[...route].ts` — push payload at line 97, `sendPush`/`sendPushToBuyer` functions, state machine
- `src/sw.ts` — push event handler, notificationclick handler
- `src/App.tsx` — `SupplierLayout` structure, `<SupplierNav />` rendering location
- `src/stores/authStore.ts` — `supplier` identity in `useAuthStore`
- `src/types/index.ts` — `OrderStatus` type, `Order` interface
- `src/utils/index.ts` — `formatOrderStatusMessage` gap for `in_route` and `rejected`
- `package.json` — vitest installed but no config

### Secondary (MEDIUM confidence)

- `.planning/phases/02-supplier-order-flow/02-CONTEXT.md` — locked decisions D-01 through D-13
- `.planning/phases/02-supplier-order-flow/02-UI-SPEC.md` — visual spec, copy, component details
- `.planning/REQUIREMENTS.md` — SUPP-01..05, PUSH-01 full text

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in package.json
- Architecture: HIGH — all patterns verified by direct code inspection
- Pitfalls: HIGH — identified from actual code gaps (missing formatOrderStatusMessage cases, missing polling, no status filter)
- TypeScript types: HIGH — types/index.ts inspected; all statuses present

**Research date:** 2026-05-14
**Valid until:** 2026-06-14 (stable codebase; no external library churn expected)
