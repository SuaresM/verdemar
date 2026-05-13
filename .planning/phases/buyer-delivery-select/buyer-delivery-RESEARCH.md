# Phase buyer-delivery-select — Research

**Researched:** 2026-05-12
**Domain:** React component state management, controlled/uncontrolled form patterns, cascading select UI, Zustand cart store
**Confidence:** HIGH — all findings come from direct codebase inspection

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Strict city selection**
- CityCombobox becomes strict via a `strict?: boolean` prop (default `false` for backward compat)
- On blur without selection: reset input to `lastValidCity` (or `""`) + show error "Selecione uma cidade da lista"
- City list: static `CITIES` constant in `src/constants/cities.ts` — do NOT query DB
- `address_state` auto-fills from `City.state` when city is selected
- Enforce in `Register.tsx` (already uses CityCombobox — pass `strict` prop) and `Profile.tsx` (replace plain `<Input field="address_city">` with strict CityCombobox)
- Neighborhood (`address_neighborhood`) stays free-text — no change
- Cart city mismatch amber warning: unchanged (keep existing `hasCityMismatch()`, do NOT block checkout)

**D-02 — Delivery time dropdown (2-step)**
- Replace free-text `<input>` in Cart.tsx with two `<select>` elements driven by `supplierZones`
- Step 1: zone select — option format `"Seg, Qua, Sex — 07:00 às 09:00"` (3-letter abbreviations)
- Step 2: day select — appears after zone chosen — full day names (`"Segunda"`, `"Quarta"`, etc.)
- Stored value format: `"Quarta — 07:00 às 09:00"` in existing `delivery_time_preference: string | null` column
- Local state: `const [selectedZoneId, setSelectedZoneId] = useState<Record<string, string>>({})` in Cart component
- Loading state: single disabled `<select>` with `opacity-50` and option "Carregando..."
- No-zones fallback: `<p className="text-xs text-danger font-bold">Fornecedor ainda não configurou horários de entrega</p>`
- Checkout gate: button disabled when `hasNoZones` OR `!section.deliveryTimePreference`
- No DB schema changes required

### Claude's Discretion
- None noted in CONTEXT.md

### Deferred Ideas (OUT OF SCOPE)
- Blocking checkout when city mismatches supplier zones (keep amber warning only)
- Dynamic city list from DB delivery_zones
- Neighborhood (bairro) strict select
- Showing delivery city per zone in the dropdown
- Supplier-side enforcement that zones must be configured before going active
</user_constraints>

---

## Summary

This phase is a pure frontend refactor across four files. It has no backend changes, no new dependencies, and no new component files. The entire implementation is within existing code boundaries.

**D-01 (strict city)** adds a `strict` prop to `CityCombobox.tsx` and wires it into the two places that collect buyer city data. The core mechanism is: track `lastValidCity` in a `useRef` (updated only on `handleSelect`); on `onBlur`, check whether `query` exactly matches any `CITIES[n].city`; if not, reset `query` to `lastValidCity` and call `setError`. The component already has an internal `error` state path via the `error` prop — this needs to be made controllable from within (internal error state for the strict blur case) without breaking the external `error` prop path used by Register.

**D-02 (zone picker)** replaces a `<input type="text">` in Cart.tsx with two conditional `<select>` elements. The only new state is `selectedZoneId: Record<string, string>` — a local Cart component state, not persisted in Zustand. The existing `updateDeliveryTime(supplierId, time)` action in `cartStore.ts` is unchanged. The existing `hasNoZones` condition plus `!section.deliveryTimePreference` drives the checkout button disabled state, which already uses `disabled:opacity-40 disabled:cursor-not-allowed`.

