# Phase buyer-delivery-select — Pattern Map

**Mapped:** 2026-05-12
**Files analyzed:** 4 (all modified, none created)
**Analogs found:** 4 / 4 (all files read directly — they ARE the analogs)

---

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `src/components/shared/CityCombobox.tsx` | component (combobox) | request-response | Self — extends existing component | self-modify |
| `src/pages/public/Register.tsx` | page (form) | request-response | Self — adds one prop at call site | self-modify |
| `src/pages/buyer/Profile.tsx` | page (form) | CRUD | Self — replaces field type at edit section | self-modify |
| `src/pages/buyer/Cart.tsx` | page (cart/checkout) | CRUD + async-load | Self — replaces delivery-time block | self-modify |

All four files are the targets themselves. Pattern extraction below documents the exact current code that must be preserved, wrapped, or replaced.

---

## Pattern Assignments

### `src/components/shared/CityCombobox.tsx` (component, request-response)

**Current file:** 60 lines total — small enough that one full read is sufficient.

**Current props interface** (lines 4-9):
```tsx
interface CityComboboxProps {
  value: string
  onChange: (city: string, state: string) => void
  placeholder?: string
  error?: string
}
```

**New props interface** — add `strict?: boolean`:
```tsx
interface CityComboboxProps {
  value: string
  onChange: (city: string, state: string) => void
  placeholder?: string
  error?: string
  strict?: boolean  // NEW — rejects unselected free text on blur
}
```

**Current state initialization** (lines 11-13):
```tsx
export function CityCombobox({ value, onChange, placeholder = 'Digite a cidade...', error }: CityComboboxProps) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
```

**Add after existing state** — two new tracking primitives:
```tsx
import { useState, useEffect, useRef } from 'react'   // add useRef to import

const lastValidCity = useRef<string>(value)            // tracks last accepted city
const [internalError, setInternalError] = useState<string>('')
```

**Current useEffect** (lines 15-17) — must be extended to keep ref in sync:
```tsx
// CURRENT (preserve and extend):
useEffect(() => {
  setQuery(value)
}, [value])

// REPLACE WITH:
useEffect(() => {
  setQuery(value)
  lastValidCity.current = value   // keep ref in sync when external value changes
}, [value])
```

**Current handleSelect** (lines 23-27) — must record the accepted value:
```tsx
// CURRENT:
const handleSelect = (city: string, state: string) => {
  setQuery(city)
  onChange(city, state)
  setOpen(false)
}

// REPLACE WITH:
const handleSelect = (city: string, state: string) => {
  lastValidCity.current = city   // record as last valid
  setQuery(city)
  setInternalError('')
  onChange(city, state)
  setOpen(false)
}
```

**Current onBlur** (line 38) — must gain strict validation branch:
```tsx
// CURRENT:
onBlur={() => setTimeout(() => setOpen(false), 150)}

// REPLACE WITH:
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
```

**Critical: the 150ms delay is not negotiable.** It allows `onMouseDown` on a dropdown `<button>` to fire before blur closes the list (browser fires blur before click but after mousedown). Remove or shorten it and clicking an option in strict mode will reset the input instead of selecting.

**Current error display** (line 43):
```tsx
// CURRENT:
{error && <p className="text-danger text-xs mt-1">{error}</p>}

// REPLACE WITH (merge internal + external):
{(internalError || error) && (
  <p className="text-danger text-xs mt-1">{internalError || error}</p>
)}
```

**UI-SPEC constraint on option class** (lines 50-51 — open question from RESEARCH.md):
```tsx
// CURRENT option class:
className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 font-medium text-gray-800"

// UI-SPEC approved class (apply as part of this phase):
className="w-full px-4 py-2 min-h-[44px] text-left text-sm hover:bg-gray-50 font-bold text-gray-800"
```

**Input border constraint** — UI-SPEC explicitly prohibits adding a red border on invalid strict input. The existing `border-gray-200` class on the `<input>` must NOT change. Error is text-only via `<p className="text-danger ...">`.

---

### `src/pages/public/Register.tsx` (page/form, request-response)

