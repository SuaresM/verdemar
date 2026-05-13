---
phase: buyer-delivery-select
plan: 02
type: execute
wave: 2
depends_on:
  - 01
files_modified:
  - src/pages/public/Register.tsx
  - src/pages/buyer/Profile.tsx
autonomous: true
requirements:
  - strict-city-register
  - strict-city-profile

must_haves:
  truths:
    - "Buyer registration in Register.tsx uses CityCombobox with strict mode — submitting arbitrary text without picking a city is blocked at blur (input resets to last valid value, error shown)"
    - "Buyer profile edit mode in Profile.tsx replaces the free-text Cidade Input with a strict CityCombobox"
    - "Selecting a city in Profile edit mode auto-fills address_state via a single setForm spread (atomic, no stale state)"
    - "The address_state field in Profile edit mode becomes a read-only display input (bg-gray-50 text-gray-500) — buyer cannot edit it directly"
    - "The CityCombobox dropdown in Profile renders at full width — not constrained to a half-column grid"
    - "Save path (handleSave → updateBuyer(buyer.id, form)) is unchanged — form.address_city and form.address_state already flow to it"
  artifacts:
    - path: "src/pages/public/Register.tsx"
      provides: "Buyer registration form with strict CityCombobox"
      contains: "<CityCombobox\n                  strict"
    - path: "src/pages/buyer/Profile.tsx"
      provides: "Profile edit mode with strict CityCombobox + read-only state input"
      contains: "<CityCombobox"
  key_links:
    - from: "Register buyer form Cidade field"
      to: "CityCombobox strict prop"
      via: "JSX prop"
      pattern: "<CityCombobox[\\s\\S]*?strict"
    - from: "Profile CityCombobox onChange"
      to: "setForm(prev => ({ ...prev, address_city, address_state }))"
      via: "single atomic state update"
      pattern: "address_city:\\s*city,\\s*address_state:\\s*state"
    - from: "Profile Estado field"
      to: "readOnly input with bg-gray-50"
      via: "controlled input, no onChange"
      pattern: "readOnly"
---

<objective>
Wire the two buyer-facing call sites of `CityCombobox` to the strict API introduced in Plan 01. Register only needs a prop addition; Profile requires replacing the existing free-text Cidade Input + Estado Input pair with a strict combobox plus a read-only Estado display.

Purpose: Enforce decision D-01 at the surfaces where buyers actually enter their city — registration and self-service profile edit. Once these are strict, every buyer record in the DB will pair `address_city` with a canonical `address_state` from the static `CITIES` table.

Output: Two modified pages. No new files, no changes to schemas, services, or stores.
</objective>

<execution_context>
@C:/Users/jsuar/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/jsuar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar/src/pages/public/Register.tsx
@C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar/src/pages/buyer/Profile.tsx
@C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar/src/components/shared/CityCombobox.tsx
@C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar/.planning/phases/buyer-delivery-select/CONTEXT.md
@C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar/.planning/phases/buyer-delivery-select/buyer-delivery-RESEARCH.md
@C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar/.planning/phases/buyer-delivery-select/buyer-delivery-PATTERNS.md
@C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar/.planning/phases/buyer-delivery-select/buyer-delivery-UI-SPEC.md
@C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar/.planning/phases/buyer-delivery-select/buyer-delivery-select-01-SUMMARY.md
</context>

<interfaces>
<!-- CityCombobox API after Plan 01 -->
```tsx
interface CityComboboxProps {
  value: string
  onChange: (city: string, state: string) => void
  placeholder?: string
  error?: string
  strict?: boolean   // NEW — pass `strict` boolean attribute to enable
}
```

<!-- Register existing call (Register.tsx lines 282-289) — CityCombobox is already imported -->
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

<!-- Profile form state pattern (Profile.tsx lines 20-31) — local useState, NOT react-hook-form -->
```tsx
const [form, setForm] = useState({
  // ...
  address_city: buyer?.address_city || '',
  address_state: buyer?.address_state || '',
  // ...
})
// updates use: setForm(prev => ({ ...prev, [field]: value }))
```

<!-- Profile current Cidade+Estado block (Profile.tsx lines 175-178, inside the editing-mode `<div className="space-y-3">`) -->
```tsx
<div className="grid grid-cols-2 gap-2">
  <Input label="Cidade" field="address_city" />
  <Input label="Estado" field="address_state" />
</div>
```

<!-- Profile DOES NOT currently import CityCombobox — this plan adds the import -->

<!-- Project label style used by Profile inputs and Cart fields (re-use it for new labels) -->
```tsx
<label className="block text-xs font-semibold text-gray-500 mb-1">…</label>
```

