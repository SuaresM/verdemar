---
phase: buyer-delivery-select
verified: 2026-05-13T13:59:56Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Buyer registration — type partial city text, click elsewhere (blur). Verify input resets to previous valid value and shows 'Selecione uma cidade da lista'."
    expected: "Input resets to last accepted city (or empty), red error text appears below the field."
    why_human: "Race condition between mousedown/blur at 150ms cannot be tested without a live browser; error rendering and reset on blur require user interaction."
  - test: "Buyer profile edit — open Profile edit mode, observe Cidade field renders as CityCombobox (not plain text input). Select a city. Verify Estado field auto-fills and is read-only."
    expected: "CityCombobox dropdown opens on focus; selecting a city populates Estado with the matching state abbreviation; Estado input cannot be edited."
    why_human: "Visual layout and read-only enforcement require browser rendering of the replaced grid."
  - test: "Cart page — supplier with zero delivery zones: verify red 'Fornecedor ainda não configurou horários de entrega' message appears and Finalizar button is disabled."
    expected: "Message renders in danger color; checkout button is grayed out."
    why_human: "Requires a real supplier record with no delivery_zones rows in the database."
  - test: "Cart page — supplier with delivery zones: Step 1 select shows zones formatted as 'Seg, Qua, Sex — 07:00 às 09:00'. Selecting a zone reveals Step 2 with full Portuguese day names. Selecting a day enables Finalizar and stores 'Quarta — 07:00 às 09:00' format."
    expected: "Step 1 lists zones with abbreviated days; Step 2 appears with full names; button enables; delivered string uses em-dash and Portuguese full day name."
    why_human: "Requires real delivery_zone data and live rendering. String format (em-dash character, 'às' separator) must be confirmed visually."
---

# Phase buyer-delivery-select: Verification Report

