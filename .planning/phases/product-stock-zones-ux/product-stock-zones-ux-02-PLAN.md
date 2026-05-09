---
phase: product-stock-zones-ux
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260508000000_products_sell_without_stock.sql
  - src/types/index.ts
  - api/[...route].ts
  - src/services/supabase.ts
autonomous: true
requirements:
  - D-02
user_setup:
  - service: supabase
    why: "Adds sell_without_stock column to products table"
    dashboard_config:
      - task: "Migration is applied via Supabase MCP apply_migration tool or `supabase db push` CLI"
        location: "Supabase project (linked via MCP)"
must_haves:
  truths:
    - "products table has sell_without_stock boolean NOT NULL DEFAULT false column"
    - "Product TypeScript type includes sell_without_stock: boolean"
    - "PATCH /api/products/:id/stock route exists, requires auth, enforces supplier ownership, returns 404 on 0 rows updated"
    - "PATCH /api/products/:id/sell-without-stock route exists, requires auth, enforces supplier ownership, returns 404 on 0 rows updated"
    - "Buyer-side searchProducts and getFeaturedProducts queries hide products where sell_without_stock=false AND stock_quantity=0"
  artifacts:
    - path: "supabase/migrations/20260508000000_products_sell_without_stock.sql"
      provides: "DB column sell_without_stock"
      contains: "ADD COLUMN IF NOT EXISTS sell_without_stock"
    - path: "src/types/index.ts"
      provides: "Product.sell_without_stock typed boolean"
      contains: "sell_without_stock: boolean"
    - path: "api/[...route].ts"
      provides: "Two PATCH endpoints for stock + sell_without_stock"
      contains: "/products/:id/stock"
    - path: "src/services/supabase.ts"
      provides: "Buyer-side queries respect sell_without_stock filter"
      contains: "sell_without_stock"
  key_links:
    - from: "api/[...route].ts (PATCH /products/:id/stock)"
      to: "products table"
      via: "adminSupabase.from('products').update(...).eq('id', productId).eq('supplier_id', userId)"
      pattern: "\\.eq\\('supplier_id', userId\\)"
    - from: "api/[...route].ts (PATCH /products/:id/sell-without-stock)"
      to: "products.sell_without_stock column"
      via: "adminSupabase update with count check"
      pattern: "sell_without_stock"
    - from: "src/services/supabase.ts (searchProducts, getFeaturedProducts)"
      to: "products.sell_without_stock + products.stock_quantity"
      via: ".or() filter combining sell_without_stock=true OR stock_quantity > 0"
      pattern: "sell_without_stock.eq.true,stock_quantity.gt.0"
---

<objective>
Implement D-02 backend infrastructure for stock management:
1. DB migration adding `sell_without_stock boolean NOT NULL DEFAULT false` to `products`
2. Apply migration via Supabase MCP (`apply_migration` tool)
3. Add `sell_without_stock: boolean` to the `Product` TypeScript type
4. Add two PATCH endpoints (`/products/:id/stock` and `/products/:id/sell-without-stock`) with auth + supplier ownership + count-check
5. Update buyer-side product queries (`searchProducts` and `getFeaturedProducts`) to hide out-of-stock products UNLESS `sell_without_stock=true`

Purpose: This plan delivers everything the Plan 03 UI consumes — types, API routes, and migrated DB column. It also closes the buyer-side correctness gap noted in CONTEXT.md (D-02 says "When sell_without_stock = true: product stays visible to buyers even when stock_quantity = 0", which means the converse — sell_without_stock=false AND stock=0 → hidden — must be enforced server-side).

Output: Migration file applied to remote Supabase, updated Product type, two new API routes, and updated buyer-facing service queries.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/product-stock-zones-ux/CONTEXT.md
@.planning/phases/product-stock-zones-ux/PATTERNS.md
@api/[...route].ts
@src/types/index.ts
@src/services/supabase.ts
@supabase/migrations/20260505000000_delivery_zones.sql
</context>

<interfaces>
<!-- Key types and patterns the executor needs. -->

Existing PATCH pattern with auth (api/[...route].ts lines 65–76):
```typescript
app.patch('/orders/:id/status', requireAuth, async (c) => {
  const orderId = c.req.param('id')
  const { status } = await c.req.json<{ status: string }>()

  const { error } = await adminSupabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
  if (error) return c.json({ error: error.message }, 400)

  return c.json({ ok: true })
})
```

Existing PUT pattern with ownership (api/[...route].ts lines 158–177):
```typescript
app.put('/supplier/delivery-zones/:id', requireAuth, async (c) => {
  const userId = c.get('userId')
  const zoneId = c.req.param('id')
  // ...update with .eq('id', zoneId).eq('supplier_id', userId)
})
```

