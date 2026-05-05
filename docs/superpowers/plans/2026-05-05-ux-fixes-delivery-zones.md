# UX Fixes (Approach B) + Delivery Zones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 critical UX issues (total_sold counter, search debounce, reorder, empty-supplier banner, whatsapp_sent) and add a per-city delivery schedule system with a fixed list of DF+entorno cities.

**Architecture:** Incremental changes to React + Hono + Supabase. New `delivery_zones` table with RLS. Cities stored as a typed constant shared across frontend. Writes go through Hono (existing pattern); reads go directly to Supabase.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Zustand, Supabase JS v2, Hono, Vitest, react-hook-form.

---

## File Map

**New:**
- `src/constants/cities.ts` — typed city list (DF + entorno)
- `src/constants/cities.test.ts` — unit tests for the list
- `src/components/shared/CityCombobox.tsx` — searchable city picker component
- `supabase/migrations/20260505000000_delivery_zones.sql` — migration SQL

**Modified:**
- `src/types/index.ts` — add `DeliveryZone` type
- `api/[...route].ts` — fix total_sold, add whatsapp-sent + delivery zone CRUD routes
- `src/services/supabase.ts` — add delivery zone read/write functions
- `src/pages/buyer/Search.tsx` — debounce auto-search on typing
- `src/pages/buyer/Cart.tsx` — fire whatsapp_sent PATCH + city warning per section
- `src/pages/buyer/OrderHistory.tsx` — reorder button
- `src/pages/supplier/Dashboard.tsx` — banner when supplier has 0 products
- `src/pages/public/Register.tsx` — buyer address_city → CityCombobox
- `src/pages/supplier/StoreSettings.tsx` — delivery zones CRUD section
- `src/pages/buyer/SupplierProfile.tsx` — zones display in "Sobre" tab

---

## Task 1: Cities Constant

**Files:**
- Create: `src/constants/cities.ts`
- Create: `src/constants/cities.test.ts`

- [ ] **Step 1: Create the cities constant file**

```typescript
// src/constants/cities.ts
export interface City {
  city: string
  state: string
}

export const CITIES: City[] = [
  // DF — Regiões Administrativas
  { city: 'Brasília', state: 'DF' },
  { city: 'Gama', state: 'DF' },
  { city: 'Taguatinga', state: 'DF' },
  { city: 'Brazlândia', state: 'DF' },
  { city: 'Sobradinho', state: 'DF' },
  { city: 'Planaltina', state: 'DF' },
  { city: 'Paranoá', state: 'DF' },
  { city: 'Núcleo Bandeirante', state: 'DF' },
  { city: 'Ceilândia', state: 'DF' },
  { city: 'Guará', state: 'DF' },
  { city: 'Cruzeiro', state: 'DF' },
  { city: 'Samambaia', state: 'DF' },
  { city: 'Santa Maria', state: 'DF' },
  { city: 'São Sebastião', state: 'DF' },
  { city: 'Recanto das Emas', state: 'DF' },
  { city: 'Lago Sul', state: 'DF' },
  { city: 'Lago Norte', state: 'DF' },
  { city: 'Riacho Fundo', state: 'DF' },
  { city: 'Riacho Fundo II', state: 'DF' },
  { city: 'Candangolândia', state: 'DF' },
  { city: 'Águas Claras', state: 'DF' },
  { city: 'Sudoeste/Octogonal', state: 'DF' },
  { city: 'Varjão', state: 'DF' },
  { city: 'Park Way', state: 'DF' },
  { city: 'Estrutural', state: 'DF' },
  { city: 'Sobradinho II', state: 'DF' },
  { city: 'Jardim Botânico', state: 'DF' },
  { city: 'Itapoã', state: 'DF' },
  { city: 'Vicente Pires', state: 'DF' },
  { city: 'Fercal', state: 'DF' },
  // Entorno GO
  { city: 'Luziânia', state: 'GO' },
  { city: 'Formosa', state: 'GO' },
  { city: 'Planaltina de Goiás', state: 'GO' },
  { city: 'Cidade Ocidental', state: 'GO' },
  { city: 'Novo Gama', state: 'GO' },
  { city: 'Valparaíso de Goiás', state: 'GO' },
  { city: 'Santo Antônio do Descoberto', state: 'GO' },
  { city: 'Águas Lindas de Goiás', state: 'GO' },
  { city: 'Cristalina', state: 'GO' },
  { city: 'Alexânia', state: 'GO' },
  // Entorno MG
  { city: 'Unaí', state: 'MG' },
]

export function getCityLabel(c: City): string {
  return `${c.city} — ${c.state}`
}
```

- [ ] **Step 2: Write the test file**

```typescript
// src/constants/cities.test.ts
import { describe, it, expect } from 'vitest'
import { CITIES, getCityLabel } from './cities'

describe('CITIES', () => {
  it('has at least 41 entries', () => {
    expect(CITIES.length).toBeGreaterThanOrEqual(41)
  })

  it('every entry has non-empty city and state', () => {
    CITIES.forEach((c) => {
      expect(c.city.length).toBeGreaterThan(0)
      expect(c.state.length).toBeGreaterThan(0)
    })
  })

  it('has no duplicate city names', () => {
    const names = CITIES.map((c) => c.city.toLowerCase())
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('getCityLabel', () => {
  it('formats city with em-dash separator', () => {
    expect(getCityLabel({ city: 'Brasília', state: 'DF' })).toBe('Brasília — DF')
  })
})
```

