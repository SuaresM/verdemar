---
phase: 02-supplier-order-flow
verified: 2026-05-15T02:00:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 8/9
  gaps_closed:
    - "ALLOWED.rejected.from now ['pending', 'confirmed'] — confirmed→rejected transition works server-side (api/[...route].ts line 131)"
    - "WR-02: SupplierLayout useEffect dependency changed to [supplier?.id] with captured id closure (src/App.tsx line 67)"
    - "WR-05: Orders.tsx polling load() uses functional setOrders updater with updating[] guard to skip in-flight orders (src/pages/supplier/Orders.tsx lines 302-309)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Push notification received and deep-link works end-to-end"
    expected: "Supplier with PWA installed receives a push notification when a buyer places an order; tapping the notification opens /supplier/orders?order=<id>; the matching card is expanded, scrolled to, and briefly highlighted."
    why_human: "Requires a real push subscription, a real device or browser with service worker registered, and a live order creation. Cannot verify VAPID delivery or service worker notificationclick behavior programmatically."
  - test: "15s polling does not flash a spinner"
    expected: "After initial load, leaving the /supplier/orders page open for 15+ seconds shows orders silently refreshed — no loading spinner appears."
    why_human: "Requires a running browser session to observe timing and visual behavior."
  - test: "Badge count visible from all supplier screens"
    expected: "Navigating to /supplier/dashboard, /supplier/products, and /supplier/settings while pending orders exist shows the red badge on the ClipboardList nav icon."
    why_human: "Requires visual inspection in a running browser."
---

# Phase 02: Supplier Order Flow Verification Report

**Phase Goal:** Suppliers can see incoming orders, accept or reject with a reason, and progress orders through to delivery — all from a mobile screen.
**Verified:** 2026-05-15T02:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (02-04 plan)

## Re-verification Summary

The single BLOCKER from the initial verification (confirmed→rejected blocked server-side) is now closed. All 9 must-haves are VERIFIED. Three human-verification items remain — these were known from the initial verification and require a running browser or real device. They are not code gaps.

