---
phase: user-settings-update
plan: 03
subsystem: ui
tags: [react, supabase, delivery-zones, supplier-card, buyer-facing]

# Dependency graph
requires:
  - phase: user-settings-update-02
    provides: delivery_days/delivery_hours_start/delivery_hours_end made optional in Supplier type

provides:
  - getZoneCountsBySuppliers service function (batch zone count query)
  - SupplierCard with zoneCount prop showing "N cidade(s) de entrega" badge
  - Home.tsx batch zone count fetch wired to SupplierCard
  - Search.tsx batch zone count fetch in all load paths, merged on load-more
  - SupplierProfile "Sobre" tab cleaned of general delivery hours; zone list with 📍 format

affects: [buyer-facing-zone-display, SupplierCard consumers, SupplierProfile]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Batch zone count fetch: single .in() query after supplier list load, count in JS loop"
    - "loadMore merge pattern: setZoneCounts((prev) => ({ ...prev, ...newCounts })) to accumulate without discard"

key-files:
  created: []
  modified:
    - src/services/supabase.ts
    - src/components/supplier/SupplierCard.tsx
    - src/pages/buyer/Home.tsx
    - src/pages/buyer/Search.tsx
    - src/pages/buyer/SupplierProfile.tsx

key-decisions:
  - "Zone counts fetched in a single .in() query per supplier list (not N+1) then counted in JS to avoid GROUP BY complexity"
  - "loadMoreSuppliers merges new zone counts into existing state with spread pattern to preserve already-loaded counts"
  - "SupplierProfile header: ternary converted to simple && (only zone chip when zones exist, nothing otherwise)"
  - "Zone section renamed from 'Zonas de Entrega' to 'Regioes de Entrega' for buyer friendliness"

patterns-established:
  - "Batch service function pattern: getZoneCountsBySuppliers(ids[]) -> Record<string, number>"
  - "Prop-based zone count: pages fetch and own zone counts state, pass to card component"

requirements-completed: [buyer-facing-zone-display]

# Metrics
duration: 15min
completed: 2026-05-07
---

# Phase user-settings-update Plan 03: Buyer Zone Display Summary

**Replaced general delivery chips in SupplierCard with a zone-count badge fetched in a single batch query, and cleaned SupplierProfile's Sobre tab of delivery_hours/days display while making the zone list prominent with 📍 per-zone format.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-07T14:13:00Z
- **Completed:** 2026-05-07T14:28:37Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Exported `getZoneCountsBySuppliers` from `supabase.ts` — single `.in()` query batch-fetches all zone counts for a supplier list
- `SupplierCard` now shows "N cidade(s) de entrega" badge via optional `zoneCount` prop; all general delivery_hours/days display removed
- `Home.tsx` and `Search.tsx` both fetch zone counts after loading suppliers, with `Search.tsx` correctly merging new counts on load-more without discarding existing ones
- `SupplierProfile` "Sobre" tab: `delivery_hours_start/end` and `delivery_days` fallback block removed; zone list renamed to "Regioes de Entrega" with 📍 city prefix per D-05

## Task Commits

Each task was committed atomically:

1. **Task 1: Add getZoneCountsBySuppliers to supabase.ts + update SupplierCard** - `1440a55` (feat)
2. **Task 2: Wire zone counts into Home.tsx and Search.tsx** - `b5dfc47` (feat)
3. **Task 3: Remove delivery_hours display and enhance zone section in SupplierProfile.tsx** - `07c556f` (feat)

## Files Created/Modified

- `src/services/supabase.ts` - Added `getZoneCountsBySuppliers(supplierIds[]) -> Record<string, number>` at end of file
- `src/components/supplier/SupplierCard.tsx` - Added `zoneCount?: number` prop, replaced delivery_days span with zone count badge, removed delivery_hours block, removed `Clock` and `getDeliveryDaysLabel` imports
- `src/pages/buyer/Home.tsx` - Added `zoneCounts` state, batch fetch in `load` callback, pass `zoneCount` to each SupplierCard
- `src/pages/buyer/Search.tsx` - Added `zoneCounts` state, fetch in `handleSearch`, catParam `useEffect`, and `loadMoreSuppliers` (merge pattern); pass `zoneCount` to each SupplierCard
- `src/pages/buyer/SupplierProfile.tsx` - Removed `Clock` import, removed delivery_hours/days chip from header, removed fallback Entrega block from Sobre tab, renamed zone section, added 📍 prefix to zone city

## Decisions Made

- Zone counts are fetched via a single `.in(supplier_id, supplierIds)` query and counted in a JS loop rather than using a SQL `GROUP BY` — avoids PostgREST GROUP BY complexity while being equally efficient for the bounded list sizes (max 10 featured, max 20 search results per page).
- `loadMoreSuppliers` uses the merge spread pattern `(prev) => ({ ...prev, ...newCounts })` so zone counts for previously-loaded suppliers are not lost when appending more results.
- The header ternary in SupplierProfile was simplified to a plain `&&` since the `delivery_days` fallback branch is no longer needed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Buyer-facing zone display complete; all SupplierCard and SupplierProfile general delivery field rendering is gone
- Plan 04 (admin reset-password API route) runs in parallel and touches different files — no conflicts
- Both plans together complete the user-settings-update phase

---
*Phase: user-settings-update*
*Completed: 2026-05-07*