**Primary recommendation:** Implement D-01 by adding a `useRef<string>` for `lastValidCity` inside CityCombobox and an internal `errorMsg` state that merges with the external `error` prop. Implement D-02 by inserting the `selectedZoneId` state at Cart component top-level and replacing the delivery-time `<div>` block in-place.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Strict city validation | Browser/Client | — | Input validation that fires on blur; no server round-trip needed; CITIES list is static and already client-side |
| City state auto-fill | Browser/Client | — | Pure derived data: `CITIES.find(c => c.city === selected).state`; no DB query |
| Delivery zone loading | Browser/Client (async) | Supabase DB | Zones already fetched via `getDeliveryZonesBySupplier` in Cart useEffect; no change to fetching logic |
| Zone/day selection state | Browser/Client (local state) | — | `selectedZoneId` is ephemeral UI state — not persisted, not sent to server until checkout |
| Stored delivery preference | Zustand (persisted) | Supabase DB (on order create) | `deliveryTimePreference` in CartSection lives in zustand-persist; written to DB only at `createOrder()` call |
| Checkout gate | Browser/Client | — | Simple boolean: `hasNoZones \|\| !section.deliveryTimePreference` — drives `disabled` prop on existing button |

---

## Standard Stack

### Core (already in project — no installs needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x | Component rendering, useState, useRef, useEffect | Project foundation |
| TypeScript | 5.x | Type safety for new props/state | Project foundation |
| Tailwind CSS | 3.x | Utility classes for all styling | Project design system — no shadcn |
| Zustand | 4.x (with persist) | Cart store: `updateDeliveryTime` action | Already used in Cart, cartStore.ts |
| react-hook-form | 7.x | Form state in Register.tsx — `setValue`, `watch` | Register.tsx already uses it |

### No New Dependencies
This phase introduces zero new npm packages. Everything needed is already installed.

---

## Architecture Patterns

### System Architecture Diagram

```
CITIES constant (static)
        |
        v
CityCombobox.tsx [strict mode added]
  - query: string (display state)
  - lastValidCity: useRef<string> (tracks last accepted value)
  - internalError: string (strict blur error)
  - onBlur: validate → reset or accept
        |
        |--- onChange(city, state) callback
        v
Register.tsx                     Profile.tsx
[react-hook-form]                [local form state: useState]
setValue('address_city', city)   setForm(prev => ({...prev, address_city: city, address_state: state}))
setValue('address_state', state)

===

Cart.tsx
  useState: expandedSections, checkoutSection, supplierZones, [NEW] selectedZoneId
        |
        | useEffect → getDeliveryZonesBySupplier (existing, unchanged)
        v
  supplierZones: Record<supplierId, DeliveryZone[]>
        |
        v
  For each CartSection:
    zones undefined → loading <select disabled>
    zones.length === 0 → <p text-danger> + button disabled
    zones.length > 0 →
      Step 1 <select> (zone picker) → handleZoneChange → setSelectedZoneId, updateDeliveryTime('', '')
      Step 2 <select> (day picker, conditional) → handleDayChange → updateDeliveryTime(label)
        |
        v
  cartStore.updateDeliveryTime(supplierId, label)
  CartSection.deliveryTimePreference = "Quarta — 07:00 às 09:00"
        |
        v
  Checkout button: disabled = hasNoZones || !section.deliveryTimePreference
        |
        v
  createOrder({ delivery_time_preference: section.deliveryTimePreference })
```

### Recommended Project Structure
No structural changes. All edits are within existing files:
```
src/
├── components/shared/CityCombobox.tsx   -- D-01: add strict prop + blur validation
├── pages/public/Register.tsx            -- D-01: pass strict prop to CityCombobox
├── pages/buyer/Profile.tsx              -- D-01: replace Input with CityCombobox
└── pages/buyer/Cart.tsx                 -- D-02: replace delivery input with 2-step select
```

### Pattern 1: CityCombobox Strict Mode

**What:** Add `strict?: boolean` prop. Track last valid city in a `useRef`. On blur, validate against CITIES array. If invalid, reset and show error.

**Current blur handling (line 38):**
```tsx
onBlur={() => setTimeout(() => setOpen(false), 150)}
```
The 150ms delay already exists to let `onMouseDown` on a dropdown option win before blur fires. This mechanism is correct and must be preserved in the strict version.

