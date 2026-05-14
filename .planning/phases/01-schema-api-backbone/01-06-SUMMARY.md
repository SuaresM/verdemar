---
phase: 01-schema-api-backbone
plan: "06"
subsystem: api-orders
tags: [gap-closure, idempotency, bug-fix, tdz]
dependency_graph:
  requires: ["01-01", "01-02", "01-03", "01-04", "01-05"]
  provides: ["idempotent-post-orders", "page-size-tdz-fix"]
  affects: ["api/[...route].ts", "src/services/supabase.ts"]
tech_stack:
  added: []
  patterns: ["ignoreDuplicates:true + fallback select", "count guard before insert"]
key_files:
  created: []
  modified:
    - api/[...route].ts
    - src/services/supabase.ts
decisions:
  - "Used ignoreDuplicates:true with a fallback select rather than ignoreDuplicates:false to avoid overwriting existing order data on retry"
  - "Added existingItemsCount guard instead of upsert on order_items to keep item logic simple and safe"
  - "Relocated PAGE_SIZE to module top-level (after imports) rather than introducing a module-level const initializer pattern — minimal change to fix TDZ"
metrics:
  duration: "< 5 minutes"
  completed: "2026-05-14"
  tasks_completed: 2
  files_modified: 2
---

# Phase 01 Plan 06: Close Idempotency Gap + PAGE_SIZE TDZ Summary

**One-liner:** Surgical two-file fix: idempotent POST /orders via `ignoreDuplicates:true` + fallback select + items count guard; `PAGE_SIZE` hoisted before `searchSuppliers` to eliminate TDZ ReferenceError.

## What Was Done

### Task 1: Fix idempotency bug in POST /orders (`api/[...route].ts`)

**Gap:** `ignoreDuplicates: false` caused the upsert to overwrite the existing order row on retry. The unconditional `order_items` insert then created duplicate item rows.

**Fix (Change A):** Flipped `ignoreDuplicates` to `true`. Added a fallback `select().eq('idempotency_key', ...)` for the case where PostgREST suppresses the insert and returns no row. Changed the `orderData` binding from `const` to `let` to allow reassignment from the fallback select.

**Fix (Change B):** Wrapped the `order_items` insert in a count-check guard. If `existingItemsCount > 0`, the insert is skipped entirely — the order already has items from the first request.

**Result:** A second POST with the same `idempotency_key` returns the original order row with no duplicate items created.

### Task 2: Fix PAGE_SIZE temporal dead zone (`src/services/supabase.ts`)

**Gap:** `const PAGE_SIZE = 20` was declared at line 162 (after `getFeaturedProducts`) but first referenced at line 113 inside `searchSuppliers`. JavaScript `const` is not hoisted, so any call to `searchSuppliers` at module evaluation time would throw `ReferenceError: Cannot access 'PAGE_SIZE' before initialization`.

**Fix:** Removed the declaration from line 162 and added it at line 5, immediately after the last `import` statement and before the `// ---- AUTH ----` comment. No other lines changed.

## Verification

`npx tsc --noEmit --project tsconfig.app.json` produces zero errors in `api/[...route].ts` and `src/services/supabase.ts`. Four pre-existing errors remain in `src/components/shared/Badge.tsx`, `src/pages/admin/Orders.tsx`, and `src/pages/supplier/Orders.tsx` (missing `in_route` and `rejected` keys in `Record<OrderStatus, ...>` maps) — these are out of scope for this plan.

## Deviations from Plan

None — plan executed exactly as written. Both changes were purely mechanical: one boolean flag flip + two code blocks added, and one line relocated.

## Known Stubs

None introduced by this plan.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The idempotency fallback select uses `idempotency_key` supplied by the caller; the `buyer_id !== userId` guard at line 32 runs before the upsert so a caller cannot access another user's order via a fabricated idempotency_key.

## Self-Check: PASSED

- `api/[...route].ts` modified and committed: de3f3e7
- `src/services/supabase.ts` modified and committed: de3f3e7
- `ignoreDuplicates: true` present in upsert options
- Fallback select by `idempotency_key` present when `orderData` is null
- `order_items` insert guarded by `existingItemsCount === 0` check
- `const PAGE_SIZE = 20` now appears at line 5 (before `searchSuppliers` at line ~115)
- `const PAGE_SIZE = 20` no longer present after `getFeaturedProducts`
- Zero errors in modified files from `tsc --noEmit`
