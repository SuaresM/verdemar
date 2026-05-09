---
phase: product-stock-zones-ux
plan: "04"
subsystem: zone-modal-accordion
tags:
  - bug-fix
  - api-hardening
  - modal-state
  - accordion
  - ux
dependency_graph:
  requires:
    - product-stock-zones-ux-02 (PATCH product routes already in api/[...route].ts)
  provides:
    - PUT /api/supplier/delivery-zones/:id returns 404 with localized message on 0-row update
    - Zone modal always clears editingZone on all close paths (success, error, cancel, background)
    - Collapsible RA list section — starts collapsed, count badge, chevron rotation
  affects:
    - api/[...route].ts
    - src/pages/supplier/StoreSettings.tsx
tech_stack:
  added: []
  patterns:
    - PostgREST .select('id', { count: 'exact', head: true }) for detecting 0-row updates
    - always-clear modal state pattern (setEditingZone(null) on every close path)
    - React useState boolean toggle for accordion visibility
    - lucide-react ChevronDown with conditional rotate-180 class
key_files:
  created: []
  modified:
    - api/[...route].ts
    - src/pages/supplier/StoreSettings.tsx
decisions:
  - "PUT /supplier/delivery-zones/:id returns 404 (not 400) on 0-row update — consistent with the PATCH /products/:id/* pattern from Plan 02; 404 is the semantically correct status for a resource that was not found or is owned by another supplier"
  - "showRaList defaults to false (collapsed) matching D-04 requirement — suppliers see the count badge without the 32-item list blocking the page"
  - "hint paragraph ('Toque em uma região...') moved inside {showRaList && (...)} — it is only relevant when the list is visible"
  - "Outra cidade button kept as sibling of toggle button so clicking it does not collapse the accordion"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-09"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 2
  files_created: 0
---

# Phase product-stock-zones-ux Plan 04: Zone Save Bug Fix + Collapsible RA Accordion Summary

## One-liner

Fixed PUT /supplier/delivery-zones/:id silent-success on 0-row update with 404 count-check, hardened zone modal to always clear editingZone on every close path, and wrapped the 32-item DF RA list in a collapsed accordion with count badge and rotating chevron.

## What Was Built

### Task 1: Fix PUT /supplier/delivery-zones/:id (api/[...route].ts)

**File:** `api/[...route].ts` lines 213–221

Changed `const { error }` to `const { error, count }` and appended `.select('id', { count: 'exact', head: true })` to the Supabase update chain. Added a 404 guard:

```typescript
if (!count || count === 0) return c.json({ error: 'Zona não encontrada ou sem permissão' }, 404)
```

Before this fix, a PUT to a zoneId owned by a different supplier (or a non-existent zone) would return HTTP 200 `{ ok: true }` with 0 rows affected — a silent "saved but not saved" experience. The fix surfaces the failure to the client and to the `updateDeliveryZone` call in StoreSettings.tsx, allowing the catch branch to toast the error and close the modal.

The PATCH `/products/:id/stock` and `/products/:id/sell-without-stock` routes added in Plan 02 are untouched (regression guard verified).

### Task 2: Fix StoreSettings.tsx modal close paths

**File:** `src/pages/supplier/StoreSettings.tsx`

Three changes:

1. **handleSaveZone** — success branch now calls `setEditingZone(null)` after `setShowZoneModal(false)`. Catch branch now calls both `setShowZoneModal(false)` AND `setEditingZone(null)` (previously: modal stayed open on error, editingZone leaked to next open). The `!supplier` guard now toasts `'Sessão expirada. Recarregue a página.'` instead of silently returning.

2. **Modal background click** — onClick changed from `() => setShowZoneModal(false)` to `() => { setShowZoneModal(false); setEditingZone(null) }`

3. **Cancel button** — same change as background click

After these fixes, all 5 paths that close the zone modal (success, error, cancel-button, background-click, and the existing openAddZone) properly reset editingZone to null. The password modal background click (`setShowPwModal`) is untouched.

### Task 3: Add collapsible RA list accordion

**File:** `src/pages/supplier/StoreSettings.tsx`

Four changes:

1. **Import** — added `ChevronDown` to the lucide-react import line

2. **State** — added `const [showRaList, setShowRaList] = useState(false)` between `zoneSaving` and `showPwModal` state declarations

3. **Section header** — replaced the static `<p>Regiões de Entrega — DF</p>` with a clickable `<button>` that contains the title, a count badge (`{zones.filter(z => DF_RAS.includes(z.city)).length}/{DF_RAS.length} configuradas`), and a `ChevronDown` icon with `rotate-180` class conditional on `showRaList`. The "Outra cidade" button remains as a sibling at the same flex level — clicking it opens the Add modal but does NOT toggle the accordion.

4. **List wrapping** — the hint paragraph and the `{zonesLoading ? ... : <div className="space-y-2">...</div>}` block are wrapped in `{showRaList && (<>...</>)}`. The inner JSX (configured zone rows with pencil/trash, unconfigured rows with +) is byte-for-byte identical to the original.

On mount, `showRaList` is `false` so the 32 DF_RAS rows are not in the DOM. The header shows the count badge immediately. Clicking the header toggles visibility; the chevron rotates to signal state.

## Deviations from Plan

None — plan executed exactly as written. The only minor note: the plan's Change 3 for Task 3 showed the hint paragraph as part of the header replacement (in the new accordion header JSX), but the plan's Change 4 correctly moved it inside the `{showRaList && (...)}` block. The file was edited in two steps (Change 3 replaced the header only, Change 4 wrapped the list block including the hint paragraph) — the end result matches the plan spec exactly.

## Known Stubs

None — all changes wire real data and behavior.

## Threat Flags

No new security surface beyond the plan's threat model. Mitigations implemented:
- T-product-stock-zones-ux-16 (Tampering — PUT 0-row update): 404 count-check implemented
- T-product-stock-zones-ux-18 (Spoofing — editingZone state leak): always-clear pattern implemented on all 4 new close paths

## Self-Check

### Files verified:
- `api/[...route].ts` — contains `Zona não encontrada ou sem permissão` (count: 1); handler not duplicated (count: 1); `.select('id', { count: 'exact', head: true })` present in PUT handler; PATCH stock and sell-without-stock routes still present
- `src/pages/supplier/StoreSettings.tsx` — `setEditingZone(null)` count: 5; `Sessão expirada` count: 1; `setShowZoneModal(false); setEditingZone(null)` count: 2; `ChevronDown` count: 2; `showRaList` count: 4; `configuradas` count: 1; `DF_RAS.includes(z.city)` count: 1; `rotate-180` count: 1; `Toque em uma região` count: 1; `DF_RAS.map` count: 1

### TypeScript: 0 errors (`npx tsc --noEmit` passes)

### Commits:
- `39105fa`: fix(product-stock-zones-ux-04): PUT /supplier/delivery-zones/:id returns 404 on 0-row update
- `ecf062a`: fix(product-stock-zones-ux-04): clear editingZone on all zone modal close paths
- `5c5c27f`: feat(product-stock-zones-ux-04): add collapsible RA list accordion with chevron and count badge

## Self-Check: PASSED