Buyer-side product queries to update (src/services/supabase.ts lines 149–181):
```typescript
export async function getFeaturedProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*, supplier:suppliers(*)')
    .eq('is_featured', true)
    .eq('is_available', true)
    .order('total_sold', { ascending: false })
    .limit(20)
  // ...
}

export async function searchProducts(query?, category?, page = 0) {
  let q = supabase
    .from('products')
    .select('*, supplier:suppliers(*)')
    .eq('is_available', true)
  if (query) q = q.ilike('name', `%${query}%`)
  if (category) q = q.eq('category', category)
  q = q.range(from, to + 1)
  // ...
}
```

Migration file pattern (template: supabase/migrations/20260505000000_delivery_zones.sql exists; use timestamp 20260508000000):
```sql
-- supabase/migrations/20260508000000_products_sell_without_stock.sql

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sell_without_stock boolean NOT NULL DEFAULT false;
```

PostgREST `.or()` filter syntax (used to express "sell_without_stock=true OR stock_quantity > 0"):
```typescript
.or('sell_without_stock.eq.true,stock_quantity.gt.0')
```
</interfaces>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create and apply migration adding sell_without_stock column</name>
  <files>supabase/migrations/20260508000000_products_sell_without_stock.sql</files>
  <read_first>
    - supabase/migrations/20260505000000_delivery_zones.sql (existing migration template — confirm style: ALTER TABLE, IF NOT EXISTS, no transaction wrapper)
    - .planning/phases/product-stock-zones-ux/PATTERNS.md (migration section, lines 543–559)
    - .planning/phases/product-stock-zones-ux/CONTEXT.md (D-02 migration block)
  </read_first>
  <behavior>
    - Test 1: After migration applied, `products` table has a `sell_without_stock` column of type boolean, NOT NULL, DEFAULT false
    - Test 2: All existing rows in `products` have sell_without_stock = false (the DEFAULT applies to existing rows because it's NOT NULL with a literal default)
    - Test 3: Re-applying the migration is a no-op (`ADD COLUMN IF NOT EXISTS` is idempotent)
  </behavior>
  <action>
    **Step A — Create the migration file** at `supabase/migrations/20260508000000_products_sell_without_stock.sql` with EXACTLY this content:

    ```sql
    -- supabase/migrations/20260508000000_products_sell_without_stock.sql
    -- D-02: Add sell_without_stock flag to products so suppliers can opt-in to accepting orders when stock_quantity = 0.

    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS sell_without_stock boolean NOT NULL DEFAULT false;
    ```

    **Step B — Apply the migration to the remote Supabase project.**

    Use the Supabase MCP `apply_migration` tool (named `mcp__supabase__apply_migration` or similar — check `list_tables` first to see existing tables and confirm connection). Pass:
    - `name`: `products_sell_without_stock`
    - `query`: The SQL body from the migration file (the ALTER TABLE statement, without the comment lines — apply_migration takes raw SQL)

    If MCP `apply_migration` is unavailable, run the equivalent CLI: `npx supabase db push` from project root (this requires `supabase login` and `supabase link` to have been done previously). If CLI also fails, surface the error — do NOT skip migration.

    **Step C — Verify** by calling MCP `list_tables` and confirming the `products` table now lists a `sell_without_stock` column. Alternatively run an `execute_sql` MCP call:
    ```sql
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'sell_without_stock';
    ```
    Expected output: `sell_without_stock | boolean | NO | false`.
  </action>
  <verify>
    <automated>node -e "const fs=require('fs');const c=fs.readFileSync('supabase/migrations/20260508000000_products_sell_without_stock.sql','utf8');if(!/ADD COLUMN IF NOT EXISTS sell_without_stock boolean NOT NULL DEFAULT false/.test(c)){process.exit(1)};console.log('migration file OK')"</automated>
  </verify>
  <acceptance_criteria>
    - File `supabase/migrations/20260508000000_products_sell_without_stock.sql` exists
    - File contains the exact substring `ADD COLUMN IF NOT EXISTS sell_without_stock boolean NOT NULL DEFAULT false`
    - Migration was applied successfully to the remote project (confirm via MCP list_tables or execute_sql; the executor should record the verification output in the SUMMARY)
    - `information_schema.columns` query confirms column exists with type boolean, NOT NULL, default false
  </acceptance_criteria>
  <done>Migration file exists with correct ALTER TABLE statement; migration applied to remote Supabase; products.sell_without_stock column verified to exist with type=boolean, nullable=NO, default=false.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add sell_without_stock to Product type and add two PATCH API routes</name>
  <files>src/types/index.ts, api/[...route].ts</files>
  <read_first>
    - src/types/index.ts (read full file — Product interface starts around line 50)
    - api/[...route].ts (read at minimum lines 1–200 — focus on existing PATCH pattern at lines 65–76 and PUT pattern at lines 158–177; new routes must be inserted in the products section, but no existing products section exists yet — add after the orders block before the PUSH block, around line 121, OR create a new "PRODUCTS" section)
    - .planning/phases/product-stock-zones-ux/PATTERNS.md (api/[...route].ts section, lines 435–501; types section, lines 627–644)
  </read_first>
  <behavior>
    - Test 1: TypeScript code that does `const p: Product = { ..., sell_without_stock: false, ... }` compiles without errors
    - Test 2: `PATCH /api/products/:id/stock` with body `{ stock_quantity: 5 }` updates the product's stock_quantity column AND updated_at
    - Test 3: `PATCH /api/products/:id/stock` for a product NOT owned by the requesting supplier returns 404 with `{ error: 'Produto não encontrado ou sem permissão' }`
    - Test 4: `PATCH /api/products/:id/sell-without-stock` with body `{ sell_without_stock: true }` updates the column and returns `{ ok: true }`
    - Test 5: Both endpoints reject requests without a valid Authorization header (handled by `requireAuth` middleware)
  </behavior>
  <action>
    **Change 1 — `src/types/index.ts`:** locate the `Product` interface (starts around line 50). After the `stock_quantity?: number` line (currently line 66), add a new line:

    ```typescript
      sell_without_stock: boolean
    ```

    The added field is REQUIRED (not optional) — the DB column is NOT NULL with default false, so all rows have a value, and the TypeScript model should reflect that. Ensure the line is inserted between `stock_quantity?: number` and `total_sold: number` (the existing `total_sold` line follows it).

    The full updated Product fragment must read:
    ```typescript
    export interface Product {
      id: string
      supplier_id: string
      name: string
      description?: string
      category: ProductCategory
      image_url?: string
      sale_unit: SaleUnit
      box_weight_kg?: number
      box_unit_quantity?: number
      box_price?: number
      price_per_kg?: number
      price_per_unit?: number
      unit_description?: string
      is_available: boolean
      is_featured: boolean
      stock_quantity?: number
      sell_without_stock: boolean
      total_sold: number
      created_at?: string
      updated_at?: string
      supplier?: Supplier
    }
    ```

    **Change 2 — `api/[...route].ts`:** add a new "PRODUCTS" section with two PATCH routes. Insert after the closing of the orders block (after line 120, the last orders endpoint `/orders/:id/whatsapp-sent`) and BEFORE the `// ── PUSH ──` section header (currently line 122). Insert this entire block:

    ```typescript
    // ── PRODUCTS ────────────────────────────────────────────────────────────────

    app.patch('/products/:id/stock', requireAuth, async (c) => {
      const userId = c.get('userId')
      const productId = c.req.param('id')
      const { stock_quantity } = await c.req.json<{ stock_quantity: number }>()

      if (typeof stock_quantity !== 'number' || !isFinite(stock_quantity) || stock_quantity < 0) {
        return c.json({ error: 'stock_quantity inválido' }, 400)
      }

      const { error, count } = await adminSupabase
        .from('products')
        .update({ stock_quantity, updated_at: new Date().toISOString() })
        .eq('id', productId)
        .eq('supplier_id', userId)
        .select('id', { count: 'exact', head: true })
      if (error) return c.json({ error: error.message }, 400)
      if (!count || count === 0) return c.json({ error: 'Produto não encontrado ou sem permissão' }, 404)

      return c.json({ ok: true })
    })

    app.patch('/products/:id/sell-without-stock', requireAuth, async (c) => {
      const userId = c.get('userId')
      const productId = c.req.param('id')
      const { sell_without_stock } = await c.req.json<{ sell_without_stock: boolean }>()

      if (typeof sell_without_stock !== 'boolean') {
        return c.json({ error: 'sell_without_stock inválido' }, 400)
      }

      const { error, count } = await adminSupabase
        .from('products')
        .update({ sell_without_stock, updated_at: new Date().toISOString() })
        .eq('id', productId)
        .eq('supplier_id', userId)
        .select('id', { count: 'exact', head: true })
      if (error) return c.json({ error: error.message }, 400)
      if (!count || count === 0) return c.json({ error: 'Produto não encontrado ou sem permissão' }, 404)

      return c.json({ ok: true })
    })

    ```

    Do NOT modify any other routes in this file. The PUT delivery-zones fix is in Plan 04.
  </action>
  <verify>
    <automated>cd "C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar" && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "(types/index\.ts|\[\.\.\.route\]\.ts)" | grep -v "^#" | grep -c "error" || echo "0 errors in modified files"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "sell_without_stock: boolean" src/types/index.ts` returns at least 1 (in the Product interface)
    - `grep -n "sell_without_stock" src/types/index.ts` shows the field between `stock_quantity` and `total_sold`
    - `grep -c "app.patch('/products/:id/stock'" api/[...route].ts` returns exactly 1
    - `grep -c "app.patch('/products/:id/sell-without-stock'" api/[...route].ts` returns exactly 1
    - `grep -c "Produto não encontrado ou sem permissão" api/[...route].ts` returns exactly 2 (one per new route)
    - `grep -c "\.eq('supplier_id', userId)" api/[...route].ts` increased by 2 from baseline (each new route enforces ownership)
    - `grep -c "count: 'exact', head: true" api/[...route].ts` increased by 2 (each new route uses count-check)
    - `npx tsc --noEmit` reports 0 errors in src/types/index.ts and api/[...route].ts
  </acceptance_criteria>
  <done>Product type has `sell_without_stock: boolean` (required). api/[...route].ts has two PATCH endpoints with `requireAuth`, `.eq('supplier_id', userId)`, count check returning 404 with localized error message, and input validation. TypeScript compiles.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Update buyer-side queries to respect sell_without_stock filter</name>
  <files>src/services/supabase.ts</files>
  <read_first>
    - src/services/supabase.ts (read at minimum lines 128–200 — getProductsBySupplier, getProductById, getFeaturedProducts, searchProducts)
    - .planning/phases/product-stock-zones-ux/CONTEXT.md (D-02 buyer-side impact note in planning_guidance)
  </read_first>
  <behavior>
    - Test 1: searchProducts() returns products where stock_quantity > 0 OR sell_without_stock = true (and is_available = true)
    - Test 2: searchProducts() does NOT return products where stock_quantity = 0 AND sell_without_stock = false (even if is_available = true)
    - Test 3: getFeaturedProducts() applies the same filter
    - Test 4: getProductsBySupplier() (supplier-side) is UNCHANGED — suppliers see all their products including out-of-stock
    - Test 5: getProductById() (single product detail page) is UNCHANGED — direct ID lookup still works for whatever the buyer can navigate to
  </behavior>
  <action>
    Modify ONLY two functions in `src/services/supabase.ts`: `getFeaturedProducts` (currently lines 149–159) and `searchProducts` (currently lines 163–181). Add a `.or('sell_without_stock.eq.true,stock_quantity.gt.0')` filter that combines the existing filters via PostgREST's logical-or operator.

    **Change 1 — `getFeaturedProducts`:** find the existing block:
    ```typescript
    export async function getFeaturedProducts(): Promise<Product[]> {
      const { data, error } = await supabase
        .from('products')
        .select('*, supplier:suppliers(*)')
        .eq('is_featured', true)
        .eq('is_available', true)
        .order('total_sold', { ascending: false })
        .limit(20)
      if (error) return []
      return data
    }
    ```

    Replace with:
    ```typescript
    export async function getFeaturedProducts(): Promise<Product[]> {
      const { data, error } = await supabase
        .from('products')
        .select('*, supplier:suppliers(*)')
        .eq('is_featured', true)
        .eq('is_available', true)
        .or('sell_without_stock.eq.true,stock_quantity.gt.0')
        .order('total_sold', { ascending: false })
        .limit(20)
      if (error) return []
      return data
    }
    ```

    **Change 2 — `searchProducts`:** find the existing block:
    ```typescript
    export async function searchProducts(
      query?: string,
      category?: string,
      page = 0
    ): Promise<{ data: Product[]; hasMore: boolean }> {
      const from = page * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      let q = supabase
        .from('products')
        .select('*, supplier:suppliers(*)')
        .eq('is_available', true)
      if (query) q = q.ilike('name', `%${query}%`)
      if (category) q = q.eq('category', category)
      q = q.range(from, to + 1) // fetch one extra to detect hasMore
      const { data, error } = await q
      if (error) return { data: [], hasMore: false }
      const hasMore = (data?.length || 0) > PAGE_SIZE
      return { data: hasMore ? data!.slice(0, PAGE_SIZE) : data || [], hasMore }
    }
    ```

    Replace ONLY the initial query builder line, adding the `.or()` filter:
    ```typescript
      let q = supabase
        .from('products')
        .select('*, supplier:suppliers(*)')
        .eq('is_available', true)
        .or('sell_without_stock.eq.true,stock_quantity.gt.0')
    ```

    Keep all other lines (query/category/range/data handling) UNCHANGED.

    **DO NOT** modify `getProductsBySupplier` (supplier-side, line 129) or `getProductById` (line 139) — suppliers must continue to see all their own products regardless of stock state, and direct-link lookups must continue to work.
  </action>
  <verify>
    <automated>cd "C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar" && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "services/supabase\.ts" | grep -v "^#" | grep -c "error" || echo "0 errors"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "sell_without_stock.eq.true,stock_quantity.gt.0" src/services/supabase.ts` returns exactly 2 (one in getFeaturedProducts, one in searchProducts)
    - The `getProductsBySupplier` function body (lines 129–137) is unchanged — `grep -A 7 "getProductsBySupplier" src/services/supabase.ts` does NOT contain `sell_without_stock`
    - The `getProductById` function body (lines 139–147) is unchanged — `grep -A 7 "getProductById" src/services/supabase.ts` does NOT contain `sell_without_stock`
    - `npx tsc --noEmit` reports 0 errors in src/services/supabase.ts
  </acceptance_criteria>
  <done>Both buyer-facing queries (getFeaturedProducts, searchProducts) filter out products where stock=0 AND sell_without_stock=false. Supplier-side queries (getProductsBySupplier, getProductById) are unchanged. TypeScript compiles.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser→api/products/:id/stock | Authenticated supplier sends arbitrary numeric stock_quantity; could attempt to update OTHER suppliers' products |
| browser→api/products/:id/sell-without-stock | Authenticated supplier sends arbitrary boolean; could attempt to flip OTHER suppliers' flag |
| browser→buyer-search | Anonymous/buyer queries products list — must not see out-of-stock products that suppliers haven't opted to keep visible |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-product-stock-zones-ux-04 | Tampering | PATCH /products/:id/stock | mitigate | Route enforces `requireAuth` + `.eq('supplier_id', userId)` — only the owning supplier can update; count-check returns 404 if 0 rows updated, preventing silent cross-tenant updates |
| T-product-stock-zones-ux-05 | Tampering | PATCH /products/:id/sell-without-stock | mitigate | Same ownership pattern as above |
| T-product-stock-zones-ux-06 | Elevation of Privilege | adminSupabase service-role bypass of RLS | mitigate | Both routes use `adminSupabase` (service role) which bypasses RLS, but explicit `.eq('supplier_id', userId)` re-enforces ownership at the query level — pattern matches existing `/supplier/delivery-zones/*` routes |
| T-product-stock-zones-ux-07 | Tampering | stock_quantity input | mitigate | Type/finite/non-negative validation: `typeof === 'number' && isFinite && >= 0` — rejects NaN, Infinity, negatives, non-numbers with 400 |
| T-product-stock-zones-ux-08 | Tampering | sell_without_stock input | mitigate | Strict `typeof === 'boolean'` check — rejects truthy non-booleans (e.g. "true" string) with 400 |
| T-product-stock-zones-ux-09 | Information Disclosure | Buyer-side searchProducts | mitigate | Adding `.or('sell_without_stock.eq.true,stock_quantity.gt.0')` ensures buyers only see in-stock products or supplier-opt-in items; out-of-stock products without opt-in are filtered server-side |
| T-product-stock-zones-ux-10 | Denial of Service | apply_migration | accept | Migration is idempotent (`IF NOT EXISTS`); ALTER TABLE on a small column with literal default is fast |
| T-product-stock-zones-ux-11 | Repudiation | Stock changes | accept | `updated_at` is set on every PATCH; full audit log is a deferred non-goal per CONTEXT.md |
</threat_model>

<verification>
- Migration applied to remote Supabase, verified via MCP list_tables / execute_sql
- `npx tsc --noEmit` passes
- Curl test (manual, post-execution): `curl -X PATCH /api/products/{id}/stock -H "Authorization: Bearer {token}" -d '{"stock_quantity":5}'` → 200 if owner, 404 if not
- Buyer-search smoke test: a product with sell_without_stock=false and stock_quantity=0 must NOT appear in the buyer home/search results
</verification>

<success_criteria>
- All 5 must_haves truths above are observable
- All grep-based acceptance criteria pass for each task
- TypeScript compiles
- Migration verified applied
</success_criteria>

<output>
After completion, create `.planning/phases/product-stock-zones-ux/product-stock-zones-ux-02-SUMMARY.md` describing:
- Migration filename, content, and confirmation that it was applied
- Product type addition
- Two new PATCH routes with input validation snippets
- Buyer-side query modifications (which functions changed, which did NOT)
- Any deviations from this plan
</output>
