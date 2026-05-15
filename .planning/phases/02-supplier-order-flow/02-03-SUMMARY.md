---
phase: 02-supplier-order-flow
plan: "03"
subsystem: supplier-orders-page
tags: [react, polling, bottom-sheet, deep-link, two-sections, reject-modal]
dependency_graph:
  requires: [02-01, 02-02]
  provides: [supplier-orders-two-sections, RejectOrderModal, orders-polling, deep-link-scroll]
  affects: []
tech_stack:
  added: []
  patterns: [useRef-polling-guard, useSearchParams-deep-link, bottom-sheet-inline-component, per-card-loading-state]
key_files:
  created: []
  modified:
    - src/pages/supplier/Orders.tsx
    - src/types/index.ts
    - src/utils/index.ts
    - src/services/supabase.ts
    - src/components/shared/Badge.tsx
    - src/pages/admin/Orders.tsx
decisions:
  - "Full rewrite over surgical diff — 12+ touching points made a complete rewrite cleaner and less error-prone"
  - "RejectOrderModal inline in Orders.tsx (not separate file) — mirrors EditOrderModal precedent"
  - "hasLoaded useRef guard prevents spinner flash during 15s background polling"
  - "Per-status conditional button rendering (pending/confirmed/in_route each rendered separately) for clarity over shared logic"
  - "canReject variable scoped inside renderCard for in_route exclusion (D-09)"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-14T00:00:00Z"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 6
---

# Phase 02 Plan 03: Orders.tsx Rewrite Summary

Full rewrite of src/pages/supplier/Orders.tsx — from a flat 443-line single-section list to a ~680-line two-section supplier order management page with inline RejectOrderModal, 15s polling (hasLoaded guard), deep-link scroll+highlight on ?order=, and per-status action button layout matching UI-SPEC exactly.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Read Orders.tsx and EmptyState to map full structure | (no commit — read-only) | — |
| 2 | Rewrite Orders.tsx — polling, two sections, RejectOrderModal, deep-link | 934268b | src/pages/supplier/Orders.tsx + 5 dependency files (deviation) |
| 3 | Human verification checklist | (checkpoint — documented in SUMMARY) | — |

## Verification Results

All plan acceptance criteria passed:

1. `grep -c "handleCancel" src/pages/supplier/Orders.tsx` → `0` ✓
2. `grep -n "order-card-"` → 2 lines (line 323 getElementById, line 423 id= assignment) ✓
3. `grep -n "RejectOrderModal"` → 2 lines (function definition line 183, JSX usage line 668) ✓
4. `grep -n "PENDENTES"` → 1 line (section header, line 622) ✓
5. `grep -n "EM ANDAMENTO"` → 1 line (section header, line 642) ✓
6. `grep -n "setInterval.*15000"` → 1 line (line 312) ✓
7. `grep -n "Tudo em dia"` → 1 line (pending empty state, line 628) ✓
8. `grep -n "Nada em andamento"` → 1 line (active empty state, line 648) ✓
9. `npx tsc --noEmit --project tsconfig.app.json 2>&1 | grep "supplier/Orders.tsx" | grep "error"` → 0 lines ✓
10. `grep -n "Recusar"` → 6 lines (button labels + modal title + modal subtitle + Cancelar in modal) ✓

## Changes Made

### src/pages/supplier/Orders.tsx (primary target)

**A. Imports:** Added `useRef` to React import; added `useSearchParams` from react-router-dom; added `CheckCircle`, `PackageOpen` from lucide-react.

**B. STATUS_TRANSITIONS:** Updated labels:
- `pending`: `'Confirmar Pedido'` → `'Aceitar'`
- `confirmed`: `'Iniciar Entrega'` → `'Em rota'` (next changed from `in_delivery` to `in_route`)
- `in_route`: `'Marcar Entregue'` → `'Entregue'`
- Added `rejected: { label: 'Recusado', next: null }` entry

**C. RejectOrderModal:** New inline component (lines 183–235) with:
- 6 predefined reasons: Sem estoque, Fora de temporada, Região/dia inválido, Pedido mínimo não atingido, Preço desatualizado, Outro
- Radio-style button rows with selected/unselected visual states
- Conditional `<textarea>` when "Outro" selected (autoFocus)
- Submit disabled until valid selection; shows spinner during submission
- Exact EditOrderModal bottom-sheet shell (fixed inset-0 z-50 flex flex-col justify-end bg-black/40, rounded-t-3xl, drag handle)

