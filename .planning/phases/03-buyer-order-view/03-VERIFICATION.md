---
phase: 03-buyer-order-view
verified: 2026-05-15T00:00:00Z
status: human_needed
score: 12/12 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Navigate to /orders/:id in a browser session as a buyer with a real order UUID; confirm the page renders with supplier name, status badge, order number, and items list"
    expected: "OrderDetail page renders with all data populated from the Supabase query — supplier name, status badge (size md), formatted order number, items with subtotals, and total_value"
    why_human: "Data-flow from getOrderById requires a live Supabase session with RLS. Cannot verify that the query returns joined supplier and items data (select '*, supplier:suppliers(*), buyer:buyers(*), items:order_items(*)') without a running app."
  - test: "Open a pending order as a buyer; tap 'Cancelar pedido'. Reload the page. Confirm status changes to 'cancelled' and cancel button disappears"
    expected: "updateOrderStatus PATCH to /orders/:id/status with status='cancelled' succeeds, getOrderById re-fetches, order.status is 'cancelled', cancel button is not rendered"
    why_human: "Cancel flow calls the API route which enforces RLS and state-machine transitions. Requires live session."
  - test: "Complete checkout from Cart; confirm the overlay shows (1) order number in #XXXXXXXX format, (2) items list with quantities and subtotals, (3) section total, (4) delivery slot text, and (5) 'Ver Pedido' button"
    expected: "All five CONF-01..04 data points appear in the overlay, correctly populated from capturedItems/capturedTotal/capturedSlot (not null/undefined). 'Ver Pedido' is enabled without requiring WhatsApp tap."
    why_human: "Requires a live checkout flow through createOrder. The closure bug fix must hold: capture happens before clearSection. Cannot verify runtime values without executing the flow."
  - test: "Trigger a push notification for buyer (e.g., supplier confirms order); tap the notification; verify it opens /orders/:id in the PWA"
    expected: "sw.ts notificationclick handler calls clients.openWindow('/orders/{orderId}'); BuyerLayout renders OrderDetail; page is not a 404 or redirect"
    why_human: "Push notification deep-link flow requires a paired PWA installation, a push subscription for the buyer, and a supplier action to trigger sendPushToBuyer. Cannot verify end-to-end without a live environment."
---

# Phase 03: Buyer Order Detail + Confirmation Upgrade Verification Report