**Gap closed:** `api/[...route].ts` line 131 now reads `rejected: { actor: 'supplier', from: ['pending', 'confirmed'] }`. Two code-quality fixes (WR-02 polling dep, WR-05 polling guard) were also applied. No regressions found.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Two-section layout renders (Pendentes + Em andamento) with correct empty states | VERIFIED | Orders.tsx lines 618-661: `pendingOrders` filter (status=pending) and `activeOrders` filter (confirmed|in_route); section headers "PENDENTES (N)" and "EM ANDAMENTO" present; empty states "Tudo em dia!" and "Nada em andamento" present. |
| 2 | SupplierNav badge shows pending order count from all supplier screens | VERIFIED | SupplierNav.tsx line 4: `pendingCount` prop accepted; lines 29-31: badge rendered conditionally when >0; App.tsx lines 59-67: `SupplierLayout` polls `getPendingOrderCount` every 15s with primitive dep `[supplier?.id]` and passes to `<SupplierNav pendingCount={pendingCount} />`. |
| 3 | Aceitar tap sets pending→confirmed with no confirmation dialog | VERIFIED | Orders.tsx: pending card has a single button calling `handleUpdateStatus(order)` → `updateOrderStatus(order.id, 'confirmed')` with no dialog; server ALLOWED.confirmed.from = `['pending']` confirmed at api/[...route].ts line 130. |
| 4 | RejectOrderModal has exactly 6 predefined reasons + Outro free-text; submit blocked until valid | VERIFIED | Orders.tsx lines 192-199: REASONS array has exactly 6 entries ('Sem estoque', 'Fora de temporada', 'Região/dia inválido', 'Pedido mínimo não atingido', 'Preço desatualizado', 'Outro'); lines 204-205: isDisabled blocks submit unless selected and (if Outro) customReason non-empty; line 251: textarea shown only when selected==='Outro'. |
| 5 | Em rota button on confirmed orders advances confirmed→in_route | VERIFIED | Orders.tsx: confirmed card renders 'Em rota' button calling handleUpdateStatus; STATUS_TRANSITIONS.confirmed = {label:'Em rota', next:'in_route'} (line 15); server ALLOWED.in_route.from = `['confirmed']` at api/[...route].ts line 132. |
| 6 | Entregue button on in_route orders advances in_route→delivered | VERIFIED | Orders.tsx: in_route card renders 'Entregue' button calling handleUpdateStatus; STATUS_TRANSITIONS.in_route = {label:'Entregue', next:'delivered'} (line 16); server ALLOWED.delivered.from = `['in_route']` at api/[...route].ts line 133. |
| 7 | Push notification URL includes ?order=<id> deep-link; deep-link scroll+expand works | VERIFIED (push URL) / HUMAN (end-to-end) | api/[...route].ts line 97: url template literal with orderData.id; sw.ts reads data.url in notificationclick; Orders.tsx lines 294-330: useSearchParams reads `?order`, finds order, expands card, scrolls, sets 1500ms highlight ring. End-to-end push delivery requires human test. |
| 8 | Tapping Recusar on a confirmed order triggers a server-side state machine that accepts the confirmed→rejected transition | VERIFIED | api/[...route].ts line 131: `rejected: { actor: 'supplier', from: ['pending', 'confirmed'] }` — 'confirmed' now present. Orders.tsx line 426: `canReject = order.status === 'pending' || order.status === 'confirmed'`; line 574: Recusar button rendered for confirmed cards. Server will return 200 (not 422) for confirmed→rejected. D-09 fully satisfied. |
| 9 | handleCancel removed; delivered/cancelled/rejected excluded from both sections | VERIFIED | grep for handleCancel returns 0 matches. supabase.ts line 228: `.in('status', ['pending', 'confirmed', 'in_route'])`. pendingOrders/activeOrders client-side filters also exclude terminal states. |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `api/[...route].ts` | State machine with confirmed→rejected transition | VERIFIED | Line 131: `rejected: { actor: 'supplier', from: ['pending', 'confirmed'] }` — gap now closed. Actor check at line 139 still validates caller is the order's supplier. |
| `src/App.tsx` | SupplierLayout fetches count, polls 15s, passes to SupplierNav | VERIFIED | Lines 59-67: useEffect with `[supplier?.id]` dep, captures `const id = supplier.id` at effect invocation, clearInterval cleanup. Line 79: `pendingCount` prop passed. |
| `src/pages/supplier/Orders.tsx` | Two-section layout, RejectOrderModal, polling, deep-link | VERIFIED | All elements present. Polling uses functional setOrders updater with `updating[serverOrder.id]` guard (lines 302-309). Deep-link (lines 294-330). Two-section layout (lines 618-661). RejectOrderModal fully implemented. |
| `src/services/supabase.ts` | getOrdersBySupplier with status filter + getPendingOrderCount export | VERIFIED | Line 228: `.in('status', ['pending', 'confirmed', 'in_route'])`. Lines 270-277: `getPendingOrderCount` exported, queries with count:exact head:true. |
| `src/components/layout/SupplierNav.tsx` | pendingCount prop and badge markup | VERIFIED | Line 4: prop accepted with default 0. Lines 26-37: conditional badge on /supplier/orders icon; bg-danger, -top-1 -right-1 positioning; 9+ cap. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Orders.tsx handleReject (confirmed status) | api/[...route].ts ALLOWED.rejected.from | `PATCH /api/orders/:id/status { status: 'rejected' }` | WIRED | ALLOWED.rejected.from = `['pending', 'confirmed']` at line 131. Client calls `updateOrderStatus(order.id, 'rejected', reason)` (Orders.tsx line 368). Server will permit the transition. |
| Orders.tsx handleReject (pending status) | api/[...route].ts ALLOWED.rejected.from | `PATCH /api/orders/:id/status { status: 'rejected' }` | WIRED | Same ALLOWED rule covers pending as before. No regression. |
| Orders.tsx deep-link effect | DOM card element | `document.getElementById('order-card-${targetOrderId}')` | WIRED | Orders.tsx line 323 reads the id; card divs have `id={'order-card-${order.id}'}`. |
| Orders.tsx polling | getOrdersBySupplier | `setInterval(load, 15000)` | WIRED | Orders.tsx line 320; getOrdersBySupplier called in load() at line 301. Functional updater guards in-flight orders (lines 302-309). |
| App.tsx SupplierLayout | SupplierNav pendingCount prop | `pendingCount={pendingCount}` | WIRED | App.tsx line 79; SupplierNav.tsx line 4. |
| App.tsx SupplierLayout | getPendingOrderCount | `setInterval(refresh, 15000)` | WIRED | App.tsx lines 63-65; dep array `[supplier?.id]` prevents spurious restarts. |
| api/[...route].ts sendPush | sw.ts notificationclick | url payload with order id | WIRED | api/[...route].ts line 97 sets url; sw.ts reads data.url in notificationclick handler. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Orders.tsx | `orders` state | getOrdersBySupplier → Supabase query with supplier_id + status IN filter | Yes — real DB query (supabase.ts line 223-233) | FLOWING |
| App.tsx SupplierLayout | `pendingCount` state | getPendingOrderCount → Supabase count query (head:true) | Yes — real DB count query (supabase.ts lines 270-277) | FLOWING |
| SupplierNav.tsx | `pendingCount` prop | Passed from App.tsx SupplierLayout via polling | Yes — live polled integer from DB | FLOWING |

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| handleCancel removed | grep Orders.tsx for 'handleCancel' | 0 matches | PASS |
| STATUS_TRANSITIONS uses in_route not in_delivery | STATUS_TRANSITIONS.confirmed.next = 'in_route' (line 15) | in_route confirmed | PASS |
| 6 rejection reasons | REASONS array in RejectOrderModal | Exactly 6 entries (lines 192-199) | PASS |
| Push URL has order id | api/[...route].ts line 97 | Template literal with orderData.id | PASS |
| confirmed→rejected allowed server-side | ALLOWED.rejected.from at api/[...route].ts line 131 | `['pending', 'confirmed']` — both present | PASS |
| SupplierLayout dep is primitive | grep `[supplier?.id]` in App.tsx | Line 67: `}, [supplier?.id])` | PASS |
| Polling guard skips in-flight orders | grep `updating[serverOrder.id]` in Orders.tsx | Line 305: present inside setOrders functional updater | PASS |
| getOrdersBySupplier excludes terminal statuses | supabase.ts line 228 | `.in('status', ['pending', 'confirmed', 'in_route'])` | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SUPP-01 | 02-02, 02-03 | Fornecedor vê lista de pedidos pendentes com contador de não lidos | SATISFIED | Badge in SupplierNav with live polled count; two-section layout with pending section. |
| SUPP-02 | 02-03, 02-04 | Fornecedor aceita pedido com um toque (sem dialog de confirmação) | SATISFIED | Aceitar button calls handleUpdateStatus directly; no confirmation dialog in code. |
| SUPP-03 | 02-03, 02-04 | Fornecedor recusa pedido com motivo obrigatório (lista predefinida + campo livre) | SATISFIED | RejectOrderModal: 6 reasons + Outro free-text, submit blocked until valid; confirmed→rejected now works server-side (gap closed in 02-04). |
| SUPP-04 | 02-03 | Fornecedor marca pedido como "Em rota" | SATISFIED | Em rota button on confirmed orders; server allows in_route from confirmed. |
| SUPP-05 | 02-03 | Fornecedor marca pedido como "Entregue" | SATISFIED | Entregue button on in_route orders; server allows delivered from in_route. |
| PUSH-01 | 02-01, 02-03 | Fornecedor recebe push ao chegar novo pedido; tap abre pedido diretamente | SATISFIED (code) / HUMAN NEEDED (delivery) | Push URL correct (api/[...route].ts line 97); service worker reads url (sw.ts); deep-link scroll+expand wired (Orders.tsx lines 294-330). End-to-end push delivery requires human test. |

