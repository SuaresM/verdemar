# Phase: product-stock-zones-ux — Pattern Map

**Mapped:** 2026-05-08
**Files analyzed:** 5
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/pages/supplier/ProductForm.tsx` | form-component | request-response | `src/pages/supplier/ProductForm.tsx` (self) | exact |
| `src/pages/supplier/Products.tsx` | list-component | CRUD | `src/pages/supplier/Products.tsx` (self) | exact |
| `src/pages/supplier/StoreSettings.tsx` | form-component | CRUD + event-driven | `src/pages/supplier/StoreSettings.tsx` (self) | exact |
| `api/[...route].ts` | API route handler | request-response | `api/[...route].ts` (self) | exact |
| `supabase/migrations/*.sql` | migration | batch | `supabase/migrations/20260505000000_delivery_zones.sql` | exact |

---

## Pattern Assignments

### `src/pages/supplier/ProductForm.tsx` (form-component, request-response)

**Task:** D-01 — add `box_weight_kg` when `sale_unit === 'kg'`; remove it from `sale_unit === 'box'`; update Zod schema.

**Current Zod schema** (lines 27–41) — all fields optional, no cross-field validation:
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

**New Zod schema pattern — use `.superRefine` for cross-field required validation:**
```typescript
const schema = z.object({
  // ... same base fields ...
  box_weight_kg: z.string().optional(),
  // ...
}).superRefine((data, ctx) => {
  if (data.sale_unit === 'kg' && !data.box_weight_kg?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Peso da caixa obrigatório', path: ['box_weight_kg'] })
  }
  if (data.sale_unit === 'box' && !data.box_price?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Preço obrigatório', path: ['box_price'] })
  }
  // add other cross-field rules here
})
```

**Conditional field rendering pattern** (lines 268–311) — `saleUnit` watched via `watch('sale_unit')` and used as JSX condition:
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
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </div>
    </div>
    ...
  </div>
)}

{saleUnit === 'kg' && (
  <div>
    <label className="block text-xs font-semibold text-gray-600 mb-1">Preço por kg (R$) *</label>
    <input {...register('price_per_kg')} type="number" step="0.01" placeholder="Ex: 3.50"
      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
  </div>
)}
```

**New `kg` block to add** — follows the same pattern as the `box` block above:
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

**Error display pattern** (lines 227, 271-278) — inline `<p className="text-danger text-xs mt-1">`:
```tsx
{errors.name && <p className="text-danger text-xs mt-1">{errors.name.message}</p>}
```

**`onSubmit` data normalization** (lines 155–164) — sale_unit branching sets null for unused fields:
```typescript
if (data.sale_unit === 'box') {
  productData.box_weight_kg = parseNum(data.box_weight_kg)
  productData.box_unit_quantity = parseInt2(data.box_unit_quantity)
  productData.box_price = parseNum(data.box_price)
} else if (data.sale_unit === 'kg') {
  productData.price_per_kg = parseNum(data.price_per_kg)
  // ADD: productData.box_weight_kg = parseNum(data.box_weight_kg)
} else if (data.sale_unit === 'unit') {
  productData.price_per_unit = parseNum(data.price_per_unit)
  productData.unit_description = data.unit_description || null
}
```

**Toggle (Controller) pattern** (lines 322–359) — used for `is_available` and `is_featured`, reuse for `sell_without_stock` if added to this form in future:
```tsx
<Controller
  name="is_available"
  control={control}
  render={({ field }) => (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-semibold text-gray-800">Disponivel</p>
        <p className="text-xs text-gray-500">Produto visivel aos compradores</p>
      </div>
      <button
        type="button"
        onClick={() => field.onChange(!field.value)}
        className={`relative w-12 h-6 rounded-full transition-colors ${field.value ? 'bg-primary' : 'bg-gray-300'}`}
      >
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${field.value ? 'translate-x-7' : 'translate-x-1'}`} />
      </button>
    </div>
  )}
/>
```

---

### `src/pages/supplier/Products.tsx` (list-component, CRUD)

**Task:** D-02 — inline stock edit (`stock_quantity`) + `sell_without_stock` toggle per product card.

**Existing optimistic toggle pattern** (lines 47–57) — `handleToggleAvailability` as the template for all per-product mutations:
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

**Inline edit pattern** — new state needed per product (use a map keyed by product ID):
```typescript
// Add to component state
const [editingStock, setEditingStock] = useState<Record<string, string>>({})
const [stockSaving, setStockSaving] = useState<Record<string, boolean>>({})

const handleStockSave = async (product: Product) => {
  const rawVal = editingStock[product.id]
  if (rawVal === undefined) return
  const newQty = parseFloat(rawVal)
  if (isNaN(newQty)) { setEditingStock((p) => { const n = { ...p }; delete n[product.id]; return n }); return }
  setStockSaving((p) => ({ ...p, [product.id]: true }))
  try {
    await apiClient.patch(`/products/${product.id}/stock`, { stock_quantity: newQty })
    setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, stock_quantity: newQty } : p))
    toast.success('Estoque atualizado')
  } catch {
    toast.error('Erro ao atualizar estoque')
  } finally {
    setStockSaving((p) => { const n = { ...p }; delete n[product.id]; return n })
    setEditingStock((p) => { const n = { ...p }; delete n[product.id]; return n })
  }
}
```

**Product card JSX anchor** (lines 131–170) — new controls go inside `<div className="p-2">` after `<PriceTag>`:
```tsx
<div key={product.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden ${!product.is_available ? 'opacity-60' : ''}`}>
  ...
  <div className="p-2">
    <p className="font-bold text-gray-900 text-xs line-clamp-2 mb-1">{product.name}</p>
    <PriceTag product={product} size="sm" />
    {/* ADD: inline stock edit here */}
    {/* ADD: sell_without_stock toggle here */}
    <div className="flex gap-1 mt-2">
      ...edit/copy/delete buttons...
    </div>
  </div>