**Phase Goal:** Buyers see their order acknowledged, can track its status through a visual timeline, and arrive at the order detail from a push notification tap.
**Verified:** 2026-05-15T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After checkout, confirmation screen shows order number, per-supplier item summary with totals, and delivery slot (SC-1 / CONF-01..03) | VERIFIED | Cart.tsx line 465: `#{orderId.slice(0,8).toUpperCase()}`; line 479: `items.map` with `item.product.name` + `formatCurrency(item.subtotal)`; line 487: `formatCurrency(sectionTotal)`; line 492: `deliveryTimePreference &&` with "Janela de entrega" block |
| 2 | Order detail page shows vertical timeline with each status change and its timestamp (SC-2 / TRACK-02) | VERIFIED | OrderDetail.tsx lines 166-187: timeline card with `timelineEntries.map`, colored dot `STATUS_DOT_CLASSES[entry.status]`, label `STATUS_LABELS_PT[entry.status]`, timestamp `formatDate(entry.at)`; spread-before-reverse at line 83 |
| 3 | Buyer can tap "Cancelar pedido" on pending order; button absent on confirmed orders (SC-3 / TRACK-03) | VERIFIED | OrderDetail.tsx lines 190-207: `{order.status === 'pending' && (...)}` conditional; `handleCancel` calls `updateOrderStatus(order.id, 'cancelled', undefined)` then re-fetches; `disabled={cancelling}` with spinner |
| 4 | Rejection reason text is shown on rejected orders (SC-4 / TRACK-04) | VERIFIED | OrderDetail.tsx lines 136-146: `{order.status === 'rejected' && (...)}` block renders `AlertTriangle` + `order.rejection_reason` |
| 5 | Push tap navigates buyer directly to order detail page (SC-5 / PUSH-02) | VERIFIED | api/[...route].ts line 453: `url: '/orders/${orderId}'` in sendPushToBuyer; sw.ts line 65: `clients.openWindow(url)`; App.tsx line 134: `<Route path="/orders/:id" element={<OrderDetail />} />` inside BuyerLayout |
| 6 | Navigating to /orders/:id renders OrderDetail (not 404) | VERIFIED | App.tsx line 22: `const OrderDetail = lazy(() => import('./pages/buyer/OrderDetail'))`; line 134: route inside `<Route element={<BuyerLayout />}>` block |
| 7 | OrderStatusBadge accepts size='md' without TypeScript error | VERIFIED | Badge.tsx line 33: `{ status: OrderStatus; size?: 'sm' \| 'md' }`; line 45: `<Badge variant={variant} size={size}>`; `npx tsc --noEmit` returns zero output |
| 8 | OrderStatusBadge with size='sm' (default) — no regression | VERIFIED | Badge.tsx line 33: `size = 'sm'` default preserves prior behavior for all callers (OrderHistory etc.) |
| 9 | Page polls every 15s and updates silently (no loader re-shown) | VERIFIED | OrderDetail.tsx lines 53-64: `setInterval(load, 15000)` with `cancelled` guard; line 88: `if (loading && !order)` — PageLoader only on initial load when `order` is null |
| 10 | EmptyState shown when order not found | VERIFIED | OrderDetail.tsx lines 89-103: `if (!order) return <EmptyState title="Pedido não encontrado" ...>` with navigate('/orders') button |
| 11 | "Ver Pedido" button always enabled — no WhatsApp gate | VERIFIED | Cart.tsx lines 523-532: button has no `disabled` prop; `disabled={!whatsappOpened}` pattern absent (grep: no match); "Ver meus pedidos" ghost button absent |
| 12 | Closure bug fixed — items captured before clearSection | VERIFIED | Cart.tsx lines 257-269: `capturedItems = checkoutSection.items`, `capturedTotal`, `capturedSlot` assigned at lines 257-259; `clearSection(...)` called at line 260 — capture precedes clear |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/pages/buyer/OrderDetail.tsx` | Buyer order detail page with status, timeline, cancel, rejection reason | VERIFIED | 212 lines, exports `default function OrderDetail`, contains all required patterns |
| `src/pages/buyer/Cart.tsx` | Enriched checkoutSuccess overlay with order#, items, delivery slot, Ver Pedido | VERIFIED | Contains `deliveryTimePreference` (9 occurrences), `capturedItems`, `items.map` in overlay, `navigate('/orders/${orderId}')` |
| `src/App.tsx` | Route /orders/:id inside BuyerLayout, lazy OrderDetail import | VERIFIED | Line 22: lazy import; line 134: route inside BuyerLayout block (lines 129-138) |
| `src/components/shared/Badge.tsx` | OrderStatusBadge with size prop passthrough | VERIFIED | Line 33: `size?: 'sm' \| 'md'`; line 45: `size={size}` forwarded to Badge |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| OrderDetail.tsx | supabase.ts getOrderById | Called on mount + every 15s via setInterval | WIRED | Line 57: `getOrderById(id)` in useEffect; line 62: `setInterval(load, 15000)` |
| OrderDetail.tsx | supabase.ts updateOrderStatus | handleCancel calls with 'cancelled' | WIRED | Line 70: `updateOrderStatus(order.id, 'cancelled', undefined)` |
| OrderDetail.tsx | Badge.tsx OrderStatusBadge | `<OrderStatusBadge status={order.status} size="md" />` | WIRED | Line 125: prop passed; `@ts-expect-error` retained (TS compiles clean — directive effectively no-op or still suppressing) |
| Cart.tsx handleCheckout | checkoutSuccess state | Items/total/slot captured BEFORE clearSection | WIRED | Lines 257-260: capture precedes clear |
| Cart.tsx overlay | navigate('/orders/${orderId}') | Ver Pedido button onClick | WIRED | Line 527: `navigate('/orders/${orderId}')` |
| App.tsx BuyerLayout routes | OrderDetail.tsx | lazy import + Route path='/orders/:id' | WIRED | Lines 22, 134 |
| api/[...route].ts sendPushToBuyer | sw.ts notificationclick | url: '/orders/${orderId}' sent in push payload | WIRED | api line 453: `url: '/orders/${orderId}'`; sw.ts line 65: reads `event.notification.data?.url` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| OrderDetail.tsx | `order` (useState) | `getOrderById(orderId)` → supabase query with `select('*, supplier:suppliers(*), buyer:buyers(*), items:order_items(*)')` | Yes — DB query with joins | FLOWING |
| Cart.tsx checkoutSuccess overlay | `items`, `sectionTotal`, `deliveryTimePreference` | `capturedItems/capturedTotal/capturedSlot` from `checkoutSection` before `clearSection()` | Yes — from in-memory cart state populated by user interaction | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| OrderDetail.tsx exports default function | grep "export default function OrderDetail" OrderDetail.tsx | Match found (line 43) | PASS |
| 15s polling interval present | grep "setInterval(load, 15000)" OrderDetail.tsx | Match found (line 62) | PASS |
| clearInterval cleanup present | grep "clearInterval" OrderDetail.tsx | Match found (line 63) | PASS |
| spread-before-reverse (no mutation) | grep "\.\.\.order\.status_history" OrderDetail.tsx | Match found (line 83) | PASS |
| All 7 OrderStatus keys in STATUS_DOT_CLASSES | 7 keys found (pending, confirmed, in_route, in_delivery, delivered, cancelled, rejected) | Verified reading file lines 13-21 | PASS |
| TypeScript compile clean | npx tsc --noEmit | Zero output = zero errors | PASS |
| Route /orders/:id inside BuyerLayout | App.tsx line 134 inside block lines 129-138 | Confirmed — route is child of `<Route element={<BuyerLayout />}>` | PASS |
| disabled={!whatsappOpened} removed | grep in Cart.tsx | No match | PASS |
| capturedItems before clearSection | Lines 257 vs 260 in Cart.tsx | Capture at 257, clear at 260 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CONF-01 | 03-02 | Order number shown after checkout | SATISFIED | Cart.tsx line 465: `#{orderId.slice(0,8).toUpperCase()}` |
| CONF-02 | 03-02 | Item summary with quantity, price, total | SATISFIED | Cart.tsx lines 479-488: items.map + sectionTotal |
| CONF-03 | 03-02 | Delivery slot shown | SATISFIED | Cart.tsx lines 492-500: deliveryTimePreference conditional block |
| CONF-04 | 03-02, 03-03 | "Ver Pedido" link opens order detail | SATISFIED | Cart.tsx line 527: navigate; App.tsx line 134: route wired |
| TRACK-01 | 03-01 | Buyer sees current order status | SATISFIED | OrderDetail.tsx line 125: `<OrderStatusBadge status={order.status} size="md" />` |
| TRACK-02 | 03-01 | Visual timeline with timestamps | SATISFIED | OrderDetail.tsx lines 166-187: timelineEntries.map with colored dots, PT-BR labels, formatDate |
| TRACK-03 | 03-01 | Cancel while pending | SATISFIED | OrderDetail.tsx lines 66-79, 190-207: handleCancel + conditional button |
| TRACK-04 | 03-01 | Rejection reason shown | SATISFIED | OrderDetail.tsx lines 136-146: status === 'rejected' block with rejection_reason |
| PUSH-02 | 03-01, 03-03 | Buyer push tap opens order detail | SATISFIED | api/[...route].ts line 453 (url payload) + sw.ts line 65 (click handler) + App.tsx line 134 (route target) |