**Strict mode addition:**
```tsx
// Source: direct codebase read of CityCombobox.tsx
const lastValidCity = useRef<string>(value)  // tracks last accepted city
const [internalError, setInternalError] = useState<string>('')

const handleSelect = (city: string, state: string) => {
  lastValidCity.current = city   // update on confirmed selection
  setQuery(city)
  setInternalError('')
  onChange(city, state)
  setOpen(false)
}

// In onBlur, after the 150ms timeout:
onBlur={() => setTimeout(() => {
  setOpen(false)
  if (strict) {
    const isValid = CITIES.some(c => c.city === query)
    if (!isValid) {
      setQuery(lastValidCity.current)
      setInternalError('Selecione uma cidade da lista')
    } else {
      setInternalError('')
    }
  }
}, 150)}

// Error display — merge internal and external:
const displayError = internalError || error
{displayError && <p className="text-danger text-xs mt-1">{displayError}</p>}
```

**Critical detail:** The `useEffect` that syncs `value` prop to `query` state (lines 15-17 in current file) also needs to reset `lastValidCity.current` when the external value changes (e.g., when form resets or Profile reopens edit mode).

```tsx
useEffect(() => {
  setQuery(value)
  lastValidCity.current = value  // keep ref in sync with external value
}, [value])
```

### Pattern 2: Profile.tsx City Field Replacement

**What:** Profile uses a local `form` state object (`useState`) — not react-hook-form. City update must call `setForm` with both `address_city` and `address_state`.

**Current pattern (lines 174-176):**
```tsx
// grid with two Input components:
<Input label="Cidade" field="address_city" />
<Input label="Estado" field="address_state" />
```

**Replacement pattern:**
```tsx
// Source: direct codebase read of Profile.tsx
<div>
  <label className="block text-xs font-semibold text-gray-500 mb-1">Cidade</label>
  <CityCombobox
    strict
    value={form.address_city}
    onChange={(city, state) => setForm(prev => ({ ...prev, address_city: city, address_state: state }))}
  />
</div>
<div>
  <label className="block text-xs font-semibold text-gray-500 mb-1">Estado</label>
  <input
    value={form.address_state}
    readOnly
    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-500 focus:outline-none"
  />
</div>
```

The `address_state` input becomes read-only after city auto-fill. Per the UI-SPEC (IC-02): "State field becomes read-only display after auto-fill — buyer cannot manually edit the state when using strict CityCombobox." The read-only input with `bg-gray-50` communicates its locked nature visually without adding a new pattern.

**Important:** The existing grid (`grid grid-cols-2 gap-2`) wrapping Ciudad + Estado can be broken — CityCombobox is full-width (`w-full`) and should not be constrained to a half-grid column. Replace the grid with two stacked `<div>` elements.

### Pattern 3: Register.tsx Strict Prop Pass-Through

**What:** Register already uses CityCombobox correctly with `onChange={(city, state) => { buyerForm.setValue(...) }}`. The only change is adding the `strict` prop.

**Current (lines 282-289):**
```tsx
<CityCombobox
  value={buyerForm.watch('address_city') || ''}
  onChange={(city, state) => {
    buyerForm.setValue('address_city', city, { shouldValidate: true })
    buyerForm.setValue('address_state', state, { shouldValidate: true })
  }}
  error={buyerForm.formState.errors.address_city?.message}
/>
```

**Change:** Add `strict` prop:
```tsx
<CityCombobox
  strict
  value={buyerForm.watch('address_city') || ''}
  onChange={...}
  error={buyerForm.formState.errors.address_city?.message}
/>
```

No other changes in Register.tsx. Note: `address_state` field is already hidden from Register's buyer form UI — it is set programmatically via `setValue` and submitted in registration data. The hidden field approach is unchanged.

### Pattern 4: Cart.tsx 2-Step Zone Picker

**What:** New local state for zone selection; replace delivery time input div with conditional select blocks.

