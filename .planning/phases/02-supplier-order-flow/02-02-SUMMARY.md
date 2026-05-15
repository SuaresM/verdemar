---
plan: 02-02
phase: 02-supplier-order-flow
status: complete
completed: 2026-05-14
commits:
  - 22882ea feat(02-02): add pendingCount prop and badge to SupplierNav
  - 24bccac feat(02-02): wire pendingCount polling in App.tsx
key-files:
  created: []
  modified:
    - src/components/layout/SupplierNav.tsx
    - src/App.tsx
---

# Plan 02-02 Summary — SupplierNav Badge + App.tsx Polling

## What Was Built

**Task 1 — SupplierNav badge (22882ea):**
- `SupplierNav.tsx` accepts `pendingCount?: number` prop (defaults to 0)
- Red badge (`bg-danger`) renders on ClipboardList icon when count > 0
- Shows numeric count for 1–9; caps at `'9+'` for 10+
- Badge hidden entirely when count is 0 (no empty circle)
- Badge positioned `absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold`

**Task 2 — App.tsx polling (24bccac):**
- `SupplierLayout` imports `getPendingOrderCount` from services
- `pendingCount` state initialized to 0
- `useEffect` guarded on `supplier != null` (avoids fetching before auth resolves)
- `setInterval(refresh, 15000)` polls every 15s; cleanup on unmount
- `pendingCount={pendingCount}` prop threaded to `<SupplierNav />`

## Self-Check: PASSED

- SupplierNav badge visible from all supplier screens ✓
- Count caps at 9+ for ≥10 pending orders ✓
- Badge absent when count = 0 ✓
- Polling fires every 15s, clears on unmount ✓
- TypeScript: 0 errors ✓

## Deviations

None. Implementation matches plan spec and all D-04/D-05/D-06 decisions exactly.