**Phase Goal:** Two buyer-facing UX improvements — (1) city field becomes strict select (must pick from CITIES list, no free text), (2) delivery time preference becomes a 2-step zone+day dropdown instead of free-text input.
**Verified:** 2026-05-13T13:59:56Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CityCombobox accepts a `strict?: boolean` prop (default false, opt-in) | VERIFIED | `strict?: boolean` on line 9 of CityCombobox.tsx; `strict = false` destructured on line 12 |
| 2 | With strict=true, blurring with non-matching text resets to lastValidCity and shows 'Selecione uma cidade da lista' | VERIFIED | Lines 44-57 of CityCombobox.tsx: 150ms onBlur timeout with `CITIES.some((c) => c.city === query)` check; `setQuery(lastValidCity.current)` and `setInternalError('Selecione uma cidade da lista')` on mismatch |
| 3 | With strict=true, selecting from dropdown clears error and accepts value | VERIFIED | `handleSelect` lines 27-33: sets `lastValidCity.current = city`, `setInternalError('')`, calls `onChange` |
| 4 | External `value` prop changes re-sync `lastValidCity` ref | VERIFIED | `useEffect` lines 18-21: `setQuery(value)` and `lastValidCity.current = value` on `[value]` dependency |
| 5 | The 150ms onBlur setTimeout is preserved | VERIFIED | Line 57: `}, 150)}` — timeout literal present, strict branch runs inside it |
| 6 | With strict=false (default), behavior is unchanged | VERIFIED | `strict = false` default; the `if (strict)` branch is not entered when strict is false |
| 7 | Buyer registration uses strict CityCombobox — submitting free text is blocked | VERIFIED | Register.tsx line 283: `strict` boolean shorthand on the existing CityCombobox element; supplier form unchanged (lines 322-323 still use plain InputField) |
| 8 | Profile edit mode uses strict CityCombobox + read-only Estado | VERIFIED | Profile.tsx line 11: CityCombobox import; lines 178-190: `<CityCombobox strict ...>` + `<input readOnly className="...bg-gray-50 text-gray-500...">` |
| 9 | Cart's delivery time field is a 2-step zone+day selector replacing free-text input | VERIFIED | Cart.tsx lines 349-401: full 3-branch conditional (no-zones/loaded/loading); DAY_LABELS, DAY_ORDER, selectedZoneId, handleZoneChange, handleDayChange all present; old `type="text"` input absent; checkout button disabled gate widened |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/shared/CityCombobox.tsx` | CityCombobox with optional strict mode | VERIFIED | Contains `strict?: boolean` (line 9), `useRef` for `lastValidCity` (line 15), `internalError` useState (line 16), strict blur branch (lines 46-56), error merge display (lines 62-64) |
| `src/pages/public/Register.tsx` | Buyer registration form with strict CityCombobox | VERIFIED | `<CityCombobox` at line 282 with `strict` boolean shorthand on line 283; supplier form unmodified |
| `src/pages/buyer/Profile.tsx` | Profile edit mode with strict CityCombobox + read-only state input | VERIFIED | CityCombobox imported (line 11), `strict` at line 179, atomic `setForm` on line 181, `readOnly` input at line 188 |
| `src/pages/buyer/Cart.tsx` | 2-step zone+day delivery selector + widened checkout-disabled gate | VERIFIED | `selectedZoneId` state (line 170), `handleZoneChange` (line 192), `handleDayChange` (line 198), 3-branch JSX (lines 352-400), widened disabled (line 406) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| CityComboboxProps | strict prop | TS interface field `strict?: boolean` | WIRED | Line 9 exact match |
| onBlur setTimeout | `CITIES.some(c => c.city === query)` check | strict branch inside 150ms timeout | WIRED | Lines 44-57 — check is inside the `setTimeout(..., 150)` callback |
| handleSelect | `lastValidCity.current` | ref update on accepted selection | WIRED | Line 28: `lastValidCity.current = city` |
| Register buyer form Cidade | CityCombobox strict prop | JSX boolean prop | WIRED | Lines 282-290: `<CityCombobox` immediately followed by `strict` |
| Profile CityCombobox onChange | `setForm(prev => ({...prev, address_city, address_state}))` | single atomic state update | WIRED | Line 181: `address_city: city, address_state: state` in one setForm call |
| Profile Estado field | readOnly input with bg-gray-50 | controlled input, no onChange | WIRED | Lines 185-190: `readOnly` + `className="...bg-gray-50 text-gray-500..."` |
| selectedZoneId state | Step 1 select value + Step 2 conditional | Record<supplierId, string> lookup | WIRED | Lines 360-392: `value={selectedZoneId[section.supplier.id] ?? ''}` drives Step 1; `activeZone` on line 292 drives Step 2 conditional |
| handleDayChange | cartStore.updateDeliveryTime | stored string label | WIRED | Lines 200-201: `updateDeliveryTime(supplierId, label)` with label built from DAY_LABELS |
| hasNoZones | checkout button disabled | boolean OR in disabled prop | WIRED | Line 406: `disabled={!isValid \|\| zones === undefined \|\| hasNoZones \|\| !section.deliveryTimePreference}` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| Cart.tsx delivery selector | `supplierZones[section.supplier.id]` | `getDeliveryZonesBySupplier` called in useEffect (lines 175-186) | Yes — async DB fetch per supplier | FLOWING |
| Cart.tsx checkout disabled | `section.deliveryTimePreference` | Written by `updateDeliveryTime` in cartStore via Zustand persist | Yes — written on day selection | FLOWING |
| Profile.tsx CityCombobox | `form.address_city` / `form.address_state` | useState initialized from `buyer?.address_city`, updated by setForm on selection | Yes — reads from buyer store and updates on selection | FLOWING |
| Register.tsx CityCombobox | `buyerForm.watch('address_city')` | react-hook-form state, written by `buyerForm.setValue` in onChange | Yes — wired to form state and submitted | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| Old free-text delivery input removed | `grep -c 'type="text"' Cart.tsx` | 0 matches | PASS |
| Old placeholder removed | `grep -c 'Ex: 07h-09h' Cart.tsx` | 0 matches | PASS |
| All 3 select branches present | `<select` count in Cart.tsx | 3 occurrences (lines 359, 381, 397) | PASS |
| CityCombobox strict in Register | `strict` attr after `<CityCombobox` in Register.tsx | Found at line 283 | PASS |
| Cidade/Estado plain inputs removed from Profile | `Input label="Cidade"` / `Input label="Estado"` in Profile.tsx | 0 matches | PASS |
| Profile atomic setForm | `address_city: city, address_state: state` in Profile.tsx | Found at line 181 | PASS |
| grid cols-2 count in Profile | `grid grid-cols-2 gap-2` occurrences | 1 occurrence (Número+Complemento grid at line 171 — Cidade+Estado grid removed) | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| strict-city-combobox | Plan 01 | CityCombobox gains strict mode prop | SATISFIED | `strict?: boolean` interface, `lastValidCity` ref, blur validation, error merge all present |
| strict-city-register | Plan 02 | Register.tsx buyer form uses strict CityCombobox | SATISFIED | `strict` prop on line 283 of Register.tsx |
| strict-city-profile | Plan 02 | Profile.tsx edit mode uses strict CityCombobox + read-only state | SATISFIED | CityCombobox at lines 178-182, readOnly input at lines 185-190 of Profile.tsx |
| delivery-zone-day-picker | Plan 03 | Cart.tsx 2-step zone+day selector replaces free-text | SATISFIED | Full implementation at lines 349-401 of Cart.tsx |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| Cart.tsx | 171 | `const [selectedDayId, setSelectedDayId] = useState<Record<string, string>>({})` — extra state not in Plan 03 spec | Info | Plan 03 spec called for `value=""` (uncontrolled Step 2) per Pitfall 3 resolution; implementation uses controlled `selectedDayId` state instead. This is a valid and arguably better approach — the selected day remains visible in the Step 2 select after selection. No stub or regression. |
| Cart.tsx | (absent) | "Selecionado: ..." confirmation line not present | Info | Plan 03 called for a `<p className="text-xs text-gray-500">Selecionado: ...</p>` line. It was omitted because the controlled `selectedDayId` approach makes it redundant — the selected value stays visible in the select itself. UX is equivalent or better. |
| Cart.tsx | 406 | `zones === undefined` extra clause in disabled gate | Info | Plan spec: `!isValid \|\| hasNoZones \|\| !section.deliveryTimePreference`. Actual: adds `zones === undefined` to also disable during loading. Stricter than spec, not a regression. |

