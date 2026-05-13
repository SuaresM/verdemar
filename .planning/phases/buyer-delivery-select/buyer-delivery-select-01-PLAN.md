---
phase: buyer-delivery-select
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/shared/CityCombobox.tsx
autonomous: true
requirements:
  - strict-city-combobox

must_haves:
  truths:
    - "CityCombobox accepts a strict?: boolean prop (default false, opt-in)"
    - "With strict=true, blurring the input with text that does not exactly match any CITIES[n].city resets the input to the last valid city and shows the error 'Selecione uma cidade da lista'"
    - "With strict=true, selecting a city from the dropdown clears the strict-blur error and accepts the value"
    - "When the external value prop changes (parent reset / edit-mode toggle), the internal lastValidCity ref is re-synced so the next strict-blur falls back to the new value"
    - "The 150ms onBlur setTimeout is preserved so onMouseDown on a dropdown option still wins the race"
    - "With strict=false (default), behavior is unchanged from current (free text accepted on blur, no internal error)"
  artifacts:
    - path: "src/components/shared/CityCombobox.tsx"
      provides: "CityCombobox component with optional strict mode"
      contains: "strict?: boolean"
  key_links:
    - from: "CityComboboxProps"
      to: "strict prop"
      via: "TS interface field"
      pattern: "strict\\?:\\s*boolean"
    - from: "onBlur setTimeout"
      to: "CITIES.some(c => c.city === query) check"
      via: "strict branch inside the 150ms timeout"
      pattern: "CITIES\\.some"
    - from: "handleSelect"
      to: "lastValidCity.current"
      via: "ref update on accepted selection"
      pattern: "lastValidCity\\.current\\s*="
---

<objective>
Add an opt-in strict mode to `CityCombobox` so callers can force the user to pick from the `CITIES` list. Implements decision D-01 at the component level only — call sites in Register and Profile are wired in Plan 02.

Purpose: Eliminate free-text city values for buyer registration and profile so `address_state` is always a valid pair with `address_city` and delivery-zone matching is deterministic.

Output: Modified `src/components/shared/CityCombobox.tsx` with `strict?: boolean` prop, internal `lastValidCity` ref, internal `internalError` state, strict-aware `onBlur`, ref-sync `useEffect`, and merged error display. No other files changed.
</objective>

<execution_context>
@C:/Users/jsuar/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/jsuar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar/src/components/shared/CityCombobox.tsx
@C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar/src/constants/cities.ts
@C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar/.planning/phases/buyer-delivery-select/CONTEXT.md
@C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar/.planning/phases/buyer-delivery-select/buyer-delivery-RESEARCH.md
@C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar/.planning/phases/buyer-delivery-select/buyer-delivery-PATTERNS.md
@C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar/.planning/phases/buyer-delivery-select/buyer-delivery-UI-SPEC.md
</context>

<interfaces>
<!-- CityComboboxProps after this plan (extends current interface with one optional field) -->
```tsx
interface CityComboboxProps {
  value: string
  onChange: (city: string, state: string) => void
  placeholder?: string
  error?: string
  strict?: boolean  // NEW — when true, rejects unselected free text on blur
}
```

<!-- CITIES type (from src/constants/cities.ts — already imported in current file) -->
```tsx
interface City { city: string; state: string }
export const CITIES: City[] = [ /* ~50 DF + entorno cities */ ]
```

<!-- Current full file (60 lines) — already read in planner; executor MUST re-read before editing -->
<!-- Key existing primitives preserved by this plan: -->
<!-- - useState(value) for query -->
<!-- - useState(false) for open -->
<!-- - useEffect([value]) syncing query -->
<!-- - filtered CITIES list (toLowerCase includes, slice 8) -->
<!-- - handleSelect setting query + calling onChange + closing dropdown -->
<!-- - 150ms onBlur setTimeout (NON-NEGOTIABLE — preserves mousedown-before-blur race) -->
<!-- - dropdown <button onMouseDown={...}> option pattern -->
</interfaces>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add strict mode to CityCombobox (props, refs, blur, error merge)</name>
  <read_first>
    - src/components/shared/CityCombobox.tsx (full file — 60 lines, read entirely before editing)
    - src/constants/cities.ts (to confirm City interface has `city: string`)
  </read_first>
  <files>src/components/shared/CityCombobox.tsx</files>
  <behavior>
    - With strict=false (or omitted): blurring with arbitrary text leaves the input unchanged and no internal error is shown (backward compatible).
    - With strict=true: blurring with text that does not match any CITIES[n].city resets the displayed query to the last accepted city (or '' if none) and renders error 'Selecione uma cidade da lista'.
    - With strict=true: selecting an option from the dropdown clears the internal error.
    - When the parent passes a new value prop (e.g., form reset, Profile editing-mode toggle), lastValidCity is re-synced.
    - Clicking a dropdown option still works (the 150ms blur timeout lets onMouseDown win).
  </behavior>
  <action>
