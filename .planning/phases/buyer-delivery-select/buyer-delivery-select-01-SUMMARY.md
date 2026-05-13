---
phase: buyer-delivery-select
plan: 01
subsystem: ui
tags: [react, typescript, combobox, form-validation, strict-mode]

# Dependency graph
requires: []
provides:
  - "CityCombobox component with opt-in strict mode (strict?: boolean prop)"
  - "Internal lastValidCity useRef for tracking last accepted selection"
  - "Internal internalError useState for blur-triggered validation messages"
  - "Strict blur validation: rejects free text, resets to last valid city"
affects:
  - buyer-delivery-select-02
  - buyer-delivery-select-03

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Opt-in strict combobox: strict=false default preserves backward compatibility"
    - "useRef for last valid value tracking (avoids useState re-render on every keystroke)"
    - "150ms onBlur setTimeout preserves mousedown-before-blur race for dropdown options"
    - "Error display merges internal validation error with external error prop"

key-files:
  created: []
  modified:
    - src/components/shared/CityCombobox.tsx

key-decisions:
  - "Used useRef (not useState) for lastValidCity to avoid re-render on every keystroke"
  - "strict=false default ensures all existing callers are byte-identical in behavior"
  - "Case-sensitive exact match (c.city === query) — no case-folding; city names contain accents (Brasilia, Paranoa)"
  - "Input border stays border-gray-200 on invalid state — error is text-only per project UI pattern"

patterns-established:
  - "Opt-in prop pattern: add strict?: boolean to combobox, default false, all callers unaffected until they opt in"

requirements-completed: [strict-city-combobox]

# Metrics
duration: 15min
completed: 2026-05-13
---

# Phase buyer-delivery-select Plan 01: CityCombobox Strict Mode Summary

**CityCombobox gains opt-in strict mode via `strict?: boolean` prop — blur without valid selection resets input and shows Portuguese validation error; useRef tracks last accepted city for reset fallback**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-13T02:35:00Z
- **Completed:** 2026-05-13T02:50:06Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `strict?: boolean` prop (default `false`) to CityComboboxProps interface — fully backward compatible
- Added `lastValidCity` useRef initialized to current value prop, synced on external value changes and selections
- Added `internalError` useState to hold "Selecione uma cidade da lista" validation message
- Extended 150ms onBlur timeout to validate query against CITIES list when strict=true; resets to lastValidCity on mismatch
- Updated dropdown option className to UI-SPEC: `py-2 min-h-[44px] font-bold` (was `py-2.5 font-medium`)
- Error display paragraph merges `internalError` and external `error` prop

## Task Commits

Each task was committed atomically:

1. **Task 1: Add strict mode to CityCombobox (props, refs, blur, error merge)** - `ea10d08` (feat)

**Plan metadata:** *(to be added after SUMMARY commit)*

## Files Created/Modified
- `src/components/shared/CityCombobox.tsx` - Added strict mode: useRef, useState, extended useEffect, updated handleSelect, expanded onBlur, merged error display, updated option className

## Note for Plan 02 Consumers

Pass `strict` (boolean) prop to opt in; default `false` keeps current behavior unchanged.

```tsx
// Strict mode — rejects free text, requires selection from CITIES list
<CityCombobox value={city} onChange={handleChange} strict />

// Default (no prop) — identical to pre-phase behavior
<CityCombobox value={city} onChange={handleChange} />
```

## Decisions Made
- Used `useRef` (not `useState`) for `lastValidCity` to avoid re-render on every keystroke (per RESEARCH.md anti-pattern note)
- `strict=false` default ensures all existing callers (Register.tsx currently) are byte-identical until Plan 02 opts them in
- Case-sensitive exact match against `CITIES[n].city` — city names contain accents (Brasilia, Paranoa); normalization is out of scope
- Input border stays `border-gray-200` on invalid state — project pattern uses error text only, not red borders on inputs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The worktree's working directory required careful path disambiguation from the main repo — writes were correctly directed to the worktree path.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `CityCombobox` is ready for Plan 02 to pass `strict` prop in `Register.tsx` and replace the plain city Input in `Profile.tsx`
- No blockers

---
*Phase: buyer-delivery-select*
*Completed: 2026-05-13*

## Self-Check

**Files exist:**
- src/components/shared/CityCombobox.tsx: FOUND (modified in worktree)

**Commits exist:**
- ea10d08: FOUND (feat: add strict mode to CityCombobox)

## Self-Check: PASSED
