---
phase: 02-supplier-order-flow
plan: "01"
subsystem: service-layer
tags: [supabase, utils, push-notification, foundation]
dependency_graph:
  requires: []
  provides: [getPendingOrderCount, getOrdersBySupplier-status-filter, formatOrderStatusMessage-in_route, formatOrderStatusMessage-rejected, push-deep-link-url]
  affects: [02-02, 02-03]
tech_stack:
  added: []
  patterns: [supabase-count-query, status-filter-query]
key_files:
  created: []
  modified:
    - src/services/supabase.ts
    - src/utils/index.ts
    - api/[...route].ts
decisions:
  - "Keep in_delivery entry in formatOrderStatusMessage for legacy orders (not removed)"
  - "getPendingOrderCount placed after getOrderById as a thin extract of getSupplierDashboard count query"
  - "Push title exclamation mark removed per UI-SPEC copywriting contract"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-14T19:01:15Z"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 3
---

# Phase 02 Plan 01: Service Layer Foundation Summary

Three pre-existing gaps in the service layer, utility function, and push payload fixed with surgical diffs — getOrdersBySupplier now filters to active statuses only, formatOrderStatusMessage handles in_route and rejected with human-readable Portuguese WhatsApp copy, and the push notification URL carries the order id query param for deep-link routing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add status filter to getOrdersBySupplier and export getPendingOrderCount | 057f669 | src/services/supabase.ts |
| 2 | Fix formatOrderStatusMessage missing cases | fed9a2c | src/utils/index.ts |
| 3 | Fix push notification URL to include order id deep-link param | a74c885 | api/[...route].ts |

## Verification Results

All 6 plan verification checks passed:
1. `.in('status', ['pending', 'confirmed', 'in_route'])` present in getOrdersBySupplier (line 228)
2. `export async function getPendingOrderCount` present (line 270)
3. `in_route:` entry present in formatOrderStatusMessage messages map (line 100)
4. `rejected:` entry present in formatOrderStatusMessage messages map (line 103)
5. `supplier/orders?order=` count in api/[...route].ts = 1
6. Zero new TypeScript errors introduced in the three modified files

## Changes Made

### src/services/supabase.ts

**getOrdersBySupplier** — Added `.in('status', ['pending', 'confirmed', 'in_route'])` between `.eq('supplier_id', supplierId)` and `.order(...)`. Excludes delivered/cancelled/rejected per D-02. No other callers of this function exist (confirmed via grep before change).

**getPendingOrderCount** — New exported function inserted after `getOrderById`. Thin extract of the identical count query already used inside `getSupplierDashboard` (line ~367). Returns `Promise<number>` — ready for Plan 02 to consume in SupplierLayout badge polling.

### src/utils/index.ts

**formatOrderStatusMessage** — Added two entries to the `messages` map:
- `in_route`: same delivery copy as legacy `in_delivery` (matching emoji, `\n\n` line breaks, `_Rota Verde 🌿_` footer)
- `rejected`: refusal copy with human-readable Portuguese explanation

Legacy `in_delivery` entry kept — historic orders with that status still resolve to a readable message.

### api/[...route].ts

**sendPush call** — Two changes:
- `url` changed from `'/supplier/orders'` (string literal) to `` `/supplier/orders?order=${orderData.id}` `` (template literal) — enables service worker deep-link routing per D-11/D-13/PUSH-01
- `title` changed from `'Novo pedido recebido!'` to `'Novo pedido recebido'` (exclamation mark removed per UI-SPEC copywriting contract)

`body` field unchanged — kept simpler `Pedido #XXXXX aguardando confirmação` format (richer buyer-name body deferred per RESEARCH.md assumption A2).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no stub patterns introduced. All changes wire real data paths.

## Threat Flags

No new security-relevant surface introduced. All changes are within pre-existing trust boundaries documented in the plan's threat model (T-02-01, T-02-02, T-02-03 all accepted).

## Self-Check: PASSED

Files exist:
- src/services/supabase.ts — FOUND (modified, verified via grep)
- src/utils/index.ts — FOUND (modified, verified via grep)
- api/[...route].ts — FOUND (modified, verified via grep)

Commits exist:
- 057f669 — FOUND (git log confirmed)
- fed9a2c — FOUND (git log confirmed)
- a74c885 — FOUND (git log confirmed)
