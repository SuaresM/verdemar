---
phase: user-settings-update
plan: "02"
subsystem: supplier-settings
tags: [types, form, delivery, cleanup]
dependency_graph:
  requires: []
  provides: [supplier-type-optional-delivery-fields, store-settings-delivery-card-cleaned]
  affects: [StoreSettings, Supplier interface]
tech_stack:
  added: []
  patterns: [zod-schema-removal, react-state-cleanup]
key_files:
  created: []
  modified:
    - src/types/index.ts
    - src/pages/supplier/StoreSettings.tsx
decisions:
  - "Made delivery_days, delivery_hours_start, delivery_hours_end optional in Supplier interface for backward compat — DB columns preserved, UI stops writing them"
  - "Removed deliveryDays state and toggleDay entirely; DAYS constant retained for zone modal"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-07"
  tasks_completed: 2
  tasks_total: 2
---

# Phase user-settings-update Plan 02: Remove General Delivery Fields Summary

## One-liner

Removed general delivery day chips and Início/Fim time inputs from StoreSettings form; made corresponding Supplier type fields optional for backward compatibility.

## What Was Done

Both tasks executed cleanly against the current file state (which already included Plan 01's password modal).

### Task 1 — types/index.ts

Made three `Supplier` interface fields optional:
- `delivery_days: string[]` → `delivery_days?: string[]`
- `delivery_hours_start: string` → `delivery_hours_start?: string`
- `delivery_hours_end: string` → `delivery_hours_end?: string`

DB columns are untouched. Existing callers that read or set these fields continue to compile.

### Task 2 — StoreSettings.tsx

Applied all six removals in sequence:

1. **Zod schema** — removed `delivery_hours_start` and `delivery_hours_end` fields
2. **State** — removed `deliveryDays` state (`useState<string[]>`)
3. **useForm defaultValues** — removed `delivery_hours_start` and `delivery_hours_end` entries
4. **toggleDay function** — removed entirely (general-delivery toggler, not zone toggler)
5. **onSubmit guard** — removed `if (deliveryDays.length === 0)` early-return block
6. **updates object** — removed `delivery_days`, `delivery_hours_start`, `delivery_hours_end` keys
7. **JSX** — removed "Dias de Entrega *" chip grid and the Início/Fim time `<InputField>` pair from the Entrega card

**Preserved (untouched):**
- `const DAYS = [...]` — still used by zone modal `toggleZoneDay`
- `toggleZoneDay` — zone modal day toggler
- Zone modal JSX
- `min_order_value` and `min_order_quantity` — both in schema, defaultValues, updates object, and JSX
- Password modal from Plan 01 — all state, handler, and JSX intact

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1    | b80f161 | feat(user-settings-update-02): make Supplier delivery fields optional in types/index.ts |
| 2    | 680a418 | feat(user-settings-update-02): remove general delivery fields from StoreSettings |

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. Changes reduce attack surface (fewer fields written to Supabase via `updateSupplier`). No new threat flags.

## Self-Check: PASSED

- `src/types/index.ts` — modified, `delivery_days?`, `delivery_hours_start?`, `delivery_hours_end?` confirmed
- `src/pages/supplier/StoreSettings.tsx` — modified, all removal targets confirmed absent, all preserved items confirmed present
- Commit `b80f161` — confirmed in git log
- Commit `680a418` — confirmed in git log
