---
phase: buyer-delivery-select
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - src/pages/buyer/Cart.tsx
autonomous: true
requirements:
  - delivery-zone-day-picker

must_haves:
  truths:
    - "Cart.tsx replaces the free-text delivery time input with a 2-step zone+day selector for each supplier section"
    - "Step 1 is a select listing zones formatted as 'Seg, Qua, Sex — 07:00 às 09:00' (3-letter day abbreviations sorted Mon-Sun)"
    - "Step 2 appears only after a zone is selected and lists the days inside that zone using full Portuguese names sorted Mon-Sun"
    - "Selecting a day updates section.deliveryTimePreference to 'Quarta — 07:00 às 09:00' format via existing cartStore updateDeliveryTime"
    - "Changing the zone clears section.deliveryTimePreference and hides/resets Step 2"
    - "If a supplier has zero zones, the input area shows the red message 'Fornecedor ainda não configurou horários de entrega' and the checkout button is disabled"
    - "While zones are still loading (supplierZones[id] === undefined), a disabled select with 'Carregando...' and opacity-50 is shown"
    - "The Finalizar pedido button is disabled when (!isValid) OR hasNoZones OR !section.deliveryTimePreference"
    - "No DB schema changes — delivery_time_preference column stores the same string format consumed by createOrder unchanged"
  artifacts:
    - path: "src/pages/buyer/Cart.tsx"
      provides: "2-step zone+day delivery selector + widened checkout-disabled gate"
      contains: "selectedZoneId"
  key_links:
    - from: "selectedZoneId state"
      to: "Step 1 select value + Step 2 conditional render"
      via: "Record<supplierId, string> keyed lookup"
      pattern: "selectedZoneId\\[section\\.supplier\\.id\\]"
    - from: "handleDayChange"
      to: "cartStore.updateDeliveryTime"
      via: "stored string 'Quarta — 07:00 às 09:00'"
      pattern: "updateDeliveryTime\\(supplierId, label\\)"
    - from: "hasNoZones (zones !== undefined && zones.length === 0)"
      to: "checkout button disabled condition"
      via: "boolean OR in disabled prop"
      pattern: "hasNoZones \\|\\| !section\\.deliveryTimePreference"
---

<objective>
Replace the free-text delivery time input in Cart.tsx with a 2-step zone+day cascading select per supplier section, and widen the checkout button's disabled condition to gate on zone availability and day selection. Implements decision D-02.

Purpose: Buyers should pick from the delivery windows the supplier configured in `delivery_zones`, not type freeform text that may not match a real slot. The stored value remains a readable string so no schema migration is needed.

Output: One modified file. New module-level constants (DAY_LABELS, DAY_ORDER), new local state (selectedZoneId), two handlers (handleZoneChange, handleDayChange), per-section derived values (zones, hasNoZones, activeZone), a replaced delivery-time JSX block, and a widened disabled condition on the checkout button.
</objective>

<execution_context>
@C:/Users/jsuar/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/jsuar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar/src/pages/buyer/Cart.tsx
@C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar/src/stores/cartStore.ts
@C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar/src/types/index.ts
@C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar/.planning/phases/buyer-delivery-select/CONTEXT.md
@C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar/.planning/phases/buyer-delivery-select/buyer-delivery-RESEARCH.md
@C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar/.planning/phases/buyer-delivery-select/buyer-delivery-PATTERNS.md
@C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar/.planning/phases/buyer-delivery-select/buyer-delivery-UI-SPEC.md
</context>

<interfaces>
DeliveryZone type (from src/types/index.ts — already imported in Cart.tsx line 13). Fields used by this plan: `id` (string), `days` (string[]), `hours_start` (string), `hours_end` (string). Other DeliveryZone fields (city, supplier_id, etc.) are NOT used.

CartSection.deliveryTimePreference is a plain string and persists via Zustand `persist` — no changes needed.

Existing cartStore action (signature unchanged):
```ts
updateDeliveryTime: (supplierId: string, time: string) => void
```

supplierZones state in Cart.tsx (line 158) — already loaded async in useEffect at lines 162-173:
```ts
const [supplierZones, setSupplierZones] = useState<Record<string, DeliveryZone[]>>({})
```

Existing per-section derived values inside the `.map((section) => { ... })` callback (lines 263-264):
```tsx
const isExpanded = expandedSections[section.supplier.id] ?? true
const isValid = isSectionValid(section)
```