<!-- Read-only input style for the auto-filled Estado field -->
```tsx
className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-500 focus:outline-none"
```
</interfaces>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Pass strict prop to CityCombobox in Register buyer form</name>
  <read_first>
    - src/pages/public/Register.tsx (full file — 380 lines, read entirely before editing)
    - src/components/shared/CityCombobox.tsx (post-Plan-01 — to confirm `strict?: boolean` prop exists)
  </read_first>
  <files>src/pages/public/Register.tsx</files>
  <action>
This is a minimal, surgical change — ONE attribute added to ONE JSX element.

Locate the existing `<CityCombobox>` element in the buyer form (currently at lines 282-289). Currently:
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

Replace with (note the new `strict` first attribute on its own line — boolean shorthand, no value):
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

**DO NOT touch anything else in Register.tsx:**
- Do NOT add `strict` to the supplier form's plain `<InputField label="Cidade" ...>` block (lines 320-323) — supplier registration uses a separate free-text city/state input on purpose and is out of scope for this phase.
- Do NOT change the zod `buyerSchema` for `address_city` / `address_state` — strict enforcement is at the UI level only; the zod minimum-length check stays.
- Do NOT change the `onChange` body, the `value` expression, or the `error` prop.
- Do NOT alter the surrounding `<div>` or `<label>` that wraps the CityCombobox.
- Do NOT touch `onSubmitBuyer`, `onSubmitSupplier`, or any other handler.

There should be exactly ONE `<CityCombobox` open tag in the entire file after this edit (same as before — only the `strict` prop is added to it).
  </action>
  <verify>
    <automated>cd "C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar" &amp;&amp; grep -nE "&lt;CityCombobox|strict" src/pages/public/Register.tsx</automated>
  </verify>
  <acceptance_criteria>
    - grep finds `<CityCombobox` exactly once in Register.tsx (same count as before — confirming we only modified the existing element)
    - grep finds `strict` at least once in Register.tsx, and that match is on the line immediately AFTER `<CityCombobox` (boolean shorthand attribute)
    - grep does NOT find `strict={false}` anywhere in Register.tsx
    - The buyer form still contains the `address_city` setValue and `address_state` setValue calls (no regression of the existing auto-fill mechanism)
    - The supplier form `<InputField label="Cidade"` block remains unchanged (still uses InputField, not CityCombobox)
    - `npx tsc --noEmit -p .` exits 0
  </acceptance_criteria>
  <done>Buyer registration's city field is a strict combobox. Typing partial text and blurring without picking an option resets the input. Supplier registration is unchanged.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Replace Profile city+state Input pair with strict CityCombobox + read-only Estado</name>
  <read_first>
    - src/pages/buyer/Profile.tsx (full file — 273 lines, read entirely before editing)
    - src/components/shared/CityCombobox.tsx (post-Plan-01 — confirm strict prop)
  </read_first>
  <files>src/pages/buyer/Profile.tsx</files>
  <action>
This task makes two edits to `src/pages/buyer/Profile.tsx`:

**Edit 1 — Add the CityCombobox import.** The current import block is lines 1-10. After the existing line 10 (`import { supabase } from '../../lib/supabaseClient'`), insert a new line:
```tsx
import { CityCombobox } from '../../components/shared/CityCombobox'
```
Order does not matter strictly but keep it grouped with the other component-style imports near the top. After this edit, there is exactly one import of `CityCombobox` in the file.

**Edit 2 — Replace the Cidade + Estado grid block.** Currently, inside the editing-mode address section (around lines 175-178), the file contains:
```tsx
              <div className="grid grid-cols-2 gap-2">
                <Input label="Cidade" field="address_city" />
                <Input label="Estado" field="address_state" />
              </div>
```

