# Research Summary — v1.1 Fluxo de Pedidos

**Project:** Rota Verde — Milestone v1.1 Fluxo de Pedidos
**Domain:** B2B fresh produce wholesale marketplace (DF & entorno)
**Researched:** 2026-05-13
**Confidence:** HIGH

---

## Stack Additions

| Package | Version | Why | What It Replaces / Supplements |
|---------|---------|-----|-------------------------------|
| `date-fns` | `^3.6.0` | Format order timestamps, relative time ("há 2 horas"), date-range labels for history filters. Tree-shakeable. | `Intl` native API (insufficient for formatted labels); `dayjs` (plugin-based TS is lossy) |

Everything else is already in the stack: `@supabase/supabase-js` for Realtime, `web-push` + VAPID infra for push, `react-hook-form` + `zod` for reject-reason form, `sonner` for toasts, `zustand` for filter state, React Router 7 for new routes.

**Do NOT add:** `@tanstack/react-query`, `socket.io-client`, `recharts`, `swr`, or any virtualization library.

---

## Feature Table Stakes

**Order Confirmation (Buyer)**
- Order number prominently displayed
- Visual success state: checkmark + "Pedido enviado"
- Per-supplier summary: items, qty, unit + total price
- Scheduled delivery slot echoed back
- Supplier name + contact link per sub-order
- "Aguardando confirmação do fornecedor" status message
- Navigation to home or order history (no dead-end)

**Supplier Order Management**
- Pending orders list with unread badge/count
- Per-order detail: buyer name, items, quantities, delivery slot
- Accept button — one tap, prominent, no dialog
- Reject with mandatory reason (predefined list + free text):
  - Sem estoque suficiente
  - Produto fora de temporada
  - Não entrego nessa região nesse dia
  - Pedido mínimo não atingido
  - Preço desatualizado
  - Outro motivo (free text)
- Delivery day visible at list level

**Status Tracking**
- 4-state: `pendente → confirmado → em rota → entregue` + `recusado` / `cancelado`
- Status visible on buyer detail and supplier card
- Push notification to buyer on every status change

**Order History**
- Buyer: all orders, newest first, status visible without opening
- Supplier: received orders, newest first
- Tap-to-open full order detail
- Filters: status, fornecedor/comprador, date range

**Lifecycle Notifications**
- Supplier: push on new order → deep-link to pending order
- Buyer: push on confirmed, rejected (with reason), em rota, entregue → deep-link to `/orders/:id`

---

## Feature Differentiators

- "Repetir pedido" shortcut from confirmation and history
- WhatsApp deep-link to supplier per sub-order on confirmation screen
- Urgency highlighting on supplier pending list (pending > 30 min gets orange border)
- Estimated response window on confirmation screen
- Order value totals per period in history
- Supplier reminder push if unactioned for 2+ hours
- Delivery confirmation accessible from list card (not just detail)

---

## Architecture Changes

**Schema migrations (required before any UI)**
- `ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;`
- `ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::jsonb;`
- Add `status` CHECK constraint (pending/confirmed/rejected/in_route/delivered/cancelled)
- Change `push_subscriptions` primary key to `(user_id, endpoint)` (multi-device support)
- Add idempotency key column + unique constraint on `orders`

**New files (4)**
- `supabase/migrations/YYYYMMDD_order_flow.sql`
- `src/pages/buyer/OrderDetail.tsx` — status timeline, rejection reason display
- `src/pages/supplier/OrderDetail.tsx` — accept/reject UI, delivery action buttons
- `src/components/shared/OrderStatusTimeline.tsx` — shared timeline (reads `status_history` JSONB)

**Modified files (8)**
- `src/types/index.ts` — add `rejection_reason?`, `status_history?` to `Order`
- `src/services/supabase.ts` — add `getOrderById()`, update `updateOrderStatus()`, add filtered queries
- `api/[...route].ts` — rewrite `PATCH /orders/:id/status` with full permission matrix; add `sendPushToBuyer()`; fix `sendPush()` to iterate rows and purge stale 410/404 subscriptions
- `src/pages/buyer/Cart.tsx` — upgrade confirmation: prominent order number, "Ver Pedido" link, `clearSection` on critical path
- `src/pages/buyer/OrderHistory.tsx` — tap card → `/orders/:id`, color-coded status chips
- `src/pages/supplier/Orders.tsx` — rejection reason, pagination (10/page), card navigation, relative timestamps
- `src/App.tsx` — add routes `/orders/:id` and `/supplier/orders/:id`
- Service worker push handler — `event.waitUntil(showNotification(...))` with parse-failure fallback

---

## Critical Pitfalls

1. **`PATCH /orders/:id/status` has ZERO authorization** — `adminSupabase` bypasses RLS; any authenticated user can set any order to any status. Must be fixed in Phase 1 before any new UI ships.