No blockers or warnings found. All three are informational deviations that improve or maintain the intended behavior.

---

### Human Verification Required

#### 1. Strict CityCombobox blur behavior

**Test:** In buyer registration form, type "aaaa" in the Cidade field, then click somewhere else (blur without selecting from dropdown).
**Expected:** Input resets to empty string (or previously selected city if one was chosen), and the text "Selecione uma cidade da lista" appears in red below the field.
**Why human:** The 150ms blur/mousedown race and the error state rendering require a live browser interaction to confirm.

#### 2. Profile edit mode layout

**Test:** Open Perfil as a buyer, tap the edit icon. Scroll to the address section. Verify: Cidade shows as a combobox (not a plain text input), Estado shows as a grayed-out auto-fill input below it (not editable). Select "Brasília" from the dropdown. Verify Estado fills with "DF".
**Why human:** Visual layout replacement (grid removed, two stacked full-width elements) and read-only visual state require browser rendering.

#### 3. Cart — supplier with no zones

**Test:** Add a product from a supplier that has no delivery_zones rows configured. Open cart. Verify the delivery section shows the red message "Fornecedor ainda não configurou horários de entrega" and the Finalizar pedido button is disabled.
**Why human:** Requires a specific DB state (supplier with zero zones) and live rendering.

#### 4. Cart — 2-step zone+day flow end-to-end

**Test:** Add a product from a supplier with configured delivery_zones. Open cart. (a) Verify Step 1 select shows zones with abbreviated days and time, e.g. "Seg, Qua, Sex — 07:00 às 09:00". (b) Select a zone — verify Step 2 appears with full Portuguese day names sorted Mon-Sun. (c) Select a day — verify the Step 2 select shows the selected day, the Finalizar button becomes active. (d) Finalize — confirm the order is created with `delivery_time_preference` like "Quarta — 07:00 às 09:00" (em-dash, not hyphen).
**Why human:** Requires real delivery_zone data, live DB fetch, and confirmation of the em-dash character in the stored string.

---

### Gaps Summary

No gaps. All 9 must-have truths are verified by code evidence. All four requirements are satisfied. Three minor implementation deviations from plan specs were found (controlled Step 2 select, absent "Selecionado:" line, extra loading guard in disabled gate) — all are functionally equivalent or improvements over the spec, none represent missing functionality.

Human verification is required for browser-dependent behaviors: the blur/reset interaction in CityCombobox, the profile edit layout, and the end-to-end cart zone+day flow with live data.

---

_Verified: 2026-05-13T13:59:56Z_
_Verifier: Claude (gsd-verifier)_
