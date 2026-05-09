---
phase: product-stock-zones-ux
plan: 04
type: execute
wave: 2
depends_on:
  - 02
files_modified:
  - api/[...route].ts
  - src/pages/supplier/StoreSettings.tsx
autonomous: true
requirements:
  - D-03
  - D-04
must_haves:
  truths:
    - "PUT /api/supplier/delivery-zones/:id returns 404 with localized message when 0 rows are updated (zone does not exist or supplier_id mismatch)"
    - "Clicking the modal Cancel button closes the modal AND clears editingZone state"
    - "Clicking the modal background closes the modal AND clears editingZone state"
    - "On successful save, the modal closes AND editingZone is cleared (no stale edit state on next open)"
    - "On save error, the modal closes AND editingZone is cleared (no stuck modal)"
    - "The 'Regiões de Entrega — DF' section starts collapsed by default and shows '{configuredCount}/{DF_RAS.length} configuradas' badge in the header"
    - "Clicking the section header toggles the RA list visibility; the chevron icon rotates 180deg when expanded"
    - "When collapsed, the 32 DF_RAS rows (and the 'Carregando...' state) are NOT in the DOM"
    - "When expanded, the existing RA list rendering is unchanged (configured zones show pencil/trash, unconfigured show '+')"
  artifacts:
    - path: "api/[...route].ts"
      provides: "Fixed PUT /supplier/delivery-zones/:id with count check"
      contains: "Zona não encontrada ou sem permissão"
    - path: "src/pages/supplier/StoreSettings.tsx"
      provides: "Zone modal state cleanup on all close paths + collapsible RA list with chevron + count badge"
      contains: "showRaList"
  key_links:
    - from: "api/[...route].ts (PUT /supplier/delivery-zones/:id)"
      to: "delivery_zones table"
      via: "adminSupabase update with count check returning 404 on 0 rows"
      pattern: "Zona não encontrada ou sem permissão"
    - from: "src/pages/supplier/StoreSettings.tsx (handleSaveZone)"
      to: "setEditingZone(null) on success and error"
      via: "always-clear pattern in try/catch"
      pattern: "setEditingZone\\(null\\)"
    - from: "src/pages/supplier/StoreSettings.tsx (Cancel button + background click)"
      to: "setEditingZone(null)"
      via: "inline onClick that clears both modal state and editingZone"
      pattern: "setShowZoneModal\\(false\\); setEditingZone\\(null\\)"
    - from: "src/pages/supplier/StoreSettings.tsx (RA section header)"
      to: "showRaList state toggle"
      via: "clickable button with ChevronDown icon and rotate-180 conditional class"
      pattern: "setShowRaList"
---

<objective>
Implement D-03 (zone save bug fix — both API and frontend) and D-04 (collapsible RA list accordion) in `api/[...route].ts` and `src/pages/supplier/StoreSettings.tsx`.

Purpose:
- D-03 — Today, when a supplier edits a configured DF RA zone, the PUT may silently affect 0 rows (e.g. supplier_id mismatch from a stale seed) yet return HTTP 200 with `{ ok: true }`, producing a "saved but not saved" experience. Additionally, the modal Cancel button and background-click do not clear `editingZone`, so the next open of the "Add" modal leaks the previous edit context. The success path also does not clear `editingZone`, and the catch path does not close the modal.
- D-04 — The DF RA list is 32 items long and pushes the rest of the form below the fold on mobile. Suppliers asked to start collapsed, with a count badge showing how many regions are already configured.