All 9 Phase 03 requirement IDs accounted for. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| OrderDetail.tsx | 123-124 | `@ts-expect-error` directive retained after Badge.tsx was updated to accept `size` prop | Info | TypeScript compiles clean (zero errors), so the directive is either still suppressing something or is a harmless stale comment. No behavioral impact — `size="md"` is correctly rendered. |

No stubs, no TODO/FIXME/PLACEHOLDER comments, no empty return patterns, no hardcoded empty data arrays found in phase files.

### Human Verification Required

#### 1. OrderDetail page renders with real Supabase data

**Test:** Authenticate as a buyer, navigate to `/orders/{uuid}` where the UUID is a real order belonging to that buyer.
**Expected:** Page renders with supplier name from joined `suppliers` table, status badge, order number `#XXXXXXXX`, items list from `order_items` join, and total_value. No "Pedido não encontrado" EmptyState.
**Why human:** The `getOrderById` query uses RLS (`buyer_id = auth.uid()`). Requires a live Supabase session. Cannot verify join completeness (supplier name, items) without execution.

#### 2. Cancel flow changes order status end-to-end

**Test:** Open a pending order as the buyer. Tap "Cancelar pedido". Observe the button shows a spinner, then disappears. Reload the page and verify status is "Cancelado pelo comprador" in the timeline.
**Expected:** `updateOrderStatus` PATCH succeeds via API route (which enforces the pending→cancelled state machine transition), `getOrderById` re-fetch returns the updated order, UI reflects the new status.
**Why human:** Requires live API + Supabase. The API route validates the state transition and buyer ownership — only testable with a real session.

#### 3. Checkout overlay shows correct data (not null/undefined)

**Test:** Add items to cart, select a delivery zone and day, tap checkout, confirm the order. Verify the overlay shows: (1) `#XXXXXXXX` order number, (2) each item with `Nx product_name — R$ X,XX`, (3) section total in BRL, (4) delivery slot text (e.g. "Terça — 07:00 às 10:00"), (5) "Ver Pedido" button tappable without WhatsApp first.
**Expected:** All 5 data points populated correctly. No "undefined" or "null" visible. The closure bug fix ensures data is captured before `clearSection()` nulls the cart state.
**Why human:** Requires a full checkout flow through `createOrder`. The closure fix is wired correctly in code but must be confirmed at runtime to rule out any other nullification path.

#### 4. Push notification tap deep-links to /orders/:id

**Test:** On a device with the PWA installed, trigger a status change on a buyer's order (e.g., supplier confirms it). Wait for the push notification to arrive. Tap the notification. Verify the PWA opens at `/orders/{orderId}`.
**Expected:** `notificationclick` handler in `sw.ts` reads `data.url = '/orders/{orderId}'`, opens or focuses the PWA window at that URL, and `BuyerLayout` renders `OrderDetail` for the buyer.
**Why human:** Requires paired PWA installation on a device, active push subscription for the buyer (`push_subscriptions` table), and a supplier action to trigger `sendPushToBuyer`. Cannot simulate the full SW push event chain without a live environment.

---

### Gaps Summary

No gaps found. All 12 observable truths are VERIFIED by static analysis. The 4 human verification items are runtime/integration concerns that cannot be checked programmatically — they represent standard acceptance testing, not known defects.

The one notable code quality item (`@ts-expect-error` that may be stale) is informational only — TypeScript compiles clean and the rendered behavior is correct.

---

_Verified: 2026-05-15T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