Replace those exact 4 lines with TWO sibling `<div>` elements (full-width, stacked — REMOVE the `grid grid-cols-2 gap-2` wrapper because CityCombobox has an absolutely-positioned dropdown that requires full container width):
```tsx
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Cidade</label>
                <CityCombobox
                  strict
                  value={form.address_city}
                  onChange={(city, state) => setForm((prev) => ({ ...prev, address_city: city, address_state: state }))}
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

Key constraints on Edit 2:
- The `<CityCombobox>` MUST use `strict` (boolean shorthand) and pass `value={form.address_city}` (no `|| ''` because `form.address_city` is initialized to `''` in line 28 — never undefined).
- The `onChange` MUST update both `address_city` and `address_state` in a SINGLE `setForm` call using the spread pattern `setForm((prev) => ({ ...prev, address_city: city, address_state: state }))`. Do NOT split this into two `setForm` calls — that would risk stale state between the two updates.
- The Estado `<input>` MUST be `readOnly` (lowercase-r `readOnly` is the React prop; not `disabled`). Use the exact className shown above — `bg-gray-50 text-gray-500` is the chosen visual signal for an auto-filled, locked field per UI-SPEC IC-02.
- Both labels use the project's existing micro-label class `block text-xs font-semibold text-gray-500 mb-1` (same as the inline `Input` component on line 91).
- Keep the surrounding `<div className="space-y-3">` (line 167) so the two new `<div>`s inherit the vertical rhythm of the other address fields in editing mode.

**DO NOT touch anywhere else in Profile.tsx:**
- Do NOT change the inline `Input` component definition (lines 83-98) — other address fields (CEP, Rua, Número, Complemento, Bairro) still use it.
- Do NOT change the non-editing display block (lines 181-186) — read-only profile view of `address_city` / `address_state` continues to use `<p>` text.
- Do NOT change `handleSave` (lines 39-51). It calls `updateBuyer(buyer.id, form)` with the full `form` object; both `address_city` and `address_state` already live in `form`, so the save path is unchanged.
- Do NOT add validation here for empty city — Profile's `handleSave` doesn't currently validate individual fields and adding it is out of scope.
- Do NOT remove the `address_state` key from the initial `form` state (line 29) — it must remain so the field has a defined value.
- Do NOT replace the Address grid that contains Número + Complemento (lines 170-173) — only the Cidade + Estado grid is replaced.
  </action>
  <verify>
    <automated>cd "C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar" &amp;&amp; grep -nE "CityCombobox|readOnly|address_city: city, address_state: state|grid grid-cols-2 gap-2" src/pages/buyer/Profile.tsx</automated>
  </verify>
  <acceptance_criteria>
    - grep finds `import { CityCombobox } from '../../components/shared/CityCombobox'` exactly once
    - grep finds `<CityCombobox` exactly once in the JSX (the new edit-mode element)
    - grep finds the line `strict` immediately after `<CityCombobox` (boolean shorthand)
    - grep finds the exact substring `address_city: city, address_state: state` exactly once (atomic setForm pattern)
    - grep finds `readOnly` exactly once in Profile.tsx (the new Estado input)
    - grep finds `bg-gray-50 text-gray-500` on the readOnly input className
    - grep finds `grid grid-cols-2 gap-2` exactly ONCE in Profile.tsx (the Número + Complemento grid on line 170 stays — the Cidade + Estado grid is gone). Pre-edit count: 2; post-edit count: 1.
    - grep does NOT find `<Input label="Cidade"` anywhere (replaced)
    - grep does NOT find `<Input label="Estado"` anywhere (replaced)
    - The inline `const Input = ...` component definition (search `const Input = ({`) still exists exactly once (used by the other address fields)
    - `npx tsc --noEmit -p .` exits 0
  </acceptance_criteria>
  <done>
    Profile edit mode shows a full-width strict CityCombobox for Cidade and a read-only auto-filled Estado input below it. Selecting a city auto-fills the state in a single atomic setForm update. Save flow is unchanged. Non-editing display is unchanged.
  </done>
</task>

</tasks>

<verification>
- `grep -n "<CityCombobox" src/pages/public/Register.tsx src/pages/buyer/Profile.tsx` shows exactly 2 total occurrences (1 in Register, 1 in Profile)
- `grep -n "strict" src/pages/public/Register.tsx src/pages/buyer/Profile.tsx` shows the new `strict` boolean attribute in both files
- `grep -c "grid grid-cols-2 gap-2" src/pages/buyer/Profile.tsx` returns 1 (was 2 pre-edit; the Cidade+Estado grid was removed)
- `npx tsc --noEmit -p .` exits 0
- Manual smoke (informational, not gating): in dev, registering a buyer or editing buyer profile and typing "blabla" in the Cidade input then blurring should reset the input and show "Selecione uma cidade da lista". Selecting a real city should auto-fill the Estado below.
</verification>

<success_criteria>
- Two files modified, no new files.
- Both buyer entry points (Register, Profile) use strict CityCombobox.
- Profile state field is read-only and auto-fills from city selection.
- TypeScript compiles cleanly.
- No regressions in supplier registration, Profile non-editing view, or the save path.
</success_criteria>

<output>
After completion, create `.planning/phases/buyer-delivery-select/buyer-delivery-select-02-SUMMARY.md` summarizing the two surgical edits, the layout change (grid removed in Profile), and noting that `delivery_time_preference` work is in Plan 03 (independent and may already be done in parallel via Wave 1).
</output>