**State addition (at Cart component top level, after existing useState declarations):**
```tsx
// Source: direct codebase read of Cart.tsx line 158 area
const [selectedZoneId, setSelectedZoneId] = useState<Record<string, string>>({})
```

**Constants (top of file, after imports):**
```tsx
const DAY_LABELS: Record<string, string> = {
  monday: 'Segunda', tuesday: 'Terça', wednesday: 'Quarta',
  thursday: 'Quinta', friday: 'Sexta', saturday: 'Sábado', sunday: 'Domingo',
}
const DAY_ORDER = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
```

**Handlers (inside Cart component, before return):**
```tsx
const handleZoneChange = (supplierId: string, zoneId: string) => {
  setSelectedZoneId(prev => ({ ...prev, [supplierId]: zoneId }))
  updateDeliveryTime(supplierId, '')  // clear day selection when zone changes
}

const handleDayChange = (supplierId: string, day: string, zone: DeliveryZone) => {
  const label = `${DAY_LABELS[day] ?? day} — ${zone.hours_start} às ${zone.hours_end}`
  updateDeliveryTime(supplierId, label)
}
```

**Delivery time block replacement (replaces lines 321-331):**

The complete JSX block is already specified in CONTEXT.md with exact CSS classes. The checkout button condition changes from `disabled={!isValid}` to `disabled={!isValid || hasNoZones || !section.deliveryTimePreference}`. The variables `zones`, `hasNoZones`, and `activeZone` must be derived inside the section `.map()` callback.

### Anti-Patterns to Avoid

- **Mutating `lastValidCity` as state instead of ref:** Would cause re-renders on every keystroke as user types. Use `useRef` — it does not trigger renders.
- **Case-insensitive match for strict validation:** The CONTEXT.md specifies exact match against `CITIES[n].city` (case-sensitive). Cities have accents (`Brasília`, `Paranoá`) — a lowercase comparison would require careful normalization. Stick to exact match as specified.
- **Deriving `hasNoZones` outside the map:** `zones` must be accessed as `supplierZones[section.supplier.id]` inside the per-section render. Computing it before the map would require the section reference.
- **Persisting `selectedZoneId` in Zustand or cartStore:** Zone selection is ephemeral UI state — it belongs in local component state. If the user navigates away and back, the zone resets to nothing while `deliveryTimePreference` (from Zustand persist) may still hold the previously stored value. This is acceptable: the stored value is already human-readable (`"Quarta — 07:00 às 09:00"`) and remains valid.
- **Breaking the Profile `<Input>` component API:** Profile's local `Input` component (defined inline at line 83) uses `field: keyof typeof form`. Do not try to extend it to handle CityCombobox — render CityCombobox directly in JSX as shown in Pattern 2.
- **Adding red border to invalid city input:** UI-SPEC explicitly states "input border stays border-gray-200 — do NOT add a red border." Error is text-only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Blur timing for combobox option selection | Custom click-capture logic | Existing 150ms `setTimeout` in onBlur | Already handles mousedown-before-blur race condition correctly |
| Day label mapping | Custom lookup | `DAY_LABELS` constant defined in CONTEXT.md | Matches the same `DAYS` array already in Register.tsx and StoreSettings.tsx |
| Zone sort order | Alphabetical sort | `DAY_ORDER` index sort as in CONTEXT.md | Days must appear in week order (Mon-Sun), not alphabetical |
| Cart store persistence | Custom localStorage | Zustand `persist` middleware already in cartStore | `deliveryTimePreference` already persists correctly via existing middleware |

---

## Q&A: Research Questions Answered

### Q1: How does CityCombobox currently handle blur/selection? What is the minimal change to make it strict?

**Current blur handling:** `onBlur={() => setTimeout(() => setOpen(false), 150)}` — the 150ms delay allows `onMouseDown` on a dropdown button to fire before blur closes the dropdown. This is the correct pattern to preserve.

**Current selection:** `handleSelect` sets `query` state and calls `onChange(city, state)` — no tracking of "last valid" value.