**D. State additions:** `rejectingOrder`, `highlightedId`, `hasLoaded` (useRef), `[searchParams]`, `targetOrderId`

**E. Polling useEffect:** Replaced one-shot load with `setInterval(load, 15000)` + cleanup + `hasLoaded.current` guard so `setLoading(false)` only fires once.

**F. Deep-link useEffect:** Depends on `[orders, targetOrderId]` — expands card, scrolls (200ms delay for DOM paint), sets highlight ring for 1500ms.

**G. handleReject:** New handler calling `updateOrderStatus(order.id, 'rejected', reason)`, updating local state, closing modal, firing WhatsApp toast with 15s duration.

**H. handleCancel:** Removed entirely.

**I. renderCard function:** Extracted card render logic into named function `renderCard(order)`. Each card gets `id={`order-card-${order.id}`}` and conditional `ring-2 ring-primary ring-offset-2` when highlighted.

**J. Per-status button layout:**
- `pending`: Aceitar (flex-1 bg-primary) + Recusar (bg-red-50 text-danger) + Editar itens
- `confirmed`: Em rota (flex-1 bg-primary) + Recusar + Editar itens
- `in_route`: Entregue (w-full bg-primary) only

**K. Two-section render:** Replaced flat `orders.map()` with `pendingOrders` + divider + `activeOrders` sections. Per-section empty states using inline JSX (CheckCircle / PackageOpen icons) instead of EmptyState component (EmptyState only accepts ReactNode for icon, not a component reference).

**L. Header title:** `"Pedidos Recebidos"` → `"Pedidos"`

**M. RejectOrderModal mount:** Added alongside EditOrderModal at bottom of return.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Applied missing Phase 01/02 dependency changes to worktree**

- **Found during:** Task 2 (TypeScript compilation errors after writing Orders.tsx)
- **Issue:** The worktree branch was created before Phase 01 changes were merged to main. The worktree's `src/types/index.ts`, `src/utils/index.ts`, `src/services/supabase.ts` still had the old pre-Phase-01 code missing `in_route`, `rejected`, `getPendingOrderCount`, status filter, etc. TypeScript errored with "Type 'in_route' is not assignable to OrderStatus | null" etc.
- **Fix:** Applied all Phase 01/02 changes that existed on main but were absent in this worktree:
  - `src/types/index.ts`: Expanded `OrderStatus` to include `in_route` and `rejected`; added `StatusHistoryEntry` interface; added `rejection_reason`, `status_history`, `idempotency_key` to `Order`
  - `src/utils/index.ts`: Added `in_route` and `rejected` cases to `formatOrderStatusMessage` messages map
  - `src/services/supabase.ts`: Added `.in('status', ['pending', 'confirmed', 'in_route'])` filter to `getOrdersBySupplier`; added exported `getPendingOrderCount` function; added `rejectionReason` parameter to `updateOrderStatus`
- **Follow-on fixes (Rule 2):** The OrderStatus type expansion caused TS errors in two other files that had exhaustive `Record<OrderStatus, ...>` maps missing the new statuses:
  - `src/components/shared/Badge.tsx`: Added `in_route` and `rejected` entries to `OrderStatusBadge` config
  - `src/pages/admin/Orders.tsx`: Added `in_route` and `rejected` entries to `statusLabel` and `statusColor` maps
- **Files modified:** src/types/index.ts, src/utils/index.ts, src/services/supabase.ts, src/components/shared/Badge.tsx, src/pages/admin/Orders.tsx
- **Commit:** 934268b (included in same commit as Orders.tsx rewrite)

**2. [Rule 2 - Missing critical functionality] EmptyState component does not accept icon as component reference**

