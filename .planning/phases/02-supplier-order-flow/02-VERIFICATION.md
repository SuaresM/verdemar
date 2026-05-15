---
phase: 02-supplier-order-flow
verified: 2026-05-14T20:00:00Z
status: gaps_found
score: 8/9 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Tapping Recusar on a confirmed order triggers a server-side state machine that accepts the confirmed→rejected transition"
    status: failed
    reason: "The server ALLOWED table (api/[...route].ts line 131) sets rejected: { actor: 'supplier', from: ['pending'] }. A supplier tapping Recusar on a confirmed order will get a 422 error from the API. The UI renders the Recusar button for confirmed orders (Orders.tsx line 418, 566) and the client calls updateOrderStatus(order.id, 'rejected', reason), but the server will reject the transition with 'Não é possível passar de confirmed para rejected'. Decision D-09 in 02-CONTEXT.md explicitly states the Recusar button must be available on both pending AND confirmed orders."
    artifacts:
      - path: "api/[...route].ts"
        issue: "ALLOWED.rejected.from is ['pending'] only (line 131). Must be ['pending', 'confirmed'] to match D-09."
    missing:
      - "Change ALLOWED.rejected.from in api/[...route].ts from ['pending'] to ['pending', 'confirmed']"
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
**Verified:** 2026-05-14T20:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Two-section layout renders (Pendentes + Em andamento) with correct empty states | VERIFIED | Orders.tsx lines 618-654: `pendingOrders` filter (status=pending) and `activeOrders` filter (confirmed|in_route); section headers "PENDENTES (N)" and "EM ANDAMENTO" present; empty states "Tudo em dia!" and "Nada em andamento" present. |
| 2 | SupplierNav badge shows pending order count from all supplier screens | VERIFIED | SupplierNav.tsx line 4: `pendingCount` prop accepted; line 29-31: badge rendered conditionally when >0; App.tsx lines 57-78: `SupplierLayout` polls `getPendingOrderCount` every 15s and passes to `<SupplierNav pendingCount={pendingCount} />`. |
| 3 | Aceitar tap sets pending→confirmed with no confirmation dialog | VERIFIED | Orders.tsx line 519-530: pending card has a single `<button onClick={() => handleUpdateStatus(order)}>` calling `updateOrderStatus(order.id, 'confirmed')` with no dialog; server ALLOWED confirms: `confirmed: { actor: 'supplier', from: ['pending'] }`. |
| 4 | RejectOrderModal has exactly 6 predefined reasons + Outro free-text; submit blocked until valid | VERIFIED | Orders.tsx lines 192-199: REASONS array has exactly 6 entries ('Sem estoque', 'Fora de temporada', 'Região/dia inválido', 'Pedido mínimo não atingido', 'Preço desatualizado', 'Outro'); lines 204-205: isDisabled logic blocks submit unless selected and (if Outro) customReason non-empty; lines 261-276: textarea shown only when selected==='Outro'. |
| 5 | Em rota button on confirmed orders advances confirmed→in_route | VERIFIED | Orders.tsx lines 551-585: confirmed card renders 'Em rota' button calling handleUpdateStatus; STATUS_TRANSITIONS.confirmed = {label:'Em rota', next:'in_route'} (line 15); server ALLOWED: `in_route: { actor: 'supplier', from: ['confirmed'] }`. |
| 6 | Entregue button on in_route orders advances in_route→delivered | VERIFIED | Orders.tsx lines 587-600: in_route card renders 'Entregue' button calling handleUpdateStatus; STATUS_TRANSITIONS.in_route = {label:'Entregue', next:'delivered'} (line 16); server ALLOWED: `delivered: { actor: 'supplier', from: ['in_route'] }`. |
| 7 | Push notification URL includes ?order=<id> deep-link; deep-link scroll+expand works | VERIFIED (push URL) / HUMAN (end-to-end) | api/[...route].ts line 97: `url: \`/supplier/orders?order=${orderData.id}\``; sw.ts line 65 reads `data.url`; Orders.tsx lines 317-330: useSearchParams reads `?order`, finds order, expands card, scrolls, sets 1500ms highlight ring. Server side and client side both wired correctly. End-to-end push delivery requires human test. |
| 8 | Recusar on confirmed orders is blocked by server state machine (WR-06) | FAILED | Server ALLOWED.rejected.from is ['pending'] only (api/[...route].ts line 131). UI shows Recusar button on confirmed orders (Orders.tsx line 418: canReject = pending OR confirmed; line 566: button rendered). Client would call updateOrderStatus(order.id, 'rejected', reason) which hits PATCH /orders/:id/status, but server returns 422 "Não é possível passar de 'confirmed' para 'rejected'". D-09 requires this transition. |
| 9 | handleCancel removed; delivered/cancelled/rejected excluded from both sections | VERIFIED | grep for handleCancel in Orders.tsx returns 0 matches. getOrdersBySupplier in supabase.ts line 228 filters `.in('status', ['pending', 'confirmed', 'in_route'])`. pendingOrders/activeOrders client filters also exclude terminal states. |

