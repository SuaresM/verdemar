---
phase: product-stock-zones-ux
plan: 03
type: execute
wave: 2
depends_on:
  - 02
files_modified:
  - src/pages/supplier/Products.tsx
autonomous: true
requirements:
  - D-02
must_haves:
  truths:
    - "Each product card on the supplier Products page shows current stock as a tappable button"
    - "Tapping the stock value transforms it into an inline number input that auto-focuses"
    - "Pressing Enter or blurring the input calls PATCH /products/:id/stock and updates the local product list"
    - "Pressing Escape reverts the edit without saving"
    - "Each product card shows a 'Vender sem estoque' toggle that calls PATCH /products/:id/sell-without-stock"
    - "Toggle uses optimistic state update with toast feedback on success/error"
  artifacts:
    - path: "src/pages/supplier/Products.tsx"
      provides: "Inline stock edit + sell_without_stock toggle UI"
      contains: "editingStock"
  key_links:
    - from: "src/pages/supplier/Products.tsx (handleStockSave)"
      to: "PATCH /api/products/:id/stock"
      via: "apiClient.patch"
      pattern: "apiClient\\.patch.*products.*stock"
    - from: "src/pages/supplier/Products.tsx (handleToggleSellWithoutStock)"
      to: "PATCH /api/products/:id/sell-without-stock"
      via: "apiClient.patch"
      pattern: "apiClient\\.patch.*sell-without-stock"
    - from: "src/pages/supplier/Products.tsx product card"
      to: "Product.sell_without_stock typed boolean"
      via: "imported from src/types"
      pattern: "product\\.sell_without_stock"
---

<objective>
Implement D-02 frontend UI: inline stock edit (tap-to-edit number) and sell_without_stock toggle on each product card in the supplier Products page.

Purpose: Suppliers should adjust stock in seconds without opening the full ProductForm. The "Vender sem estoque" toggle controls whether the product remains visible to buyers when stock hits zero (the buyer-side filter was added in Plan 02).

Output: Updated Products.tsx with two new state slots, two new handlers, an `apiClient` import, and JSX additions inside each product card.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/product-stock-zones-ux/CONTEXT.md
@.planning/phases/product-stock-zones-ux/PATTERNS.md
@.planning/phases/product-stock-zones-ux/product-stock-zones-ux-02-SUMMARY.md
@src/pages/supplier/Products.tsx
@src/lib/apiClient.ts
@src/types/index.ts
</context>

<interfaces>
<!-- Key contracts from Plan 02 (must already exist before this plan runs). -->

From Plan 02 — `Product` interface gains:
```typescript
sell_without_stock: boolean   // required, defaults to false
```

From Plan 02 — API endpoints available:
```
PATCH /api/products/:id/stock           body: { stock_quantity: number }       returns: 200 { ok: true } | 404 | 400
PATCH /api/products/:id/sell-without-stock  body: { sell_without_stock: boolean } returns: 200 { ok: true } | 404 | 400
```

From src/lib/apiClient.ts:
```typescript
export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  // ...
}
```
Note: paths passed to apiClient must NOT include the `/api` prefix — the client adds it.

Existing optimistic toggle pattern in Products.tsx (lines 47–57) — model new handlers after this:
```typescript
const handleToggleAvailability = async (product: Product) => {
  try {
    await updateProduct(product.id, { is_available: !product.is_available })
    setProducts((prev) =>
      prev.map((p) => p.id === product.id ? { ...p, is_available: !p.is_available } : p)
    )
    toast.success(product.is_available ? 'Produto desativado' : 'Produto ativado')
  } catch {
    toast.error('Erro ao atualizar')
  }
}
```