### Anti-Patterns Found

None — no blockers or warnings. The previous BLOCKER (`ALLOWED.rejected.from = ['pending']` only) is now resolved. The `placeholder=` attribute in Orders.tsx line 255 is a textarea UI hint in RejectOrderModal, not a data stub.

### Human Verification Required

#### 1. Push Notification End-to-End (PUSH-01)

**Test:** Install the app as a PWA to home screen on a mobile device. Log in as a supplier. Then, using a separate buyer account, place an order from that supplier. Wait for the push notification.
**Expected:** Supplier device receives a push notification titled "Novo pedido recebido". Tapping it opens `/supplier/orders?order=<order-uuid>`. The matching order card is expanded, scrolled into view, and shows a primary-colored ring highlight for ~1.5 seconds.
**Why human:** Requires VAPID push delivery over the internet to a real subscribed device. Service worker `notificationclick` can only fire in a real browser context.

#### 2. Silent 15s Polling (no spinner flash)

**Test:** Log in as a supplier, navigate to `/supplier/orders`, and wait 15+ seconds without interacting.
**Expected:** The page does not show a loading spinner or flash during the background refresh. Orders update silently.
**Why human:** Timing and visual behavior requires a running browser. The `hasLoaded` ref guard in Orders.tsx (line 293) is designed to prevent this — visual confirmation is needed.

#### 3. Badge Count Visible from All Supplier Screens

**Test:** Log in as a supplier with at least one pending order. Navigate to `/supplier/dashboard`, `/supplier/products`, and `/supplier/settings`.
**Expected:** The ClipboardList icon in the bottom nav shows a red badge with the pending order count on all screens, not only on the orders screen.
**Why human:** Visual rendering and nav behavior requires a running browser.

### Gap Closure Verification

The single BLOCKER from the initial verification is confirmed closed:

- **Before:** `rejected: { actor: 'supplier', from: ['pending'] }` — confirmed orders could not be rejected; server returned 422.
- **After:** `rejected: { actor: 'supplier', from: ['pending', 'confirmed'] }` — both pending and confirmed orders can be rejected by the supplier per D-09.

Evidence: `api/[...route].ts` line 131 reads exactly `rejected:  { actor: 'supplier', from: ['pending', 'confirmed'] },` — verified by direct file read.

Two code-quality fixes also confirmed:
- `src/App.tsx` line 67: `}, [supplier?.id])` — primitive dep, no stale-closure risk.
- `src/pages/supplier/Orders.tsx` lines 302-309: functional `setOrders` updater with `updating[serverOrder.id]` guard — polling no longer races against optimistic mutations.

---

_Verified: 2026-05-15T02:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification after: 02-04 gap closure_
