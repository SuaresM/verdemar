---
phase: buyer-delivery-select
reviewed: 2026-05-13T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/components/shared/CityCombobox.tsx
  - src/pages/buyer/Cart.tsx
  - src/pages/buyer/Profile.tsx
  - src/pages/public/Register.tsx
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: issues_found
---

# buyer-delivery-select: Code Review Report

**Reviewed:** 2026-05-13T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Four files were reviewed covering the strict-mode CityCombobox component, the Cart 2-step delivery-zone selector, Profile's city/state editing, and Register's CityCombobox integration. All files are TypeScript React; language-specific checks were applied throughout.

The most significant problems are: (1) `CityCombobox` in strict mode silently resets the displayed value without notifying the parent via `onChange`, causing permanent parent/child state desync; (2) the day picker in Cart always renders with `value=""` so the selected day cannot be shown and the input is uncontrolled; (3) the checkout button can be enabled while zones are still loading (undefined state), bypassing the "no delivery time" guard under a race condition. Three additional warnings cover UX regressions and logic gaps.

---

## Critical Issues

### CR-01: CityCombobox strict reset never calls onChange — parent state permanently desynchronised

**File:** `src/components/shared/CityCombobox.tsx:44-54`

**Issue:** When `strict=true` and the user types an invalid city then blurs, the component resets the visible `query` to `lastValidCity.current` and shows an error. However, it never calls `onChange(lastValidCity.current, state)` to inform the parent. The parent's controlled value (e.g., `form.address_city` in Profile and `buyerForm`'s `address_city` in Register) retains whatever invalid/partial string the user typed. Submitting the form at that point persists the invalid city string to Supabase even though the input appears to show the correct, validated city.

Proof path: user types "Sao Paulo" (not in list), blurs → `query` snaps back to "Brasília" (last valid) → `form.address_city` is still "Sao Paulo" → handleSave/onSubmitBuyer sends "Sao Paulo".

**Fix:**
```tsx
onBlur={() => setTimeout(() => {
  setOpen(false)
  if (strict) {
    const match = CITIES.find((c) => c.city === query)
    if (!match) {
      // Reset display AND notify parent with the last known-good value
      const fallback = CITIES.find((c) => c.city === lastValidCity.current)
      setQuery(lastValidCity.current)
      setInternalError('Selecione uma cidade da lista')
      if (fallback) onChange(fallback.city, fallback.state)
    } else {
      setInternalError('')
    }
  }
}, 150)}
```

---

### CR-02: Day picker is an uncontrolled select — selected day is invisible and immediately lost

**File:** `src/pages/buyer/Cart.tsx:378-391`

**Issue:** The second-step day `<select>` is rendered with the hardcoded `value=""`:

```tsx
<select
  value=""
  onChange={(e) => handleDayChange(section.supplier.id, e.target.value, activeZone)}
```

React renders this as a controlled select permanently stuck at the placeholder option. Every time the component re-renders (e.g., user scrolls, quantity changes, notes are typed) the select snaps back to "Selecione o dia" regardless of what the user previously chose. The cart store correctly holds `deliveryTimePreference` after the first `onChange`, so the confirmation text below the select shows the right value — but the select widget itself resets on every re-render, creating a broken UX where the control appears blank even after a selection. More critically, if the user selects Monday, then the component re-renders (e.g., they edit the notes field), the select shows blank again, and re-selecting triggers another `handleDayChange` which calls `updateDeliveryTime` — this is the only harmless path. But there is no visual confirmation in the select itself, which is a functional defect.

**Fix:** Track the selected day per supplier alongside `selectedZoneId`:
```tsx
// Add alongside selectedZoneId state:
const [selectedDay, setSelectedDay] = useState<Record<string, string>>({})

// In handleDayChange:
const handleDayChange = (supplierId: string, day: string, zone: DeliveryZone) => {
  setSelectedDay((prev) => ({ ...prev, [supplierId]: day }))
  const label = `${DAY_LABELS[day] ?? day} — ${zone.hours_start} às ${zone.hours_end}`
  updateDeliveryTime(supplierId, label)
}

// In JSX:
<select
  value={selectedDay[section.supplier.id] ?? ''}
  onChange={(e) => handleDayChange(section.supplier.id, e.target.value, activeZone)}
>
```