- [ ] **Step 3: Run the test**

```
npx vitest run src/constants/cities.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/constants/cities.ts src/constants/cities.test.ts
git commit -m "feat: add cities constant for DF and entorno"
```

---

## Task 2: DeliveryZone Type + CityCombobox Component

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/components/shared/CityCombobox.tsx`

- [ ] **Step 1: Add DeliveryZone to types**

Open `src/types/index.ts` and append after the `CartSection` interface:

```typescript
export interface DeliveryZone {
  id: string
  supplier_id: string
  city: string
  state: string
  days: string[]
  hours_start: string
  hours_end: string
  created_at?: string
}
```

- [ ] **Step 2: Create the CityCombobox component**

```typescript
// src/components/shared/CityCombobox.tsx
import { useState, useRef } from 'react'
import { CITIES } from '../../constants/cities'

interface CityComboboxProps {
  value: string
  onChange: (city: string, state: string) => void
  placeholder?: string
  error?: string
}

export function CityCombobox({ value, onChange, placeholder = 'Digite a cidade...', error }: CityComboboxProps) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = query
    ? CITIES.filter((c) => c.city.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : CITIES.slice(0, 8)

  const handleSelect = (city: string, state: string) => {
    setQuery(city)
    onChange(city, state)
    setOpen(false)
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
      />
      {error && <p className="text-danger text-xs mt-1">{error}</p>}
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((c) => (
            <button
              key={c.city}
              type="button"
              onMouseDown={() => handleSelect(c.city, c.state)}
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 font-medium text-gray-800"
            >
              {c.city} <span className="text-gray-400 text-xs">— {c.state}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run type-check to verify no errors**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/components/shared/CityCombobox.tsx
git commit -m "feat: add DeliveryZone type and CityCombobox component"
```

---

## Task 3: Supabase Migration

**Files:**
- Create: `supabase/migrations/20260505000000_delivery_zones.sql`

- [ ] **Step 1: Create the migration file**

```bash
mkdir -p supabase/migrations
```

```sql
-- supabase/migrations/20260505000000_delivery_zones.sql

-- Table
CREATE TABLE IF NOT EXISTS delivery_zones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  city        TEXT NOT NULL,
  state       TEXT NOT NULL,
  days        TEXT[] NOT NULL DEFAULT '{}',
  hours_start TEXT NOT NULL,
  hours_end   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delivery_zones_select_all" ON delivery_zones
  FOR SELECT USING (true);

CREATE POLICY "delivery_zones_insert_own" ON delivery_zones
  FOR INSERT WITH CHECK (supplier_id = auth.uid());

CREATE POLICY "delivery_zones_update_own" ON delivery_zones
  FOR UPDATE USING (supplier_id = auth.uid());

CREATE POLICY "delivery_zones_delete_own" ON delivery_zones
  FOR DELETE USING (supplier_id = auth.uid());

-- Postgres helper functions for atomic counter increments
CREATE OR REPLACE FUNCTION increment_product_sold(p_id uuid, p_amount int)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE products SET total_sold = total_sold + p_amount WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION increment_supplier_sales(p_id uuid, p_amount numeric)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE suppliers SET total_sales = total_sales + p_amount WHERE id = p_id;
$$;
```

- [ ] **Step 2: Run the migration in Supabase**

Open the Supabase dashboard → SQL Editor → paste the contents of the migration file → Run.

Verify: the `delivery_zones` table appears in the Table Editor. The two functions appear under Database → Functions.

- [ ] **Step 3: Commit the migration file**

```bash
git add supabase/migrations/20260505000000_delivery_zones.sql
git commit -m "feat: add delivery_zones table, RLS policies, and increment RPCs"
```

---

## Task 4: Hono API — Fix total_sold + Add whatsapp-sent + Delivery Zone CRUD

**Files:**
- Modify: `api/[...route].ts`

- [ ] **Step 1: Fix POST /orders to increment counters**

In `api/[...route].ts`, find the `app.post('/orders', ...)` handler. After the successful `order_items` insert and before `sendPush`, add the counter increments:

```typescript
// After: const { error: itemsError } = await adminSupabase.from('order_items').insert(orderItems)
// if (itemsError) return c.json({ error: itemsError.message }, 400)
// ADD THIS BLOCK:

  // Increment total_sold per product (atomic via Postgres function)
  const quantityByProduct: Record<string, number> = {}
  for (const item of items) {
    const pid = item.product_id as string
    quantityByProduct[pid] = (quantityByProduct[pid] || 0) + (item.quantity as number)
  }
  await Promise.all(
    Object.entries(quantityByProduct).map(([pid, qty]) =>
      adminSupabase.rpc('increment_product_sold', { p_id: pid, p_amount: qty })
    )
  )

  // Increment supplier total_sales
  await adminSupabase.rpc('increment_supplier_sales', {
    p_id: order.supplier_id as string,
    p_amount: orderData.total_value as number,
  })
```

The complete updated handler looks like this (replace the entire `app.post('/orders', ...)` block):

```typescript
app.post('/orders', requireAuth, async (c) => {
  const userId = c.get('userId')
  const { order, items } = await c.req.json<{ order: Record<string, unknown>; items: Record<string, unknown>[] }>()

  if (order.buyer_id !== userId) return c.json({ error: 'Forbidden' }, 403)

  const { data: orderData, error: orderError } = await adminSupabase
    .from('orders')
    .insert(order)
    .select()
    .single()
  if (orderError) return c.json({ error: orderError.message }, 400)

  const orderItems = items.map((item) => ({ ...item, order_id: orderData.id }))
  const { error: itemsError } = await adminSupabase.from('order_items').insert(orderItems)
  if (itemsError) return c.json({ error: itemsError.message }, 400)

  // Increment total_sold per product (atomic via Postgres function)
  const quantityByProduct: Record<string, number> = {}
  for (const item of items) {
    const pid = item.product_id as string
    quantityByProduct[pid] = (quantityByProduct[pid] || 0) + (item.quantity as number)
  }
  await Promise.all(
    Object.entries(quantityByProduct).map(([pid, qty]) =>
      adminSupabase.rpc('increment_product_sold', { p_id: pid, p_amount: qty })
    )
  )

  // Increment supplier total_sales
  await adminSupabase.rpc('increment_supplier_sales', {
    p_id: order.supplier_id as string,
    p_amount: orderData.total_value as number,
  })

  sendPush(order.supplier_id as string, orderData.id as string).catch(() => {})

  return c.json(orderData, 201)
})
```

- [ ] **Step 2: Add PATCH /orders/:id/whatsapp-sent route**

After the `app.patch('/orders/:id/items', ...)` block, add:

```typescript
app.patch('/orders/:id/whatsapp-sent', requireAuth, async (c) => {
  const orderId = c.req.param('id')

  const { error } = await adminSupabase
    .from('orders')
    .update({ whatsapp_sent: true })
    .eq('id', orderId)
  if (error) return c.json({ error: error.message }, 400)

  return c.json({ ok: true })
})
```

- [ ] **Step 3: Add delivery zone CRUD routes**

After the push subscribe route and before the ADMIN section, add:

```typescript
// ── DELIVERY ZONES ───────────────────────────────────────────────────────────

app.post('/supplier/delivery-zones', requireAuth, async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json<{
    city: string
    state: string
    days: string[]
    hours_start: string
    hours_end: string
  }>()

  const { data, error } = await adminSupabase
    .from('delivery_zones')
    .insert({ ...body, supplier_id: userId })
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 400)

  return c.json(data, 201)
})

app.put('/supplier/delivery-zones/:id', requireAuth, async (c) => {
  const userId = c.get('userId')
  const zoneId = c.req.param('id')
  const body = await c.req.json<{
    city: string
    state: string
    days: string[]
    hours_start: string
    hours_end: string
  }>()

  const { error } = await adminSupabase
    .from('delivery_zones')
    .update(body)
    .eq('id', zoneId)
    .eq('supplier_id', userId)
  if (error) return c.json({ error: error.message }, 400)

  return c.json({ ok: true })
})

app.delete('/supplier/delivery-zones/:id', requireAuth, async (c) => {
  const userId = c.get('userId')
  const zoneId = c.req.param('id')

  const { error } = await adminSupabase
    .from('delivery_zones')
    .delete()
    .eq('id', zoneId)
    .eq('supplier_id', userId)
  if (error) return c.json({ error: error.message }, 400)

  return c.json({ ok: true })
})
```

- [ ] **Step 4: Type-check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add api/[...route].ts
git commit -m "feat: fix total_sold increments, add whatsapp-sent route and delivery zone CRUD"
```

---

## Task 5: Supabase Service Functions — Delivery Zones

**Files:**
- Modify: `src/services/supabase.ts`

- [ ] **Step 1: Add read function**

Open `src/services/supabase.ts`. At the end of the file, add:

```typescript
// ---- DELIVERY ZONES ----

import type { DeliveryZone } from '../types'

export async function getDeliveryZonesBySupplier(supplierId: string): Promise<DeliveryZone[]> {
  const { data, error } = await supabase
    .from('delivery_zones')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('city')
  if (error) return []
  return data
}
```

Note: the `import type { DeliveryZone }` line should be merged into the existing import at the top of the file. Find the line:

```typescript
import type { Profile, Buyer, Supplier, Product, Order, OrderItem } from '../types'
```

And change it to:

```typescript
import type { Profile, Buyer, Supplier, Product, Order, OrderItem, DeliveryZone } from '../types'
```

Then add only the function body at the end of the file (no separate import needed).

- [ ] **Step 2: Add write functions (via apiClient)**

```typescript
export async function createDeliveryZone(
  zone: Omit<DeliveryZone, 'id' | 'created_at'>
): Promise<DeliveryZone> {
  return apiClient.post<DeliveryZone>('/supplier/delivery-zones', zone)
}

export async function updateDeliveryZone(
  id: string,
  zone: Pick<DeliveryZone, 'city' | 'state' | 'days' | 'hours_start' | 'hours_end'>
): Promise<void> {
  await apiClient.put(`/supplier/delivery-zones/${id}`, zone)
}

export async function deleteDeliveryZone(id: string): Promise<void> {
  await apiClient.delete(`/supplier/delivery-zones/${id}`)
}
```

The `apiClient` already has a `.put()` method? Check `src/lib/apiClient.ts` — it currently only has `get`, `post`, `patch`, `delete`. Add `put`:

Open `src/lib/apiClient.ts` and add to the `apiClient` object:

```typescript
put: <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
```

- [ ] **Step 3: Type-check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/services/supabase.ts src/lib/apiClient.ts
git commit -m "feat: add delivery zone service functions and apiClient.put"
```

---

## Task 6: Fix Search.tsx — Debounce Auto-Search

**Files:**
- Modify: `src/pages/buyer/Search.tsx`

- [ ] **Step 1: Add debounce ref and update the onChange handler**

Open `src/pages/buyer/Search.tsx`. Add `useRef` to the imports (it's already imported). Add a `debounceRef` near the other refs:

```typescript
const debounceRef = useRef<ReturnType<typeof setTimeout>>()
```

Replace the current `<input>` onChange in the search header from:

```typescript
onChange={(e) => setQuery(e.target.value)}
```

To:

```typescript
onChange={(e) => {
  const q = e.target.value
  setQuery(q)
  if (!q.trim() && !category) return
  clearTimeout(debounceRef.current)
  debounceRef.current = setTimeout(() => handleSearch(q), 400)
}}
```

- [ ] **Step 2: Manual test**

Run the dev server (`npm run dev`). Log in as a buyer. Go to Home and click a category (e.g., "Frutas"). Verify:
- The search page opens and immediately shows results for the category — no "Digite algo" message
- Type "banana" in the search field — results appear automatically after ~400ms without pressing Enter
- Pressing Enter still works

- [ ] **Step 3: Commit**

```bash
git add src/pages/buyer/Search.tsx
git commit -m "fix: add debounce auto-search in Search page"
```

---

## Task 7: Fix Cart.tsx — whatsapp_sent + City Warning

**Files:**
- Modify: `src/pages/buyer/Cart.tsx`

- [ ] **Step 1: Import new functions and types**

At the top of `src/pages/buyer/Cart.tsx`, add to the imports:

```typescript
import { getDeliveryZonesBySupplier } from '../../services/supabase'
import type { DeliveryZone } from '../../types'
```

- [ ] **Step 2: Add state for supplier zones**

Inside the `Cart` component, after the existing state declarations, add:

```typescript
const [supplierZones, setSupplierZones] = useState<Record<string, DeliveryZone[]>>({})
```

- [ ] **Step 3: Load zones when sections change**

Add this `useEffect` after the existing state declarations:

```typescript
useEffect(() => {
  if (sections.length === 0) return
  Promise.all(
    sections.map((s) =>
      getDeliveryZonesBySupplier(s.supplier.id).then((zones) => ({ id: s.supplier.id, zones }))
    )
  ).then((results) => {
    const map: Record<string, DeliveryZone[]> = {}
    results.forEach(({ id, zones }) => { map[id] = zones })
    setSupplierZones(map)
  })
}, [sections])
```

- [ ] **Step 4: Add helper function (above the Cart component)**

```typescript
function hasCityMismatch(
  supplierId: string,
  buyerCity: string | undefined,
  supplierZones: Record<string, DeliveryZone[]>
): boolean {
  if (!buyerCity) return false
  const zones = supplierZones[supplierId]
  if (!zones || zones.length === 0) return false
  return !zones.some((z) => z.city === buyerCity)
}
```

- [ ] **Step 5: Add city warning in section render**

In the `isExpanded` block, find the `{/* Min order status */}` comment and add the city warning just before it:

```typescript
{/* City delivery warning */}
{hasCityMismatch(section.supplier.id, buyer?.address_city, supplierZones) && (
  <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl">
    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-amber-600" />
    <p className="text-xs text-amber-700 font-semibold">
      Este fornecedor pode não entregar em {buyer?.address_city}. Confirme antes de finalizar.
    </p>
  </div>
)}
```

`AlertTriangle` is already imported in Cart.tsx.

- [ ] **Step 6: Patch whatsapp_sent when buyer taps the WhatsApp button**

Find the success screen JSX. The `<a>` tag that opens WhatsApp currently has:

```typescript
onClick={() => setCheckoutSuccess(null)}
```

Change it to:

```typescript
onClick={() => {
  setCheckoutSuccess(null)
  // Fire-and-forget: mark order as whatsapp_sent
  if (checkoutSuccess) {
    apiClient.patch(`/orders/${checkoutSuccess.orderId}/whatsapp-sent`, {}).catch(() => {})
  }
}}
```

For this to work, `checkoutSuccess` state needs to include `orderId`. Update the state type and where it's set:

Find:
```typescript
const [checkoutSuccess, setCheckoutSuccess] = useState<{ whatsappUrl: string; supplierName: string } | null>(null)
```

Change to:
```typescript
const [checkoutSuccess, setCheckoutSuccess] = useState<{ whatsappUrl: string; supplierName: string; orderId: string } | null>(null)
```

Find where `setCheckoutSuccess` is called (inside `handleCheckout`):
```typescript
setCheckoutSuccess({ whatsappUrl, supplierName: checkoutSection.supplier.store_name })
```

Change to:
```typescript
setCheckoutSuccess({ whatsappUrl, supplierName: checkoutSection.supplier.store_name, orderId: order.id })
```

Also import `apiClient` at the top of Cart.tsx:
```typescript
import { apiClient } from '../../lib/apiClient'
```

- [ ] **Step 7: Type-check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Manual test**

Run the dev server. Add items from two different suppliers to the cart. If one supplier has delivery zones that don't include the buyer's city, the amber warning should appear. Complete a checkout and tap the WhatsApp button — verify `whatsapp_sent` is `true` in the Supabase dashboard.

- [ ] **Step 9: Commit**

```bash
git add src/pages/buyer/Cart.tsx
git commit -m "fix: track whatsapp_sent and show city delivery warning in Cart"
```

---

## Task 8: Fix OrderHistory.tsx — Reorder Button

**Files:**
- Modify: `src/pages/buyer/OrderHistory.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/pages/buyer/OrderHistory.tsx`, add:

```typescript
import { useNavigate } from 'react-router-dom'
import { RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { getProductsBySupplier } from '../../services/supabase'
import { useCartStore } from '../../stores/cartStore'
```

- [ ] **Step 2: Add navigate, cartStore, and reorder handler inside the component**

Add after the existing state declarations:

```typescript
const navigate = useNavigate()
const addItem = useCartStore((s) => s.addItem)
const [reordering, setReordering] = useState<string | null>(null)
```

Add the handler function:

```typescript
const handleReorder = async (order: Order) => {
  if (!order.supplier || !order.items) return
  setReordering(order.id)
  try {
    const currentProducts = await getProductsBySupplier(order.supplier.id)
    const available = currentProducts.filter((p) => p.is_available)
    const unavailableNames: string[] = []

    order.items.forEach((item) => {
      const product = available.find((p) => p.id === item.product_id)
      if (product) {
        addItem(product, item.quantity, order.supplier!)
      } else {
        unavailableNames.push(item.product_name)
      }
    })

    if (unavailableNames.length > 0) {
      toast.warning(
        `Alguns produtos não estão mais disponíveis: ${unavailableNames.join(', ')}`
      )
    }

    if (unavailableNames.length < (order.items?.length ?? 0)) {
      navigate('/cart')
    }
  } catch {
    toast.error('Erro ao repetir pedido')
  } finally {
    setReordering(null)
  }
}
```

- [ ] **Step 3: Add the reorder button in the expanded order card**

Find the expanded order section (`{isExpanded && order.items && (`). After the `{order.notes && ...}` block and before the closing `</div>`, add:

```typescript
<button
  onClick={() => handleReorder(order)}
  disabled={reordering === order.id}
  className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 disabled:opacity-50"
>
  {reordering === order.id ? (
    <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
  ) : (
    <>
      <RotateCcw size={14} />
      Repetir pedido
    </>
  )}
</button>
```

- [ ] **Step 4: Type-check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual test**

Log in as a buyer with past orders. Expand any order and tap "Repetir pedido". Verify the cart is populated with the same items and the app navigates to `/cart`. If a product was removed, a warning toast should appear.

- [ ] **Step 6: Commit**

```bash
git add src/pages/buyer/OrderHistory.tsx
git commit -m "feat: add reorder button in order history"
```

---

## Task 9: Fix Dashboard.tsx — Empty Products Banner

**Files:**
- Modify: `src/pages/supplier/Dashboard.tsx`

- [ ] **Step 1: Add import and state**

At the top of `src/pages/supplier/Dashboard.tsx`, add to imports:

```typescript
import { getProductsBySupplier } from '../../services/supabase'
```

Inside the `Dashboard` component, add state:

```typescript
const [productCount, setProductCount] = useState<number | null>(null)
```

- [ ] **Step 2: Load product count alongside dashboard data**

Update the existing `useEffect` to also load products:

```typescript
useEffect(() => {
  if (!supplier) return
  Promise.all([
    getSupplierDashboard(supplier.id),
    getProductsBySupplier(supplier.id),
  ])
    .then(([dashData, products]) => {
      setData(dashData)
      setProductCount(products.length)
    })
    .catch((err) => console.error('Erro ao carregar dashboard:', err))
    .finally(() => setLoading(false))
  subscribeToPush(supplier.id).catch(() => {})
}, [supplier])
```

- [ ] **Step 3: Add the banner in the JSX**

After the `{/* Header */}` block (after the gradient welcome banner div), add the empty products banner. Find the closing `</div>` of the header section and after it, before `<div className="px-4 py-4 space-y-4">`, insert:

```typescript
{productCount === 0 && (
  <div className="mx-4 mt-4 bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
    <span className="text-2xl">⚠️</span>
    <div className="flex-1">
      <p className="font-bold text-amber-800 text-sm">Catálogo vazio</p>
      <p className="text-xs text-amber-700 mt-0.5">Compradores não encontrarão seus produtos enquanto o catálogo estiver vazio.</p>
      <button
        onClick={() => navigate('/supplier/products/new')}
        className="mt-2 text-xs font-bold text-primary underline"
      >
        Adicionar primeiro produto →
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 4: Type-check**

```
npx tsc --noEmit
```

- [ ] **Step 5: Manual test**

Log in as a supplier with no products. Verify the amber banner appears below the welcome card. Click the link — it should navigate to the new product form.

- [ ] **Step 6: Commit**

```bash
git add src/pages/supplier/Dashboard.tsx
git commit -m "feat: show empty-products banner on supplier dashboard"
```

---

## Task 10: Register.tsx — Buyer City Combobox

**Files:**
- Modify: `src/pages/public/Register.tsx`

- [ ] **Step 1: Import CityCombobox**

At the top of `src/pages/public/Register.tsx`, add:

```typescript
import { CityCombobox } from '../../components/shared/CityCombobox'
```

- [ ] **Step 2: Replace address_city + address_state fields in the buyer form**

In the buyer form section, find the grid with `address_city` and `address_state` inputs:

```typescript
<div className="grid grid-cols-2 gap-3">
  <InputField label="Cidade" required placeholder="São Paulo" error={buyerForm.formState.errors.address_city?.message} {...buyerForm.register('address_city')} />
  <InputField label="Estado" required placeholder="SP" error={buyerForm.formState.errors.address_state?.message} {...buyerForm.register('address_state')} />
</div>
```

Replace with:

```typescript
<div>
  <label className="block text-sm font-semibold text-gray-700 mb-1">
    Cidade <span className="text-danger">*</span>
  </label>
  <CityCombobox
    value={buyerForm.watch('address_city') || ''}
    onChange={(city, state) => {
      buyerForm.setValue('address_city', city, { shouldValidate: true })
      buyerForm.setValue('address_state', state, { shouldValidate: true })
    }}
    error={buyerForm.formState.errors.address_city?.message}
  />
</div>
```

- [ ] **Step 3: Update buyerSchema — relax address_state validation**

Since `address_state` is now auto-filled and the user doesn't type it, the 2-char minimum is still fine but the field is hidden. No schema change needed — `setValue` sets it programmatically.

- [ ] **Step 4: Type-check**

```
npx tsc --noEmit
```

- [ ] **Step 5: Manual test**

Go to `/register`, choose "Sou Comprador", and find the city field. Type "Tag" — verify "Taguatinga — DF" appears in the dropdown. Select it — verify the field shows "Taguatinga" and the state is set correctly (visible if you console.log `buyerForm.getValues()`). Submit the form — verify the buyer is created with the correct city.

- [ ] **Step 6: Commit**

```bash
git add src/pages/public/Register.tsx
git commit -m "feat: replace buyer city text input with CityCombobox in registration"
```

---

## Task 11: StoreSettings.tsx — Delivery Zones UI

**Files:**
- Modify: `src/pages/supplier/StoreSettings.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/pages/supplier/StoreSettings.tsx`, add:

```typescript
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { CityCombobox } from '../../components/shared/CityCombobox'
import { getDeliveryZonesBySupplier, createDeliveryZone, updateDeliveryZone, deleteDeliveryZone } from '../../services/supabase'
import type { DeliveryZone } from '../../types'
import { getDeliveryDaysLabel } from '../../utils'
```

Note: `getDeliveryDaysLabel` may already be imported — check and add only what's missing.

- [ ] **Step 2: Add zone state inside the StoreSettings component**

After the existing state declarations, add:

```typescript
const [zones, setZones] = useState<DeliveryZone[]>([])
const [zonesLoading, setZonesLoading] = useState(true)
const [showZoneModal, setShowZoneModal] = useState(false)
const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null)
const [zoneForm, setZoneForm] = useState({
  city: '',
  state: '',
  days: [] as string[],
  hours_start: '',
  hours_end: '',
})
const [zoneSaving, setZoneSaving] = useState(false)
```

- [ ] **Step 3: Load zones on mount**

Add a `useEffect` after the existing state:

```typescript
useEffect(() => {
  if (!supplier) return
  getDeliveryZonesBySupplier(supplier.id)
    .then(setZones)
    .finally(() => setZonesLoading(false))
}, [supplier])
```

- [ ] **Step 4: Add zone save/delete handlers**

```typescript
const openAddZone = () => {
  setEditingZone(null)
  setZoneForm({ city: '', state: '', days: [], hours_start: '', hours_end: '' })
  setShowZoneModal(true)
}

const openEditZone = (zone: DeliveryZone) => {
  setEditingZone(zone)
  setZoneForm({ city: zone.city, state: zone.state, days: zone.days, hours_start: zone.hours_start, hours_end: zone.hours_end })
  setShowZoneModal(true)
}

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
      const created = await createDeliveryZone({ ...zoneForm, supplier_id: supplier.id })
      setZones((prev) => [...prev, created])
      toast.success('Zona adicionada!')
    }
    setShowZoneModal(false)
  } catch {
    toast.error('Erro ao salvar zona')
  } finally {
    setZoneSaving(false)
  }
}

const handleDeleteZone = async (zoneId: string) => {
  try {
    await deleteDeliveryZone(zoneId)
    setZones((prev) => prev.filter((z) => z.id !== zoneId))
    toast.success('Zona removida!')
  } catch {
    toast.error('Erro ao remover zona')
  }
}

const toggleZoneDay = (day: string) => {
  setZoneForm((f) => ({
    ...f,
    days: f.days.includes(day) ? f.days.filter((d) => d !== day) : [...f.days, day],
  }))
}
```

- [ ] **Step 5: Add zones section to the form JSX**

Find the existing `{/* Delivery */}` section in the form. After that entire section's closing `</div>`, add the new zones section:

```typescript
{/* Delivery Zones */}
<div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
  <div className="flex items-center justify-between">
    <p className="font-bold text-gray-700">Zonas de Entrega por Cidade</p>
    <button
      type="button"
      onClick={openAddZone}
      className="flex items-center gap-1 text-sm text-primary font-semibold"
    >
      <Plus size={16} />
      Adicionar
    </button>
  </div>

  {zonesLoading ? (
    <p className="text-sm text-gray-400 text-center py-2">Carregando...</p>
  ) : zones.length === 0 ? (
    <p className="text-sm text-gray-400 text-center py-2">Nenhuma zona cadastrada</p>
  ) : (
    zones.map((zone) => (
      <div key={zone.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
        <div>
          <p className="font-semibold text-gray-800 text-sm">{zone.city} — {zone.state}</p>
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
    ))
  )}
</div>
```

- [ ] **Step 6: Add zone modal at the bottom of the returned JSX (inside the outer `<div>`)**

Before the final closing `</div>` of the component return:

```typescript
{/* Zone modal */}
{showZoneModal && (
  <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setShowZoneModal(false)}>
    <div className="bg-white rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
      <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
      <h3 className="text-xl font-extrabold text-gray-900 mb-4">
        {editingZone ? 'Editar Zona' : 'Adicionar Cidade'}
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">Cidade *</label>
          <CityCombobox
            value={zoneForm.city}
            onChange={(city, state) => setZoneForm((f) => ({ ...f, city, state }))}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-2">Dias de entrega *</label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day) => (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleZoneDay(day.value)}
                className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
                  zoneForm.days.includes(day.value) ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Início *</label>
            <input
              type="time"
              value={zoneForm.hours_start}
              onChange={(e) => setZoneForm((f) => ({ ...f, hours_start: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Fim *</label>
            <input
              type="time"
              value={zoneForm.hours_end}
              onChange={(e) => setZoneForm((f) => ({ ...f, hours_end: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveZone}
          disabled={zoneSaving}
          className="w-full bg-primary text-white font-bold py-4 rounded-2xl disabled:opacity-60 flex items-center justify-center"
        >
          {zoneSaving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : 'Salvar'}
        </button>
        <button type="button" onClick={() => setShowZoneModal(false)} className="w-full py-3 text-gray-500 font-semibold">
          Cancelar
        </button>
      </div>
    </div>
  </div>
)}
```

Note: `DAYS` is already defined at the top of StoreSettings.tsx — use it directly.

- [ ] **Step 7: Type-check**

```
npx tsc --noEmit
```

- [ ] **Step 8: Manual test**

Log in as a supplier. Go to Configurações da Loja. Scroll to "Zonas de Entrega por Cidade". Tap "Adicionar". Select "Taguatinga", check Seg+Ter, set 06:00–09:00. Save. Verify the zone appears in the list. Edit it. Delete it.

- [ ] **Step 9: Commit**

```bash
git add src/pages/supplier/StoreSettings.tsx
git commit -m "feat: add delivery zones management UI in supplier StoreSettings"
```

---

## Task 12: SupplierProfile.tsx — Delivery Schedule Display

**Files:**
- Modify: `src/pages/buyer/SupplierProfile.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/pages/buyer/SupplierProfile.tsx`, add:

```typescript
import { useAuthStore } from '../../stores/authStore'
import { getDeliveryZonesBySupplier } from '../../services/supabase'
import type { DeliveryZone } from '../../types'
```

- [ ] **Step 2: Add state and load zones**

Inside the `SupplierProfile` component, add:

```typescript
const { buyer } = useAuthStore()
const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([])
```

Update the existing `useEffect` to load zones alongside supplier + products:

```typescript
useEffect(() => {
  if (!id) return
  Promise.all([
    getSupplierById(id),
    getProductsBySupplier(id),
    getDeliveryZonesBySupplier(id),
  ])
    .then(([sup, prods, zones]) => {
      setSupplier(sup)
      setProducts(prods ?? [])
      setDeliveryZones(zones)
    })
    .catch((err) => {
      console.error('Erro ao carregar fornecedor:', err)
    })
    .finally(() => {
      setLoading(false)
    })
}, [id])
```

- [ ] **Step 3: Replace the delivery info in the "about" tab**

In the `tab === 'about'` section, find the existing delivery row:

```typescript
<div className="flex items-center gap-2 text-gray-600">
  <Truck size={14} className="text-primary" />
  <span>Entrega: {getDeliveryDaysLabel(supplier.delivery_days)}</span>
</div>
<div className="flex items-center gap-2 text-gray-600">
  <Clock size={14} className="text-primary" />
  <span>Horário: {supplier.delivery_hours_start} às {supplier.delivery_hours_end}</span>
</div>
```

Replace with a delivery zones section. Add it as a new `<div>` card in the about tab, after the existing "Informações" card:

```typescript
{/* Delivery Zones */}
{deliveryZones.length > 0 ? (
  <div className="bg-white rounded-2xl p-4 shadow-sm">
    <p className="font-bold text-gray-700 mb-3">Zonas de Entrega</p>
    <div className="space-y-2">
      {deliveryZones.map((zone) => {
        const isMyCity = buyer?.address_city === zone.city
        return (
          <div
            key={zone.id}
            className={`flex items-center justify-between p-3 rounded-xl ${
              isMyCity ? 'bg-green-50 border border-green-100' : 'bg-gray-50'
            }`}
          >
            <div>
              <p className={`font-semibold text-sm ${isMyCity ? 'text-green-700' : 'text-gray-800'}`}>
                {zone.city} — {zone.state}
                {isMyCity && <span className="ml-2 text-xs">✓ Sua cidade</span>}
              </p>
              <p className="text-xs text-gray-500">
                {getDeliveryDaysLabel(zone.days)} · {zone.hours_start}–{zone.hours_end}
              </p>
            </div>
            <Truck size={14} className={isMyCity ? 'text-green-500' : 'text-gray-400'} />
          </div>
        )
      })}
    </div>
    {buyer?.address_city && !deliveryZones.some((z) => z.city === buyer.address_city) && (
      <p className="text-xs text-amber-600 mt-3 font-semibold">
        ⚠️ Este fornecedor não lista entrega em {buyer.address_city}. Consulte pelo WhatsApp.
      </p>
    )}
  </div>
) : supplier.delivery_days.length > 0 ? (
  <div className="bg-white rounded-2xl p-4 shadow-sm">
    <p className="font-bold text-gray-700 mb-2">Entrega</p>
    <p className="text-sm text-gray-600">
      {getDeliveryDaysLabel(supplier.delivery_days)} · {supplier.delivery_hours_start}–{supplier.delivery_hours_end}
    </p>
  </div>
) : null}
```

Also update the existing mini-tags in the header area (the `flex flex-wrap gap-3 mt-3` block) to use zones if available. Find the current `supplier.delivery_days.length > 0` tag and update it:

```typescript
{/* Show zones count if available, otherwise global days */}
{deliveryZones.length > 0 ? (
  <div className="flex items-center gap-1 bg-gray-50 rounded-xl px-3 py-1.5">
    <Truck size={13} className="text-primary" />
    <span className="text-xs font-semibold text-gray-700">
      Entrega em {deliveryZones.length} {deliveryZones.length === 1 ? 'cidade' : 'cidades'}
    </span>
  </div>
) : supplier.delivery_days.length > 0 && (
  <div className="flex items-center gap-1 bg-gray-50 rounded-xl px-3 py-1.5">
    <Truck size={13} className="text-primary" />
    <span className="text-xs font-semibold text-gray-700">{getDeliveryDaysLabel(supplier.delivery_days)}</span>
  </div>
)}
```

- [ ] **Step 4: Type-check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual test**

As a supplier, configure two delivery zones (e.g., Taguatinga + Ceilândia). Log in as a buyer whose city is Taguatinga. Open that supplier's profile. In the "Sobre" tab, the Taguatinga zone should be highlighted in green with "✓ Sua cidade". The header should show "Entrega em 2 cidades". As a buyer from Brasília (not in zones), the amber warning appears.

- [ ] **Step 6: Commit**

```bash
git add src/pages/buyer/SupplierProfile.tsx
git commit -m "feat: show per-city delivery schedule in supplier profile"
```

---

## Self-Review Checklist

### Spec Coverage

| Spec Requirement | Task |
|---|---|
| total_sold / total_sales increment | Task 4 |
| Search auto-trigger + debounce | Task 6 |
| Reorder button | Task 8 |
| Supplier empty-products banner | Task 9 |
| whatsapp_sent tracking | Task 7 |
| Cities constant (DF + entorno) | Task 1 |
| delivery_zones table + RLS | Task 3 |
| DeliveryZone type | Task 2 |
| Buyer city combobox in registration | Task 10 |
| Supplier delivery zones CRUD UI | Task 11 |
| Supplier profile — zones display + buyer city highlight | Task 12 |
| Cart — city warning | Task 7 |
| apiClient.put method | Task 5 |
| Hono delivery zone CRUD routes | Task 4 |

All 14 spec requirements are covered.

### Type Consistency

- `DeliveryZone` defined in Task 2, used in Tasks 5, 7, 11, 12 — same interface throughout
- `createDeliveryZone` takes `Omit<DeliveryZone, 'id' | 'created_at'>` and returns `DeliveryZone` — matches Hono route which returns the inserted row
- `updateDeliveryZone` takes `id: string` + `Pick<DeliveryZone, 'city'|'state'|'days'|'hours_start'|'hours_end'>` — matches the zone form state shape
- `CityCombobox` `onChange` signature `(city: string, state: string) => void` — used consistently in Tasks 10 and 11
- `checkoutSuccess` state in Cart.tsx extended with `orderId: string` in Task 7 — used only in that file
