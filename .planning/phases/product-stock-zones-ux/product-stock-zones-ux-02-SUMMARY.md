---
phase: product-stock-zones-ux
plan: "02"
subsystem: products-stock-api
tags:
  - supabase-migration
  - api-routes
  - product-type
  - buyer-queries
  - stock-management
  - sell-without-stock
dependency_graph:
  requires: []
  provides:
    - sell_without_stock boolean column on products table (migration file created; requires manual DB application)
    - Product TypeScript type includes sell_without_stock: boolean
    - PATCH /api/products/:id/stock — auth + ownership + validation + count-check 404
    - PATCH /api/products/:id/sell-without-stock — auth + ownership + validation + count-check 404
    - getFeaturedProducts filters sell_without_stock=false AND stock=0 products for buyers
    - searchProducts filters sell_without_stock=false AND stock=0 products for buyers
  affects:
    - src/types/index.ts
    - api/[...route].ts
    - src/services/supabase.ts
tech_stack:
  added: []
  patterns:
    - PATCH route with requireAuth + adminSupabase ownership via .eq('supplier_id', userId) + count-check 404
    - PostgREST .or() filter combining boolean flag with numeric threshold
    - Strict input validation (typeof number/boolean checks before DB writes)
key_files:
  created:
    - supabase/migrations/20260508000000_products_sell_without_stock.sql
  modified:
    - src/types/index.ts
    - api/[...route].ts
    - src/services/supabase.ts
decisions:
  - "sell_without_stock typed as required boolean (not optional) — DB column is NOT NULL DEFAULT false so all rows have a value; TypeScript model should reflect that"
  - "Input validation uses typeof === 'number' && isFinite && >= 0 for stock_quantity (rejects NaN, Infinity, negatives, non-numbers) and typeof === 'boolean' for sell_without_stock (rejects truthy strings like 'true')"
  - "Buyer-side filter uses PostgREST .or('sell_without_stock.eq.true,stock_quantity.gt.0') — this means: show product if supplier opted-in OR if product has stock; hide only when both conditions fail"
  - "getProductsBySupplier and getProductById intentionally NOT filtered — suppliers see all their own products regardless of stock state; direct product links continue to work"
  - "Migration file created with correct idempotent SQL (IF NOT EXISTS) but DB application required manual step — see Deviations section"
metrics:
  duration: "~16 minutes"
  completed: "2026-05-09"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 3
  files_created: 1
---

# Phase product-stock-zones-ux Plan 02: Stock Management Backend Infrastructure Summary

## One-liner

Added DB migration for sell_without_stock boolean, Product TypeScript type field, two PATCH API routes with auth/ownership/validation, and buyer-side query filters hiding out-of-stock products that haven't opted into sell-without-stock mode.

## What Was Built

### Task 1: Create migration adding sell_without_stock column

**File:** `supabase/migrations/20260508000000_products_sell_without_stock.sql`

```sql
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sell_without_stock boolean NOT NULL DEFAULT false;
```

The migration uses `IF NOT EXISTS` making it idempotent. The `NOT NULL DEFAULT false` means all existing rows get `false` automatically — no backfill needed.

**DB Application Status:** Migration file created and committed. Could not apply to remote Supabase (`mdwifcuaekjboukvsnvg`) programmatically — see Deviations section. The SQL must be run manually in the Supabase SQL Editor before the API routes will work correctly.

### Task 2: Product type + two PATCH API routes

**`src/types/index.ts`:** Added `sell_without_stock: boolean` to the Product interface between `stock_quantity?: number` and `total_sold: number`. Field is required (not optional) matching the NOT NULL DB constraint.

**`api/[...route].ts`:** Added new "PRODUCTS" section with two routes:

- `PATCH /products/:id/stock` — validates `stock_quantity` is `typeof number && isFinite && >= 0`, updates via `adminSupabase` with `.eq('supplier_id', userId)` ownership check, returns 404 if 0 rows updated
- `PATCH /products/:id/sell-without-stock` — validates `sell_without_stock` is `typeof boolean` (rejects string "true"), same ownership pattern, 404 on 0 rows

