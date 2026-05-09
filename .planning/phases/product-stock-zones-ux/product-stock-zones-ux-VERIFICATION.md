---
phase: product-stock-zones-ux
verified: 2026-05-09T00:00:00Z
status: human_needed
score: 20/20 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Switch sale_unit to kg then submit without box_weight_kg"
    expected: "'Peso da caixa (kg) *' field appears; submitting without it shows inline error 'Peso da caixa obrigatório'"
    why_human: "Cross-field Zod validation and conditional JSX rendering require browser interaction to confirm correct react-hook-form error binding"
  - test: "Switch sale_unit to box"
    expected: "No 'Peso da caixa (kg)' input visible in the box section (only Qtd. unidades na caixa and Preco da caixa)"
    why_human: "Requires visual confirmation that the field is absent from the DOM when saleUnit=box"
  - test: "Tap stock count on a product card → edit value → press Enter"
    expected: "Input appears with autoFocus; on Enter, toast 'Estoque atualizado' appears and list value updates without page reload"
    why_human: "Optimistic UI update, toast feedback, and API round-trip require live browser testing against deployed or locally running app"
  - test: "Tap sell_without_stock toggle on a product card"
    expected: "Toggle flips immediately (optimistic), API call fires, toast confirms; on error the toggle reverts"
    why_human: "Optimistic state revert behavior can only be validated by triggering a real API error"
  - test: "Edit a configured DF RA zone → save → observe modal"
    expected: "Modal closes; reopening Add modal shows empty form (editingZone cleared)"
    why_human: "State cleanup on modal close paths requires live interaction to confirm editingZone is truly null after each path (success, cancel, background click)"
  - test: "Click Cancel or modal background after opening Edit"
    expected: "Modal closes; editingZone is cleared (subsequent Add modal opens with empty form)"
    why_human: "Multiple close paths tested individually; cannot assert React state values via static code inspection alone"
  - test: "Load StoreSettings page — check RA section initial state"
    expected: "Section starts collapsed; header shows '{N}/32 configuradas' badge with correct count of configured zones"
    why_human: "Requires a browser with real supplier data to confirm the count badge computes correctly and the list is not in the DOM on mount"
  - test: "Click RA section header"
    expected: "32-item RA list appears; chevron rotates 180deg; clicking again collapses and chevron returns to original angle"
    why_human: "CSS transition-transform with conditional class requires visual confirmation that rotate-180 is applied correctly by the browser"
  - test: "Click 'Outra cidade' button while RA section is collapsed"
    expected: "Add modal opens without toggling the accordion"
    why_human: "Button is a sibling element — requires browser click to confirm the click event does not bubble into the toggle handler"
---

# Phase product-stock-zones-ux Verification Report

**Phase Goal:** Implement D-01 (conditional sale unit fields in ProductForm), D-02 (stock management backend + UI), D-03 (zone save bug fix), and D-04 (collapsible DF RA list accordion).
**Verified:** 2026-05-09T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

