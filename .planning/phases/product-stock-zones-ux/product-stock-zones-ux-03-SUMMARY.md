---
phase: product-stock-zones-ux
plan: "03"
subsystem: products-ui
tags:
  - inline-edit
  - stock-management
  - optimistic-ui
  - toggle
  - sell-without-stock
dependency_graph:
  requires:
    - product-stock-zones-ux-02 (PATCH /products/:id/stock and PATCH /products/:id/sell-without-stock routes, sell_without_stock: boolean on Product type)
  provides:
    - Inline tap-to-edit stock input on each product card in supplier Products page
    - sell_without_stock toggle pill on each product card
    - editingStock and stockSaving per-product state slots
    - handleStockSave, handleStockCancel, handleToggleSellWithoutStock handlers
  affects:
    - src/pages/supplier/Products.tsx
tech_stack:
  added: []
  patterns:
    - Per-product Record<string, string/boolean> state maps for inline edit tracking
    - Optimistic UI update with revert-on-error for toggle
    - apiClient.patch from frontend for inline mutations
    - Spinner via animate-spin while stockSaving[product.id] is true
key_files:
  created: []
  modified:
    - src/pages/supplier/Products.tsx
decisions:
  - "handleStockSave checks isNaN || < 0 before calling API — matches T-product-stock-zones-ux-12 mitigation in threat model; invalid input clears edit state and shows toast without making a network call"
  - "handleToggleSellWithoutStock uses optimistic update first then reverts on catch — this matches the pattern from CONTEXT.md D-02 and the existing handleToggleAvailability style"
  - "editingStock[product.id] appears 3 times in JSX/handlers (handler read, conditional, value prop) rather than 4 as estimated in the plan's acceptance criterion — the onChange handler uses e.target.value rather than reading editingStock, so 3 is the correct count; all behavioral requirements are met"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-09"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
  files_created: 0
---

# Phase product-stock-zones-ux Plan 03: Inline Stock Edit and sell_without_stock Toggle UI Summary

## One-liner

Added tap-to-edit inline stock number input and sell_without_stock toggle pill to each supplier product card, wired to the Plan 02 PATCH API routes via apiClient.

## What Was Built

### Task 1: apiClient import + state + handlers

**File:** `src/pages/supplier/Products.tsx`

**Import added** (line 7, directly after the supabase service import):
```typescript
import { apiClient } from '../../lib/apiClient'
```

**State slots added** (after `availabilityFilter`):
```typescript
const [editingStock, setEditingStock] = useState<Record<string, string>>({})
const [stockSaving, setStockSaving] = useState<Record<string, boolean>>({})
```

**Three handlers inserted** immediately after `handleToggleAvailability`:

- **`handleStockSave(product)`** — reads `editingStock[product.id]`, parses with `parseFloat`, rejects NaN or negative with toast + clears edit state, sets `stockSaving[product.id] = true`, calls `apiClient.patch('/products/:id/stock', { stock_quantity })`, updates `products` state on success, clears saving and editing state in `finally`.
- **`handleStockCancel(product)`** — removes the product's key from `editingStock` without saving. Used for Escape key path.
- **`handleToggleSellWithoutStock(product)`** — optimistically flips `sell_without_stock` in products state first, calls `apiClient.patch('/products/:id/sell-without-stock', { sell_without_stock: newVal })`, shows toast on success; on error, reverts the optimistic state change and shows error toast.

### Task 2: Inline stock edit JSX and sell_without_stock toggle JSX

Both new JSX blocks are inserted inside the `<div className="p-2">` of each product card, **immediately after `<PriceTag product={product} size="sm" />`** and **before the `<div className="flex gap-1 mt-2">` button row**.

**Inline stock edit block:**
- When `editingStock[product.id] !== undefined`: renders `<input type="number" step="0.001" min="0" autoFocus ...>` with `onBlur` → `handleStockSave`, `onKeyDown` → Enter calls `handleStockSave`, Escape calls `handleStockCancel`
- When `editingStock[product.id] === undefined`: renders a `<button>` showing `{stock_quantity ?? 0} em estoque`; while `stockSaving[product.id]` is true, the button is disabled and shows a small `animate-spin` spinner instead of the count

**sell_without_stock toggle block:**
- `<div className="flex items-center justify-between mt-2">` with label "Vender sem estoque" (text-xs text-gray-500) and a toggle pill button
- Toggle pill: `w-9 h-5 rounded-full transition-colors`; `bg-primary` when `product.sell_without_stock` is true, `bg-gray-300` when false
- Inner thumb div translates: `translate-x-4` when on, `translate-x-0.5` when off
- `aria-label="Vender sem estoque"` and `aria-pressed={product.sell_without_stock}` for accessibility
- `onClick` → `handleToggleSellWithoutStock(product)`

## Deviations from Plan

### Minor criterion adjustment: editingStock[product.id] appears 3 times not 4

**Found during:** Task 2 acceptance criteria verification

**Issue:** The plan's acceptance criterion stated "at least 4" occurrences of `editingStock[product.id]`. The implemented pattern produces 3: (1) the read in `handleStockSave`, (2) the JSX conditional `editingStock[product.id] !== undefined`, (3) the `value={editingStock[product.id]}` prop. The `onChange` handler uses `e.target.value` (not a read of `editingStock[product.id]`), and `onKeyDown` does not need to read the current value — it delegates to `handleStockSave` or `handleStockCancel`. The PATTERNS.md pattern (lines 220–246) confirms the same 3-occurrence structure.

**Assessment:** This is a count estimation error in the plan, not a missing behavior. All 7 `<behavior>` tests in the plan are implemented correctly.

## Known Stubs

None — the inline edit reads `product.stock_quantity` from loaded product state (real DB data), and the toggle reads `product.sell_without_stock` (real DB data). Both mutation paths call live API endpoints.

## Threat Flags

No new security surface. The NaN/negative guard in `handleStockSave` implements T-product-stock-zones-ux-12 (Tampering, parseFloat guard). No new endpoints or trust boundaries introduced in this plan.

## Self-Check

### Files verified:
- `src/pages/supplier/Products.tsx` — exists and contains all new code

### Commits:
- `807a547`: feat(product-stock-zones-ux-03): add apiClient import, stock state, and handlers
- `944fe2a`: feat(product-stock-zones-ux-03): add inline stock edit and sell_without_stock toggle JSX

### TypeScript: 0 errors (`npx tsc --noEmit` passes — entire project)

## Self-Check: PASSED