**Current CityCombobox call site** (lines 278-290):
```tsx
<div>
  <label className="block text-sm font-semibold text-gray-700 mb-1">
    Cidade <span className="text-danger">*</span>
  </label>
  <CityCombobox
    value={buyerForm.watch('address_city') || ''}
    onChange={(city, state) => {
      buyerForm.setValue('address_city', city, { shouldValidate: true })
      buyerForm.setValue('address_state', state, { shouldValidate: true })
    }}
    error={buyerForm.formState.errors.address_city?.message}
  />
</div>
```

**Change:** Add `strict` prop — no other modifications:
```tsx
<CityCombobox
  strict
  value={buyerForm.watch('address_city') || ''}
  onChange={(city, state) => {
    buyerForm.setValue('address_city', city, { shouldValidate: true })
    buyerForm.setValue('address_state', state, { shouldValidate: true })
  }}
  error={buyerForm.formState.errors.address_city?.message}
/>
```

**Form management pattern in Register:** react-hook-form with `useForm<BuyerForm>`. `setValue` with `{ shouldValidate: true }` is already used for both `address_city` and `address_state`. `address_state` is set programmatically only — it has no visible form field for the buyer. No changes to this mechanism.

**Note:** Supplier form (lines 320-323) uses plain `<InputField>` for city/state — NOT CityCombobox. Do not touch the supplier registration city field in this phase.

---

### `src/pages/buyer/Profile.tsx` (page/form, CRUD)

**Form state pattern** (lines 20-31) — local `useState` object, NOT react-hook-form:
```tsx
const [form, setForm] = useState({
  company_name: buyer?.company_name || '',
  contact_phone: buyer?.contact_phone || '',
  business_hours: buyer?.business_hours || '',
  address_street: buyer?.address_street || '',
  address_number: buyer?.address_number || '',
  address_complement: buyer?.address_complement || '',
  address_neighborhood: buyer?.address_neighborhood || '',
  address_city: buyer?.address_city || '',
  address_state: buyer?.address_state || '',
  address_zip: buyer?.address_zip || '',
})
```

**Local `Input` component** (lines 83-98) — keyed by `field: keyof typeof form`. Do NOT extend this to handle CityCombobox — render CityCombobox directly in JSX:
```tsx
const Input = ({
  label,
  field,
}: {
  label: string
  field: keyof typeof form
}) => (
  <div>
    <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
    <input
      value={form[field]}
      onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
    />
  </div>
)
```

**Current city+state block in edit mode** (lines 175-178) — INSIDE the address edit section:
```tsx
<div className="grid grid-cols-2 gap-2">
  <Input label="Cidade" field="address_city" />
  <Input label="Estado" field="address_state" />
</div>
```

