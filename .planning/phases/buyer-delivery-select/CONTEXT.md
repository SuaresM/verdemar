---
phase: buyer-delivery-select
created: 2026-05-12
status: ready-for-planning
areas:
  - strict-city-select
  - delivery-time-dropdown
---

# Phase Context — buyer-delivery-select

## Objective

Two buyer-facing UX improvements to the cart/checkout flow:
1. City field becomes a strict select (no free-text). Buyer must pick from the static `CITIES` list.
2. Delivery time preference becomes a dropdown showing the supplier's configured time slots instead of a free-text input.

---

## D-01 — Strict city selection (no free text)

**Decision: CityCombobox becomes strict — user must select from CITIES list**

### What "strict" means
- User can type to filter options, but submitting an arbitrary text value that does not match a city in the `CITIES` array is **not allowed**.
- On blur without selecting: reset the input to its previous valid value (or empty if none) + show validation error.
- On selection from dropdown: accepted, state auto-fills from `CITIES[n].state`.

### City list
- Use the existing `CITIES` constant in `src/constants/cities.ts` (~50 DF + entorno cities).
- Do **not** query `delivery_zones` from the DB for the city list. Static list is sufficient.

### Where to enforce

| Location | Current behavior | Required change |
|----------|-----------------|-----------------|
| `src/pages/public/Register.tsx` | Uses `CityCombobox` but allows free text | Make strict (force selection from list) |
| `src/pages/buyer/Profile.tsx` edit mode | Plain `<Input label="Cidade" field="address_city" />` | Replace with strict `CityCombobox` + auto-fill state |

**State auto-fill:** When buyer selects a city in Profile, `address_state` must be auto-filled from the selected `City.state` (same mechanism as Register.tsx — call `setValue('address_state', state)`).

### Neighborhood (bairro)
- `address_neighborhood` stays as a free-text input in Profile and Register. No changes.
- Bairro is **not** used for delivery zone validation — only city matters.

### Cart behavior
- Keep the existing amber warning (`hasCityMismatch()`). Do **not** block checkout.
- No changes to Cart.tsx for this feature.

---

## D-02 — Delivery time dropdown

**Decision: replace free-text `deliveryTimePreference` input with a dropdown of unique time slots**

### Current state
`Cart.tsx` renders:
```tsx
<input
  type="text"
  value={section.deliveryTimePreference}
  onChange={(e) => updateDeliveryTime(section.supplier.id, e.target.value)}
  placeholder="Ex: 07h-09h"
/>
```

### New behavior

Replace with a `<select>` element populated from `supplierZones[section.supplier.id]`.

**Two-step selection: zone first, specific day second.**

### Step 1 — Select zone (days + time window)
First `<select>` shows all zones. Each option = one zone row. Format: days as headline, time as qualifier:
```
"Seg, Qua, Sex — 07:00 às 09:00"
"Ter, Qui — 10:00 às 12:00"
```

### Step 2 — Select specific day within that zone
After zone is chosen, a second `<select>` appears showing only the days in that zone:
```
"Segunda"
"Quarta"
"Sexta"
```

**Stored value:** `"Quarta — 07:00 às 09:00"` — specific day + time window, readable in order details without DB joins. Same `delivery_time_preference: string | null` column — no schema changes.

**State:** Local `Record<supplierId, string>` named `selectedZoneId` in Cart.tsx tracks which zone was picked per section. Selecting a new zone clears the day selection and calls `updateDeliveryTime(supplierId, '')`.

**Day label mapping** (same values used in Register.tsx `DAYS` array):
```ts
const DAY_LABELS: Record<string, string> = {
  monday: 'Segunda', tuesday: 'Terça', wednesday: 'Quarta',
  thursday: 'Quinta', friday: 'Sexta', saturday: 'Sábado', sunday: 'Domingo',
}
const DAY_ORDER = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
```

Full day names (not abbreviations) in the day picker — buyer is confirming a specific date slot.