Output:
1. `api/[...route].ts` PUT `/supplier/delivery-zones/:id` updated to use `.select('id', { count: 'exact', head: true })` and return 404 with `Zona não encontrada ou sem permissão` when 0 rows updated
2. `src/pages/supplier/StoreSettings.tsx` `handleSaveZone` always clears `editingZone` on success and error and always closes the modal
3. `src/pages/supplier/StoreSettings.tsx` Cancel button and background-click both call `setEditingZone(null)`
4. `src/pages/supplier/StoreSettings.tsx` adds `showRaList` state, imports `ChevronDown`, makes the section header a toggle button, and conditionally renders the RA list block
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/product-stock-zones-ux/CONTEXT.md
@.planning/phases/product-stock-zones-ux/PATTERNS.md
@.planning/phases/product-stock-zones-ux/product-stock-zones-ux-02-SUMMARY.md
@api/[...route].ts
@src/pages/supplier/StoreSettings.tsx
</context>

<interfaces>
<!-- Key contracts the executor needs. Extracted from PATTERNS.md and the current codebase. -->

Existing PUT handler in api/[...route].ts (lines 158–177) — does NOT check count:
```typescript
app.put('/supplier/delivery-zones/:id', requireAuth, async (c) => {
  const userId = c.get('userId')
  const zoneId = c.req.param('id')
  const body = await c.req.json<{ city: string; state: string; days: string[]; hours_start: string; hours_end: string }>()

  const { error } = await adminSupabase
    .from('delivery_zones')
    .update({ city: body.city, state: body.state, days: body.days, hours_start: body.hours_start, hours_end: body.hours_end })
    .eq('id', zoneId)
    .eq('supplier_id', userId)
  if (error) return c.json({ error: error.message }, 400)

  return c.json({ ok: true })  // ← returns 200 even when 0 rows updated
})
```

Current StoreSettings.tsx zone modal state (lines 59–70):
```typescript
const [zones, setZones] = useState<DeliveryZone[]>([])
const [zonesLoading, setZonesLoading] = useState(true)
const [showZoneModal, setShowZoneModal] = useState(false)
const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null)
const [zoneForm, setZoneForm] = useState({ city: '', state: '', days: [] as string[], hours_start: '', hours_end: '' })
const [zoneSaving, setZoneSaving] = useState(false)
```

Current handleSaveZone (lines 107–130) — missing setEditingZone(null) on success and missing modal-close on catch:
```typescript
const handleSaveZone = async () => {
  if (!supplier) return
  if (!zoneForm.city || zoneForm.days.length === 0 || !zoneForm.hours_start || !zoneForm.hours_end) {
    toast.error('Preencha cidade, dias e horário')
    return
  }
  setZoneSaving(true)
  try {
    if (editingZone) {
      await updateDeliveryZone(editingZone.id, zoneForm)
      setZones((prev) => prev.map((z) => (z.id === editingZone.id ? { ...z, ...zoneForm } : z)))
      toast.success('Zona atualizada!')
    } else {
      const created = await createDeliveryZone(zoneForm)
      setZones((prev) => [...prev, created])
      toast.success('Zona adicionada!')
    }
    setShowZoneModal(false)         // ← editingZone NOT cleared
  } catch {
    toast.error('Erro ao salvar zona')
                                     // ← modal NOT closed
  } finally {
    setZoneSaving(false)
  }
}
```

Current modal background click (line 414):
```tsx
<div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setShowZoneModal(false)}>
```

Current Cancel button (line 485):
```tsx
<button type="button" onClick={() => setShowZoneModal(false)} className="w-full py-3 text-gray-500 font-semibold">
  Cancelar
</button>
```

Current RA section header (lines 311–322):
```tsx
<div className="flex items-center justify-between">
  <p className="font-bold text-gray-700">Regiões de Entrega — DF</p>
  <button
    type="button"
    onClick={() => openAddZone()}
    className="flex items-center gap-1 text-sm text-primary font-semibold"
  >
    <Plus size={16} />
    Outra cidade
  </button>
</div>
<p className="text-xs text-gray-400">Toque em uma região para configurar os dias e horários de entrega</p>

{zonesLoading ? (
  <p className="text-sm text-gray-400 text-center py-2">Carregando...</p>
) : (
  <div className="space-y-2">
    {DF_RAS.map((ra) => { ... })}
  </div>
)}
```