Also reset `selectedDay` for a supplier when the zone changes in `handleZoneChange`:
```tsx
const handleZoneChange = (supplierId: string, zoneId: string) => {
  setSelectedZoneId((prev) => ({ ...prev, [supplierId]: zoneId }))
  setSelectedDay((prev) => ({ ...prev, [supplierId]: '' }))
  updateDeliveryTime(supplierId, '')
}
```

---

### CR-03: Checkout button enabled during zone-load race — "no delivery time" guard can be bypassed

**File:** `src/pages/buyer/Cart.tsx:406-413`

**Issue:** The checkout button is disabled when `hasNoZones` is true (zones loaded, count is 0) or `!section.deliveryTimePreference`. However, while zones are still fetching, `zones` is `undefined` (not yet in `supplierZones`), so `hasNoZones` is `false`. The `deliveryTimePreference` in the cart store persists across page visits (Zustand `persist` middleware). If a user had previously selected a delivery time for the same supplier, `deliveryTimePreference` is already set from local storage. In that scenario, the checkout button is enabled and fully clickable before zones have loaded, with a stale delivery time from a previous session that may no longer match the supplier's current zone configuration.

**Fix:** Disable the button whenever `zones === undefined` (still loading):

```tsx
<button
  onClick={() => setCheckoutSection(section)}
  disabled={!isValid || zones === undefined || hasNoZones || !section.deliveryTimePreference}
  ...
>
```

Additionally, clear `deliveryTimePreference` when zones finish loading and the stored preference no longer matches any zone/day combination.

---

## Warnings

### WR-01: CityCombobox key collision — duplicate city names across states render duplicate dropdown keys

**File:** `src/components/shared/CityCombobox.tsx:65-74`

**Issue:** The dropdown buttons use `key={c.city}` as the React key. If `CITIES` ever contains the same city name in two different states (e.g., "Santa Maria" exists in RS and DF in the national database — only DF is present now, but the list is expected to grow), React will produce a key collision warning and may mis-identify nodes during reconciliation. The stable unique key should be the `city+state` combination.

**Fix:**
```tsx
<button
  key={`${c.city}-${c.state}`}
  ...
>
```

---

### WR-02: Profile `handleSave` does not refresh authStore buyer — stale data shown immediately after save

**File:** `src/pages/buyer/Profile.tsx:40-51`

**Issue:** After a successful `updateBuyer(buyer.id, form)`, the component sets `editing(false)` and shows the view-mode fields which read directly from `buyer` (the authStore object), not from `form`. Since `setBuyer` is never called after the update, the view immediately reverts to displaying the old city/state from the in-memory `buyer` object. The user sees their old city right after saving, giving the impression the save failed. The data is correct in Supabase; only the in-memory state is stale.

This is especially visible with the new CityCombobox because `address_city` and `address_state` are the two fields most likely to be changed in this editing flow.

**Fix:**
```tsx
const handleSave = async () => {
  if (!buyer) return
  setSaving(true)
  try {
    await updateBuyer(buyer.id, form)
    setBuyer({ ...buyer, ...form })   // update in-memory state
    toast.success('Dados atualizados!')
    setEditing(false)
  } catch {
    toast.error('Erro ao salvar')
  } finally {
    setSaving(false)
  }
}
```

---

### WR-03: Register supplier form bypasses CityCombobox — supplier city not validated against CITIES list

**File:** `src/pages/public/Register.tsx:321-323`

**Issue:** The buyer section of the Register form uses `<CityCombobox strict>` for `address_city`. The supplier section, however, uses a plain `<InputField>` for both city and state — no combobox, no list restriction. This means a supplier can register with an arbitrary city string. The `DeliveryZone.city` field is compared against `buyer.address_city` in `hasCityMismatch` in Cart.tsx — if the supplier registered with "São Paulo" but the CITIES list uses "São Paulo" (exact match is fine here), the comparison still works. But if the supplier types "sao paulo" (lowercase) or "S. Paulo" the matching silently fails and the city-mismatch warning will never fire for buyers in that city.