**REPLACE** the grid+two-Input block with two stacked full-width elements. Remove the `grid grid-cols-2 gap-2` wrapper — CityCombobox is full-width and its dropdown (`absolute z-50 w-full`) must not be constrained to a half-column:
```tsx
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

**Required import:** Add `CityCombobox` import at top of file:
```tsx
import { CityCombobox } from '../../components/shared/CityCombobox'
```

**Save path is unchanged.** `handleSave` (line 39) calls `updateBuyer(buyer.id, form)`. `form` already contains both `address_city` and `address_state` — the auto-fill flows through `setForm` into the same object that `handleSave` reads.

**Read-only state input styling** — `bg-gray-50 text-gray-500` visually communicates the field is locked. Pattern for locked readonly inputs already present in modal password fields (lines 235-242) which use `bg-white` — the gray background is the chosen differentiator for auto-filled read-only state.

---

### `src/pages/buyer/Cart.tsx` (page/cart, CRUD + async-load)

**Existing state declarations at Cart component level** (lines 153-158):
```tsx
const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
const [checkoutSection, setCheckoutSection] = useState<CartSection | null>(null)
const [checkoutLoading, setCheckoutLoading] = useState(false)
const [checkoutSuccess, setCheckoutSuccess] = useState<{ whatsappUrl: string; supplierName: string; orderId: string } | null>(null)
const [whatsappOpened, setWhatsappOpened] = useState(false)
const [supplierZones, setSupplierZones] = useState<Record<string, DeliveryZone[]>>({})
```

**Add new state after line 158:**
```tsx
const [selectedZoneId, setSelectedZoneId] = useState<Record<string, string>>({})
```

**Add constants at top of file, after imports block:**
```tsx
const DAY_LABELS: Record<string, string> = {
  monday: 'Segunda', tuesday: 'Terça', wednesday: 'Quarta',
  thursday: 'Quinta', friday: 'Sexta', saturday: 'Sábado', sunday: 'Domingo',
}
const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
```

**Add handlers inside Cart component, after `toggleSection` (line 177) and before `handleCheckout`:**
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

**Per-section derived values** — add inside the `.map((section) => {` callback (line 262), alongside `isExpanded` and `isValid`:
```tsx
const zones = supplierZones[section.supplier.id]         // undefined = loading, [] = no zones configured
const hasNoZones = zones !== undefined && zones.length === 0
const activeZone = zones?.find(z => z.id === selectedZoneId[section.supplier.id])
```

**Current delivery time block** (lines 321-331) — REPLACE entirely:
```tsx
// CURRENT (remove this):
{/* Delivery time */}
<div>
  <label className="block text-xs font-semibold text-gray-500 mb-1">Horário preferencial de entrega</label>
  <input
    type="text"
    value={section.deliveryTimePreference}
    onChange={(e) => updateDeliveryTime(section.supplier.id, e.target.value)}
    placeholder="Ex: 07h-09h"
    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
  />
</div>
```

```tsx
// REPLACE WITH:
{/* Delivery time — 2-step zone+day picker */}
<div>
  <label className="block text-xs font-semibold text-gray-500 mb-1">Horário preferencial de entrega</label>
  {hasNoZones ? (
    <p className="text-xs text-danger font-semibold">
      Fornecedor ainda não configurou horários de entrega
    </p>
  ) : zones ? (
    <div className="space-y-2">
      {/* Step 1 — zone picker */}
      <select
        value={selectedZoneId[section.supplier.id] ?? ''}
        onChange={(e) => handleZoneChange(section.supplier.id, e.target.value)}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none"
      >
        <option value="">Selecione a janela de entrega</option>
        {zones.map(z => {
          const days = (z.days ?? [])
            .slice().sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
            .map(d => DAY_LABELS[d]?.slice(0, 3) ?? d).join(', ')
          return (
            <option key={z.id} value={z.id}>
              {days} — {z.hours_start} às {z.hours_end}
            </option>
          )
        })}
      </select>

      {/* Step 2 — day picker (only after zone selected) */}
      {activeZone && (
        <select
          value=""
          onChange={(e) => handleDayChange(section.supplier.id, e.target.value, activeZone)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none"
        >
          <option value="">Selecione o dia</option>
          {(activeZone.days ?? [])
            .slice().sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
            .map(d => (
              <option key={d} value={d}>{DAY_LABELS[d] ?? d}</option>
            ))
          }
        </select>
      )}
    </div>
  ) : (
    /* Loading state */
    <select disabled className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl opacity-50">
      <option>Carregando...</option>
    </select>
  )}
</div>
```

**Note on Step 2 `value` prop (Pitfall 3 from RESEARCH.md):** The `value=""` approach on the day select makes it uncontrolled after selection — the select always resets to placeholder when zone changes (since `handleZoneChange` clears `deliveryTimePreference`). This is correct behavior. If a "show current selection" requirement is added later, a `selectedDay: Record<string,string>` state can be added alongside `selectedZoneId`. For this phase, the uncontrolled approach avoids the Portuguese-label vs. English-key mismatch described in Pitfall 3.

**Checkout button — current** (lines 334-340):
```tsx
<button
  onClick={() => setCheckoutSection(section)}
  disabled={!isValid}
  className="w-full bg-primary text-white font-bold py-3 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed text-sm"
>
  {getCheckoutLabel(section)}
</button>
```

**Checkout button — change only the `disabled` condition** (class string unchanged):
```tsx
<button
  onClick={() => setCheckoutSection(section)}
  disabled={!isValid || hasNoZones || !section.deliveryTimePreference}
  className="w-full bg-primary text-white font-bold py-3 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed text-sm"
>
  {getCheckoutLabel(section)}
</button>
```

**`updateDeliveryTime` signature** (from cartStore.ts — unchanged by this phase):
```ts
updateDeliveryTime: (supplierId: string, time: string) => void
```
The store accepts any string value — no cartStore changes needed.

---

## Shared Patterns

### Input label style — Profile and Cart use matching micro-label pattern
**Source:** `src/pages/buyer/Profile.tsx` line 91 and `src/pages/buyer/Cart.tsx` line 311
```tsx
<label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
```
Apply this exact class to the "Horário preferencial de entrega" label and the "Cidade" / "Estado" labels in Profile edit mode.

### Input base style — used in Cart textarea and Profile inputs
**Source:** `src/pages/buyer/Cart.tsx` line 316 (textarea) and `src/pages/buyer/Profile.tsx` line 95
```tsx
className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
```
The `<select>` elements in Cart use the same base padding/border/radius but drop `focus:ring-2 focus:ring-primary/30` (native select focus ring differs from input). The loading disabled select adds `opacity-50`.

### Disabled button pattern
**Source:** `src/pages/buyer/Cart.tsx` line 337
```tsx
className="... disabled:opacity-40 disabled:cursor-not-allowed ..."
```
`opacity-40` for hard-disabled (structural gate like no zones or no selection), `opacity-60` for soft-disabled (loading). Already present on checkout button — no new class needed.

### setForm atomic update — Profile
**Source:** `src/pages/buyer/Profile.tsx` line 94
```tsx
onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
```
City+state two-field update in CityCombobox `onChange` uses the same spread-and-override pattern with multiple keys at once:
```tsx
onChange={(city, state) => setForm(prev => ({ ...prev, address_city: city, address_state: state }))}
```
Single `setForm` call — no risk of stale state between `address_city` and `address_state`.

### react-hook-form setValue pattern — Register
**Source:** `src/pages/public/Register.tsx` lines 284-287
```tsx
buyerForm.setValue('address_city', city, { shouldValidate: true })
buyerForm.setValue('address_state', state, { shouldValidate: true })
```
`shouldValidate: true` triggers zod schema re-validation after programmatic setValue. Required so the form error for `address_city` clears after selection. Unchanged — strict prop addition does not affect this.

---

## No Analog Found

None — all four files exist and were read directly. The 2-step cascading select is a new interaction pattern with no existing analog in the codebase, but its implementation details are fully specified in CONTEXT.md.

---

## Key Anti-Patterns (from RESEARCH.md — planner must reference)

| Anti-pattern | Consequence | Correct approach |
|---|---|---|
| Shorten or remove 150ms blur delay | Clicking dropdown option in strict mode resets input instead of selecting | Preserve 150ms setTimeout exactly |
| `lastValidCity` as `useState` instead of `useRef` | Re-renders on every keystroke as user types | `useRef` — does not trigger renders |
| Case-insensitive match in strict validation | Fails on accented city names (Brasília, Paranoá) | Exact match: `CITIES.some(c => c.city === query)` |
| `hasNoZones = zones?.length === 0` | Masks loading vs. empty distinction | `zones !== undefined && zones.length === 0` |
| Wrapping CityCombobox in `grid grid-cols-2` in Profile | Dropdown truncated to half-width | Remove grid; render two stacked full-width elements |
| Persisting `selectedZoneId` in cartStore/Zustand | Zone picker state should be ephemeral | Local `useState` in Cart component only |

---

## Metadata

**Analog search scope:** All four target files read in full (60, 380, 273, 419 lines respectively)
**Files scanned:** 6 (four targets + `src/constants/cities.ts` for City interface + `src/pages/public/Register.tsx` for DAYS/supplier form context)
**Pattern extraction date:** 2026-05-12