Current lucide-react import (line 5) — does NOT include ChevronDown:
```typescript
import { Camera, MessageCircle, LogOut, Plus, Pencil, Trash2, Lock } from 'lucide-react'
```

Existing PATCH route with count check (template — added in Plan 02):
```typescript
const { error, count } = await adminSupabase
  .from('products')
  .update({ ... })
  .eq('id', productId)
  .eq('supplier_id', userId)
  .select('id', { count: 'exact', head: true })
if (error) return c.json({ error: error.message }, 400)
if (!count || count === 0) return c.json({ error: 'Produto não encontrado ou sem permissão' }, 404)
```
</interfaces>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Fix PUT /supplier/delivery-zones/:id to return 404 on 0-row updates</name>
  <files>api/[...route].ts</files>
  <read_first>
    - api/[...route].ts (read at minimum lines 1–200 — confirm the current PUT handler at lines 158–177; also re-read the PATCH /products/:id/stock route added by Plan 02 to confirm the count-check pattern is present and consistent)
    - .planning/phases/product-stock-zones-ux/PATTERNS.md (api section, lines 503–539)
    - .planning/phases/product-stock-zones-ux/CONTEXT.md (D-03 root cause area #3)
  </read_first>
  <behavior>
    - Test 1: PUT with a valid zoneId owned by the requesting supplier returns 200 `{ ok: true }` and updates the row
    - Test 2: PUT with a zoneId that does not exist returns 404 `{ error: 'Zona não encontrada ou sem permissão' }`
    - Test 3: PUT with a zoneId that exists but is owned by a different supplier_id returns 404 `{ error: 'Zona não encontrada ou sem permissão' }` (NOT a silent 200)
    - Test 4: PUT with a Supabase error (e.g. column type mismatch) still returns 400 `{ error: <message> }` — the count check does not mask DB errors
    - Test 5: requireAuth middleware still rejects unauthenticated requests (unchanged)
  </behavior>
  <action>
    Locate the existing handler in `api/[...route].ts`:

    ```typescript
    app.put('/supplier/delivery-zones/:id', requireAuth, async (c) => {
      const userId = c.get('userId')
      const zoneId = c.req.param('id')
      const body = await c.req.json<{ city: string; state: string; days: string[]; hours_start: string; hours_end: string }>()

      const { error } = await adminSupabase
        .from('delivery_zones')
        .update({ city: body.city, state: body.state, days: body.days, hours_start: body.hours_start, hours_end: body.hours_end })
        .eq('id', zoneId)
        .eq('supplier_id', userId)
      if (error) return c.json({ error: error.message }, 400)

      return c.json({ ok: true })
    })
    ```

    Replace the entire handler body with this version that destructures `count` and returns 404 on `count === 0`:

    ```typescript
    app.put('/supplier/delivery-zones/:id', requireAuth, async (c) => {
      const userId = c.get('userId')
      const zoneId = c.req.param('id')
      const body = await c.req.json<{ city: string; state: string; days: string[]; hours_start: string; hours_end: string }>()

      const { error, count } = await adminSupabase
        .from('delivery_zones')
        .update({ city: body.city, state: body.state, days: body.days, hours_start: body.hours_start, hours_end: body.hours_end })
        .eq('id', zoneId)
        .eq('supplier_id', userId)
        .select('id', { count: 'exact', head: true })
      if (error) return c.json({ error: error.message }, 400)
      if (!count || count === 0) return c.json({ error: 'Zona não encontrada ou sem permissão' }, 404)

      return c.json({ ok: true })
    })
    ```

    Specific edits required:
    1. Change `const { error } = await adminSupabase` to `const { error, count } = await adminSupabase`
    2. Append `.select('id', { count: 'exact', head: true })` after the existing `.eq('supplier_id', userId)` chain — keep the chain order: from → update → eq(id) → eq(supplier_id) → select
    3. Add a new line directly after `if (error) return c.json({ error: error.message }, 400)`: `if (!count || count === 0) return c.json({ error: 'Zona não encontrada ou sem permissão' }, 404)`

    Do NOT modify any other route. Do NOT change the existing 400 status for Supabase errors. Do NOT touch the PATCH `/products/:id/*` routes (they were correctly added in Plan 02).
  </action>
  <verify>
    <automated>cd "C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar" && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "\[\.\.\.route\]\.ts" | grep -v "^#" | grep -c "error" || echo "0 errors"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "Zona não encontrada ou sem permissão" "api/[...route].ts"` returns exactly 1
    - `grep -c "app.put('/supplier/delivery-zones/:id'" "api/[...route].ts"` returns exactly 1 (handler not duplicated)
    - The PUT handler block contains the substring `count: 'exact', head: true` — verify with `grep -A 12 "app.put('/supplier/delivery-zones/:id'" "api/[...route].ts" | grep -c "count: 'exact', head: true"` returns at least 1
    - The PUT handler block contains `if (!count || count === 0)` — verify with `grep -A 14 "app.put('/supplier/delivery-zones/:id'" "api/[...route].ts" | grep -c "if (!count"` returns at least 1
    - `npx tsc --noEmit` reports 0 errors in api/[...route].ts
    - The PATCH `/products/:id/stock` and `/products/:id/sell-without-stock` routes from Plan 02 are still present (regression guard) — `grep -c "app.patch('/products/:id/stock'" "api/[...route].ts"` returns exactly 1, and `grep -c "app.patch('/products/:id/sell-without-stock'" "api/[...route].ts"` returns exactly 1
  </acceptance_criteria>
  <done>The PUT handler destructures `count`, appends `.select('id', { count: 'exact', head: true })`, and returns 404 with `Zona não encontrada ou sem permissão` when 0 rows updated. TypeScript compiles. No other routes modified.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Fix StoreSettings.tsx modal close paths (handleSaveZone, Cancel button, background click)</name>
  <files>src/pages/supplier/StoreSettings.tsx</files>
  <read_first>
    - src/pages/supplier/StoreSettings.tsx (read FULL FILE — handleSaveZone is at lines 107–130; modal background click at line 414; Cancel button at line 485)
    - .planning/phases/product-stock-zones-ux/PATTERNS.md (D-03 fix patterns, lines 290–372)
    - .planning/phases/product-stock-zones-ux/CONTEXT.md (D-03 fix approach)
  </read_first>
  <behavior>
    - Test 1: After successful save (create or update), `editingZone` is reset to null
    - Test 2: After save error, the modal is closed AND `editingZone` is reset to null (no stuck modal)
    - Test 3: Clicking Cancel both closes the modal and resets `editingZone` to null
    - Test 4: Clicking the modal background both closes the modal and resets `editingZone` to null
    - Test 5: When the Add modal is opened immediately after closing an Edit modal, `editingZone` is null and `zoneForm` is empty (existing `openAddZone` already sets editingZone to null and resets zoneForm — verify by inspection that openAddZone is unchanged)
  </behavior>
  <action>
    Make THREE changes in `src/pages/supplier/StoreSettings.tsx`. Do NOT touch any other code (no D-04 work in this task — that is Task 3).

    **Change 1 — Update `handleSaveZone` (lines 107–130).** Find the existing function and replace its body so that:
    - The success branch (try block) calls `setEditingZone(null)` after `setShowZoneModal(false)`
    - The catch branch calls `setShowZoneModal(false)` AND `setEditingZone(null)` (currently it does neither)

    The full new function MUST be:
    ```typescript
    const handleSaveZone = async () => {
      if (!supplier) {
        toast.error('Sessão expirada. Recarregue a página.')
        return
      }
      if (!zoneForm.city || zoneForm.days.length === 0 || !zoneForm.hours_start || !zoneForm.hours_end) {
        toast.error('Preencha cidade, dias e horário')
        return
      }
      setZoneSaving(true)
      try {
        if (editingZone) {
          await updateDeliveryZone(editingZone.id, zoneForm)
          setZones((prev) => prev.map((z) => (z.id === editingZone.id ? { ...z, ...zoneForm } : z)))
          toast.success('Zona atualizada!')
        } else {
          const created = await createDeliveryZone(zoneForm)
          setZones((prev) => [...prev, created])
          toast.success('Zona adicionada!')
        }
        setShowZoneModal(false)
        setEditingZone(null)
      } catch {
        toast.error('Erro ao salvar zona')
        setShowZoneModal(false)
        setEditingZone(null)
      } finally {
        setZoneSaving(false)
      }
    }
    ```

    Note the upgraded `if (!supplier)` branch now toasts (was a silent return) — this matches the planning_guidance D-03 root cause area #1. Do NOT add any other behavioural changes (no new validations, no extra logging).

    **Change 2 — Update modal Cancel button (line 485).** Find:
    ```tsx
    <button type="button" onClick={() => setShowZoneModal(false)} className="w-full py-3 text-gray-500 font-semibold">
      Cancelar
    </button>
    ```
    Replace with:
    ```tsx
    <button type="button" onClick={() => { setShowZoneModal(false); setEditingZone(null) }} className="w-full py-3 text-gray-500 font-semibold">
      Cancelar
    </button>
    ```

    **Change 3 — Update modal background click (line 414).** Find:
    ```tsx
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setShowZoneModal(false)}>
    ```
    Replace with:
    ```tsx
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => { setShowZoneModal(false); setEditingZone(null) }}>
    ```

    Do NOT modify the password modal background click (line 495) — it has different state. Do NOT modify `openAddZone` or `openEditZone` (they already manage state correctly on open).
  </action>
  <verify>
    <automated>cd "C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar" && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "StoreSettings\.tsx" | grep -v "^#" | grep -c "error" || echo "0 errors"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "setEditingZone(null)" src/pages/supplier/StoreSettings.tsx` returns at least 4 (one in openAddZone — pre-existing — plus three NEW: handleSaveZone success, handleSaveZone catch, Cancel button, background click → counted total ≥ 4 since openAddZone already had one and we added 4 more, expect ≥ 5)
    - `grep -c "Sessão expirada" src/pages/supplier/StoreSettings.tsx` returns exactly 1 (the new toast in the !supplier guard)
    - `grep -c "setShowZoneModal(false); setEditingZone(null)" src/pages/supplier/StoreSettings.tsx` returns at least 2 (Cancel button + background click)
    - The handleSaveZone catch block contains both `setShowZoneModal(false)` and `setEditingZone(null)` — verify by inspection: `grep -A 5 "Erro ao salvar zona" src/pages/supplier/StoreSettings.tsx` shows both lines
    - `npx tsc --noEmit` reports 0 errors in src/pages/supplier/StoreSettings.tsx
    - The password modal background click (line ~495) is UNCHANGED — `grep -c "onClick={() => setShowPwModal(false)}" src/pages/supplier/StoreSettings.tsx` returns exactly 1
  </acceptance_criteria>
  <done>handleSaveZone always closes the modal and clears editingZone on both success and error. Cancel button and background click both clear editingZone. The !supplier guard now toasts instead of silently returning. The password modal is untouched. TypeScript compiles.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Add collapsible RA list accordion with chevron + count badge in StoreSettings.tsx</name>
  <files>src/pages/supplier/StoreSettings.tsx</files>
  <read_first>
    - src/pages/supplier/StoreSettings.tsx (read FULL FILE — section header at lines 311–322, RA list at lines 324–360, lucide import at line 5, useState block at lines 59–70)
    - .planning/phases/product-stock-zones-ux/PATTERNS.md (D-04 accordion patterns, lines 374–432)
    - .planning/phases/product-stock-zones-ux/CONTEXT.md (D-04 implementation snippet)
  </read_first>
  <behavior>
    - Test 1: On mount, the section renders the header but NOT the RA list rows (collapsed by default)
    - Test 2: The header shows "Regiões de Entrega — DF" plus a small badge with format "{configuredCount}/32 configuradas"
    - Test 3: The header includes a ChevronDown icon that has class `rotate-180` ONLY when showRaList is true
    - Test 4: Clicking the header toggles showRaList; the RA list block (and the loading state) appears/disappears accordingly
    - Test 5: The "Outra cidade" button on the right of the header still works and is NOT inside the toggle button (clicking it does NOT toggle the accordion)
    - Test 6: When expanded, the existing RA list rendering is byte-for-byte unchanged (configured rows show pencil/trash; unconfigured rows show '+')
    - Test 7: configuredCount counts only zones whose city is in DF_RAS
  </behavior>
  <action>
    Make FOUR changes in `src/pages/supplier/StoreSettings.tsx`.

    **Change 1 — Add ChevronDown to the lucide-react import (line 5).** Find:
    ```typescript
    import { Camera, MessageCircle, LogOut, Plus, Pencil, Trash2, Lock } from 'lucide-react'
    ```
    Replace with:
    ```typescript
    import { Camera, MessageCircle, LogOut, Plus, Pencil, Trash2, Lock, ChevronDown } from 'lucide-react'
    ```

    **Change 2 — Add `showRaList` state.** Find the existing `useState(false)` for `showZoneModal` (line 61):
    ```typescript
    const [showZoneModal, setShowZoneModal] = useState(false)
    ```
    Insert directly AFTER the `setZoneSaving` line (line 70), at the same indentation level as the other useState calls in this component:
    ```typescript
      const [showRaList, setShowRaList] = useState(false)
    ```
    The new line MUST come AFTER `const [zoneSaving, setZoneSaving] = useState(false)` (line 70) and BEFORE `const [showPwModal, setShowPwModal] = useState(false)` (line 71). Indentation is 2 spaces (matching the surrounding lines).

    **Change 3 — Replace the section header block (lines 311–322).** Find the existing block:
    ```tsx
    <div className="flex items-center justify-between">
      <p className="font-bold text-gray-700">Regiões de Entrega — DF</p>
      <button
        type="button"
        onClick={() => openAddZone()}
        className="flex items-center gap-1 text-sm text-primary font-semibold"
      >
        <Plus size={16} />
        Outra cidade
      </button>
    </div>
    <p className="text-xs text-gray-400">Toque em uma região para configurar os dias e horários de entrega</p>
    ```

    Replace with the toggle-button version. The "Outra cidade" button remains as a sibling at the SAME flex level (it must NOT be inside the toggle button, so clicks on it do not collapse the accordion). The hint paragraph moves INSIDE the conditional block so it only appears when expanded:

    ```tsx
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowRaList((v) => !v)}
                  className="flex items-center gap-2 text-left flex-1"
                >
                  <p className="font-bold text-gray-700">Regiões de Entrega — DF</p>
                  <span className="text-xs text-gray-400 font-normal">
                    {zones.filter((z) => DF_RAS.includes(z.city)).length}/{DF_RAS.length} configuradas
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-gray-400 transition-transform ${showRaList ? 'rotate-180' : ''}`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => openAddZone()}
                  className="flex items-center gap-1 text-sm text-primary font-semibold"
                >
                  <Plus size={16} />
                  Outra cidade
                </button>
              </div>
    ```

    Indentation must match the surrounding JSX (the parent `<div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">` lines its children at 10 spaces — match exactly).

    **Change 4 — Wrap the existing list-rendering block (lines 322–360) in `{showRaList && (...)}`.** The current code is:

    ```tsx
    <p className="text-xs text-gray-400">Toque em uma região para configurar os dias e horários de entrega</p>

    {zonesLoading ? (
      <p className="text-sm text-gray-400 text-center py-2">Carregando...</p>
    ) : (
      <div className="space-y-2">
        {DF_RAS.map((ra) => {
          const zone = zones.find((z) => z.city === ra)
          return zone ? (
            <div key={ra} ... />
          ) : (
            <button key={ra} ... />
          )
        })}
      </div>
    )}
    ```

    Wrap in a conditional render and KEEP the inner content byte-for-byte identical (do NOT touch the existing zone/button rendering — copy it exactly):
    ```tsx
              {showRaList && (
                <>
                  <p className="text-xs text-gray-400">Toque em uma região para configurar os dias e horários de entrega</p>

                  {zonesLoading ? (
                    <p className="text-sm text-gray-400 text-center py-2">Carregando...</p>
                  ) : (
                    <div className="space-y-2">
                      {DF_RAS.map((ra) => {
                        const zone = zones.find((z) => z.city === ra)
                        return zone ? (
                          <div key={ra} className="flex items-center justify-between p-3 bg-primary/5 rounded-xl border border-primary/20">
                            <div>
                              <p className="font-semibold text-gray-800 text-sm">{ra} — DF</p>
                              <p className="text-xs text-gray-500">
                                {getDeliveryDaysLabel(zone.days)} · {zone.hours_start}–{zone.hours_end}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => openEditZone(zone)} className="p-1.5 text-gray-400 hover:text-primary">
                                <Pencil size={14} />
                              </button>
                              <button type="button" onClick={() => handleDeleteZone(zone.id)} className="p-1.5 text-gray-400 hover:text-danger">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            key={ra}
                            type="button"
                            onClick={() => openAddZone(ra)}
                            className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                          >
                            <p className="text-sm text-gray-500">{ra}</p>
                            <Plus size={14} className="text-gray-300" />
                          </button>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
    ```

    Important: the inner JSX (configured-row block and unconfigured-button block) must be IDENTICAL to the existing code — same className strings, same icons, same handlers. Do NOT refactor or "improve" anything inside.

    Do NOT add CSS animations beyond the existing `transition-transform` on the chevron (the planning_guidance lists animation as optional and the simplest approach is a discrete show/hide, matching D-04's description).
  </action>
  <verify>
    <automated>cd "C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar" && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "StoreSettings\.tsx" | grep -v "^#" | grep -c "error" || echo "0 errors"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "ChevronDown" src/pages/supplier/StoreSettings.tsx` returns exactly 2 (1 in import, 1 in JSX)
    - `grep -c "showRaList" src/pages/supplier/StoreSettings.tsx` returns at least 4 (state declaration, setter, toggle onClick, conditional render, chevron rotate)
    - `grep -c "useState(false)" src/pages/supplier/StoreSettings.tsx` increased by 1 from baseline (showRaList added)
    - `grep -c "configuradas" src/pages/supplier/StoreSettings.tsx` returns exactly 1 (the count badge)
    - `grep -c "DF_RAS.includes(z.city)" src/pages/supplier/StoreSettings.tsx` returns exactly 1 (the count filter)
    - `grep -c "rotate-180" src/pages/supplier/StoreSettings.tsx` returns exactly 1 (chevron conditional)
    - `grep -c "Toque em uma região" src/pages/supplier/StoreSettings.tsx` returns exactly 1 (hint paragraph still exists, just moved inside the conditional)
    - `grep -c "DF_RAS.map" src/pages/supplier/StoreSettings.tsx` returns exactly 1 (list mapping not duplicated)
    - The "Outra cidade" button is NOT inside the toggle button — verify with `grep -B 2 "Outra cidade" src/pages/supplier/StoreSettings.tsx | head -10` showing it as a sibling button, not nested
    - `npx tsc --noEmit` reports 0 errors in src/pages/supplier/StoreSettings.tsx
  </acceptance_criteria>
  <done>ChevronDown imported. showRaList state added (defaults to false → collapsed). Section header is a clickable toggle button with count badge and rotating chevron. RA list block (and the hint paragraph) is wrapped in `{showRaList && (...)}`. Existing list rendering is byte-for-byte preserved. The "Outra cidade" button remains a sibling of the toggle (not nested inside it). TypeScript compiles.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser→api/supplier/delivery-zones/:id (PUT) | Authenticated supplier sends arbitrary zoneId; could attempt to update OTHER suppliers' zones (which today silently returns 200 even on 0-row update) |
| user→browser (StoreSettings UI) | Supplier interacts with the modal and the accordion toggle; no untrusted input crosses here (zone form fields go to the API which validates server-side) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-product-stock-zones-ux-16 | Tampering | PUT /supplier/delivery-zones/:id | mitigate | Add `.select('id', { count: 'exact', head: true })` and return 404 with localized message when 0 rows updated. Combined with the existing `.eq('supplier_id', userId)`, this surfaces silent cross-tenant or stale-id update attempts to the client and prevents the "saved but not saved" UX |
| T-product-stock-zones-ux-17 | Information Disclosure | 404 error message wording | accept | Returning `Zona não encontrada ou sem permissão` discloses that the zone may exist under another owner — but the message is identical for "does not exist" and "wrong owner" cases (no oracle), and the threat is low because zone IDs are UUIDs not enumerated |
| T-product-stock-zones-ux-18 | Spoofing | editingZone state leak across modal opens | mitigate | Always-clear `setEditingZone(null)` on every modal close path (success, error, cancel, background) prevents stale edit context from being applied to a subsequent Add operation |
| T-product-stock-zones-ux-19 | Denial of Service | Accordion toggle | accept | `useState` toggle is O(1); no measurable perf impact even on rapid clicking |
| T-product-stock-zones-ux-20 | Information Disclosure | Count badge | accept | `{configuredCount}/{DF_RAS.length} configuradas` is computed from data the supplier already loaded for their own account — no cross-tenant leak |
| T-product-stock-zones-ux-21 | Tampering | StoreSettings.tsx zoneForm validation | accept | Existing client-side validation (`!zoneForm.city || zoneForm.days.length === 0 || ...`) is for UX only; server-side validation is the authoritative check. This plan does not weaken existing checks |
</threat_model>

<verification>
- `npx tsc --noEmit` passes with 0 errors across api/[...route].ts and src/pages/supplier/StoreSettings.tsx
- Manual smoke (post-execution, owner verification step):
  1. Edit a configured DF RA zone → save → toast 'Zona atualizada!' → modal closes
  2. Click pencil on a zone → click Cancel → reopen Add modal → form is empty (no leaked editingZone)
  3. Click pencil on a zone → click background → reopen Add modal → form is empty
  4. Force a save error (e.g. temporarily set wrong supplier_id in DB) → modal closes, toast 'Erro ao salvar zona', no stuck modal
  5. Visit StoreSettings → RA section starts collapsed; header shows e.g. "3/32 configuradas"
  6. Click section header → list expands with chevron rotated; click again → collapses
  7. Click "Outra cidade" button → opens Add modal (does NOT toggle accordion)
- API regression test (curl, post-execution):
  - `curl -X PUT /api/supplier/delivery-zones/<valid-zone-id-i-own>` with valid body → 200
  - `curl -X PUT /api/supplier/delivery-zones/00000000-0000-0000-0000-000000000000` → 404 with `Zona não encontrada ou sem permissão`
</verification>

<success_criteria>
- All 9 must_haves truths above are observable in the running app and via curl
- All grep-based acceptance criteria pass for each task
- TypeScript compiles with 0 new errors
- Plan 02 PATCH product routes still present and functional (regression guard)
- No new lint warnings introduced beyond the existing baseline
</success_criteria>

<output>
After completion, create `.planning/phases/product-stock-zones-ux/product-stock-zones-ux-04-SUMMARY.md` describing:
- The PUT /supplier/delivery-zones/:id fix (count check, 404 path)
- The handleSaveZone success+error cleanup (always close modal, always clear editingZone)
- The Cancel button and background-click fixes
- The new showRaList state and the section header toggle JSX
- The conditional render wrapping the existing list (byte-for-byte preserved)
- The lucide-react ChevronDown import addition
- Manual smoke results for the 7 verification steps
- Any deviations from this plan
</output>
