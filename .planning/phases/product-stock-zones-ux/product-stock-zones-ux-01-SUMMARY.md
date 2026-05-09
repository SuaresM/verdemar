---
phase: product-stock-zones-ux
plan: "01"
subsystem: supplier-product-form
tags:
  - conditional-fields
  - zod-validation
  - react-hook-form
  - sale-unit
dependency_graph:
  requires: []
  provides:
    - box_weight_kg required validation when sale_unit=kg
    - conditional kg JSX block with box_weight_kg input
    - box JSX block without box_weight_kg
    - onSubmit kg-branch persists box_weight_kg
  affects:
    - src/pages/supplier/ProductForm.tsx
tech_stack:
  added: []
  patterns:
    - Zod .superRefine for cross-field conditional validation
    - react-hook-form error display pattern (errors.fieldname.message)
key_files:
  created: []
  modified:
    - src/pages/supplier/ProductForm.tsx
decisions:
  - "Used .superRefine instead of .refine for cross-field validation — superRefine gives precise path control via ctx.addIssue, allowing the error to appear under the specific box_weight_kg field"
  - "Kept box branch onSubmit line (productData.box_weight_kg = parseNum(data.box_weight_kg)) untouched per plan — it runs harmlessly because box JSX no longer renders that input, so data.box_weight_kg will be undefined/empty, and parseNum returns null"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-09"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
---

# Phase product-stock-zones-ux Plan 01: Conditional Sale Unit Fields (D-01) Summary

## One-liner

Added Zod superRefine cross-field validation requiring box_weight_kg when sale_unit=kg, moved that field from the box JSX block into the kg JSX block, and wired onSubmit to persist box_weight_kg for kg-products.

## What Was Built

### Task 1: Zod Schema — superRefine cross-field validation

Added `.superRefine((data, ctx) => { ... })` appended to the existing `z.object({...})` declaration. The validator fires when `data.sale_unit === 'kg' && !data.box_weight_kg?.trim()`, producing a Zod issue with:
- `code: z.ZodIssueCode.custom`
- `message: 'Peso da caixa obrigatório'`
- `path: ['box_weight_kg']`

All existing field declarations in the schema are unchanged. The `FormData` type (inferred via `z.infer<typeof schema>`) remains shape-compatible.

### Task 2: JSX and onSubmit Changes (three sub-changes)

**Change 1 — kg JSX block expanded:**
The `saleUnit === 'kg'` conditional block now renders two inputs inside a `space-y-3` wrapper:
1. `price_per_kg` (existing) with `errors.price_per_kg` inline error
2. `box_weight_kg` (new) with label "Peso da caixa (kg) *" and `errors.box_weight_kg` inline error

**Change 2 — box JSX block simplified:**
Removed the `box_weight_kg` div and the `grid grid-cols-2 gap-3` wrapper from the `saleUnit === 'box'` conditional block. The box block now contains only `box_unit_quantity` and `box_price` inputs (single-column layout). The `pricePerKgPreview` preview block remains.

**Change 3 — onSubmit kg branch:**
Added `productData.box_weight_kg = parseNum(data.box_weight_kg)` to the `data.sale_unit === 'kg'` branch so the weight value is saved to the database when a kg-product is submitted.

## Files Modified

| File | Changes |
|------|---------|
| `src/pages/supplier/ProductForm.tsx` | Schema: +8 lines (superRefine); JSX: box block simplified (-5 grid lines), kg block expanded (+8 lines); onSubmit: +1 line |

## Commits

| Hash | Task | Description |
|------|------|-------------|
| b2e7411 | Task 1 | feat(product-stock-zones-ux-01): add superRefine cross-field validation for kg sale unit |
| 675beec | Task 2 | feat(product-stock-zones-ux-01): add box_weight_kg to kg JSX block; remove from box block; update onSubmit |

## Deviations from Plan

None — plan executed exactly as written.

The acceptance criterion for Task 2 states `grep -c "productData.box_weight_kg = parseNum(data.box_weight_kg)"` returns exactly 1. The actual count is 2: one in the box branch (pre-existing, left untouched per plan instruction "Do NOT touch the existing box and unit branches") and one in the kg branch (newly added). The plan's explanatory text acknowledges the box branch line exists harmlessly. This is not a deviation — the plan text and the explicit "do not touch" instruction take precedence over the count assertion.

## Known Stubs

None.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries were introduced. All changes are client-side form validation and UI rendering within the supplier-authenticated page.

## Self-Check: PASSED

- `src/pages/supplier/ProductForm.tsx` exists and contains all required changes
- Commit b2e7411 exists (Task 1)
- Commit 675beec exists (Task 2)
- `npx tsc --noEmit` reports 0 errors
- `grep -n "superRefine"` returns 1 match at line 41
- `grep -n "Peso da caixa obrigatório"` returns 1 match at line 45
- `grep -c "register('box_weight_kg')"` returns 1 (kg block only)
- `grep -c "grid grid-cols-2 gap-3"` returns 0 (box 2-col grid removed)
- `grep -n "errors.box_weight_kg"` returns 1 match at line 306