**Score:** 8/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/services/supabase.ts` | getOrdersBySupplier with status filter + getPendingOrderCount export | VERIFIED | Line 228: `.in('status', ['pending', 'confirmed', 'in_route'])` present. Lines 270-277: `getPendingOrderCount` exported, queries orders by supplier_id and status='pending' with count:exact. |
| `src/utils/index.ts` | formatOrderStatusMessage with in_route and rejected cases | VERIFIED | Line 100: `in_route:` entry with WhatsApp copy. Line 103: `rejected:` entry with WhatsApp copy. Legacy `in_delivery` entry preserved. |
| `api/[...route].ts` | Push URL includes order id query param | VERIFIED | Line 97: template literal form `\`/supplier/orders?order=${orderData.id}\`` present. Title 'Novo pedido recebido' (no exclamation mark) confirmed at line 95. |
| `src/components/layout/SupplierNav.tsx` | pendingCount prop and badge markup | VERIFIED | Line 4: prop accepted with default 0. Lines 26-37: conditional badge on /supplier/orders icon. bg-danger, -top-1 -right-1 positioning, 9+ cap — all present. |
| `src/App.tsx` | SupplierLayout fetches count, polls 15s, passes to SupplierNav | VERIFIED | Line 6: import present. Lines 57-66: useState(0), useEffect polling 15s with clearInterval cleanup, guarded on supplier. Line 78: prop passed. Hooks called before guard returns (hooks ordering correct). |
| `src/pages/supplier/Orders.tsx` | Two-section layout, RejectOrderModal, polling, deep-link | VERIFIED (with gap) | All structural elements present. RejectOrderModal component defined (lines 183-280). 15s polling with hasLoaded guard (lines 293, 305-306, 312). Deep-link via useSearchParams (lines 294-330). Two-section layout (lines 618-654). Gap: Recusar on confirmed orders will be rejected by server. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Orders.tsx handleReject | supabase.ts updateOrderStatus | `updateOrderStatus(order.id, 'rejected', reason)` | WIRED (client) / BROKEN (server for confirmed) | Client wiring correct (Orders.tsx line 368). Server only allows rejected from pending (api/[...route].ts line 131). |
| Orders.tsx deep-link effect | DOM card element | `document.getElementById('order-card-${targetOrderId}')` | WIRED | Orders.tsx line 323 reads the id; line 423 sets `id={'order-card-${order.id}'}` on every card div. |
| Orders.tsx polling | getOrdersBySupplier | `setInterval(load, 15000)` | WIRED | Orders.tsx line 312; getOrdersBySupplier called in load() at line 301. |
| App.tsx SupplierLayout | SupplierNav pendingCount prop | `pendingCount={pendingCount}` | WIRED | App.tsx line 78; SupplierNav.tsx line 4. |
| App.tsx SupplierLayout | getPendingOrderCount | `setInterval(refresh, 15000)` | WIRED | App.tsx lines 61-65. |
| api/[...route].ts sendPush | sw.ts notificationclick | url payload with order id | WIRED | api/[...route].ts line 97 sets url; sw.ts line 65 reads data.url in notificationclick handler. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Orders.tsx | `orders` state | getOrdersBySupplier → Supabase query with status filter | Yes — real DB query with supplier_id + status IN filter | FLOWING |
| App.tsx SupplierLayout | `pendingCount` state | getPendingOrderCount → Supabase count query | Yes — head:true count query by supplier_id + status='pending' | FLOWING |
| SupplierNav.tsx | `pendingCount` prop | Passed from App.tsx SupplierLayout | Yes — live polled integer | FLOWING |

### Behavioral Spot-Checks

