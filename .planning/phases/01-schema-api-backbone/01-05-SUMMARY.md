---
phase: 01-schema-api-backbone
plan: 05
subsystem: api
tags: [typescript, supabase, orders, rls, service-layer, phase01]

# Dependency graph
requires:
  - "01-02 (Order type with optional rejection_reason, status_history, idempotency_key)"
  - "01-03 (PATCH /orders/:id/status handler accepting 'reason' in body)"
provides:
  - "getOrderById(orderId: string): Promise<Order | null> — RLS-protected single order fetch with full joins"
  - "updateOrderStatus with optional rejectionReason parameter — passes as 'reason' in PATCH body"
affects:
  - "Phase 02 (Supplier Order Flow) — uses getOrderById to render order detail"
  - "Phase 03 (Buyer Order Detail) — uses getOrderById to fetch single order"
  - "Any supplier UI calling updateOrderStatus with rejection reason"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read function returns null on RLS block (same pattern as getSupplierById, getProfile)"
    - "Conditional spread for optional PATCH body fields: ...(field ? { key: field } : {})"

key-files:
  created: []
  modified:
    - src/services/supabase.ts

key-decisions:
  - "getOrderById uses supabase (anon key + JWT) not adminSupabase — RLS enforces buyer/supplier row isolation automatically"
  - "Select includes full joins: supplier:suppliers(*), buyer:buyers(*), items:order_items(*) — matches what Phase 02/03 pages need"
  - "updateOrderStatus spreads reason conditionally to avoid sending undefined field to API"

requirements-completed:
  - API-01
  - API-02
  - API-03

# Metrics
duration: 5min
completed: 2026-05-13
---

# Phase 01 Plan 05: getOrderById and updateOrderStatus rejectionReason Summary

**RLS-protected getOrderById() added to service layer with full joins; updateOrderStatus updated to pass optional rejectionReason as 'reason' in PATCH body — TypeScript compiles cleanly**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-13T23:20:00Z
- **Completed:** 2026-05-13T23:25:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added `getOrderById(orderId: string): Promise<Order | null>` to the ORDERS section of `src/services/supabase.ts`, using the RLS-protected `supabase` client (anon key + JWT). The select fetches full relational data: `*, supplier:suppliers(*), buyer:buyers(*), items:order_items(*)`
- Updated `updateOrderStatus` from a two-parameter function to accept an optional third parameter `rejectionReason?: string`, passed to the PATCH body as `reason` via conditional spread
- No new imports required — `Order` type and `supabase` client were already in scope
- TypeScript exits with code 0 after changes

## Task Commits

1. **Task 1: Add getOrderById and update updateOrderStatus signature** - `99cc111` (feat)

## Files Created/Modified

- `src/services/supabase.ts` — Added `getOrderById()` function, updated `updateOrderStatus()` signature with optional `rejectionReason` parameter

## Decisions Made

- Used `supabase` (RLS-protected anon client) for `getOrderById` — `adminSupabase` is not imported in this file and must not be. RLS policies on the `orders` table enforce that buyers see only their orders and suppliers see only orders for their store.
- The `reason` field in the PATCH body is optional — the API handler validates its presence only when `status === 'rejected'`. No client-side validation needed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — pre-existing TypeScript errors in Badge.tsx and admin/Orders.tsx (missing `in_route`/`rejected` from Record<OrderStatus, ...>) were present before this plan and are out of scope.

## Known Stubs

None.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. `getOrderById` uses the existing RLS-enforced `orders` table. Threat T-01-S-01 (Information Disclosure) is mitigated by RLS — returning `null` on any error including unauthorized access.

## Self-Check: PASSED

- FOUND: src/services/supabase.ts (modified)
- FOUND commit: 99cc111
- grep checks:
  - `getOrderById` definition: line 259 (1 match)
  - `buyer:buyers` in select: present
  - `adminSupabase`: 0 matches (correct)
  - `rejectionReason`: lines 237, 241 (2+ matches)
  - `reason: rejectionReason`: line 241 (1 match)
- TypeScript: exits with code 0

---
*Phase: 01-schema-api-backbone*
*Completed: 2026-05-13*