Product card JSX anchor (lines 131–170) — new controls go inside the `<div className="p-2">` block after `<PriceTag>` and before the buttons row.
</interfaces>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add apiClient import + state + handlers for inline stock edit and sell_without_stock toggle</name>
  <files>src/pages/supplier/Products.tsx</files>
  <read_first>
    - src/pages/supplier/Products.tsx (read FULL FILE — about 200 lines; needed to place state next to existing useState calls and handlers next to handleToggleAvailability)
    - .planning/phases/product-stock-zones-ux/PATTERNS.md (Products.tsx section, lines 159–283)
    - src/lib/apiClient.ts (verify patch signature)
  </read_first>
  <behavior>
    - Test 1: After mount, `editingStock` state is `{}` and `stockSaving` state is `{}`
    - Test 2: handleStockSave reads editingStock[product.id], parses to float, validates not NaN, calls apiClient.patch('/products/:id/stock', { stock_quantity }), updates products state on success, clears editingStock and stockSaving in finally
    - Test 3: handleToggleSellWithoutStock optimistically toggles via apiClient.patch('/products/:id/sell-without-stock', { sell_without_stock: !current }) and reverts on error (or relies on the catch toast — see action)
    - Test 4: apiClient is imported at top of file
  </behavior>
  <action>
    Make THREE changes in `src/pages/supplier/Products.tsx`:

    **Change 1 — Add the apiClient import.** Find the existing imports block (lines 1–13). After the existing service import line:
    ```typescript
    import { getProductsBySupplier, deleteProduct, updateProduct, createProduct } from '../../services/supabase'
    ```
    Add a new line directly below it:
    ```typescript
    import { apiClient } from '../../lib/apiClient'
    ```

    **Change 2 — Add two new state slots.** Find the existing useState declarations (around lines 26–29):
    ```typescript
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [category, setCategory] = useState('all')
    const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'unavailable'>('all')
    ```
    Add directly after `availabilityFilter`:
    ```typescript
    const [editingStock, setEditingStock] = useState<Record<string, string>>({})
    const [stockSaving, setStockSaving] = useState<Record<string, boolean>>({})
    ```

    **Change 3 — Add two new handlers.** Find the existing `handleToggleAvailability` (around lines 47–57). Directly AFTER its closing brace, insert these two new handler functions:

    ```typescript
    const handleStockSave = async (product: Product) => {
      const rawVal = editingStock[product.id]
      if (rawVal === undefined) return
      const newQty = parseFloat(rawVal)
      if (isNaN(newQty) || newQty < 0) {
        setEditingStock((p) => { const n = { ...p }; delete n[product.id]; return n })
        toast.error('Valor inválido')
        return
      }
      setStockSaving((p) => ({ ...p, [product.id]: true }))
      try {
        await apiClient.patch(`/products/${product.id}/stock`, { stock_quantity: newQty })
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, stock_quantity: newQty } : p))
        )
        toast.success('Estoque atualizado')
      } catch {
        toast.error('Erro ao atualizar estoque')
      } finally {
        setStockSaving((p) => { const n = { ...p }; delete n[product.id]; return n })
        setEditingStock((p) => { const n = { ...p }; delete n[product.id]; return n })
      }
    }

    const handleStockCancel = (product: Product) => {
      setEditingStock((p) => { const n = { ...p }; delete n[product.id]; return n })
    }

    const handleToggleSellWithoutStock = async (product: Product) => {
      const newVal = !product.sell_without_stock
      // optimistic update
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, sell_without_stock: newVal } : p))
      )
      try {
        await apiClient.patch(`/products/${product.id}/sell-without-stock`, { sell_without_stock: newVal })
        toast.success(newVal ? 'Venda sem estoque ativada' : 'Venda sem estoque desativada')
      } catch {
        // revert
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, sell_without_stock: !newVal } : p))
        )
        toast.error('Erro ao atualizar')
      }
    }

    ```

    Note: `handleStockCancel` is a small helper to reuse for the Escape-key path in the JSX block (Task 2). It is NOT called from any other site.

    Do NOT modify the existing `load`, `handleToggleAvailability`, `handleDelete`, or `handleDuplicate` functions.
  </action>
  <verify>
    <automated>cd "C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar" && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "Products\.tsx" | grep -v "^#" | grep -c "error" || echo "0 errors"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "from '../../lib/apiClient'" src/pages/supplier/Products.tsx` returns exactly 1
    - `grep -c "useState<Record<string, string>>" src/pages/supplier/Products.tsx` returns at least 1 (for editingStock)
    - `grep -c "useState<Record<string, boolean>>" src/pages/supplier/Products.tsx` returns at least 1 (for stockSaving)
    - `grep -c "handleStockSave" src/pages/supplier/Products.tsx` returns at least 2 (definition + later usage in Task 2 — at this stage 1 is acceptable; Task 2 will add usages)
    - `grep -c "handleToggleSellWithoutStock" src/pages/supplier/Products.tsx` returns at least 2 (same — at Task 1 stage 1 is OK)
    - `grep -c "apiClient.patch.*products.*stock" src/pages/supplier/Products.tsx` returns at least 1 (in handleStockSave; the second route is /sell-without-stock and matches the broader regex — exact-match grep)
    - `grep -c "apiClient.patch.*sell-without-stock" src/pages/supplier/Products.tsx` returns exactly 1
    - `npx tsc --noEmit` reports 0 errors in src/pages/supplier/Products.tsx
  </acceptance_criteria>
  <done>apiClient is imported, two state slots are declared, three handlers (handleStockSave, handleStockCancel, handleToggleSellWithoutStock) are defined right after handleToggleAvailability. TypeScript compiles.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add inline stock edit JSX and sell_without_stock toggle JSX inside each product card</name>
  <files>src/pages/supplier/Products.tsx</files>
  <read_first>
    - src/pages/supplier/Products.tsx (read FULL FILE — product card JSX is around lines 131–170)
    - .planning/phases/product-stock-zones-ux/PATTERNS.md (inline stock input pattern lines 220–246; toggle button JSX lines 266–276)
  </read_first>
  <behavior>
    - Test 1: Each product card renders a button showing "{stock_quantity ?? 0} em estoque" by default
    - Test 2: Clicking the stock button replaces it with an `<input type="number">` that has autoFocus
    - Test 3: While saving, the button shows a small spinner instead of the count
    - Test 4: Pressing Escape exits the input without saving
    - Test 5: Each product card renders a small toggle pill labeled "Vender sem estoque"
    - Test 6: The toggle pill is filled (bg-primary) when product.sell_without_stock=true, gray (bg-gray-300) when false
    - Test 7: Clicking the toggle calls handleToggleSellWithoutStock(product)
  </behavior>
  <action>
    Locate the product card JSX. The card is rendered inside a `.map((product) => ...)` block (around line 131). Each card is structured as:

    ```tsx
    <div key={product.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden ${!product.is_available ? 'opacity-60' : ''}`}>
      {/* image + category badge */}
      <div className="p-2">
        <p className="font-bold text-gray-900 text-xs line-clamp-2 mb-1">{product.name}</p>
        <PriceTag product={product} size="sm" />
        {/* INSERT new controls HERE */}
        <div className="flex gap-1 mt-2">
          {/* edit / copy / delete buttons */}
        </div>
      </div>
    </div>
    ```

    Insert the following JSX block IMMEDIATELY AFTER `<PriceTag product={product} size="sm" />` and BEFORE the `<div className="flex gap-1 mt-2">` button row:

    ```tsx
            {/* D-02: inline stock edit */}
            <div className="mt-2">
              {editingStock[product.id] !== undefined ? (
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  autoFocus
                  value={editingStock[product.id]}
                  onChange={(e) => setEditingStock((p) => ({ ...p, [product.id]: e.target.value }))}
                  onBlur={() => handleStockSave(product)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleStockSave(product)
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      handleStockCancel(product)
                    }
                  }}
                  className="w-full px-2 py-1 border border-primary rounded-lg text-xs text-center"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingStock((p) => ({ ...p, [product.id]: String(product.stock_quantity ?? 0) }))}
                  className="text-xs text-gray-500 underline-offset-2 hover:underline w-full text-left"
                  disabled={stockSaving[product.id]}
                >
                  {stockSaving[product.id] ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="w-3 h-3 border border-gray-400 border-t-primary rounded-full animate-spin inline-block" />
                      salvando...
                    </span>
                  ) : (
                    <>{product.stock_quantity ?? 0} em estoque</>
                  )}
                </button>
              )}
            </div>

            {/* D-02: sell_without_stock toggle */}
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-500">Vender sem estoque</p>
              <button
                type="button"
                onClick={() => handleToggleSellWithoutStock(product)}
                className={`relative w-9 h-5 rounded-full transition-colors ${product.sell_without_stock ? 'bg-primary' : 'bg-gray-300'}`}
                aria-label="Vender sem estoque"
                aria-pressed={product.sell_without_stock}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${product.sell_without_stock ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
    ```

    Indentation MUST match the surrounding JSX (the parent `<div className="p-2">` indents children at the same level as `<PriceTag>`).

    Do NOT modify the existing image, category badge, name, PriceTag, or button-row JSX. Do NOT modify any keys or other props on the card root.
  </action>
  <verify>
    <automated>cd "C:/Users/jsuar/OneDrive/Desktop/Nova pasta/verdemar" && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "Products\.tsx" | grep -v "^#" | grep -c "error" || echo "0 errors"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "editingStock\[product.id\]" src/pages/supplier/Products.tsx` returns at least 4 (state read in conditional, value, onChange, onKeyDown access)
    - `grep -c "handleStockSave(product)" src/pages/supplier/Products.tsx` returns at least 2 (onBlur + Enter)
    - `grep -c "handleStockCancel(product)" src/pages/supplier/Products.tsx` returns exactly 1 (Escape)
    - `grep -c "handleToggleSellWithoutStock(product)" src/pages/supplier/Products.tsx` returns exactly 1
    - `grep -c "Vender sem estoque" src/pages/supplier/Products.tsx` returns exactly 2 (label + aria-label)
    - `grep -c "em estoque" src/pages/supplier/Products.tsx` returns at least 1
    - `grep -c "product.sell_without_stock" src/pages/supplier/Products.tsx` returns at least 4 (toggle bg conditional, transform conditional, aria-pressed, handler call's inner !product.sell_without_stock)
    - `grep -c "autoFocus" src/pages/supplier/Products.tsx` returns at least 1 (on the inline input)
    - `npx tsc --noEmit` reports 0 errors in src/pages/supplier/Products.tsx
  </acceptance_criteria>
  <done>Each product card renders the inline stock edit (button↔input) and the sell_without_stock toggle. TypeScript compiles. Existing card structure (image, badge, name, PriceTag, button row) is preserved.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser→api | Stock and toggle PATCH requests cross here; auth and ownership are enforced server-side (Plan 02 routes) |
| user→browser | Direct keyboard input (numeric stock value) is consumed by parseFloat — must guard against NaN locally |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-product-stock-zones-ux-12 | Tampering | handleStockSave parseFloat | mitigate | `isNaN(newQty) \|\| newQty < 0` short-circuits with toast and clears edit state — no API call made on bad input |
| T-product-stock-zones-ux-13 | Information Disclosure | Optimistic UI | accept | Optimistic state changes display only the supplier's own products; no cross-tenant exposure possible (all data already in component state, owned by current user) |
| T-product-stock-zones-ux-14 | Denial of Service | Rapid toggle clicks | accept | Each toggle fires one PATCH; even rapid clicking is bounded by network latency. Backend route is O(1) update. No mitigation required for solo-developer marketplace scale |
| T-product-stock-zones-ux-15 | Repudiation | Stock change attribution | accept | Backend writes `updated_at`; per CONTEXT.md non-goals, full audit log is deferred |
</threat_model>

<verification>
- TypeScript compiles
- Manual smoke (post-execution): tap stock value → input appears → edit + Enter → toast 'Estoque atualizado' → list updates; tap toggle → optimistic flip; reload page → values persist
- Buyer-side regression: a product with stock=0 and sell_without_stock=false should NOT appear in buyer search
</verification>

<success_criteria>
- All 6 must_haves truths above are observable
- All grep-based acceptance criteria pass
- TypeScript compiles
</success_criteria>

<output>
After completion, create `.planning/phases/product-stock-zones-ux/product-stock-zones-ux-03-SUMMARY.md` describing:
- The new state slots and handlers
- The new JSX blocks and their location relative to PriceTag
- Manual smoke results
- Any deviations from this plan
</output>
