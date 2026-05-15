---
phase: 03-buyer-order-view
plan: "03"
subsystem: routing-and-ui-components
tags: [routing, badge, typescript, react-router, lazy-loading]
dependency_graph:
  requires: [03-01]
  provides: [orders-detail-route, order-status-badge-size]
  affects: [src/App.tsx, src/components/shared/Badge.tsx]
tech_stack:
  added: []
  patterns: [lazy-import, react-router-v6-nested-routes, default-prop-backward-compat]
key_files:
  modified:
    - src/App.tsx
    - src/components/shared/Badge.tsx
decisions:
  - "OrderStatusBadge size defaults to 'sm' to preserve backward compatibility with all existing callers"
  - "Route /orders/:id placed inside BuyerLayout to inherit buyer auth guard (role check + redirect)"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-15"
---

# Phase 03 Plan 03: Route Registration and Badge Size Prop Summary

Two surgical edits wired the `/orders/:id` route into BuyerLayout and added `size` prop passthrough to `OrderStatusBadge` — enabling the `OrderDetail` page to be reachable and to render a larger status badge.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add size prop passthrough to OrderStatusBadge | 3f49cb6 | src/components/shared/Badge.tsx |
| 2 | Register /orders/:id route in App.tsx | 34a6ba0 | src/App.tsx |

## Changes Made

### Task 1 — Badge.tsx (3f49cb6)

`OrderStatusBadge` now accepts an optional `size?: 'sm' | 'md'` parameter (default `'sm'`), which is forwarded to the inner `Badge` component. Before this change the size was always implicitly `'sm'` (Badge's own default). The default ensures zero regression for all existing callers (`OrderHistory.tsx` etc.).

### Task 2 — App.tsx (34a6ba0)

Added lazy import and route:

```typescript
const OrderDetail = lazy(() => import('./pages/buyer/OrderDetail'))
```

```tsx
<Route path="/orders/:id" element={<OrderDetail />} />
```

Placed immediately after `/orders` inside the `<Route element={<BuyerLayout />}>` block. React Router v6 path specificity ensures `/orders` and `/orders/:id` coexist without conflict.

## Verification

- TypeScript compile: zero errors (`npx tsc --noEmit` returns no output)
- Route confirmed inside BuyerLayout block (inherits `profile.role !== 'buyer'` redirect guard — T-03-07 mitigated)
- `/orders` route preserved (OrderHistory not replaced)
- `OrderDetail` appears twice in App.tsx (import + route usage)

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| (none) | — | No new trust boundaries introduced. Route is inside BuyerLayout which applies the existing role guard. |

## Self-Check

- [x] `src/components/shared/Badge.tsx` contains `size?: 'sm' | 'md'` in OrderStatusBadge — FOUND
- [x] `src/App.tsx` contains `const OrderDetail = lazy(...)` — FOUND
- [x] `src/App.tsx` contains `<Route path="/orders/:id" element={<OrderDetail />} />` — FOUND
- [x] Commits 3f49cb6 and 34a6ba0 exist in git log — FOUND

## Self-Check: PASSED