Current delivery-time JSX block (Cart.tsx lines 321-331) — to be REPLACED entirely:
```tsx
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

Current checkout button (Cart.tsx lines 334-340) — only the `disabled` expression changes:
```tsx
<button
  onClick={() => setCheckoutSection(section)}
  disabled={!isValid}
  className="w-full bg-primary text-white font-bold py-3 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed text-sm"
>
  {getCheckoutLabel(section)}
</button>
```
</interfaces>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add constants, selectedZoneId state, handlers, and per-section derived values in Cart.tsx</name>
  <read_first>
    - src/pages/buyer/Cart.tsx (full file — 419 lines, read entirely before editing)
    - src/types/index.ts (confirm DeliveryZone has `id`, `days`, `hours_start`, `hours_end` fields)
    - src/stores/cartStore.ts (confirm updateDeliveryTime signature unchanged)
  </read_first>
  <files>src/pages/buyer/Cart.tsx</files>
  <action>
This task adds module-level constants, one new local state hook, two handler functions, and per-section derived values. Task 2 swaps the JSX. Doing the data plumbing first keeps the diff reviewable.

**Edit 1 — Add module-level constants.** Insert these TWO constants immediately AFTER the last import line (line 14, `import { apiClient } from '../../lib/apiClient'`) and BEFORE `function SectionMinOrderStatus` on line 16. Add blank lines for readability:

```tsx
const DAY_LABELS: Record<string, string> = {
  monday: 'Segunda',
  tuesday: 'Terça',
  wednesday: 'Quarta',
  thursday: 'Quinta',
  friday: 'Sexta',
  saturday: 'Sábado',
  sunday: 'Domingo',
}
const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
```

**Edit 2 — Add `selectedZoneId` state.** Inside the `Cart()` function, the current state declarations end at line 158 with:

```tsx
const [supplierZones, setSupplierZones] = useState<Record<string, DeliveryZone[]>>({})
```

Insert a new line IMMEDIATELY AFTER line 158 (use the same two-space indent as the surrounding state hooks):

```tsx
  const [selectedZoneId, setSelectedZoneId] = useState<Record<string, string>>({})
```

**Edit 3 — Add `handleZoneChange` and `handleDayChange` handlers.** Insert these AFTER the `toggleSection` function (ends at line 177) and BEFORE `handleCheckout` (starts at line 179):

```tsx
  const handleZoneChange = (supplierId: string, zoneId: string) => {
    setSelectedZoneId((prev) => ({ ...prev, [supplierId]: zoneId }))
    updateDeliveryTime(supplierId, '')
  }

  const handleDayChange = (supplierId: string, day: string, zone: DeliveryZone) => {
    const label = `${DAY_LABELS[day] ?? day} — ${zone.hours_start} às ${zone.hours_end}`
    updateDeliveryTime(supplierId, label)
  }
