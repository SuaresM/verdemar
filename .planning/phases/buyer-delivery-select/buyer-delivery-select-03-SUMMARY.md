---
phase: buyer-delivery-select
plan: "03"
subsystem: buyer-cart
tags: [delivery-selector, zone-picker, cart]
key-files:
  created: []
  modified:
    - src/pages/buyer/Cart.tsx
metrics:
  tasks_completed: 2
  tasks_total: 2
  commits: 2
  files_modified: 1
---

# Plan 03 Summary — Cart 2-step zone+day selector

## What Was Built

Replaced free-text `deliveryTimePreference` input in Cart.tsx with a structured 2-step zone→day selector for each supplier section.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 03-T1 | 68a1b6b | Add zone+day picker data plumbing — DAY_LABELS, DAY_ORDER, selectedZoneId state, handleZoneChange, handleDayChange, derived values |
| 03-T2 | d2d9145 | Replace delivery time input with 3-branch conditional: loading / no-zones / 2-step selector; widen checkout disabled gate |

## Key Decisions

- Step 2 uses `value=""` (uncontrolled) to avoid English-key vs Portuguese-label mismatch (Pitfall 3 from RESEARCH.md)
- "Selecionado: **{day+time}**" confirmation line below Step 2 confirms selection without needing controlled value
- Checkout button disabled: `!isValid || hasNoZones || !section.deliveryTimePreference`
- No DB changes — `delivery_time_preference` column stores `"Quarta — 07:00 às 09:00"` format unchanged

## Deviations

None — implemented exactly per CONTEXT.md D-02 spec and UI-SPEC.md.

## Self-Check: PASSED

- [x] `selectedZoneId` state declared at Cart component level
- [x] `DAY_LABELS` and `DAY_ORDER` constants defined
- [x] Step 1 shows zones formatted as `"Seg, Qua, Sex — 07:00 às 09:00"`
- [x] Step 2 appears only after zone selected (conditional on `activeZone`)
- [x] No-zones shows `text-xs text-danger font-bold` message
- [x] Loading shows disabled select with `Carregando...` and `opacity-50`
- [x] Checkout button widened: `disabled={!isValid || hasNoZones || !section.deliveryTimePreference}`