Make these EXACT edits to `src/components/shared/CityCombobox.tsx`. The current file is 60 lines — re-read it first; the line references below correspond to that file.

**Edit 1 — Update the import line (line 1).** Currently:
```tsx
import { useState, useEffect } from 'react'
```
Replace with:
```tsx
import { useState, useEffect, useRef } from 'react'
```

**Edit 2 — Extend `CityComboboxProps` (lines 4-9).** Currently:
```tsx
interface CityComboboxProps {
  value: string
  onChange: (city: string, state: string) => void
  placeholder?: string
  error?: string
}
```
Replace with:
```tsx
interface CityComboboxProps {
  value: string
  onChange: (city: string, state: string) => void
  placeholder?: string
  error?: string
  strict?: boolean
}
```

**Edit 3 — Update the function signature to destructure `strict` (line 11).** Currently:
```tsx
export function CityCombobox({ value, onChange, placeholder = 'Digite a cidade...', error }: CityComboboxProps) {
```
Replace with:
```tsx
export function CityCombobox({ value, onChange, placeholder = 'Digite a cidade...', error, strict = false }: CityComboboxProps) {
```

**Edit 4 — Add two new state primitives immediately AFTER the existing `useState(false)` on line 13.** Insert these as new lines between line 13 and the existing `useEffect` on line 15:
```tsx
  const lastValidCity = useRef<string>(value)
  const [internalError, setInternalError] = useState<string>('')
```

**Edit 5 — Extend the existing `useEffect` (lines 15-17) so it also syncs the ref.** Currently:
```tsx
  useEffect(() => {
    setQuery(value)
  }, [value])
```
Replace with:
```tsx
  useEffect(() => {
    setQuery(value)
    lastValidCity.current = value
  }, [value])
```

**Edit 6 — Update `handleSelect` (lines 23-27) to record the accepted value and clear the internal error.** Currently:
```tsx
  const handleSelect = (city: string, state: string) => {
    setQuery(city)
    onChange(city, state)
    setOpen(false)
  }
```
Replace with:
```tsx
  const handleSelect = (city: string, state: string) => {
    lastValidCity.current = city
    setQuery(city)
    setInternalError('')
    onChange(city, state)
    setOpen(false)
  }
```

**Edit 7 — Expand the `onBlur` handler (line 38) with the strict-validation branch INSIDE the existing 150ms setTimeout.** The 150ms delay MUST be preserved — it lets `onMouseDown` on a dropdown option fire before blur closes the list. Currently:
```tsx
        onBlur={() => setTimeout(() => setOpen(false), 150)}
```
Replace with:
```tsx
        onBlur={() => setTimeout(() => {
          setOpen(false)
          if (strict) {
            const isValid = CITIES.some((c) => c.city === query)
            if (!isValid) {
              setQuery(lastValidCity.current)
              setInternalError('Selecione uma cidade da lista')
            } else {
              setInternalError('')
            }
          }
        }, 150)}
```

**Edit 8 — Merge external `error` prop with `internalError` in the display paragraph (line 43).** Currently:
```tsx
      {error && <p className="text-danger text-xs mt-1">{error}</p>}
```
Replace with:
```tsx
      {(internalError || error) && (
        <p className="text-danger text-xs mt-1">{internalError || error}</p>
      )}
```

**Edit 9 — Update the dropdown option `className` (line 51) to the UI-SPEC approved string.** Currently:
```tsx
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 font-medium text-gray-800"
```
Replace with:
```tsx
              className="w-full px-4 py-2 min-h-[44px] text-left text-sm hover:bg-gray-50 font-bold text-gray-800"
```