```

Notes on the handlers:
- `handleZoneChange` clears the persisted day selection by passing `''` to `updateDeliveryTime` — this also re-disables the checkout button until a new day is picked.
- `handleDayChange` builds the stored label using the Portuguese full day name from `DAY_LABELS`, the em-dash (` — `, U+2014 surrounded by single spaces), and the zone hours. Format MUST match `Quarta — 07:00 às 09:00`. Copy the em-dash exactly from this plan — do NOT substitute hyphen `-` or en-dash `–`.
- Both handlers reference the existing destructured `updateDeliveryTime` action from `useCartStore()` (line 150). Do NOT re-import or re-destructure it.

**Edit 4 — Add per-section derived values inside the `.map((section) => {` callback.** Currently lines 263-264 inside that callback read:

```tsx
const isExpanded = expandedSections[section.supplier.id] ?? true
const isValid = isSectionValid(section)
```

Insert THREE new lines AFTER `const isValid = isSectionValid(section)` and BEFORE the `return (` on line 266 (use 12-space indentation to match `isExpanded` and `isValid` indent inside the .map callback):

```tsx
            const zones = supplierZones[section.supplier.id]
            const hasNoZones = zones !== undefined && zones.length === 0
            const activeZone = zones?.find((z) => z.id === selectedZoneId[section.supplier.id])
```

Constraints on derived values:
- `hasNoZones` MUST use the explicit two-part check `zones !== undefined && zones.length === 0` (NOT `zones?.length === 0`). Per RESEARCH Pitfall 5, the explicit form distinguishes loading (undefined) from empty (length 0).
- `activeZone` MUST use optional chaining `zones?.find(...)` because `zones` may still be undefined during initial load.

**DO NOT in this task:**
- Do NOT touch the JSX delivery time div block yet (that is Task 2).
- Do NOT touch the checkout button yet (also Task 2).
- Do NOT add a `selectedDay` state — Task 2 deliberately uses an uncontrolled Step 2 select (`value=""`) per RESEARCH Pitfall 3 resolution, so a separate selectedDay record is not needed.
- Do NOT persist `selectedZoneId` in cartStore — zone selection is ephemeral local UI state per the architectural responsibility map.
- Do NOT change the useEffect that fetches zones (lines 162-173) — it already populates `supplierZones` correctly.
- Do NOT change the import line for DeliveryZone — it is already imported (line 13: `import type { CartSection, DeliveryZone } from '../../types'`).
  </action>
  <verify>
    <automated>cd "C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar" &amp;&amp; grep -nE "DAY_LABELS|DAY_ORDER|selectedZoneId|handleZoneChange|handleDayChange|hasNoZones|activeZone" src/pages/buyer/Cart.tsx &amp;&amp; npx tsc --noEmit -p .</automated>
  </verify>
  <acceptance_criteria>
    - grep finds `const DAY_LABELS: Record<string, string> = {` exactly once at module level
    - grep finds `const DAY_ORDER` exactly once and its value array contains all 7 keys: monday, tuesday, wednesday, thursday, friday, saturday, sunday
    - grep finds `const [selectedZoneId, setSelectedZoneId] = useState<Record<string, string>>({})` exactly once
    - grep finds `const handleZoneChange` exactly once
    - grep finds `const handleDayChange` exactly once
    - grep finds the literal `DAY_LABELS[day] ?? day` inside handleDayChange (confirms the label is built with the constant)
    - grep finds the literal `às ${zone.hours_end}` (confirms the em-dash format string is built in handleDayChange)
    - grep finds the exact substring `zones !== undefined && zones.length === 0` exactly once (the explicit two-part hasNoZones check)
    - grep finds `zones?.find` (optional-chained find for activeZone)
    - `npx tsc --noEmit -p .` exits 0 (no new TypeScript errors)
    - DeliveryZone type is still imported (search shows the existing line 13 import and at least one new usage in handleDayChange's `zone: DeliveryZone` parameter)
  </acceptance_criteria>
  <done>
    Cart.tsx has the data plumbing for the zone+day picker in place: module-level day constants, ephemeral `selectedZoneId` state, two handlers that route through the existing cartStore action, and per-section derived `zones` / `hasNoZones` / `activeZone` values. The JSX is still the old free-text input — Task 2 replaces it. TypeScript compiles cleanly.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Replace delivery-time JSX with 2-step zone+day selector and widen checkout disabled gate</name>
  <read_first>
    - src/pages/buyer/Cart.tsx (re-read AFTER Task 1 edits — line numbers below have shifted from pre-Task-1 numbering; locate the targets by content, not raw line number)
    - .planning/phases/buyer-delivery-select/buyer-delivery-UI-SPEC.md (CSS classes for selects, copy strings, color tokens)
  </read_first>
  <files>src/pages/buyer/Cart.tsx</files>
  <action>
This task replaces the delivery-time div block and widens the checkout button's `disabled` prop.

**Edit 1 — Replace the entire delivery-time div block.** Locate the existing block by content — find the comment `{/* Delivery time */}` followed by the `<input type="text">` that reads `section.deliveryTimePreference`. The block to REMOVE in full:

```tsx
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

REPLACE with this exact block (preserve the 18-space leading indent of the existing `{/* Delivery time */}` line — it sits inside the `isExpanded && (` panel div):

```tsx
                  {/* Delivery time — 2-step zone + day picker */}
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
                          {zones.map((z) => {
                            const days = (z.days ?? [])
                              .slice()
                              .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
                              .map((d) => DAY_LABELS[d]?.slice(0, 3) ?? d)
                              .join(', ')
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
                              .slice()
                              .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
                              .map((d) => (
                                <option key={d} value={d}>{DAY_LABELS[d] ?? d}</option>
                              ))}
                          </select>
                        )}

                        {section.deliveryTimePreference && (
                          <p className="text-xs text-gray-500">
                            Selecionado: <span className="font-semibold text-gray-700">{section.deliveryTimePreference}</span>
                          </p>
                        )}
                      </div>
                    ) : (
                      <select disabled className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl opacity-50">
                        <option>Carregando...</option>
                      </select>
                    )}
                  </div>
```

Notes on this block:
- The three-branch conditional (`hasNoZones ? ... : zones ? ... : loading`) is intentional. Order matters: check `hasNoZones` first because `zones` is also truthy when length is 0 (empty array is truthy). The current ordering correctly handles all three states: no zones → red message; zones loaded with entries → selects; zones still undefined → loading.
- Step 1's `value={selectedZoneId[section.supplier.id] ?? ''}` makes it controlled. When zone is cleared, it falls back to the placeholder option.
- Step 2 deliberately uses `value=""` (uncontrolled-after-selection) to avoid the Portuguese-label vs English-key mismatch documented in RESEARCH Pitfall 3. After picking a day, the visible confirmation comes from the `Selecionado: <strong>...</strong>` summary line just below — that is the practical UX cue that a day was chosen, even though the Step 2 select itself resets to placeholder. This summary uses only existing palette colors (text-gray-500 label, text-gray-700 value).
- The day label inside the Step 1 option uses `DAY_LABELS[d]?.slice(0, 3)` for 3-letter abbreviations (Seg, Ter, Qua, Qui, Sex, Sáb, Dom). The first three chars of each Portuguese name are unique.
- All em-dashes use the literal U+2014 character ` — `. Copy exactly; do NOT substitute hyphen `-` or en-dash `–`.

**Edit 2 — Widen the checkout button's `disabled` prop.** Locate the existing button by content — it's the immediate sibling AFTER the delivery-time block, with `onClick={() => setCheckoutSection(section)}`. Current:

```tsx
                  <button
                    onClick={() => setCheckoutSection(section)}
                    disabled={!isValid}
                    className="w-full bg-primary text-white font-bold py-3 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                  >
                    {getCheckoutLabel(section)}
                  </button>
```

Replace the `disabled` attribute only — leave className and `getCheckoutLabel` unchanged. Final button:

```tsx
                  <button
                    onClick={() => setCheckoutSection(section)}
                    disabled={!isValid || hasNoZones || !section.deliveryTimePreference}
                    className="w-full bg-primary text-white font-bold py-3 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                  >
                    {getCheckoutLabel(section)}
                  </button>
```

**DO NOT touch in this task:**
- The `CheckoutDrawer` component (lines 82-136) — drawer shows the section after the gate has passed, no changes.
- The `getCheckoutLabel` function (lines 59-73) — per UI-SPEC the button copy stays the same Finalizar string even when disabled by no-zones or missing day.
- The useEffect that fetches zones (lines 162-173) — unchanged.
- The `hasCityMismatch` amber-warning block (lines 295-302) — unchanged (CONTEXT explicitly keeps this warning).
- The Notes textarea block (lines 309-319) — unchanged.
- The `clearSection` / `setCheckoutSuccess` flow in `handleCheckout` (lines 179-234) — unchanged. After successful checkout, `clearSection(section.supplier.id)` removes the section entirely, so the now-stale `selectedZoneId[section.supplier.id]` entry naturally becomes irrelevant. Per RESEARCH assumption A3, we deliberately do NOT clean it up — no leak, avoids extra useEffect complexity.
- The empty-cart branch (lines 236-255), Footer total (lines 348-354), or Success screen (lines 366-414) — unchanged.

**Style guard:**
- Both selects use `focus:outline-none` only (no `focus:ring-*` ring) per UI-SPEC — this matches the project's existing native select pattern. Inputs use `focus:ring-2 focus:ring-primary/30` but selects intentionally do not (native select focus ring renders differently across browsers). DO NOT add a focus ring class to either select.
- The no-zones `<p>` uses `text-danger font-semibold` (NOT `font-bold`). The project's danger paragraph pattern in this codebase uses `font-semibold` at `text-xs` size — copy exactly.
  </action>
  <verify>
    <automated>cd "C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar" &amp;&amp; grep -nE "Selecione a janela de entrega|Selecione o dia|Carregando\.\.\.|Fornecedor ainda não configurou|hasNoZones \|\| !section\.deliveryTimePreference|Selecionado:" src/pages/buyer/Cart.tsx &amp;&amp; npx tsc --noEmit -p .</automated>
  </verify>
  <acceptance_criteria>
    - grep finds `Selecione a janela de entrega` exactly once (Step 1 placeholder)
    - grep finds `Selecione o dia` exactly once (Step 2 placeholder)
    - grep finds `Carregando...` exactly once (loading select option)
    - grep finds `Fornecedor ainda não configurou horários de entrega` exactly once (no-zones message)
    - grep finds `!isValid || hasNoZones || !section.deliveryTimePreference` exactly once (widened disabled condition)
    - grep finds `Selecionado:` exactly once (selected-day confirmation line)
    - grep filter for the OLD free-text input — `grep -c 'type="text"' src/pages/buyer/Cart.tsx` returns 0 (the only `type="text"` in the pre-edit file was the delivery time input; after Task 2 it should be gone). If the file ever gains another text input later this count assumption needs revisiting; for THIS phase the count must drop to 0.
    - grep -c finds `placeholder="Ex: 07h-09h"` returning 0 (old placeholder removed)
    - grep finds `<select` at least 3 times (Step 1, Step 2, loading) — the conditional only renders one branch at runtime but the source contains all three
    - grep finds `value=""` on the Step 2 select line (uncontrolled-after-selection per Pitfall 3 resolution). Search context: 2 hits expected (Step 1 placeholder option + Step 2 select value) — verify both.
    - grep finds `DAY_ORDER.indexOf` at least twice (used in both Step 1 and Step 2 sorts)
    - grep finds `DAY_LABELS[d]` at least three times (Step 1 abbrev slice, Step 2 full label, plus the handleDayChange template literal)
    - `npx tsc --noEmit -p .` exits 0
    - File line count is within expected delta — pre-phase was 419 lines, after Plan 03 Tasks 1+2 expect roughly 470-490 lines (rough sanity check, not a hard gate; investigate if outside this range)
  </acceptance_criteria>
  <done>
    Cart.tsx no longer contains the free-text delivery time input. Each expanded supplier section shows one of: red "no zones" message, the 2-step zone+day cascading select with a "Selecionado: ..." confirmation, or the loading select. The Finalizar pedido button is disabled until a zone AND a day are picked (or remains disabled if the supplier has no zones). All UI strings match the UI-SPEC copywriting contract. TypeScript compiles cleanly.
  </done>
</task>

</tasks>

<verification>
- `grep -n "selectedZoneId\|handleZoneChange\|handleDayChange\|hasNoZones\|activeZone\|DAY_LABELS\|DAY_ORDER" src/pages/buyer/Cart.tsx` shows all 7 new identifiers present
- `grep -c 'type="text"' src/pages/buyer/Cart.tsx` returns 0 (free-text delivery input removed)
- `grep -c '<select' src/pages/buyer/Cart.tsx` returns >= 3 (Step 1, Step 2, loading)
- `npx tsc --noEmit -p .` exits 0
- Manual smoke (informational only, not a gate):
  - Open a supplier section whose `delivery_zones` are still loading: should see disabled "Carregando..." select.
  - Open a supplier section with no zones configured: should see red "Fornecedor ainda não configurou..." message and disabled Finalizar button.
  - Open a supplier section with zones: should see Step 1 with options "Seg, Qua, Sex — 07:00 às 09:00" style. Pick a zone → Step 2 appears with full day names. Pick a day → "Selecionado: Quarta — 07:00 às 09:00" appears and Finalizar enables.
  - Change zone after picking a day: Step 2 resets, "Selecionado: ..." line disappears, Finalizar disables.
  - Submit a checkout: order is created with `delivery_time_preference: 'Quarta — 07:00 às 09:00'` (or whatever was selected). WhatsApp message uses the same string.
</verification>

<success_criteria>
- One file modified (`src/pages/buyer/Cart.tsx`), no new files, no schema or service changes.
- Free-text delivery time input is fully replaced with the 2-step zone+day cascade.
- Checkout gate widened to require zone availability AND a selected day.
- All UI copy strings match the UI-SPEC copywriting table.
- TypeScript compiles cleanly.
- No regressions in non-touched areas (CheckoutDrawer, Notes textarea, city-mismatch warning, empty-cart, success screen).
</success_criteria>

<output>
After completion, create `.planning/phases/buyer-delivery-select/buyer-delivery-select-03-SUMMARY.md` following the project SUMMARY template. Cover: the two-task split (plumbing then JSX), the Pitfall 3 resolution (uncontrolled Step 2 + visible "Selecionado:" line), the stored value format, and confirmation that no DB schema changes were required.
</output>