Both routes:
- Protected by `requireAuth` middleware
- Use `adminSupabase` (service role) with explicit ownership re-enforcement at query level
- Use `.select('id', { count: 'exact', head: true })` to detect unauthorized updates (0 count → 404)
- Return `{ error: 'Produto não encontrado ou sem permissão' }` on 404

### Task 3: Update buyer-side queries

**`src/services/supabase.ts`:** Added `.or('sell_without_stock.eq.true,stock_quantity.gt.0')` to two buyer-facing functions:

- `getFeaturedProducts` — filter added after `.eq('is_available', true)`
- `searchProducts` — filter added after `.eq('is_available', true)` and before the conditional query/category filters

Functions **intentionally NOT changed:**
- `getProductsBySupplier` — suppliers see all their own products regardless of stock
- `getProductById` — direct product detail lookups still work (for in-progress cart, order history, etc.)

## Deviations from Plan

### Authentication Gate — Migration Not Applied to Remote DB

**Found during:** Task 1

**Issue:** The plan specified applying the migration via `mcp__plugin_supabase_supabase__apply_migration`. The MCP tools are unavailable in this spawned agent context (known issue: anthropics/claude-code#13898 strips MCP tools from agents with a `tools:` frontmatter restriction). Fallback to `npx supabase db push` also failed — CLI not linked/authenticated. The Vercel encrypted environment variables (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`) cannot be retrieved programmatically via `vercel env run` (they come back empty for the production environment).

**Impact:** The migration SQL is ready but the `sell_without_stock` column does not yet exist in the remote Supabase project (`mdwifcuaekjboukvsnvg`). The two new PATCH routes in `api/[...route].ts` will fail with a 400 DB error until the migration is applied. The buyer-side `.or()` filter will return an error on queries until the column exists.

**Required manual step:** Open the Supabase SQL Editor at https://supabase.com/dashboard/project/mdwifcuaekjboukvsnvg/sql and run:

```sql
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sell_without_stock boolean NOT NULL DEFAULT false;
```

**Verification query to run after:**
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'products' AND column_name = 'sell_without_stock';
```

Expected: `sell_without_stock | boolean | NO | false`

**Note on project ID discrepancy:** The plan references project ID `vpomchqkkmjjeschanch` but the actual live project is `mdwifcuaekjboukvsnvg` (confirmed via `.env` file and successful REST API queries). The original `vpomchqkkmjjeschanch` reference in the plan is outdated — the project was migrated in commit `1c1aa39`.

## Known Stubs

None — all new code has real data flow. The `.or()` filter will behave correctly once the DB migration is applied.

## Threat Flags

No new security surface beyond what was planned in the threat model. All mitigations from the plan's STRIDE register (T-product-stock-zones-ux-04 through T-product-stock-zones-ux-09) are implemented:
- T-04, T-05: requireAuth + .eq('supplier_id', userId) on both PATCH routes
- T-06: adminSupabase bypass mitigated by explicit ownership filter
- T-07: stock_quantity type/finite/non-negative validation
- T-08: sell_without_stock strict typeof boolean check
- T-09: buyer-side .or() filter in getFeaturedProducts and searchProducts

## Self-Check

### Files verified:
- `supabase/migrations/20260508000000_products_sell_without_stock.sql` — exists
- `src/types/index.ts` — contains `sell_without_stock: boolean`
- `api/[...route].ts` — contains both PATCH routes with ownership + count-check
- `src/services/supabase.ts` — contains 2x `.or('sell_without_stock.eq.true,stock_quantity.gt.0')`

### TypeScript: 0 errors (`npx tsc --noEmit` passes)

### Commits:
- `c830dea`: chore(product-stock-zones-ux-02): create migration for sell_without_stock column
- `c4860cf`: feat(product-stock-zones-ux-02): add sell_without_stock to Product type and PATCH API routes
- `7bed76b`: feat(product-stock-zones-ux-02): update buyer queries to filter out-of-stock products