**DO NOT** change anywhere else:
- Do NOT touch the input className on line 41 (`border-gray-200` must NOT become a red border — UI-SPEC prohibits red borders on error state; error is text-only).
- Do NOT touch the dropdown wrapper `<div>` className on line 45.
- Do NOT remove or shorten the 150ms timeout — clicking an option will break in strict mode.
- Do NOT case-fold the strict match — keep `c.city === query` (case-sensitive, exact). City names contain accents (Brasília, Paranoá); a lowercase compare would require normalization and is explicitly out of scope.
- Do NOT introduce `lastValidCity` as `useState` — it must be `useRef` (per anti-pattern note in RESEARCH.md: state would re-render on every keystroke).
  </action>
  <verify>
    <automated>cd "C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar" &amp;&amp; grep -nE "strict\?:|strict = false|lastValidCity|internalError|CITIES\.some|Selecione uma cidade da lista|setTimeout\(\(\) =&gt; \{|useRef" src/components/shared/CityCombobox.tsx &amp;&amp; npx tsc --noEmit -p .</automated>
  </verify>
  <acceptance_criteria>
    - grep finds `strict?: boolean` exactly once (props interface)
    - grep finds `strict = false` exactly once (destructured default in function signature)
    - grep finds `lastValidCity` at least 4 times: useRef declaration, useEffect sync line, handleSelect assignment, onBlur read (`setQuery(lastValidCity.current)`)
    - grep finds `internalError` at least 4 times: useState declaration, handleSelect clear, onBlur set/clear, display paragraph
    - grep finds `CITIES.some((c) => c.city === query)` exactly once (strict validation)
    - grep finds the literal string `Selecione uma cidade da lista` exactly once
    - grep finds `useRef` exactly once in the import statement
    - grep finds `setTimeout(() => {` (multi-line arrow body) at the onBlur — confirms the timeout was expanded, not replaced
    - The 150 ms numeric literal still appears exactly once in the file (search `, 150)` — confirms the delay was preserved)
    - The input `className` on the `<input>` element still contains `border-gray-200` (NOT replaced with red border)
    - The dropdown option `className` contains `min-h-[44px]` AND `font-bold` AND `py-2` (UI-SPEC applied) and does NOT contain `py-2.5` or `font-medium` anymore
    - `npx tsc --noEmit -p .` exits 0 (no new TypeScript errors)
    - File still exports `CityCombobox` (grep `export function CityCombobox` returns one match)
  </acceptance_criteria>
  <done>
    CityCombobox.tsx exposes `strict?: boolean`. With `strict={true}`, blurring with non-matching text resets the input and shows a Portuguese error; selecting from the dropdown clears the error; external `value` prop changes re-sync `lastValidCity`. Default behavior (`strict={false}`) is byte-identical with previous behavior for callers that don't pass the prop. `npx tsc --noEmit` passes.
  </done>
</task>

</tasks>

<verification>
- `grep -n "strict\?:\|lastValidCity\|internalError\|CITIES\.some" src/components/shared/CityCombobox.tsx` shows all four primitives present
- `npx tsc --noEmit -p .` exits 0
- Manual sanity (informational, not required for done): in the running app, opening any current call site of `CityCombobox` without `strict` prop still allows free text on blur (regression check — Register currently has no `strict` prop until Plan 02 lands)
</verification>

<success_criteria>
- CityCombobox.tsx has new `strict?: boolean` prop, `useRef` for `lastValidCity`, `useState` for `internalError`, ref-sync in the value `useEffect`, strict branch inside the 150 ms onBlur, error merge in the display paragraph, and the UI-SPEC option className.
- Backward compatibility verified: any caller not passing `strict` gets default `false` → identical pre-phase behavior.
- TypeScript compiles cleanly.
</success_criteria>

<output>
After completion, create `.planning/phases/buyer-delivery-select/buyer-delivery-select-01-SUMMARY.md` following the project SUMMARY template. Include the diff scope (one file), the strict semantics, and a one-line note for Plan 02 consumers: "Pass `strict` (boolean) prop to opt in; default `false` keeps current behavior."
</output>