</div>
```

**Inline stock input pattern** — tap-to-edit using conditional render:
```tsx
{editingStock[product.id] !== undefined ? (
  <input
    type="number"
    step="0.001"
    autoFocus
    value={editingStock[product.id]}
    onChange={(e) => setEditingStock((p) => ({ ...p, [product.id]: e.target.value }))}
    onBlur={() => handleStockSave(product)}
    onKeyDown={(e) => {
      if (e.key === 'Enter') handleStockSave(product)
      if (e.key === 'Escape') setEditingStock((p) => { const n = { ...p }; delete n[product.id]; return n })
    }}
    className="w-full px-2 py-1 border border-primary rounded-lg text-xs text-center"
  />
) : (
  <button
    type="button"
    onClick={() => setEditingStock((p) => ({ ...p, [product.id]: String(product.stock_quantity ?? 0) }))}
    className="text-xs text-gray-500 underline-offset-2 hover:underline"
  >
    {stockSaving[product.id]
      ? <div className="w-3 h-3 border border-gray-400 border-t-primary rounded-full animate-spin inline-block" />
      : `${product.stock_quantity ?? 0} em estoque`}
  </button>
)}
```

**`sell_without_stock` toggle pattern** — mirrors `handleToggleAvailability` but calls new PATCH endpoint:
```typescript
const handleToggleSellWithoutStock = async (product: Product) => {
  try {
    await apiClient.patch(`/products/${product.id}/sell-without-stock`, {
      sell_without_stock: !product.sell_without_stock,
    })
    setProducts((prev) =>
      prev.map((p) => p.id === product.id ? { ...p, sell_without_stock: !p.sell_without_stock } : p)
    )
    toast.success(product.sell_without_stock ? 'Venda sem estoque desativada' : 'Venda sem estoque ativada')
  } catch {
    toast.error('Erro ao atualizar')
  }
}
```

**Toggle button JSX** — reuse the `bg-primary/bg-gray-300` pill pattern from ProductForm (lines 334–337):
```tsx
<div className="flex items-center justify-between mt-2">
  <p className="text-xs text-gray-500">Vender sem estoque</p>
  <button
    type="button"
    onClick={() => handleToggleSellWithoutStock(product)}
    className={`relative w-9 h-5 rounded-full transition-colors ${product.sell_without_stock ? 'bg-primary' : 'bg-gray-300'}`}
  >
    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${product.sell_without_stock ? 'translate-x-4' : 'translate-x-0.5'}`} />
  </button>
</div>
```

**Import additions needed** — `apiClient` is currently NOT imported in Products.tsx; add:
```typescript
import { apiClient } from '../../lib/apiClient'
```

---

### `src/pages/supplier/StoreSettings.tsx` (form-component, CRUD + event-driven)

**Task:** D-03 — zone modal bug fixes; D-04 — RA accordion collapse/expand.

#### D-03 — Zone modal bug fixes

**Current `handleSaveZone`** (lines 107–130) — missing `setEditingZone(null)` on success; cancel button (line 485) only calls `setShowZoneModal(false)`, not `setEditingZone(null)`:
```typescript
const handleSaveZone = async () => {
  if (!supplier) return          // ← silent bail-out, no toast
  // ...validation...
  setZoneSaving(true)
  try {
    if (editingZone) {
      await updateDeliveryZone(editingZone.id, zoneForm)
      setZones(...)
      toast.success('Zona atualizada!')
    } else {
      const created = await createDeliveryZone(zoneForm)
      setZones(...)
      toast.success('Zona adicionada!')
    }
    setShowZoneModal(false)       // ← editingZone NOT cleared here
  } catch {
    toast.error('Erro ao salvar zona')
    // ← setShowZoneModal(false) NOT called on error
  } finally {
    setZoneSaving(false)
  }
}
```