This is an asymmetry introduced by this phase: buyers are now validated, suppliers are not. Either apply the same `CityCombobox strict` to supplier registration, or document the asymmetry explicitly.

**Fix:**
```tsx
// Replace the plain InputField grid for supplier city/state with:
<div>
  <label className="block text-sm font-semibold text-gray-700 mb-1">
    Cidade <span className="text-danger">*</span>
  </label>
  <CityCombobox
    strict
    value={supplierForm.watch('address_city') || ''}
    onChange={(city, state) => {
      supplierForm.setValue('address_city', city, { shouldValidate: true })
      supplierForm.setValue('address_state', state, { shouldValidate: true })
    }}
    error={supplierForm.formState.errors.address_city?.message}
  />
</div>
// Remove the separate Estado InputField — populated automatically by CityCombobox
```

---

### WR-04: Zone fetch error is silently swallowed — buyer sees infinite "Carregando..." on network failure

**File:** `src/pages/buyer/Cart.tsx:174-185`

**Issue:** The `Promise.all` that fetches delivery zones has no `.catch()` handler. If any single `getDeliveryZonesBySupplier` call fails (network error, RLS policy block, etc.), the entire `Promise.all` rejects. Because there is no catch, the error is an unhandled promise rejection. The `supplierZones` map is never populated for any supplier, so every section renders the disabled "Carregando..." select permanently. The checkout button stays disabled with no feedback.

**Fix:**
```tsx
Promise.all(
  sections.map((s) =>
    getDeliveryZonesBySupplier(s.supplier.id)
      .then((zones) => ({ id: s.supplier.id, zones }))
      .catch(() => ({ id: s.supplier.id, zones: [] as DeliveryZone[] }))
  )
).then((results) => {
  const map: Record<string, DeliveryZone[]> = {}
  results.forEach(({ id, zones }) => { map[id] = zones })
  setSupplierZones(map)
})
```

This ensures a failed fetch degrades gracefully (shows "Fornecedor ainda não configurou horários de entrega") rather than hanging indefinitely. Add a `toast.error` or set a separate error state if explicit user feedback is desired.

---

## Info

### IN-01: Unused import — `apiClient` imported in Cart but only used in one inline handler

**File:** `src/pages/buyer/Cart.tsx:14`

**Issue:** `apiClient` is imported at the top level and used only inside an `onClick` callback for the WhatsApp link. This is not a bug, but the import at line 14 alongside `createOrder` and `getDeliveryZonesBySupplier` from `'../../services/supabase'` at lines 11-12 suggests `apiClient` could also be imported from `supabase.ts` for consistency, or the patch call could be wrapped in a service function. The current pattern mixes abstraction layers (service functions vs raw apiClient calls) in the same component.

**Fix:** Extract to a service function in `supabase.ts`:
```ts
export async function markOrderWhatsAppSent(orderId: string): Promise<void> {
  await apiClient.patch(`/orders/${orderId}/whatsapp-sent`, {})
}
```

---

### IN-02: `setCheckoutSuccess(null)` called before navigation in WhatsApp onClick — race between state clear and render

**File:** `src/pages/buyer/Cart.tsx:459-464`

**Issue:** The `onClick` of the WhatsApp anchor sets `setWhatsappOpened(true)` and then immediately calls `setCheckoutSuccess(null)`. This hides the success screen before the browser has navigated to the WhatsApp URL. On slow devices or if `wa.me` is blocked, the user sees the screen flash away with no confirmation. The `setCheckoutSuccess(null)` call should be deferred until after the user returns from WhatsApp (e.g., on the "Ver meus pedidos" button click) rather than on the initial tap.

**Fix:** Remove `setCheckoutSuccess(null)` from the WhatsApp anchor `onClick`. Allow the success screen to remain visible until the user explicitly taps "Ver meus pedidos":
```tsx
onClick={() => {
  setWhatsappOpened(true)
  if (checkoutSuccess) {
    apiClient.patch(`/orders/${checkoutSuccess.orderId}/whatsapp-sent`, {}).catch(() => {})
  }
  // Do NOT call setCheckoutSuccess(null) here
}}
```

---

_Reviewed: 2026-05-13T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