- **Found during:** Task 2 (plan spec said to use EmptyState component for per-section empty states)
- **Issue:** `EmptyState` accepts `icon?: React.ReactNode` (JSX), not an icon component. Using it would require passing `<CheckCircle size={48} className="..." />` as the icon prop. However, the plan spec used a custom inline empty state with specific styling (`py-10`, `text-center`, etc.) that differs from the component's `py-16 px-6` default.
- **Fix:** Used inline `<div>` empty states per the plan's exact spec rather than the EmptyState wrapper component, to match UI-SPEC padding and icon sizing exactly.
- **Files modified:** src/pages/supplier/Orders.tsx

## Task 3: Human Verification Checklist

This plan's Task 3 was `type="checkpoint:human-verify"`. The checklist for manual verification after deploying:

**Setup:** Run `npm run dev`. Log in as a supplier account.

### 1. Badge (SUPP-01)
- [ ] Navigate to Dashboard or Products
- [ ] Confirm ClipboardList nav icon shows red badge when pending orders exist
- [ ] Badge shows count (1–9) or "9+" for 10+
- [ ] Badge shows nothing when count is 0

### 2. Two sections (D-01)
- [ ] Navigate to /supplier/orders
- [ ] Confirm "PENDENTES (N)" section header visible with count
- [ ] Confirm "EM ANDAMENTO" section header visible
- [ ] Empty Pendentes section shows CheckCircle icon + "Tudo em dia!" + "Nenhum pedido aguardando resposta."
- [ ] Empty Em andamento section shows PackageOpen icon + "Nada em andamento" + "Pedidos confirmados e em rota aparecem aqui."

### 3. Accept order (SUPP-02)
- [ ] Tap "Aceitar" on a pending order
- [ ] Status updates immediately with no confirmation dialog
- [ ] Card moves from Pendentes to Em andamento
- [ ] WhatsApp toast appears with "💬 Abrir WhatsApp" action

### 4. Reject order (SUPP-03)
- [ ] Tap "Recusar" on a pending order — bottom sheet opens
- [ ] 6 reason options visible: Sem estoque, Fora de temporada, Região/dia inválido, Pedido mínimo não atingido, Preço desatualizado, Outro
- [ ] Submit button disabled with no reason selected
- [ ] Select "Outro" — free-text field appears with autoFocus
- [ ] Submit disabled when "Outro" selected but text is empty
- [ ] Select a reason and submit — order disappears from list, WhatsApp toast appears
- [ ] Tap backdrop or "Cancelar" — sheet dismisses without action
- [ ] Tap "Recusar" on a confirmed order (Em andamento) — same behavior

### 5. Em rota + Entregue (SUPP-04/05)
- [ ] Tap "Em rota" on a confirmed order — status updates to in_route
- [ ] In_route card remains in Em andamento section
- [ ] Tap "Entregue" on an in_route order — card disappears from Em andamento (terminal status)
- [ ] No "Recusar" button visible on in_route orders
- [ ] No "Editar itens" button visible on in_route orders

### 6. Deep-link (PUSH-01)
- [ ] Navigate to `/supplier/orders?order=<a-valid-order-id>`
- [ ] Matching card is expanded automatically
- [ ] Page scrolls smoothly to the card
- [ ] Card shows a brief ring highlight for ~1.5 seconds then disappears

### 7. Silent polling
- [ ] Wait 15+ seconds on the orders page
- [ ] No loading spinner appears during background refresh
- [ ] If another browser tab creates a new order, it appears within 15s

## Known Stubs

None — all changes wire real data paths. No hardcoded empty values or placeholder text in the rendered output.

## Threat Flags

No new security-relevant surface beyond what was documented in the plan's threat model. The `?order=` query param is used only as a key lookup against the supplier's own fetched orders — never inserted into innerHTML or eval. Rejection reason flows through `updateOrderStatus` API which validates actor role server-side.

## Self-Check: PASSED

Files exist:
- src/pages/supplier/Orders.tsx — FOUND (rewritten, verified via grep)
- src/types/index.ts — FOUND (modified)
- src/utils/index.ts — FOUND (modified)
- src/services/supabase.ts — FOUND (modified)
- src/components/shared/Badge.tsx — FOUND (modified)
- src/pages/admin/Orders.tsx — FOUND (modified)

Commits exist:
- 934268b — FOUND (current HEAD)

TypeScript check:
- `npx tsc --noEmit --project tsconfig.app.json 2>&1 | grep "supplier/Orders.tsx"` → 0 errors
- Full build: 0 errors