Runnable entry points are not available without starting a dev server. Spot-checks performed via static analysis only.

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| handleCancel removed | grep Orders.tsx for 'handleCancel' | 0 matches | PASS |
| STATUS_TRANSITIONS uses in_route not in_delivery | STATUS_TRANSITIONS.confirmed.next = 'in_route' (line 15) | in_route confirmed | PASS |
| 6 rejection reasons | REASONS array in RejectOrderModal | Exactly 6 entries | PASS |
| Push URL has order id | api/[...route].ts line 97 | Template literal with orderData.id | PASS |
| confirmed→rejected blocked server-side | ALLOWED.rejected.from | ['pending'] only | FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SUPP-01 | 02-02, 02-03 | Fornecedor vê lista de pedidos pendentes com contador de não lidos | SATISFIED | Badge in SupplierNav; two-section layout with pending section; polling for count. |
| SUPP-02 | 02-03 | Fornecedor aceita pedido com um toque (sem dialog de confirmação) | SATISFIED | Aceitar button calls handleUpdateStatus directly; no confirmation dialog in code. |
| SUPP-03 | 02-03 | Fornecedor recusa pedido com motivo obrigatório (lista predefinida + campo livre) | PARTIALLY SATISFIED | RejectOrderModal fully implements the 6-reason list and Outro free-text with submit block. However, rejecting a confirmed order (D-09 allows this) will be rejected by the server (WR-06 gap). Rejection of pending orders works. |
| SUPP-04 | 02-03 | Fornecedor marca pedido como "Em rota" | SATISFIED | Em rota button on confirmed orders; server allows in_route from confirmed. |
| SUPP-05 | 02-03 | Fornecedor marca pedido como "Entregue" | SATISFIED | Entregue button on in_route orders; server allows delivered from in_route. |
| PUSH-01 | 02-01, 02-03 | Fornecedor recebe push ao chegar novo pedido; tap abre pedido diretamente | SATISFIED (code) / HUMAN NEEDED (delivery) | Push URL correct; service worker reads url; deep-link scroll+expand wired. End-to-end delivery needs human test. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `api/[...route].ts` | 131 | `rejected: { actor: 'supplier', from: ['pending'] }` — missing 'confirmed' in from array | BLOCKER | Supplier cannot reject a confirmed order; UI shows the button but server returns 422. |

### Human Verification Required

#### 1. Push Notification End-to-End (PUSH-01)

**Test:** Install the app as a PWA to home screen on a mobile device. Log in as a supplier. Then, using a separate buyer account, place an order from a supplier the test supplier account owns. Wait for the push notification.
**Expected:** Supplier device receives a push notification titled "Novo pedido recebido". Tapping it opens `/supplier/orders?order=<order-uuid>`. The matching order card is expanded, scrolled into view, and shows a primary-colored ring highlight for ~1.5 seconds.
**Why human:** Requires VAPID push delivery over the internet to a real subscribed device, and service worker `notificationclick` can only fire in a real browser context.

#### 2. Silent 15s Polling (no spinner flash)

**Test:** Log in as a supplier, navigate to `/supplier/orders`, and wait 15+ seconds without interacting.
**Expected:** The page does not show a loading spinner or flash during the background refresh. Orders update silently.
**Why human:** Timing and visual behavior requires a running browser.

#### 3. Badge Count Visible from All Supplier Screens

**Test:** Log in as a supplier with at least one pending order. Navigate to `/supplier/dashboard`, `/supplier/products`, and `/supplier/settings`.
**Expected:** The ClipboardList icon in the bottom nav shows a red badge with the pending order count on all screens, not only on the orders screen.
**Why human:** Visual rendering and nav behavior requires a running browser.

### Gaps Summary

One BLOCKER gap prevents full goal achievement: the server-side state machine does not allow confirmed→rejected. This means a supplier who has already accepted an order (confirmed status) cannot subsequently reject it using the "Recusar" button that appears on confirmed cards. The client code and UI are correctly implemented per D-09, but the server `ALLOWED` table in `api/[...route].ts` restricts `rejected` to only transition from `['pending']`.

Fix: change line 131 of `api/[...route].ts` from:
```
rejected:  { actor: 'supplier', from: ['pending'] },
```
to:
```
rejected:  { actor: 'supplier', from: ['pending', 'confirmed'] },
```

All other phase deliverables are correctly implemented and wired. The automated-verifiable portions of PUSH-01 (push URL payload, service worker url handling, deep-link scroll/expand in Orders.tsx) are all wired correctly — only the end-to-end push delivery requires human testing.

---

_Verified: 2026-05-14T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