**Minimal strict change:**
1. Add `strict?: boolean` to props interface
2. Add `const lastValidCity = useRef<string>(value)` and `const [internalError, setInternalError] = useState('')`
3. Update `useEffect` to also set `lastValidCity.current = value`
4. Update `handleSelect` to set `lastValidCity.current = city` and clear `internalError`
5. Expand `onBlur` setTimeout to conditionally validate and reset
6. Display `internalError || error` for the error paragraph

**Total new lines in CityCombobox.tsx:** approximately 12-15 lines changed/added.

### Q2: How does Profile.tsx manage form state for address fields? What pattern to update buyer fields?

Profile uses a plain `useState` object (`form`) with `setForm(prev => ({ ...prev, [field]: value }))`. This is the **local state pattern** — not react-hook-form. There is no `setValue` or `register` — just direct state mutation.

The city field update in Profile must call:
```tsx
setForm(prev => ({ ...prev, address_city: city, address_state: state }))
```

Both fields update in a single `setForm` call (atomic, no risk of stale state between city and state fields).

The `handleSave` function (line 39) calls `updateBuyer(buyer.id, form)` — `form` already contains `address_city` and `address_state`, so no changes to the save path are needed.

### Q3: What is the current Cart.tsx pattern for deliveryTimePreference and how does it integrate with cartStore?

**Current pattern (lines 321-331):** A controlled `<input type="text">` that calls `updateDeliveryTime(section.supplier.id, e.target.value)` on every keystroke.

**CartStore.updateDeliveryTime (line 128-132):** Updates `deliveryTimePreference` in the matching CartSection. The field is a plain string in the `CartSection` interface. No validation or transformation in the store.

**Integration:** `deliveryTimePreference` flows to `createOrder({ delivery_time_preference: ... })` at checkout (line 203). The format `"Quarta — 07:00 às 09:00"` is a readable string stored directly in the `delivery_time_preference` DB column (already `string | null`).

**No changes to cartStore.ts are needed.** `updateDeliveryTime` already accepts any string.

### Q4: What local state management is needed in Cart.tsx for the 2-step zone picker?

Single new `useState` at Cart component level:
```tsx
const [selectedZoneId, setSelectedZoneId] = useState<Record<string, string>>({})
```

Keyed by `supplierId`. Cleared per-supplier on zone change (sets to `''` for that key, which causes Step 2 to hide). No need for a `selectedDay` state — the day selection writes directly to `deliveryTimePreference` via `updateDeliveryTime`.

Per-section derived values (inside the map):
```tsx
const zones = supplierZones[section.supplier.id]         // undefined = loading, [] = no zones
const hasNoZones = zones !== undefined && zones.length === 0
const activeZone = zones?.find(z => z.id === selectedZoneId[section.supplier.id])
```

### Q5: Are there any existing patterns for cascading selects in this codebase?

No cascading select pattern exists in this codebase. The closest analogy is `StoreSettings.tsx` zone modal, which uses a day-toggle button grid followed by time inputs — not a cascading select. The 2-step zone+day pattern in Cart.tsx is a new interaction pattern for this project.

However, the `supplierZones` async loading pattern IS established in Cart.tsx (lines 162-173) — the same `Record<string, DeliveryZone[]>` state is already there. The zone picker simply consumes it.

### Q6: What does the disabled button pattern look like (for when hasNoZones)?

**Existing disabled pattern in Cart.tsx (line 337):**
```tsx
<button
  onClick={() => setCheckoutSection(section)}
  disabled={!isValid}
  className="w-full bg-primary text-white font-bold py-3 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed text-sm"
>
```

The `disabled:opacity-40 disabled:cursor-not-allowed` classes are already present. The only change is expanding the disabled condition:
```tsx
disabled={!isValid || hasNoZones || !section.deliveryTimePreference}
```

No visual changes to the button needed — same class string, wider disabled condition.

---

## Common Pitfalls

