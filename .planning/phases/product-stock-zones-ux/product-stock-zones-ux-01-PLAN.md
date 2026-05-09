---
phase: product-stock-zones-ux
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/pages/supplier/ProductForm.tsx
autonomous: true
requirements:
  - D-01
must_haves:
  truths:
    - "When supplier selects sale_unit=kg, the form shows 'Peso da caixa (kg)' field as required"
    - "When supplier selects sale_unit=box, the form does NOT show the 'Peso da caixa (kg)' field"
    - "When supplier selects sale_unit=unit, the form is unchanged (price_per_unit + unit_description only)"
    - "Submitting a kg-product form WITHOUT box_weight_kg shows inline error 'Peso da caixa obrigatório'"
    - "Submitting a kg-product form WITH box_weight_kg saves successfully and persists box_weight_kg in DB"
  artifacts:
    - path: "src/pages/supplier/ProductForm.tsx"
      provides: "Conditional sale unit fields with cross-field Zod validation"
      contains: ".superRefine"
  key_links:
    - from: "src/pages/supplier/ProductForm.tsx (kg block JSX)"
      to: "register('box_weight_kg')"
      via: "react-hook-form register"
      pattern: "register\\('box_weight_kg'\\)"
    - from: "src/pages/supplier/ProductForm.tsx (Zod schema)"
      to: "ctx.addIssue with path ['box_weight_kg']"
      via: "superRefine cross-field validator"
      pattern: "sale_unit === 'kg'"
    - from: "src/pages/supplier/ProductForm.tsx (onSubmit)"
      to: "productData.box_weight_kg"
      via: "parseNum(data.box_weight_kg) in kg branch"
      pattern: "productData\\.box_weight_kg = parseNum"
---

<objective>
Implement D-01 — conditional sale unit fields in ProductForm.tsx so that the box_weight_kg field appears (and is required) when sale_unit=kg, and is removed when sale_unit=box. The unit option remains unchanged.

Purpose: Suppliers selling per-kg need to record the box weight (used by buyers for logistics). Suppliers selling per-box do not enter weight (only quantity per box). Current schema makes all fields optional with no cross-field validation, leading to inconsistent product data.

Output: Updated ProductForm.tsx with superRefine Zod cross-field validation, kg JSX block with box_weight_kg input, box JSX block with box_weight_kg removed, and onSubmit data normalization that persists box_weight_kg for kg-products.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/product-stock-zones-ux/CONTEXT.md
@.planning/phases/product-stock-zones-ux/PATTERNS.md
@src/pages/supplier/ProductForm.tsx
</context>

<interfaces>
<!-- Key types and patterns the executor needs. Extracted from PATTERNS.md and codebase. -->

From src/types/index.ts (Product interface, lines 50–71):
```typescript
export interface Product {
  id: string
  supplier_id: string
  name: string
  description?: string
  category: ProductCategory
  image_url?: string
  sale_unit: SaleUnit              // 'box' | 'kg' | 'unit'
  box_weight_kg?: number           // optional in DB; kg-products MUST set this
  box_unit_quantity?: number
  box_price?: number
  price_per_kg?: number
  price_per_unit?: number
  unit_description?: string
  is_available: boolean
  is_featured: boolean
  stock_quantity?: number
  total_sold: number
  // ...
}
```

Existing Zod schema (ProductForm.tsx lines 27–43):
```typescript
const schema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  description: z.string().optional(),
  category: z.enum(['fruit', 'vegetable', 'greens', 'other']),
  sale_unit: z.enum(['box', 'kg', 'unit']),
  box_weight_kg: z.string().optional(),
  box_unit_quantity: z.string().optional(),
  box_price: z.string().optional(),
  price_per_kg: z.string().optional(),
  price_per_unit: z.string().optional(),
  unit_description: z.string().optional(),
  stock_quantity: z.string().optional(),
  is_available: z.boolean(),
  is_featured: z.boolean(),
})
```