**Fixed pattern to apply:**
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
    setEditingZone(null)          // ← ADD
  } catch {
    toast.error('Erro ao salvar zona')
    setShowZoneModal(false)       // ← ADD: always close on error too
    setEditingZone(null)          // ← ADD
  } finally {
    setZoneSaving(false)
  }
}
```

**Cancel button fix** (line 485) — add `setEditingZone(null)`:
```tsx
// Before:
<button type="button" onClick={() => setShowZoneModal(false)} className="w-full py-3 text-gray-500 font-semibold">
  Cancelar
</button>

// After:
<button type="button" onClick={() => { setShowZoneModal(false); setEditingZone(null) }} className="w-full py-3 text-gray-500 font-semibold">
  Cancelar
</button>
```

**Background click fix** (line 414) — same pattern:
```tsx
// Before:
<div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setShowZoneModal(false)}>

// After:
<div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => { setShowZoneModal(false); setEditingZone(null) }}>
```

#### D-04 — RA accordion

**New state** — add alongside `showZoneModal` (line 61):
```typescript
const [showRaList, setShowRaList] = useState(false)
```

**Configured count** — add after `zones` state (line 59), or derive inline in JSX:
```typescript
const configuredCount = zones.filter((z) => DF_RAS.includes(z.city)).length
```

**Current section header** (lines 311–312):
```tsx
<div className="flex items-center justify-between">
  <p className="font-bold text-gray-700">Regiões de Entrega — DF</p>
  <button type="button" onClick={() => openAddZone()} ...>
```

**New accordion header pattern** — replace the `<p>` with a clickable row; keep the "Outra cidade" button unchanged:
```tsx
<div className="flex items-center justify-between">
  <button
    type="button"
    onClick={() => setShowRaList((v) => !v)}
    className="flex items-center gap-2 text-left"
  >
    <p className="font-bold text-gray-700">Regiões de Entrega — DF</p>
    <span className="text-xs text-gray-400 font-normal">{configuredCount}/{DF_RAS.length} configuradas</span>
    <ChevronDown
      size={16}
      className={`text-gray-400 transition-transform ${showRaList ? 'rotate-180' : ''}`}
    />
  </button>
  <button type="button" onClick={() => openAddZone()} className="flex items-center gap-1 text-sm text-primary font-semibold">
    <Plus size={16} />
    Outra cidade
  </button>