### Pitfall 1: Blur fires before mousedown on option button
**What goes wrong:** User clicks an option in the dropdown; blur fires first, strict mode resets the input, option click is ignored.
**Why it happens:** Browser fires `blur` before `click` but after `mousedown`.
**How to avoid:** The existing 150ms `setTimeout` on blur is the correct fix — it gives `onMouseDown` time to fire. Preserve this timing in the strict version. Do NOT convert option `<button>` to use `onClick` without also ensuring `onMouseDown` still fires for the delay.
**Warning signs:** In testing, clicking an option resets input to empty instead of selecting.

### Pitfall 2: `lastValidCity` ref out of sync with external `value` prop
**What goes wrong:** User opens Profile edit mode with existing city "Brasília". They clear the field and type partial text, then blur. Strict mode should reset to "Brasília" (last valid). But if `lastValidCity.current` was initialized to `""` (not to `value`), it resets to empty string.
**Why it happens:** `useRef(value)` initializes from the prop at mount time, but if `value` changes (e.g., Profile toggles edit mode), the ref does not auto-update.
**How to avoid:** The `useEffect([value])` that syncs `query` must also sync `lastValidCity.current = value`.
**Warning signs:** After selecting a city in one session, cancelling edit, reopening edit, and blurring the unchanged city field causes it to reset to empty.

### Pitfall 3: Zone select Step 2 value mismatch
**What goes wrong:** Step 2 select `value` is set to `section.deliveryTimePreference.split(' — ')[0]` to extract the day label. But `DAY_LABELS` maps English keys (`'monday'`) to Portuguese labels (`'Segunda'`), while the `<option value={d}>` uses the English key. The value extracted from the stored string (`"Segunda"`) won't match an option value (`"monday"`).
**Why it happens:** The select option `value` is the English key (`monday`, `tuesday`, etc.), but `deliveryTimePreference` stores the Portuguese label.
**How to avoid:** The Step 2 select value should be derived differently — either store the English key separately in a state, or leave the select uncontrolled (no `value` prop) after selection. The simplest fix: after zone change clears `deliveryTimePreference`, Step 2 shows with placeholder. After day selection, `deliveryTimePreference` is set. The select should show the current selection — but since we don't have the raw key anymore, use `value=""` (placeholder) for the select and rely on re-selection if zone changes. Alternatively track `selectedDay: Record<string, string>` similar to `selectedZoneId`.
**Warning signs:** After selecting "Quarta", the Step 2 select shows placeholder instead of "Quarta".

> **Resolution for Pitfall 3:** The CONTEXT.md code snippet shows `value={section.deliveryTimePreference ? section.deliveryTimePreference.split(' — ')[0] : ''}` for the day select. This extracts the Portuguese day name (e.g., `"Quarta"`). For this to work as a controlled select, the option values must be the Portuguese names too. But the CONTEXT.md options are `value={d}` where `d` is the English key. **Recommendation:** Use uncontrolled day select (no `value` prop) OR track `selectedDay` per supplier in local state. The planner should choose: either add `const [selectedDay, setSelectedDay] = useState<Record<string,string>>({})` alongside `selectedZoneId`, or use the uncontrolled approach. Both are valid.

### Pitfall 4: Profile grid layout breaks CityCombobox width
**What goes wrong:** The current address fields use `grid grid-cols-2 gap-2` for Cidade+Estado. CityCombobox has `w-full` and a dropdown with `absolute z-50 w-full`. If constrained to `col-span-1` half-width, the dropdown is also half-width and truncates city names.
**Why it happens:** Grid column constraint on parent div clips the full-width child.
**How to avoid:** Remove the grid wrapper for Cidade+Estado. Render CityCombobox and the read-only Estado input as two separate full-width stacked elements.
**Warning signs:** Dropdown appears narrow; city names wrap or truncate.