2. **`push_subscriptions` upserts on `user_id` alone — multi-device suppliers silently lose notifications** — tablet registration overwrites phone. Fix: change key to `(user_id, endpoint)`; iterate all rows on send; purge 410/404 stale rows.

3. **iOS silently cancels PWA push subscriptions after inactivity or silent push** — `showNotification` MUST be called inside `event.waitUntil`; include fallback notification if payload parse fails. Suppliers must install to home screen.

4. **No idempotency on order creation — duplicates amplify with status lifecycle** — network retry creates two `pending` rows; push fires twice per status change. Fix: UUID idempotency key from frontend + unique constraint before any new UI.

5. **`rejection_reason` column doesn't exist yet** — supplier reject will Postgres-error silently. Phase 1 migration is a prerequisite.

---

## Watch Out For

1. **Concurrent state: supplier accepts while buyer cancels** — implement actor + prior-state guard in Hono handler; return 409 with current status in message.
2. **Optimistic UI** — after PATCH, re-fetch order from Supabase; do not trust 200 as ground truth; roll back on error.
3. **`PATCH /orders/:id/items` must refuse if status ≠ pending** — add guard to prevent edits after confirmation.
4. **Cart stale state** — `clearSection(supplierId)` must be on critical path before success screen; re-fetch product prices on cart mount.
5. **Supabase Realtime + RLS is a known broken combination** (issue #35195) — use 15s polling on order history; Realtime deferred to v1.2.
6. **iOS push delivery is 70–85%, not 100%** — in-app status is primary; push is supplemental.
7. **No horizontal swipe for accept/reject on mobile** — conflicts with iOS Safari back gesture.
8. **Paginate order lists from day one** — 10 per page; unbounded list causes scroll jank on older iPhones.

---

## Recommended Phase Structure

### Phase 1 — Schema + API Backbone
**Goal:** Fix security hole, establish safe data layer, unblock all page work.
- Migration: `rejection_reason`, `status_history`, status CHECK, idempotency key
- Rewrite `PATCH /orders/:id/status` with full actor + state guard
- `sendPush()` refactored (multi-device, stale cleanup); `sendPushToBuyer()` wired
- `getOrderById()` service function
- `push_subscriptions` composite key migration

**Why first:** Authorization hole is a live production security issue. Every subsequent feature depends on this schema.

### Phase 2 — Supplier Order Flow
**Goal:** Suppliers accept/reject on mobile with full lifecycle control.
- `src/pages/supplier/OrderDetail.tsx` — accept, reject (reason bottom sheet), em rota, entregue
- `Orders.tsx` updated — pagination, relative timestamps, card navigation
- Route `/supplier/orders/:id`
- Service worker `event.waitUntil` fix

**Why second:** Supplier triggers buyer push. Must be testable end-to-end before buyer notification path validated.

### Phase 3 — Buyer Order Detail + Confirmation Upgrade
**Goal:** Close the loop for buyers — visible status, timeline, deep-link from push.
- `OrderStatusTimeline.tsx` shared component
- `src/pages/buyer/OrderDetail.tsx` — timeline, rejection reason, WhatsApp link
- Route `/orders/:id`
- `Cart.tsx` success upgrade: prominent order number, "Ver Pedido", `clearSection` on critical path
- `OrderHistory.tsx` — tap-card navigation, status chips
- Product price re-fetch on cart mount with stale-price toast

**Why third:** Buyer detail is the push deep-link target. Cannot ship before Phase 2 enables push.

### Phase 4 — History Filters + Polish
**Goal:** Make order history operationally useful for both roles over time.
- Status filter, date range filter, name/order search
- Order value totals per period
- "Repetir pedido" on order detail
- Urgency highlighting for pending suppliers

---

## Open Questions

1. **Buyer cancellation scope** — `pending → cancelled` by buyer in scope for v1.1, or deferred?
2. **Partial acceptance / counter-offer** — v1.1 or v1.2? If v1.1, schema needs `partial_fulfillment` structure in Phase 1.
3. **`cancelado` vs `recusado`** — two distinct DB enum states, or one terminal with `rejection_reason` presence check?
4. **iOS onboarding gate** — hard "install first" prompt or passive banner for push permission?
5. **Order history default date range** — "last 30 days" acceptable, or open by default?
6. **Polling interval** — 15s acceptable, or specific scenario needs Realtime (adds broadcast_changes + DB trigger complexity)?
7. **Idempotency UX** — silent dedup on retry, or show "already submitted" error?

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Single new dependency; all "do not add" rationale confirmed |
| Features | HIGH | Cross-verified across Choco, Fresho, Orderlion, Mercury VMP, Baymard |
| Architecture | HIGH | Direct codebase inspection of schema, types, API files |
| Pitfalls | HIGH | Security hole confirmed by code inspection (`api/[...route].ts:67`) |

---

*Research completed: 2026-05-13 | Ready for roadmap: yes*