All 20 must-have truths verified via static code inspection. No automated blockers found. Human verification required for runtime/UI behavior as listed above.

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | When supplier selects sale_unit=kg, form shows 'Peso da caixa (kg)' as required | VERIFIED | ProductForm.tsx line 304: `<label>Peso da caixa (kg) *</label>` inside `{saleUnit === 'kg' && (...)}` block |
| 2  | When supplier selects sale_unit=box, form does NOT show 'Peso da caixa (kg)' | VERIFIED | ProductForm.tsx lines 277-294: box block contains only `box_unit_quantity` and `box_price`; no `box_weight_kg` register call |
| 3  | When supplier selects sale_unit=unit, form is unchanged | VERIFIED | ProductForm.tsx lines 311-322: unit block unchanged with `price_per_unit` and `unit_description` only |
| 4  | Submitting kg-product WITHOUT box_weight_kg shows inline error 'Peso da caixa obrigatório' | VERIFIED | ProductForm.tsx lines 41-49: superRefine fires on `sale_unit === 'kg' && !box_weight_kg?.trim()`, adds issue with path `['box_weight_kg']`; line 306: `{errors.box_weight_kg && <p ...>{errors.box_weight_kg.message}</p>}` |
| 5  | Submitting kg-product WITH box_weight_kg saves and persists box_weight_kg in DB | VERIFIED | ProductForm.tsx lines 167-169: kg branch sets `productData.price_per_kg = parseNum(data.price_per_kg)` AND `productData.box_weight_kg = parseNum(data.box_weight_kg)` |
| 6  | products table has sell_without_stock boolean NOT NULL DEFAULT false | VERIFIED | Migration `supabase/migrations/20260508000000_products_sell_without_stock.sql` exists with `ADD COLUMN IF NOT EXISTS sell_without_stock boolean NOT NULL DEFAULT false`; user confirmed applied to remote Supabase |
| 7  | Product TypeScript type includes sell_without_stock: boolean | VERIFIED | src/types/index.ts line 67: `sell_without_stock: boolean` in Product interface, between `stock_quantity?: number` and `total_sold: number` |
| 8  | PATCH /api/products/:id/stock route exists, requires auth, enforces supplier ownership, returns 404 on 0 rows | VERIFIED | api/[...route].ts lines 124-143: `requireAuth`, `.eq('supplier_id', userId)`, `.select('id', { count: 'exact', head: true })`, `if (!count || count === 0) return c.json({ error: 'Produto não encontrado ou sem permissão' }, 404)` |
| 9  | PATCH /api/products/:id/sell-without-stock route exists, requires auth, enforces supplier ownership, returns 404 on 0 rows | VERIFIED | api/[...route].ts lines 145-164: same ownership pattern; `typeof sell_without_stock !== 'boolean'` input guard; 404 on count=0 |
| 10 | Buyer-side searchProducts and getFeaturedProducts hide sell_without_stock=false AND stock_quantity=0 products | VERIFIED | src/services/supabase.ts line 155 (getFeaturedProducts): `.or('sell_without_stock.eq.true,stock_quantity.gt.0')`; line 175 (searchProducts): same filter; getProductsBySupplier and getProductById have NO such filter |
| 11 | Each product card shows current stock as a tappable button | VERIFIED | Products.tsx lines 222-238: button renders `{product.stock_quantity ?? 0} em estoque`, disabled while `stockSaving[product.id]` |
| 12 | Tapping stock value transforms it into an inline input that auto-focuses | VERIFIED | Products.tsx lines 201-221: conditional on `editingStock[product.id] !== undefined`; input has `autoFocus` prop |
| 13 | Pressing Enter or blurring the input calls PATCH /products/:id/stock and updates local list | VERIFIED | Products.tsx lines 209-218: `onBlur={() => handleStockSave(product)}`; Enter key also calls `handleStockSave`; handler at lines 62-84: `apiClient.patch('/products/${product.id}/stock', { stock_quantity: newQty })` then `setProducts(...)` |
| 14 | Pressing Escape reverts the edit without saving | VERIFIED | Products.tsx lines 215-218: Escape calls `handleStockCancel(product)`; handler at lines 86-88 deletes the key from editingStock without calling API |
| 15 | Each product card shows a 'Vender sem estoque' toggle | VERIFIED | Products.tsx lines 241-253: label "Vender sem estoque" + toggle button with bg-primary/bg-gray-300 conditional |
| 16 | Toggle uses optimistic state update with toast feedback | VERIFIED | Products.tsx lines 90-106: optimistic `setProducts(...)` before API call; toast on success; revert `setProducts(...)` in catch |
| 17 | PUT /api/supplier/delivery-zones/:id returns 404 when 0 rows updated | VERIFIED | api/[...route].ts lines 213-220: `.select('id', { count: 'exact', head: true })`; `if (!count || count === 0) return c.json({ error: 'Zona não encontrada ou sem permissão' }, 404)` |
| 18 | Cancel button and background click both close modal AND clear editingZone | VERIFIED | StoreSettings.tsx line 439 (background): `onClick={() => { setShowZoneModal(false); setEditingZone(null) }}`; line 510 (Cancel): same handler |
| 19 | handleSaveZone clears editingZone on success AND error | VERIFIED | StoreSettings.tsx lines 128-129 (success): `setShowZoneModal(false); setEditingZone(null)`; lines 131-133 (catch): `setShowZoneModal(false); setEditingZone(null)` |
| 20 | RA section starts collapsed; header shows count badge; chevron rotates on expand | VERIFIED | StoreSettings.tsx line 71: `const [showRaList, setShowRaList] = useState(false)`; lines 325-331: count badge + ChevronDown with `rotate-180` conditional; line 343: `{showRaList && (...)}` wraps entire list |