### Pitfall 5: hasNoZones triggers before zones are loaded
**What goes wrong:** `zones = supplierZones[supplierId]` returns `undefined` while loading. The condition `zones !== undefined && zones.length === 0` correctly avoids `hasNoZones = true` during loading. But if the condition is written as `zones?.length === 0`, it returns `false` when `zones` is `undefined` (correct) but could silently mask bugs.
**Why it happens:** `undefined?.length === 0` → `undefined === 0` → `false` — technically works but is less explicit.
**How to avoid:** Use the explicit two-part condition from CONTEXT.md: `const hasNoZones = zones !== undefined && zones.length === 0`.

---

## Code Examples

### CityCombobox — new props interface
```tsx
// Source: direct read of src/components/shared/CityCombobox.tsx
interface CityComboboxProps {
  value: string
  onChange: (city: string, state: string) => void
  placeholder?: string
  error?: string
  strict?: boolean  // NEW
}
```

### Profile.tsx — city block replacement (full section, edit mode)
```tsx
// Source: direct read of src/pages/buyer/Profile.tsx lines 167-179
// Before: <div className="grid grid-cols-2 gap-2"><Input label="Cidade" ... /><Input label="Estado" ... /></div>
// After:
<div>
  <label className="block text-xs font-semibold text-gray-500 mb-1">Cidade</label>
  <CityCombobox
    strict
    value={form.address_city}
    onChange={(city, state) => setForm(prev => ({ ...prev, address_city: city, address_state: state }))}
  />
</div>
<div>
  <label className="block text-xs font-semibold text-gray-500 mb-1">Estado</label>
  <input
    value={form.address_state}
    readOnly
    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-500 focus:outline-none"
  />
</div>
```