Existing JSX conditional pattern (ProductForm.tsx lines 268–311):
```tsx
const saleUnit = watch('sale_unit')   // line 73

{saleUnit === 'box' && (
  <div className="space-y-3">
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Peso da caixa (kg)</label>
        <input {...register('box_weight_kg')} type="number" step="0.001" placeholder="Ex: 20"
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Qtd. unidades na caixa</label>
        <input {...register('box_unit_quantity')} type="number" placeholder="Ex: 24"
          className="..." />
      </div>
    </div>
    {/* box_price input */}
  </div>
)}

{saleUnit === 'kg' && (
  <div>
    <label className="block text-xs font-semibold text-gray-600 mb-1">Preço por kg (R$) *</label>
    <input {...register('price_per_kg')} type="number" step="0.01" placeholder="Ex: 3.50"
      className="..." />
  </div>
)}
```

Error display pattern: `{errors.fieldname && <p className="text-danger text-xs mt-1">{errors.fieldname.message}</p>}`

onSubmit data normalization (ProductForm.tsx lines 155–164):
```typescript
if (data.sale_unit === 'box') {
  productData.box_weight_kg = parseNum(data.box_weight_kg)
  productData.box_unit_quantity = parseInt2(data.box_unit_quantity)
  productData.box_price = parseNum(data.box_price)
} else if (data.sale_unit === 'kg') {
  productData.price_per_kg = parseNum(data.price_per_kg)
  // box_weight_kg currently NOT set here — must be added
} else if (data.sale_unit === 'unit') {
  productData.price_per_unit = parseNum(data.price_per_unit)
  productData.unit_description = data.unit_description || null
}
```
</interfaces>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Update Zod schema with superRefine for kg-conditional box_weight_kg validation</name>
  <files>src/pages/supplier/ProductForm.tsx</files>
  <read_first>
    - src/pages/supplier/ProductForm.tsx (read FULL FILE — schema is around lines 27–43, but onSubmit and JSX must be understood as they reference field names)
    - .planning/phases/product-stock-zones-ux/PATTERNS.md (Zod superRefine pattern, lines 46–61)
    - .planning/phases/product-stock-zones-ux/CONTEXT.md (D-01 section)
  </read_first>
  <behavior>
    - Test 1: Schema accepts a valid kg-product with box_weight_kg='20' → no validation errors
    - Test 2: Schema REJECTS a kg-product with box_weight_kg='' or undefined → produces issue with path ['box_weight_kg'] and message 'Peso da caixa obrigatório'
    - Test 3: Schema accepts a box-product without box_weight_kg → no validation errors (the field is no longer relevant for box)
    - Test 4: Schema accepts a unit-product without box_weight_kg → no validation errors
    - Test 5: TypeScript types still infer correctly (FormData type unchanged in shape)
  </behavior>
  <action>
    Locate the existing `const schema = z.object({ ... })` declaration in ProductForm.tsx (around lines 27–43). The current declaration ends with `})` immediately after `is_featured: z.boolean()`.

    Replace the closing `})` with `}).superRefine((data, ctx) => { ... })` — append the cross-field validator. Keep ALL existing field declarations unchanged. The full new declaration MUST be:

    ```typescript
    const schema = z.object({
      name: z.string().min(2, 'Nome obrigatório'),
      description: z.string().optional(),
      category: z.enum(['fruit', 'vegetable', 'greens', 'other']),
      sale_unit: z.enum(['box', 'kg', 'unit']),
      box_weight_kg: z.string().optional(),
      box_unit_quantity: z.string().optional(),
      box_price: z.string().optional(),
      price_per_kg: z.string().optional(),
      price_per_unit: z.string().optional(),
      unit_description: z.string().optional(),
      stock_quantity: z.string().optional(),
      is_available: z.boolean(),
      is_featured: z.boolean(),
    }).superRefine((data, ctx) => {
      if (data.sale_unit === 'kg' && !data.box_weight_kg?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Peso da caixa obrigatório',
          path: ['box_weight_kg'],
        })
      }
    })
    ```

    Do NOT add other validators (e.g. box_price required for box) — D-01 scope is strictly the box_weight_kg→kg rule. Adding more rules risks breaking existing flows that pass without them today.

    Note: react-hook-form's `zodResolver` works with `.superRefine` outputs the same way as `.object` — no other code changes required for this task.
  </action>
  <verify>
    <automated>cd "C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar" && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "ProductForm\.tsx" | grep -v "^#" | grep -c "error" || echo "0 errors in ProductForm.tsx"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "superRefine" src/pages/supplier/ProductForm.tsx` returns exactly 1 match
    - `grep -n "Peso da caixa obrigatório" src/pages/supplier/ProductForm.tsx` returns exactly 1 match
    - `grep -n "path: \['box_weight_kg'\]" src/pages/supplier/ProductForm.tsx` returns exactly 1 match
    - `grep -n "data.sale_unit === 'kg'" src/pages/supplier/ProductForm.tsx` returns exactly 1 match (in superRefine)
    - `npx tsc --noEmit` reports 0 errors in src/pages/supplier/ProductForm.tsx
    - The string `z.object({` still appears at most once in the file (no duplicate schema declarations)
  </acceptance_criteria>
  <done>Zod schema is wrapped in `.superRefine` that adds an issue with message 'Peso da caixa obrigatório' on `path: ['box_weight_kg']` when `data.sale_unit === 'kg' && !data.box_weight_kg?.trim()`. TypeScript compiles. No other validation rules added.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add box_weight_kg field to kg JSX block; remove from box JSX block; update onSubmit data normalization</name>
  <files>src/pages/supplier/ProductForm.tsx</files>
  <read_first>
    - src/pages/supplier/ProductForm.tsx (read FULL FILE — JSX conditional blocks are at lines 268–311, onSubmit normalization at lines 155–164)
    - .planning/phases/product-stock-zones-ux/PATTERNS.md (kg block to add, lines 94–112; onSubmit normalization, lines 119–132)
  </read_first>
  <behavior>
    - Test 1: Render form with sale_unit='kg' → DOM contains an input registered as 'box_weight_kg' with label "Peso da caixa (kg) *"
    - Test 2: Render form with sale_unit='box' → DOM does NOT contain any input registered as 'box_weight_kg'
    - Test 3: Render form with sale_unit='unit' → unchanged (price_per_unit + unit_description still render)
    - Test 4: Submit kg-product with box_weight_kg='20' → onSubmit produces productData.box_weight_kg === 20 (number)
    - Test 5: Submit kg-product with empty box_weight_kg → form does NOT submit; inline error 'Peso da caixa obrigatório' renders below the input
  </behavior>
  <action>
    Make THREE changes in `src/pages/supplier/ProductForm.tsx`:

    **Change 1 — Replace the kg JSX block (currently lines ~285–293).** Find the existing block:
    ```tsx
    {saleUnit === 'kg' && (
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Preço por kg (R$) *</label>
        <input {...register('price_per_kg')} type="number" step="0.01" placeholder="Ex: 3.50"
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </div>
    )}
    ```

    Replace with the expanded block that adds `box_weight_kg` input and error displays:
    ```tsx
    {saleUnit === 'kg' && (
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Preço por kg (R$) *</label>
          <input {...register('price_per_kg')} type="number" step="0.01" placeholder="Ex: 3.50"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          {errors.price_per_kg && <p className="text-danger text-xs mt-1">{errors.price_per_kg.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Peso da caixa (kg) *</label>
          <input {...register('box_weight_kg')} type="number" step="0.001" placeholder="Ex: 20"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          {errors.box_weight_kg && <p className="text-danger text-xs mt-1">{errors.box_weight_kg.message}</p>}
        </div>
      </div>
    )}
    ```

    **Change 2 — Remove the box_weight_kg input from the box JSX block (currently lines ~268–283).** The current box block contains a 2-column grid:
    ```tsx
    {saleUnit === 'box' && (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Peso da caixa (kg)</label>
            <input {...register('box_weight_kg')} type="number" step="0.001" placeholder="Ex: 20"
              className="..." />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Qtd. unidades na caixa</label>
            <input {...register('box_unit_quantity')} type="number" placeholder="Ex: 24"
              className="..." />
          </div>
        </div>
        {/* box_price input below */}
      </div>
    )}
    ```

    Remove the entire `<div>` containing `register('box_weight_kg')` AND replace the `grid grid-cols-2 gap-3` wrapper with a single-column layout. The new box block MUST be:
    ```tsx
    {saleUnit === 'box' && (
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Qtd. unidades na caixa</label>
          <input {...register('box_unit_quantity')} type="number" placeholder="Ex: 24"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        {/* keep the existing box_price input block below — DO NOT REMOVE IT */}
      </div>
    )}
    ```

    Preserve the existing `box_price` input block that follows inside the same `saleUnit === 'box'` conditional. Only remove the `box_weight_kg` div and collapse the 2-col grid wrapper around `box_unit_quantity`.

    **Change 3 — Add box_weight_kg to onSubmit normalization (currently lines ~155–164).** Find:
    ```typescript
    } else if (data.sale_unit === 'kg') {
      productData.price_per_kg = parseNum(data.price_per_kg)
    } else if (data.sale_unit === 'unit') {
    ```

    Replace the kg branch with:
    ```typescript
    } else if (data.sale_unit === 'kg') {
      productData.price_per_kg = parseNum(data.price_per_kg)
      productData.box_weight_kg = parseNum(data.box_weight_kg)
    } else if (data.sale_unit === 'unit') {
    ```

    Do NOT touch the existing `box` and `unit` branches.

    **Important:** Do NOT change the unit JSX block. Leave it exactly as-is.
  </action>
  <verify>
    <automated>cd "C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar" && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "ProductForm\.tsx" | grep -v "^#" | grep -c "error" || echo "0 errors in ProductForm.tsx"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "register('box_weight_kg')" src/pages/supplier/ProductForm.tsx` returns exactly 1 (was 1 before in box block, now should be 1 in kg block)
    - `grep -c "Peso da caixa (kg) \*" src/pages/supplier/ProductForm.tsx` returns exactly 1 (label has asterisk for required)
    - `grep -B 2 "register('box_weight_kg')" src/pages/supplier/ProductForm.tsx` shows the `saleUnit === 'kg'` block context (not the box block)
    - `grep -n "errors.box_weight_kg" src/pages/supplier/ProductForm.tsx` returns at least 1 match (error display present)
    - `grep -c "productData.box_weight_kg = parseNum(data.box_weight_kg)" src/pages/supplier/ProductForm.tsx` returns exactly 1 (added to kg branch in onSubmit; box branch already had a similar line — but since box block is now removed-from-form, the box-branch line in onSubmit still exists harmlessly because it parses an undefined string to null/0)
    - `grep -c "grid grid-cols-2 gap-3" src/pages/supplier/ProductForm.tsx` is reduced by 1 from previous count (the box-block 2-col wrapper is gone)
    - `npx tsc --noEmit` reports 0 errors in src/pages/supplier/ProductForm.tsx
  </acceptance_criteria>
  <done>The kg JSX block contains both `price_per_kg` and `box_weight_kg` inputs with required-asterisk labels and inline error displays. The box JSX block no longer renders any `box_weight_kg` input. The onSubmit kg-branch sets `productData.box_weight_kg = parseNum(data.box_weight_kg)`. TypeScript compiles. The unit branch is untouched.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser→api | Supplier-submitted form data crosses here via existing POST/PUT product endpoint (handled in createProduct/updateProduct services using supabase client; this plan does not add new endpoints) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-product-stock-zones-ux-01 | Tampering | ProductForm Zod schema (cross-field validation) | mitigate | superRefine enforces box_weight_kg required for kg-products on the client; backend RLS on `products` already restricts INSERT/UPDATE to `supplier_id = auth.uid()` (existing) — no new server-side validation added in this plan because the field remains nullable in DB and box_weight_kg is informational, not a security-relevant value |
| T-product-stock-zones-ux-02 | Information Disclosure | ProductForm field rendering | accept | All form fields are inside the supplier's own page (requires auth); rendered values are the supplier's own data — no PII or secrets disclosed |
| T-product-stock-zones-ux-03 | Denial of Service | superRefine logic | accept | superRefine runs O(1) per submit; no loops, no I/O — negligible attack surface |
</threat_model>

<verification>
- `npx tsc --noEmit` passes with 0 errors in ProductForm.tsx
- Manual smoke test (post-execution, user verification step in main phase): switching between kg/box/unit shows expected fields; submitting kg-product without box_weight_kg shows inline error; submitting with box_weight_kg saves successfully
</verification>

<success_criteria>
- D-01 truths above are observable in the UI
- All grep-based acceptance criteria pass
- TypeScript compiles
- No new lint warnings introduced beyond the existing baseline
</success_criteria>

<output>
After completion, create `.planning/phases/product-stock-zones-ux/product-stock-zones-ux-01-SUMMARY.md` describing:
- Files modified (ProductForm.tsx only)
- The new superRefine validator
- The new kg JSX block with box_weight_kg
- The removal of box_weight_kg from the box block
- The onSubmit normalization addition
- Any deviations from this plan
</output>
