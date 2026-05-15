---
phase: 03-buyer-order-view
plan: 01
subsystem: ui

tags: [react, typescript, tailwind, supabase, polling, lucide-react, sonner]

# Dependency graph
requires:
  - phase: 01-order-api
    provides: getOrderById and updateOrderStatus service functions
  - phase: 02-supplier-order-mgmt
    provides: 15s polling pattern, OrderStatusBadge, StatusHistoryEntry type

provides:
  - Buyer order detail page at /orders/:id with full tracking UI (TRACK-01..04)
  - 15s silent polling refresh without PageLoader flash
  - Vertical status timeline (newest-first) with colored dots, PT-BR labels, timestamps
  - Conditional cancel button for pending orders with optimistic reload
  - Conditional rejection reason block for rejected orders
  - EmptyState for null/not-found orders with navigate-back
  - PUSH-02 satisfied: route target for push deep-links to /orders/:id

affects:
  - 03-02 (Cart.tsx enrichment will add navigate to /orders/:id — needs this page to exist)
  - 03-03 (Badge.tsx update adds size prop to OrderStatusBadge — resolves ts-expect-error in this file)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 15s polling with setInterval + cancelled flag guard + clearInterval cleanup
    - spread-before-reverse for status_history arrays (never mutate state)
    - conditional loading guard: loading && !order shows PageLoader; polling never re-shows it
    - @ts-expect-error with comment for known cross-plan type dependency

key-files:
  created:
    - src/pages/buyer/OrderDetail.tsx
  modified: []

key-decisions:
  - "@ts-expect-error used on OrderStatusBadge size prop — size support added in Plan 03-03 (Badge.tsx), acceptable cross-plan dependency"
  - "Cancel action: single-tap, no confirmation dialog (D-06) — aligns with UI-SPEC and plan decision log"
  - "Timeline fallback: single entry {status, updated_at ?? created_at} for orders without status_history"
  - "Scroll-to-top on mount via useEffect([], []) to avoid inheriting Cart overlay scroll position"

patterns-established:
  - "Polling cleanup pattern: let cancelled = false; clearInterval inside cleanup fn prevents setState after unmount"
  - "Optimistic cancel: updateOrderStatus then getOrderById to confirm new state before setOrder"

requirements-completed: [TRACK-01, TRACK-02, TRACK-03, TRACK-04, PUSH-02]

# Metrics
duration: 15min
completed: 2026-05-15
---

# Phase 03 Plan 01: Buyer Order Detail Summary

**Buyer-facing order detail page at /orders/:id with 15s silent polling, vertical status timeline, conditional cancel, and rejection reason block — satisfying all TRACK-01..04 and PUSH-02 requirements**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-15T00:00:00Z
- **Completed:** 2026-05-15
- **Tasks:** 2 (written as a single complete file — split was conceptual)
- **Files modified:** 1

## Accomplishments

- Created `src/pages/buyer/OrderDetail.tsx` (212 lines) as a complete, TypeScript-valid React component
- Implemented 15s polling via `setInterval` with `cancelled` flag guard and `clearInterval` cleanup — no PageLoader flash on refresh after initial load
- Status timeline renders `status_history` newest-first using `[...order.status_history!].reverse()` spread pattern; falls back to single `{status, updated_at}` entry for legacy orders
- Cancel button conditionally rendered on `status === 'pending'` only; shows inline spinner during PATCH; re-fetches order after success
- Rejection reason block conditionally rendered on `status === 'rejected'` with `AlertTriangle` icon and `order.rejection_reason` body text
- Zero TypeScript errors — only suppressed error is expected `size` prop on `OrderStatusBadge` (resolved by Plan 03-03)

## Task Commits

1. **Task 1+2: Create OrderDetail.tsx (status card, rejection block, items card, timeline, cancel)** - `24c324e` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/pages/buyer/OrderDetail.tsx` - Buyer order detail page: polling, timeline, cancel button, rejection block, EmptyState

## Decisions Made

- Used `@ts-expect-error` comment on `OrderStatusBadge size="md"` prop — Plan 03-03 will add the `size` prop to `OrderStatusBadge`; this is a planned cross-plan dependency, not a bug
- Cancel is single-tap with no confirmation dialog per D-06 (locked in planning decisions)
- Timeline fallback for orders with empty `status_history`: constructs a single entry from `order.status` + `order.updated_at ?? order.created_at`
- `window.scrollTo(0, 0)` on mount prevents scroll position inheritance from the Cart overlay

## Deviations from Plan

None — plan executed exactly as written. The `@ts-expect-error` suppression for the `size` prop was anticipated by the plan and is the correct approach for this cross-plan dependency.

## Issues Encountered

None. TypeScript compiled with zero errors (the `size` prop TS error was suppressed via `@ts-expect-error` as planned — Plan 03-03 resolves it by updating Badge.tsx).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `src/pages/buyer/OrderDetail.tsx` is ready to be routed — Plan 03-03 registers `/orders/:id` in App.tsx
- Plan 03-02 (Cart.tsx enrichment) can add "Ver Pedido" button navigating to `/orders/${orderId}` — this page is the destination
- Plan 03-03 updates `OrderStatusBadge` to accept `size` prop — that change will auto-resolve the `@ts-expect-error` here
- PUSH-02 is satisfied: the route `/orders/:id` will exist once Plan 03-03 registers it; push deep-links land here

## Self-Check: PASSED

- `src/pages/buyer/OrderDetail.tsx` — FOUND (212 lines)
- Commit `24c324e` — FOUND
- TypeScript compile — zero errors (size prop suppressed as planned)
- All 7 OrderStatus keys present in all 3 Record constants — CONFIRMED (in_delivery count: 3)
- spread-before-reverse — CONFIRMED
- clearInterval — CONFIRMED
- status === 'pending' conditional — CONFIRMED
- status === 'rejected' conditional — CONFIRMED

---
*Phase: 03-buyer-order-view*
*Completed: 2026-05-15*