### Cart.tsx — checkout button disabled condition
```tsx
// Source: direct read of src/pages/buyer/Cart.tsx line 334-340
// Before: disabled={!isValid}
// After:
disabled={!isValid || hasNoZones || !section.deliveryTimePreference}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Free-text city input (Register) | CityCombobox with filtering | Already in codebase | Phase adds strict enforcement on top |
| Free-text delivery time input | 2-step zone+day select | This phase | Buyer selects from supplier's actual configured slots |
| `address_state` manually editable in Profile | Read-only, auto-filled from selected city | This phase | State always matches city; reduces user error |

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely frontend code changes with no external service dependencies, CLI tools, or build process changes beyond the existing Vite+React dev server.

---

## Validation Architecture

No `config.json` found in `.planning/`. Treating `nyquist_validation` as enabled (absent = enabled).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no test config files found in codebase scan |
| Config file | None — Wave 0 gap |
| Quick run command | TBD (no framework installed) |
| Full suite command | TBD |

No test files, no jest/vitest config, no `__tests__` directories were found in the project. This is a frontend-only project with no existing test infrastructure.

### Phase Requirements → Test Map

| Behavior | Test Type | Notes |
|----------|-----------|-------|
| CityCombobox strict blur resets invalid input | Unit | Requires DOM testing (fireEvent blur) |
| CityCombobox strict blur accepts valid city | Unit | Same |
| CityCombobox state auto-fill on selection | Unit | Check onChange callback args |
| Zone select shows zones after load | Component | Requires mock of getDeliveryZonesBySupplier |
| Day select appears after zone selected | Component | Same |
| Checkout button disabled when no zones | Component | Same |
| Checkout button disabled when day not selected | Component | Same |
| Stored value format is "Quarta — 07:00 às 09:00" | Unit | Test handleDayChange output |

### Wave 0 Gaps
- [ ] No test framework installed — if tests are required, Wave 0 must install vitest + @testing-library/react
- [ ] No test files for CityCombobox, Cart, Profile, or Register exist

*(If testing is out of scope for this phase, skip Wave 0 gap items — planner should clarify.)*

---

## Security Domain

This phase has no authentication, authorization, data validation for persistence, or cryptography changes. It adds client-side input validation (blur validation) and replaces a free-text input with a constrained select. No ASVS categories apply beyond V5 Input Validation, which is satisfied by the strict city combobox at the UI level. The server-side `delivery_time_preference` column is still a free string — no server-side validation is added for the stored format.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The read-only `address_state` input in Profile edit mode should use `bg-gray-50 text-gray-500` styling to visually indicate it is locked | Pattern 2 | If project convention differs, different classes needed — cosmetic only |
| A2 | No test framework is installed (based on absence of test config files in codebase scan) | Validation Architecture | If tests exist elsewhere (e.g., Cypress e2e not visible in src/), the Wave 0 gap items are already resolved |
| A3 | `selectedZoneId` should NOT be reset when sections change (e.g., if buyer adds a new supplier section) | Pattern 4 | If it should reset, a useEffect watching sections would be needed — low impact either way |

---

## Open Questions (RESOLVED)

1. **Controlled vs. uncontrolled Step 2 select (Pitfall 3)**
   - What we know: CONTEXT.md code snippet uses `value={section.deliveryTimePreference.split(' — ')[0]}` which extracts a Portuguese label, but option `value` props are English keys
   - What's unclear: Whether the CONTEXT.md intended option values to be Portuguese labels (matching the stored format) or English keys
   - Recommendation: Use English keys as option values AND track `selectedDay: Record<string, string>` as a second local state alongside `selectedZoneId`. This gives clean controlled behavior. Alternatively, make option `value={DAY_LABELS[d]}` (Portuguese) to match the split. Either way — planner should pick one and be consistent.
   - **RESOLVED:** Use uncontrolled Step 2 select (`value=""`) + explicit "Selecionado: **{day}**" confirmation line below the cascade. Avoids the value/key mismatch entirely. No extra state needed. (Plan 03 Task 2)

2. **CityCombobox option class in UI-SPEC vs current code**
   - What we know: UI-SPEC specifies `px-4 py-2 min-h-[44px] text-left text-sm hover:bg-gray-50 font-bold text-gray-800`; current code uses `px-4 py-2.5 text-left text-sm hover:bg-gray-50 font-medium text-gray-800` (py-2.5 not py-2, font-medium not font-bold)
   - What's unclear: Whether to update the option class to match the UI-SPEC as part of this phase, or leave it unchanged
   - Recommendation: Apply the UI-SPEC class exactly as specified — it is the approved design contract. The difference (py-2 vs py-2.5, font-medium vs font-bold) is minor but the SPEC is the authority.
   - **RESOLVED:** Apply UI-SPEC class `px-4 py-2 min-h-[44px] text-left text-sm hover:bg-gray-50 font-bold text-gray-800` — py-2.5 eliminated (not multiple of 4), font-bold per typography contract. (Plan 01 Task 1 Edit 9)

---

## Sources

### Primary (HIGH confidence — direct codebase read)
- `src/components/shared/CityCombobox.tsx` — full file read; all behavioral claims verified
- `src/pages/buyer/Cart.tsx` — full file read; all state, handler, and JSX claims verified
- `src/pages/buyer/Profile.tsx` — full file read; form state pattern verified
- `src/pages/public/Register.tsx` — full file read; CityCombobox usage pattern verified
- `src/stores/cartStore.ts` — full file read; `updateDeliveryTime` signature verified
- `src/types/index.ts` — full file read; `DeliveryZone`, `CartSection` interfaces verified
- `src/constants/cities.ts` — full file read; CITIES array and City interface verified
- `.planning/phases/buyer-delivery-select/CONTEXT.md` — full file read; all decisions verified
- `.planning/phases/buyer-delivery-select/buyer-delivery-UI-SPEC.md` — full file read; all CSS classes and interaction contracts verified

### Secondary
- `src/pages/supplier/StoreSettings.tsx` — partial read to verify: no existing cascading select pattern, DAYS constant definition, CityCombobox usage in supplier context

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in codebase; no new deps needed
- Architecture: HIGH — all four files read in full; behavioral patterns confirmed from source
- Pitfalls: HIGH — derived from actual code, not from assumptions; Pitfall 3 (value mismatch) identified from careful reading of CONTEXT.md code snippet vs. actual option rendering

**Research date:** 2026-05-12
**Valid until:** 2026-06-12 (stable codebase — no external dependencies)
