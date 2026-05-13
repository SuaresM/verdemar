---
phase: buyer-delivery-select
plan: 02
subsystem: ui
tags: [react, typescript, combobox, strict-mode, profile, registration]

# Dependency graph
requires:
  - buyer-delivery-select-01  # CityCombobox strict prop
provides:
  - "Register.tsx buyer form with strict CityCombobox (rejects free-text city)"
  - "Profile.tsx edit mode with strict CityCombobox + read-only auto-filled Estado"
affects:
  - buyer-delivery-select-03

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Boolean shorthand prop (strict) — no value assignment on JSX boolean attribute"
    - "Atomic setForm spread for two related fields (address_city + address_state in single call)"
    - "readOnly input with bg-gray-50 text-gray-500 for auto-filled locked fields (UI-SPEC IC-02)"
    - "Full-width CityCombobox without grid wrapper (required for absolutely-positioned dropdown)"

key-files:
  created: []
  modified:
    - src/pages/public/Register.tsx
    - src/pages/buyer/Profile.tsx

key-decisions:
  - "Single setForm call for city + state update prevents stale state race between two updates"
  - "readOnly (not disabled) for Estado input — preserves form value in submit while signaling locked field visually"
  - "Removed grid grid-cols-2 gap-2 wrapper from Cidade+Estado block — CityCombobox absolutely-positioned dropdown requires full container width"
  - "CityCombobox label in Profile uses project micro-label class (block text-xs font-semibold text-gray-500 mb-1) consistent with existing inline Input component"

requirements-completed:
  - strict-city-register
  - strict-city-profile

# Metrics
duration: 10min
completed: 2026-05-13
---

# Phase buyer-delivery-select Plan 02: Wire strict CityCombobox to Register and Profile Summary

**Two surgical call-site edits wire the strict CityCombobox API (Plan 01) into buyer registration and profile edit mode — Register gets one new prop, Profile replaces a grid of two free-text inputs with a full-width combobox and a read-only auto-filled state field**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-13T02:55:00Z
- **Completed:** 2026-05-13T03:05:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

### Task 1 — Register.tsx (fd3bc6b)
- Added `strict` boolean shorthand prop to the existing `<CityCombobox>` in the buyer registration form (lines 282-290)
- Zero other changes — supplier form `<InputField label="Cidade" ...>` is unchanged
- Buyer registration now enforces city selection from the static CITIES list; blurring without picking resets the input

### Task 2 — Profile.tsx (54d8dcd)
- Added `import { CityCombobox } from '../../components/shared/CityCombobox'` after the supabaseClient import
- Replaced the `grid grid-cols-2 gap-2` wrapper containing `<Input label="Cidade" field="address_city" />` and `<Input label="Estado" field="address_state" />` with two full-width sibling `<div>` elements:
  - `<CityCombobox strict value={form.address_city} onChange={(city, state) => setForm((prev) => ({ ...prev, address_city: city, address_state: state }))} />`
  - `<input readOnly value={form.address_state} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-500 focus:outline-none" />`
- The `const Input = (...)` component (line 84) and all other address inputs (CEP, Rua, Número, Complemento, Bairro) are unchanged
- `handleSave` is unchanged — both `address_city` and `address_state` already live in `form` and flow to `updateBuyer(buyer.id, form)`
- Non-editing display block (`<p>` tags) is unchanged

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add strict prop to CityCombobox in buyer registration | fd3bc6b | src/pages/public/Register.tsx |
| 2 | Replace Profile city/state inputs with strict CityCombobox | 54d8dcd | src/pages/buyer/Profile.tsx |

## Files Created/Modified

- `src/pages/public/Register.tsx` — Added `strict` boolean attribute to existing CityCombobox (1 line inserted)
- `src/pages/buyer/Profile.tsx` — Added CityCombobox import; replaced Cidade+Estado grid with full-width strict combobox + readOnly state input (+16 lines, -3 lines)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — both pages wire real form state. No placeholder or hardcoded values introduced.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes. Both edits are purely client-side UI changes to existing form fields.

## Next Phase Readiness

- Plan 03 (delivery time dropdown in Cart.tsx) is independent of Plans 01 and 02. It may already be complete in a parallel worktree.
- No blockers for Plan 03.

---
*Phase: buyer-delivery-select*
*Completed: 2026-05-13*

## Self-Check

**Files exist:**
- src/pages/public/Register.tsx: FOUND
- src/pages/buyer/Profile.tsx: FOUND
- .planning/phases/buyer-delivery-select/buyer-delivery-select-02-SUMMARY.md: FOUND

**Commits exist:**
- fd3bc6b: FOUND (feat: add strict prop to CityCombobox in buyer registration)
- 54d8dcd: FOUND (feat: replace Profile city/state inputs with strict CityCombobox)

## Self-Check: PASSED