**Score:** 20/20 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/pages/supplier/ProductForm.tsx` | Conditional sale unit fields with superRefine | VERIFIED | superRefine at line 41; kg block at 296-309; box block at 277-294 without box_weight_kg |
| `supabase/migrations/20260508000000_products_sell_without_stock.sql` | DB column sell_without_stock | VERIFIED | File exists with exact `ADD COLUMN IF NOT EXISTS sell_without_stock boolean NOT NULL DEFAULT false`; user confirmed applied to remote |
| `src/types/index.ts` | Product.sell_without_stock typed boolean | VERIFIED | Line 67: `sell_without_stock: boolean` (required, not optional) |
| `api/[...route].ts` | Two PATCH endpoints + fixed PUT | VERIFIED | PATCH /products/:id/stock at line 124; PATCH /products/:id/sell-without-stock at line 145; PUT /supplier/delivery-zones/:id fixed at line 202 |
| `src/services/supabase.ts` | Buyer queries respect sell_without_stock | VERIFIED | getFeaturedProducts line 155; searchProducts line 175; supplier-side queries unchanged |
| `src/pages/supplier/Products.tsx` | Inline stock edit + sell_without_stock toggle | VERIFIED | editingStock state line 31; handleStockSave line 62; handleToggleSellWithoutStock line 90; JSX blocks lines 199-253 |
| `src/pages/supplier/StoreSettings.tsx` | Zone modal state cleanup + collapsible RA list | VERIFIED | showRaList line 71; ChevronDown import line 5; handleSaveZone cleanup lines 128-133; Cancel/background onClick lines 439, 510; accordion JSX lines 318-386 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| ProductForm.tsx kg block JSX | `register('box_weight_kg')` | react-hook-form register | WIRED | Line 305: `{...register('box_weight_kg')}` inside `{saleUnit === 'kg' && (...)}` |
| ProductForm.tsx Zod schema | `ctx.addIssue` path ['box_weight_kg'] | superRefine cross-field validator | WIRED | Lines 41-49: `data.sale_unit === 'kg'` triggers `ctx.addIssue({ path: ['box_weight_kg'] })` |
| ProductForm.tsx onSubmit | `productData.box_weight_kg` | parseNum in kg branch | WIRED | Line 169: `productData.box_weight_kg = parseNum(data.box_weight_kg)` |
| api/[...route].ts PATCH /products/:id/stock | products table | adminSupabase with supplier ownership | WIRED | Lines 133-141: `.eq('supplier_id', userId)` + count check |
| api/[...route].ts PATCH /products/:id/sell-without-stock | products.sell_without_stock column | adminSupabase with supplier ownership | WIRED | Lines 154-162: same pattern, updates `sell_without_stock` field |
| src/services/supabase.ts (getFeaturedProducts, searchProducts) | products.sell_without_stock + stock_quantity | `.or()` filter | WIRED | Lines 155 and 175: `.or('sell_without_stock.eq.true,stock_quantity.gt.0')` |
| Products.tsx handleStockSave | PATCH /api/products/:id/stock | apiClient.patch | WIRED | Line 73: `apiClient.patch('/products/${product.id}/stock', ...)` |
| Products.tsx handleToggleSellWithoutStock | PATCH /api/products/:id/sell-without-stock | apiClient.patch | WIRED | Line 97: `apiClient.patch('/products/${product.id}/sell-without-stock', ...)` |
| api/[...route].ts PUT /supplier/delivery-zones/:id | delivery_zones table | adminSupabase count check 404 | WIRED | Lines 213-220: count-check added; returns 404 with 'Zona não encontrada ou sem permissão' |
| StoreSettings.tsx handleSaveZone | `setEditingZone(null)` on success and error | always-clear pattern | WIRED | Lines 128-129 (success), 131-133 (catch): both paths clear editingZone |
| StoreSettings.tsx Cancel + background | `setEditingZone(null)` | inline onClick | WIRED | Line 439 (background), line 510 (Cancel): `{ setShowZoneModal(false); setEditingZone(null) }` |
| StoreSettings.tsx RA section header | showRaList state toggle | clickable button with ChevronDown | WIRED | Lines 319-332: button with `onClick={() => setShowRaList((v) => !v)}`; ChevronDown with `rotate-180` class conditional on showRaList |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Products.tsx stock button | `product.stock_quantity` | `getProductsBySupplier` → Supabase `.select('*')` on products table | Yes — direct DB select, no static fallback | FLOWING |
| Products.tsx sell_without_stock toggle | `product.sell_without_stock` | same Supabase select | Yes — all product columns returned | FLOWING |
| StoreSettings.tsx count badge | `zones.filter(z => DF_RAS.includes(z.city)).length` | `getDeliveryZonesBySupplier` → Supabase `.select('*')` on delivery_zones | Yes — real DB query | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — app requires a running Vite dev server and authenticated session; no standalone runnable entry points for the supplier pages.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| D-01 | Plan 01 | Conditional box_weight_kg field required for kg sale unit | SATISFIED | superRefine schema + kg JSX block + onSubmit normalization all verified in ProductForm.tsx |
| D-02 | Plan 02, 03 | Stock management backend (migration, type, API routes, buyer filter) + frontend inline edit and toggle | SATISFIED | Migration file exists and applied; Product type updated; two PATCH routes with auth/ownership; buyer queries filtered; Products.tsx UI wired to API |
| D-03 | Plan 04 | Zone save bug fix — API 404 on 0-row update + modal state cleanup | SATISFIED | PUT route fixed with count-check 404; handleSaveZone, Cancel, background all clear editingZone |
| D-04 | Plan 04 | Collapsible DF RA list accordion with count badge | SATISFIED | showRaList state (default false), clickable toggle header, count badge, ChevronDown rotate-180, RA list wrapped in conditional |

### Anti-Patterns Found

None found. Searched for TODO/FIXME, placeholder returns, empty state initialization that flows to rendering without data fetch — none present in modified files. The `editingStock` and `stockSaving` state initialize as `{}` but are populated on user interaction before any rendering depends on them (not a stub pattern).

### Human Verification Required

The following items cannot be verified via static code inspection:

**1. D-01: kg field conditional rendering + inline error**
- Test: Switch sale_unit to kg. Verify 'Peso da caixa (kg) *' field appears. Submit without filling it.
- Expected: Inline error 'Peso da caixa obrigatório' appears below the box_weight_kg input.
- Why human: react-hook-form error binding with zodResolver + superRefine requires a live form submission to confirm the error path activates and renders under the correct field.

**2. D-01: box field absence**
- Test: Switch sale_unit to box. Inspect the pricing section.
- Expected: No 'Peso da caixa (kg)' input is visible or in the DOM.
- Why human: Conditional rendering correctness requires visual/DOM inspection.

**3. D-02: Inline stock edit flow**
- Test: On the supplier Products page, tap a stock count value on any product card. Edit the number. Press Enter.
- Expected: Input auto-focuses on tap; pressing Enter triggers toast 'Estoque atualizado' and the displayed value updates without page reload.
- Why human: Optimistic state update, toast feedback, and API round-trip require a running app with authentication.

**4. D-02: sell_without_stock optimistic toggle**
- Test: Tap the 'Vender sem estoque' toggle on a product card.
- Expected: Toggle flips immediately (optimistic), API PATCH fires, toast confirms. If the API errors, toggle reverts.
- Why human: Revert behavior on error requires triggering a real API failure.

**5. D-03: Zone modal state cleanup — success path**
- Test: Open Edit on a configured DF RA zone. Change a field. Save.
- Expected: Modal closes immediately; reopening the Add modal ('+' on any unconfigured RA) shows an empty form.
- Why human: React state persistence between modal open/close cycles requires live interaction.

**6. D-03: Zone modal state cleanup — Cancel and background paths**
- Test: Open Edit on a configured zone. Click Cancel. Then click '+' to add a new zone.
- Expected: Modal closes; Add modal opens with empty city/days fields (no editingZone leak).
- Test 2: Repeat with clicking the background overlay instead of Cancel.
- Why human: Multiple close paths must be tested individually.

**7. D-04: Initial collapsed state + count badge**
- Test: Load StoreSettings page for a supplier with some configured DF RA zones.
- Expected: 'Regiões de Entrega — DF' section is collapsed on load; header shows e.g. '3/32 configuradas'.
- Why human: Count badge accuracy depends on real delivery_zones data for the authenticated supplier.

**8. D-04: Accordion toggle + chevron**
- Test: Click the section header. Then click again.
- Expected: First click — list of 32 RA rows appears; chevron rotates 180deg. Second click — list collapses; chevron returns to original angle.
- Why human: CSS transition and conditional class require visual confirmation in a browser.

**9. D-04: 'Outra cidade' button independence**
- Test: With RA section collapsed, click 'Outra cidade'.
- Expected: Add zone modal opens; RA section remains collapsed (accordion does NOT expand).
- Why human: Button sibling relationship to the toggle button requires click event verification.

---

### Gaps Summary

No blocking gaps. All 20 must-have truths are verified by static code inspection. The `sell_without_stock` DB column is confirmed applied (stated in problem context). All key links are wired and data flows to rendering from real DB queries.

The 9 human verification items are standard UI/runtime behaviors that cannot be asserted programmatically: conditional form rendering, toast feedback, optimistic UI revert, React state across modal open/close cycles, and CSS class conditional transitions.

---

_Verified: 2026-05-09T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