</div>
```

**Collapsible list** — wrap the existing `{zonesLoading ? ... : <div className="space-y-2">...</div>}` block:
```tsx
{showRaList && (
  zonesLoading ? (
    <p className="text-sm text-gray-400 text-center py-2">Carregando...</p>
  ) : (
    <div className="space-y-2">
      {DF_RAS.map((ra) => { ... })}
    </div>
  )
)}
```

**Import addition** — `ChevronDown` from lucide-react (line 5 currently imports `Camera, MessageCircle, LogOut, Plus, Pencil, Trash2, Lock`):
```typescript
import { Camera, MessageCircle, LogOut, Plus, Pencil, Trash2, Lock, ChevronDown } from 'lucide-react'
```

---

### `api/[...route].ts` (API route handler, request-response)

**Task:** D-02 — add `PATCH /products/:id/stock` and `PATCH /products/:id/sell-without-stock`; D-03 — fix PUT handler to detect 0-row update.

**Existing PATCH pattern with `requireAuth` + ownership check** (lines 65–76):
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

**Ownership-check pattern** (lines 22–27) — compare body field to `userId`; for products use `.eq('supplier_id', userId)`:
```typescript
app.post('/orders', requireAuth, async (c) => {
  const userId = c.get('userId')
  // ...
  if (order.buyer_id !== userId) return c.json({ error: 'Forbidden' }, 403)
```

**New PATCH /products/:id/stock** — model exactly after orders PATCH, add supplier ownership via `.eq('supplier_id', userId)`:
```typescript
app.patch('/products/:id/stock', requireAuth, async (c) => {
  const userId = c.get('userId')
  const productId = c.req.param('id')
  const { stock_quantity } = await c.req.json<{ stock_quantity: number }>()

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
```

**New PATCH /products/:id/sell-without-stock** — same structure:
```typescript
app.patch('/products/:id/sell-without-stock', requireAuth, async (c) => {
  const userId = c.get('userId')
  const productId = c.req.param('id')
  const { sell_without_stock } = await c.req.json<{ sell_without_stock: boolean }>()

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

**Current PUT delivery-zones handler** (lines 158–177) — does NOT check `count`; silent 0-row update:
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

  return c.json({ ok: true })    // ← returns 200 even when 0 rows updated
})
```

**Fixed PUT handler — add count check:**
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
  if (!count || count === 0) return c.json({ error: 'Zona não encontrada ou sem permissão' }, 400)

  return c.json({ ok: true })
})
```

---

### `supabase/migrations/*.sql` (migration, batch)

**Task:** D-02 — add `sell_without_stock boolean NOT NULL DEFAULT false` to `products`.

**Existing migration as template** (`supabase/migrations/20260505000000_delivery_zones.sql`) — uses `CREATE TABLE IF NOT EXISTS`, RLS policies, and REVOKE/GRANT for RPCs.

**New migration file name:** `supabase/migrations/20260508000000_products_sell_without_stock.sql`

**Migration pattern** — `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`:
```sql
-- supabase/migrations/20260508000000_products_sell_without_stock.sql

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sell_without_stock boolean NOT NULL DEFAULT false;
```

No new RLS policies needed: the column is on `products`, which already has `supplier_id`-scoped RLS. The two new PATCH routes use `adminSupabase` (service role) with an explicit `.eq('supplier_id', userId)` ownership check, so RLS does not need to cover the new column separately.

---

## Shared Patterns

### Auth / ownership in API handlers
**Source:** `api/[...route].ts`, lines 22–27 and 65–76
**Apply to:** Both new PATCH routes and the fixed PUT route
```typescript
const userId = c.get('userId')   // injected by requireAuth middleware
// ...
.eq('supplier_id', userId)       // row-level ownership enforced in query
```

### Error handling — Hono response format
**Source:** `api/[...route].ts`, lines 73–75
**Apply to:** All API routes
```typescript
if (error) return c.json({ error: error.message }, 400)
return c.json({ ok: true })
```

### Optimistic state update after mutation
**Source:** `src/pages/supplier/Products.tsx`, lines 48–53
**Apply to:** `handleStockSave` and `handleToggleSellWithoutStock` in Products.tsx
```typescript
setProducts((prev) =>
  prev.map((p) => p.id === product.id ? { ...p, [field]: newValue } : p)
)
```

### Spinner while saving
**Source:** `src/pages/supplier/ProductForm.tsx`, lines 364–370 and `src/pages/supplier/StoreSettings.tsx`, lines 480–483
**Apply to:** Inline stock save spinner and zone save button
```tsx
{saving ? (
  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
) : 'Salvar'}
```
Smaller variant for inline controls: `w-3 h-3 border border-gray-400 border-t-primary rounded-full animate-spin`

### Toast notifications
**Source:** All three TSX files; imports `toast` from `'sonner'`
**Apply to:** All new async handlers
```typescript
toast.success('...')   // on success
toast.error('...')     // on catch
```

### Modal close — always reset all modal state
**Source:** `src/pages/supplier/StoreSettings.tsx`, zone modal pattern
**Apply to:** All modal close paths (success, cancel, background click)
```typescript
setShowZoneModal(false)
setEditingZone(null)    // must always accompany setShowZoneModal(false)
```

### `apiClient.patch` from frontend
**Source:** `src/lib/apiClient.ts`, line 30; used in `src/services/supabase.ts` lines 234, 240
**Apply to:** `handleStockSave` and `handleToggleSellWithoutStock` in Products.tsx
```typescript
await apiClient.patch(`/products/${product.id}/stock`, { stock_quantity: newQty })
await apiClient.patch(`/products/${product.id}/sell-without-stock`, { sell_without_stock: newVal })
```

---

## Types to update

`src/types/index.ts` — the `Product` interface (lines 50–71) must gain `sell_without_stock`:

**Current:**
```typescript
export interface Product {
  // ...
  stock_quantity?: number
  total_sold: number
  // ...
}
```

**Add:**
```typescript
  sell_without_stock: boolean   // after stock_quantity
```

---

## No Analog Found

None. All five files exist in the codebase and have been read in full.

---

## Metadata

**Analog search scope:** `src/pages/supplier/`, `api/`, `supabase/migrations/`, `src/services/`, `src/lib/`, `src/types/`
**Files scanned:** 7 (ProductForm.tsx, Products.tsx, StoreSettings.tsx, api/[...route].ts, supabase migration, supabase.ts service, apiClient.ts, types/index.ts)
**Pattern extraction date:** 2026-05-08
