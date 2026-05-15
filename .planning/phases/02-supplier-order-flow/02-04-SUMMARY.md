---
phase: 02-supplier-order-flow
plan: "04"
subsystem: api
tags: [hono, react, state-machine, polling, zustand]

# Dependency graph
requires:
  - phase: 02-supplier-order-flow
    provides: Orders page, SupplierLayout badge polling, RejectOrderModal, server state machine
provides:
  - "confirmed→rejected transition allowed in server ALLOWED table (D-09 fully implemented)"
  - "SupplierLayout polling stable on primitive supplier?.id, stale-closure risk eliminated"
  - "Orders.tsx polling guard preserves optimistic state for in-flight mutations"
affects: [02-supplier-order-flow, 03-buyer-order-view, 04-order-history]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useEffect depends on primitive id not object reference to prevent spurious re-runs"
    - "Functional setOrders updater with in-flight guard to prevent polling races"

key-files:
  created: []
  modified:
    - api/[...route].ts
    - src/App.tsx
    - src/pages/supplier/Orders.tsx

key-decisions:
  - "ALLOWED.rejected.from expanded to ['pending','confirmed'] per D-09 — supplier can reject until delivery"
  - "Polling dependency uses supplier?.id (string primitive) not supplier (object) to avoid stale-closure"
  - "Polling setOrders uses functional updater + updating[] guard to skip in-flight orders"

patterns-established:
  - "Primitive dependency pattern: useEffect deps on id strings, not whole objects"
  - "Polling guard pattern: functional setOrders updater preserves optimistic state mid-mutation"

requirements-completed:
  - SUPP-02

# Metrics
duration: 3min
completed: 2026-05-15
---

# Phase 02 Plan 04: Gap Closure Summary

**Three surgical fixes: server state machine allows confirmed→rejected (D-09), polling useEffect stabilized on primitive id, and polling load() guards in-flight orders from optimistic state overwrite**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-15T01:40:15Z
- **Completed:** 2026-05-15T01:42:40Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Unblocked SUPP-03 for confirmed orders: `ALLOWED.rejected.from` now `['pending', 'confirmed']`, so `PATCH /api/orders/:id/status { status: 'rejected' }` returns 200 (not 422) for confirmed orders
- Eliminated stale-closure risk in `SupplierLayout`: effect depends on `supplier?.id` string, captures `id` at invocation, restarts only when supplier id actually changes
- Prevented polling race in `Orders.tsx`: functional `setOrders` updater skips server data for any order whose `updating[id]` flag is truthy, preserving optimistic status mid-mutation

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix ALLOWED.rejected.from — add 'confirmed'** - `01bab9e` (fix)
2. **Task 2: WR-02 — SupplierLayout useEffect primitive dependency** - `08eb384` (fix)
3. **Task 3: WR-05 — polling load() guard for in-flight orders** - `900b74c` (fix)

**Plan metadata:** (this SUMMARY commit)

## Files Created/Modified
- `api/[...route].ts` — ALLOWED.rejected.from changed from `['pending']` to `['pending', 'confirmed']`
- `src/App.tsx` — useEffect guard + dependency array changed to `supplier?.id`; captured `id` const added
- `src/pages/supplier/Orders.tsx` — `.then((data) => setOrders(data))` replaced with functional updater checking `updating[]`

## Decisions Made
None beyond what was already specified in the plan. All three changes were fully prescribed in 02-04-PLAN.md.

## Deviations from Plan

None — plan executed exactly as written. All three edits matched the exact code shown in the plan's `<interfaces>` and `<action>` blocks.

## Issues Encountered
None. TypeScript compiled cleanly with zero errors after each individual change and after all three combined.

## Known Stubs
None. The `placeholder=` attribute found in Orders.tsx line 255 is a textarea UI hint in `RejectOrderModal` — not a data stub.

## Threat Flags
No new trust-boundary surfaces introduced. All three changes are internal state-machine corrections and React hook fixes. The expanded `ALLOWED.rejected.from` is an intentional business rule per D-09; actor verification at line 139 of `api/[...route].ts` still validates the caller is the order's supplier (T-02-04-01 accepted per threat model).

## Next Phase Readiness
- Phase 02 verification blocker is now closed: confirmed→rejected works end-to-end
- Three human-verification items from 02-VERIFICATION.md remain (push end-to-end, silent polling, badge visibility from all screens) — these require a running browser session and are not blockers for code shipping
- Phase 03 (buyer order view) and Phase 04 (order history) can proceed without dependency on these gap fixes

## Self-Check: PASSED

All files present, all commits verified:
- FOUND: `.planning/phases/02-supplier-order-flow/02-04-SUMMARY.md`
- FOUND: `api/[...route].ts`
- FOUND: `src/App.tsx`
- FOUND: `src/pages/supplier/Orders.tsx`
- FOUND commit `01bab9e` (Task 1)
- FOUND commit `08eb384` (Task 2)
- FOUND commit `900b74c` (Task 3)

---
*Phase: 02-supplier-order-flow*
*Completed: 2026-05-15*