**No-zones fallback:** Suppliers are **required** to have delivery zones configured (business rule). If a supplier has no zones:
- Show: "Fornecedor ainda não configurou horários de entrega"
- Disable "Finalizar pedido" button for that section

**Checkout gate:** Button disabled unless both zone AND specific day are selected (i.e., `section.deliveryTimePreference` is non-empty string).

**Loading state:** `supplierZones` loaded async. While loading, show disabled first select with "Carregando...".

### Implementation in Cart.tsx

```tsx
const DAY_LABELS: Record<string, string> = {
  monday: 'Segunda', tuesday: 'Terça', wednesday: 'Quarta',
  thursday: 'Quinta', friday: 'Sexta', saturday: 'Sábado', sunday: 'Domingo',
}
const DAY_ORDER = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']

// Local state added at Cart component level:
const [selectedZoneId, setSelectedZoneId] = useState<Record<string, string>>({})

// Inside section render:
const zones = supplierZones[section.supplier.id]
const hasNoZones = zones !== undefined && zones.length === 0
const activeZone = zones?.find(z => z.id === selectedZoneId[section.supplier.id])

const handleZoneChange = (supplierId: string, zoneId: string) => {
  setSelectedZoneId(prev => ({ ...prev, [supplierId]: zoneId }))
  updateDeliveryTime(supplierId, '') // clear day selection
}

const handleDayChange = (supplierId: string, day: string, zone: DeliveryZone) => {
  const label = `${DAY_LABELS[day] ?? day} — ${zone.hours_start} às ${zone.hours_end}`
  updateDeliveryTime(supplierId, label)
}

// JSX:
{hasNoZones ? (
  <p className="text-xs text-danger font-semibold">
    Fornecedor ainda não configurou horários de entrega
  </p>
) : zones ? (
  <div className="space-y-2">
    {/* Step 1 */}
    <select
      value={selectedZoneId[section.supplier.id] ?? ''}
      onChange={(e) => handleZoneChange(section.supplier.id, e.target.value)}
      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none"
    >
      <option value="">Selecione a janela de entrega</option>
      {zones.map(z => {
        const days = (z.days ?? [])
          .slice().sort((a,b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
          .map(d => DAY_LABELS[d]?.slice(0,3) ?? d).join(', ')
        return (
          <option key={z.id} value={z.id}>
            {days} — {z.hours_start} às {z.hours_end}
          </option>
        )
      })}
    </select>

    {/* Step 2 — appears only after zone selected */}
    {activeZone && (
      <select
        value={section.deliveryTimePreference
          ? (section.deliveryTimePreference.split(' — ')[0])
          : ''}
        onChange={(e) => handleDayChange(section.supplier.id, e.target.value, activeZone)}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none"
      >
        <option value="">Selecione o dia</option>
        {(activeZone.days ?? [])
          .slice().sort((a,b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
          .map(d => (
            <option key={d} value={d}>{DAY_LABELS[d] ?? d}</option>
          ))
        }
      </select>
    )}
  </div>
) : (
  <select disabled className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl opacity-50">
    <option>Carregando...</option>
  </select>
)}
```

Checkout button disabled when `hasNoZones` OR `!section.deliveryTimePreference`.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/shared/CityCombobox.tsx` | D-01: add strict mode (reject unselected free text on blur) |
| `src/pages/public/Register.tsx` | D-01: pass `strict` prop to CityCombobox |
| `src/pages/buyer/Profile.tsx` | D-01: replace city Input with strict CityCombobox + state auto-fill |
| `src/pages/buyer/Cart.tsx` | D-02: replace delivery time input with deduplicated time-slot dropdown; disable checkout if no zones |

## No DB changes required

- `delivery_time_preference` already stores string — compatible with new format.
- `CITIES` constant already exists — no new data needed.
- No new API routes.

## Non-goals (explicitly deferred)
- Blocking checkout when city mismatches supplier zones (user chose to keep amber warning)
- Dynamic city list from DB delivery_zones
- Neighborhood (bairro) strict select
- Showing delivery city per zone in the dropdown (only days + time shown)
- Supplier-side enforcement that zones must be configured before going active
