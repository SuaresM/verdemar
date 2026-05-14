# Phase 02: Supplier Order Flow — Pattern Map

**Mapped:** 2026-05-14
**Files analyzed:** 6
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/pages/supplier/Orders.tsx` | page/component | request-response + polling | self (major extension of existing file) | exact |
| `src/components/layout/SupplierNav.tsx` | component | event-driven (prop) | `src/components/layout/BuyerNav.tsx` (same pattern) | exact |
| `src/services/supabase.ts` | service | CRUD / count query | `getSupplierDashboard` (lines 343-381, same file) | exact |
| `api/[...route].ts` | API route | request-response | self (one-line fix at line 97) | exact |
| `src/utils/index.ts` | utility | transform | `formatOrderStatusMessage` (lines 89-106, same file) | exact |
| `src/App.tsx` | layout / provider | polling + prop-threading | `SupplierLayout` (lines 53-68, same file) | exact |

---

## Pattern Assignments

### `src/pages/supplier/Orders.tsx` (page, request-response + polling)

**Analog:** self — existing 443-line file; all patterns are already established inside it.

**Imports pattern** (lines 1-11 of current file):
```tsx
import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Phone, Pencil, Minus, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '../../stores/authStore'
import { getOrdersBySupplier, updateOrderStatus, updateOrderItemsAndTotal } from '../../services/supabase'
import type { Order, OrderItem, OrderStatus } from '../../types'
import { Header } from '../../components/layout/Header'
import { OrderStatusBadge } from '../../components/shared/Badge'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { EmptyState } from '../../components/shared/EmptyState'
import { formatCurrency, formatDate, formatPhone, formatOrderStatusMessage, formatOrderEditMessage } from '../../utils'
```

**New imports to add** (merge into the existing import block):
```tsx
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle, PackageOpen } from 'lucide-react'
// also add getPendingOrderCount if Orders.tsx drives its own initial badge seed
```

**STATUS_TRANSITIONS map** — current (lines 13-21), shows exact shape to update:
```tsx
const STATUS_TRANSITIONS: Record<OrderStatus, { label: string; next: OrderStatus | null }> = {
  pending:     { label: 'Confirmar Pedido', next: 'confirmed' },   // ← change to 'Aceitar'
  confirmed:   { label: 'Iniciar Entrega',  next: 'in_route' },    // ← change to 'Em rota'
  in_route:    { label: 'Marcar Entregue',  next: 'delivered' },   // ← change to 'Entregue'
  in_delivery: { label: 'Marcar Entregue',  next: 'delivered' },   // keep for type safety
  delivered:   { label: 'Entregue',         next: null },
  cancelled:   { label: 'Cancelado',        next: null },
  rejected:    { label: 'Recusado',         next: null },
}
```

**One-shot load pattern** (lines 191-197) — base to convert to polling:
```tsx
useEffect(() => {
  if (!supplier) return
  getOrdersBySupplier(supplier.id)
    .then((data) => setOrders(data))
    .catch(() => toast.error('Erro ao carregar pedidos'))
    .finally(() => setLoading(false))
}, [supplier])
```

**Polling conversion** — wrap with `hasLoaded` ref guard and `setInterval`:
```tsx
const hasLoaded = useRef(false)

useEffect(() => {
  if (!supplier) return
  const load = () => {
    getOrdersBySupplier(supplier.id)
      .then((data) => setOrders(data))
      .catch(() => toast.error('Erro ao carregar pedidos'))
      .finally(() => {
        if (!hasLoaded.current) {
          hasLoaded.current = true
          setLoading(false)
        }
      })
  }
  load()
  const interval = setInterval(load, 15000)
  return () => clearInterval(interval)
}, [supplier])
```

**Per-card loading state pattern** (lines 202-203 and 398-402):
```tsx
// Set per order:
setUpdating((prev) => ({ ...prev, [order.id]: true }))
// Reset in finally:
setUpdating((prev) => ({ ...prev, [order.id]: false }))

// In render:
{isUpdating ? (
  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
) : (
  transition.label
)}
```

**handleUpdateStatus pattern** (lines 199-229) — base for `handleReject`:
```tsx
const handleUpdateStatus = async (order: Order) => {
  const transition = STATUS_TRANSITIONS[order.status]
  if (!transition.next || !supplier) return
  setUpdating((prev) => ({ ...prev, [order.id]: true }))
  try {
    await updateOrderStatus(order.id, transition.next)
    const nextStatus = transition.next
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status: nextStatus } : o))
    )
    if (order.buyer?.contact_phone) {
      const message = formatOrderStatusMessage(nextStatus, order, supplier)
      const phone = order.buyer.contact_phone.replace(/\D/g, '')
      const whatsappUrl = `https://wa.me/${phone}?text=${message}`
      toast.success('Status atualizado!', {
        description: 'Toque abaixo para notificar o comprador via WhatsApp.',
        action: {
          label: '💬 Abrir WhatsApp',
          onClick: () => window.open(whatsappUrl, '_blank'),
        },
        duration: 15000,
      })
    } else {
      toast.success('Status atualizado!')
    }
  } catch {
    toast.error('Erro ao atualizar status')
  } finally {
    setUpdating((prev) => ({ ...prev, [order.id]: false }))
  }
}
```

**handleReject shape** — copy `handleUpdateStatus` but call with `'rejected'` and reason:
```tsx
const handleReject = async (order: Order, reason: string) => {
  if (!supplier) return
  setUpdating((prev) => ({ ...prev, [order.id]: true }))
  try {
    await updateOrderStatus(order.id, 'rejected', reason)
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status: 'rejected', rejection_reason: reason } : o))
    )
    setRejectingOrder(null)
    if (order.buyer?.contact_phone) {
      const message = formatOrderStatusMessage('rejected', order, supplier)
      const phone = order.buyer.contact_phone.replace(/\D/g, '')
      const whatsappUrl = `https://wa.me/${phone}?text=${message}`
      toast.success('Pedido recusado.', {
        description: 'Toque abaixo para notificar o comprador via WhatsApp.',
        action: {
          label: '💬 Abrir WhatsApp',
          onClick: () => window.open(whatsappUrl, '_blank'),
        },
        duration: 15000,
      })
    } else {
      toast.success('Pedido recusado.')
    }
  } catch {
    toast.error('Erro ao recusar pedido')
  } finally {
    setUpdating((prev) => ({ ...prev, [order.id]: false }))
  }
}
```

**Expandable card pattern** (lines 295-425) — key extracts:
```tsx
// State shape:
const [expanded, setExpanded] = useState<Record<string, boolean>>({})

// Toggle:
setExpanded((prev) => ({ ...prev, [order.id]: !prev[order.id] }))

// Card wrapper — add id for deep-link scroll target:
<div key={order.id} id={`order-card-${order.id}`} className="bg-white rounded-2xl shadow-sm overflow-hidden">

// Highlight ring class (add conditionally when highlightedId === order.id):
// ring-2 ring-primary
```

**Deep-link useEffect pattern** — new, source is `useSearchParams` + `scrollIntoView`:
```tsx
const [searchParams] = useSearchParams()
const targetOrderId = searchParams.get('order')
const [highlightedId, setHighlightedId] = useState<string | null>(null)

useEffect(() => {
  if (!targetOrderId || orders.length === 0) return
  const found = orders.find((o) => o.id === targetOrderId)
  if (!found) return
  setExpanded((prev) => ({ ...prev, [targetOrderId]: true }))
  setTimeout(() => {
    document.getElementById(`order-card-${targetOrderId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
    setHighlightedId(targetOrderId)
    setTimeout(() => setHighlightedId(null), 1500)
  }, 200)
}, [orders, targetOrderId])
```

**Bottom sheet (EditOrderModal) pattern** (lines 104-178) — copy verbatim for RejectOrderModal:
```tsx
// Overlay + sheet shell:
<div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={onClose}>
  <div
    className="bg-white rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto"
    onClick={(e) => e.stopPropagation()}
  >
    <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
    {/* content */}
  </div>
</div>

// Save button with spinner (line 162-171):
<button
  onClick={handleSave}
  disabled={saving || /* RejectOrderModal: !selectedReason */}
  className="w-full bg-primary text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
>
  {saving ? (
    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
  ) : (
    'Confirmar Recusa'
  )}
</button>
```

**Two-section render structure** — replace the flat `orders.map()` with:
```tsx
const pendingOrders = orders.filter((o) => o.status === 'pending')
const activeOrders  = orders.filter((o) => o.status === 'confirmed' || o.status === 'in_route')

return (
  <div className="min-h-screen">
    <Header title="Pedidos" />
    <div className="px-4 py-4 space-y-4">

      {/* Section: Pendentes */}
      <div>
        <h2 className="text-sm font-extrabold text-gray-500 uppercase tracking-wide mb-2">
          Pendentes {pendingOrders.length > 0 && `(${pendingOrders.length})`}
        </h2>
        {pendingOrders.length === 0
          ? <EmptyState title="Nenhum pedido pendente" description="Novos pedidos aparecerão aqui" />
          : pendingOrders.map((order) => <OrderCard key={order.id} order={order} />)
        }
      </div>

      <hr className="border-gray-100" />

      {/* Section: Em andamento */}
      <div>
        <h2 className="text-sm font-extrabold text-gray-500 uppercase tracking-wide mb-2">
          Em andamento
        </h2>
        {activeOrders.length === 0
          ? <EmptyState title="Nenhum pedido em andamento" description="" />
          : activeOrders.map((order) => <OrderCard key={order.id} order={order} />)
        }
      </div>

    </div>

    {editingOrder && <EditOrderModal ... />}
    {rejectingOrder && <RejectOrderModal ... />}
  </div>
)
```

**Action buttons per status** — replace the current single `handleCancel` button with:
```tsx
{/* pending: Aceitar + Recusar */}
{order.status === 'pending' && (
  <div className="flex gap-2">
    <button onClick={() => handleUpdateStatus(order)} disabled={isUpdating}
      className="flex-1 bg-primary text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center">
      {isUpdating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Aceitar'}
    </button>
    <button onClick={() => setRejectingOrder(order)}
      className="px-4 py-2.5 bg-red-50 text-danger font-semibold rounded-xl text-sm">
      Recusar
    </button>
  </div>
)}

{/* confirmed: Em rota + Recusar */}
{order.status === 'confirmed' && (
  <div className="flex gap-2">
    <button onClick={() => handleUpdateStatus(order)} disabled={isUpdating}
      className="flex-1 bg-primary text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center">
      {isUpdating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Em rota'}
    </button>
    <button onClick={() => setRejectingOrder(order)}
      className="px-4 py-2.5 bg-red-50 text-danger font-semibold rounded-xl text-sm">
      Recusar
    </button>
  </div>
)}

{/* in_route: Entregue only */}
{order.status === 'in_route' && (
  <button onClick={() => handleUpdateStatus(order)} disabled={isUpdating}
    className="w-full bg-primary text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center">
    {isUpdating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Entregue'}
  </button>
)}
```

---

### `src/components/layout/SupplierNav.tsx` (component, prop-driven)

**Analog:** self — existing 33-line file.

**Current full file** (lines 1-33):
```tsx
import { NavLink } from 'react-router-dom'
import { BarChart2, Package, ClipboardList, Settings } from 'lucide-react'

export function SupplierNav() {
  const navItems = [
    { to: '/supplier/dashboard', icon: BarChart2,     label: 'Painel',   id: 'nav-supplier-dashboard' },
    { to: '/supplier/products',  icon: Package,       label: 'Produtos', id: 'nav-supplier-products' },
    { to: '/supplier/orders',    icon: ClipboardList, label: 'Pedidos',  id: 'nav-supplier-orders' },
    { to: '/supplier/settings',  icon: Settings,      label: 'Loja',     id: 'nav-supplier-settings' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom z-50">
      <div className="flex items-stretch justify-around max-w-lg mx-auto">
        {navItems.map(({ to, icon: Icon, label, id }) => (
          <NavLink key={to} to={to} id={id}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-2 px-4 flex-1 min-h-[56px] transition-colors ${
                isActive ? 'text-primary' : 'text-gray-400'
              }`
            }
          >
            <Icon size={22} strokeWidth={2} />
            <span className="text-[10px] font-semibold mt-0.5">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
```

**Prop addition + badge pattern** — change signature and wrap ClipboardList conditionally:
```tsx
export function SupplierNav({ pendingCount = 0 }: { pendingCount?: number }) {
  // navItems array unchanged

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom z-50">
      <div className="flex items-stretch justify-around max-w-lg mx-auto">
        {navItems.map(({ to, icon: Icon, label, id }) => (
          <NavLink key={to} to={to} id={id}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-2 px-4 flex-1 min-h-[56px] transition-colors ${
                isActive ? 'text-primary' : 'text-gray-400'
              }`
            }
          >
            {to === '/supplier/orders' ? (
              <div className="relative">
                <Icon size={22} strokeWidth={2} />
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-danger text-white flex items-center justify-center text-[9px] font-bold leading-none">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </div>
            ) : (
              <Icon size={22} strokeWidth={2} />
            )}
            <span className="text-[10px] font-semibold mt-0.5">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
```

---

### `src/services/supabase.ts` — new `getPendingOrderCount` + filter on `getOrdersBySupplier`

**Analog 1:** `getSupplierDashboard` (lines 343-381) — the exact pending-count sub-query already exists:
```typescript
// From lines 355-359 of getSupplierDashboard:
supabase
  .from('orders')
  .select('id', { count: 'exact', head: true })
  .eq('supplier_id', supplierId)
  .eq('status', 'pending')
// returns pendingRes.count
```

**New exported function** — place after `getOrderById` (after line 267):
```typescript
export async function getPendingOrderCount(supplierId: string): Promise<number> {
  const { count } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('supplier_id', supplierId)
    .eq('status', 'pending')
  return count || 0
}
```

**Analog 2:** `getOrdersBySupplier` (lines 223-232) — current unfiltered query:
```typescript
export async function getOrdersBySupplier(supplierId: string, limit = 100): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, buyer:buyers(*), items:order_items(*)')
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) return []
  return data
}
```

**Required diff** — add `.in()` before `.order()`:
```typescript
// Add this line after .eq('supplier_id', supplierId):
.in('status', ['pending', 'confirmed', 'in_route'])
```

**`.in()` pattern reference** — same syntax already used in `getFeaturedProducts` (lines 152-162):
```typescript
.or('sell_without_stock.eq.true,stock_quantity.gt.0')
// and .eq() chaining pattern is universal in the file
```

---

### `api/[...route].ts` (API route, request-response)

**Analog:** self — one-line change at line 97.

**Current lines 94-98**:
```typescript
sendPush(order.supplier_id as string, {
  title: 'Novo pedido recebido!',
  body: `Pedido #${(orderData.id as string).slice(0, 8).toUpperCase()} aguardando confirmação.`,
  url: '/supplier/orders',   // ← line 97: fix target
}).catch(() => {})
```

**Required change** (line 97 only):
```typescript
url: `/supplier/orders?order=${orderData.id}`,
```

No other changes needed in this file. `sendPush` signature, auth middleware, and error handling are unchanged.

---

### `src/utils/index.ts` (utility, transform)

**Analog:** `formatOrderStatusMessage` (lines 89-106) — existing function with gap.

**Current function** (lines 89-106):
```typescript
export function formatOrderStatusMessage(
  status: OrderStatus,
  order: Order,
  supplier: Supplier
): string {
  const total = formatCurrency(order.total_value)
  const storeName = supplier.store_name

  const messages: Partial<Record<OrderStatus, string>> = {
    confirmed:   `✅ *Pedido Confirmado!* ...`,
    in_delivery: `🚚 *Pedido a Caminho!* ...`,   // ← legacy, keep
    delivered:   `🎉 *Pedido Entregue!* ...`,
    cancelled:   `❌ *Pedido Cancelado* ...`,
    // ← MISSING: in_route and rejected
  }

  const text = messages[status] ?? `Atualização do seu pedido na ${storeName}: ${status}`
  return encodeURIComponent(text)
}
```

**Two new entries to add** to the `messages` map — copy style from existing entries:
```typescript
in_route: `🚚 *Pedido a Caminho!*\n\n🏪 Fornecedor: ${storeName}\n💰 Total: ${total}\n\nSeu pedido saiu para entrega! Fique de olho. 😊\n\n_Rota Verde 🌿_`,
rejected: `❌ *Pedido Recusado*\n\n🏪 Fornecedor: ${storeName}\n💰 Total: ${total}\n\nInfelizmente seu pedido foi recusado. Entre em contato com o fornecedor para mais informações.\n\n_Rota Verde 🌿_`,
```

**Placement:** insert as new entries in the `messages` object at lines 97-102. No other changes needed in this file.

---

### `src/App.tsx` — `SupplierLayout` polling + prop-threading (lines 53-68)

**Analog:** `SupplierLayout` function (lines 53-68) — the layout to extend.

**Current SupplierLayout** (lines 53-68):
```tsx
function SupplierLayout() {
  const { profile, isLoading } = useAuthStore()
  if (isLoading) return <PageLoader />
  if (!profile) return <Navigate to="/login" replace />
  if (profile.role !== 'supplier') return <Navigate to="/" replace />
  return (
    <div className="flex flex-col h-dvh max-w-lg mx-auto relative">
      <div className="flex-1 overflow-y-auto pb-16">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </div>
      <SupplierNav />
    </div>
  )
}
```

**Extended SupplierLayout** — add state + polling before guards, pass prop to SupplierNav:
```tsx
function SupplierLayout() {
  const { profile, isLoading, supplier } = useAuthStore()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!supplier) return
    const refresh = () =>
      getPendingOrderCount(supplier.id).then(setPendingCount).catch(() => {})
    refresh()
    const interval = setInterval(refresh, 15000)
    return () => clearInterval(interval)
  }, [supplier])

  if (isLoading) return <PageLoader />
  if (!profile) return <Navigate to="/login" replace />
  if (profile.role !== 'supplier') return <Navigate to="/" replace />
  return (
    <div className="flex flex-col h-dvh max-w-lg mx-auto relative">
      <div className="flex-1 overflow-y-auto pb-16">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </div>
      <SupplierNav pendingCount={pendingCount} />
    </div>
  )
}
```

**New imports needed** at top of `App.tsx`:
```tsx
import { useState, useEffect } from 'react'            // add useEffect (already imported? check)
import { getPendingOrderCount } from './services/supabase'
```

Note: `App.tsx` line 1 already imports `{ Suspense, lazy, useEffect }` — add `useState` to that destructure and add the service import.

**`useAuthStore` already imported** at line 4. The `supplier` field is available in the store (confirmed in `authStore.ts`); just destructure it from `useAuthStore()`.

---

## Shared Patterns

### Toast with WhatsApp Action
**Source:** `src/pages/supplier/Orders.tsx` lines 213-220
**Apply to:** `handleUpdateStatus`, `handleReject`, `EditOrderModal.handleSave`
```tsx
toast.success('Status atualizado!', {
  description: 'Toque abaixo para notificar o comprador via WhatsApp.',
  action: {
    label: '💬 Abrir WhatsApp',
    onClick: () => window.open(whatsappUrl, '_blank'),
  },
  duration: 15000,
})
```

### Per-Card Loading Spinner
**Source:** `src/pages/supplier/Orders.tsx` lines 398-402
**Apply to:** All action buttons in Orders.tsx
```tsx
{isUpdating ? (
  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
) : (
  label
)}
```

### Bottom Sheet Shell
**Source:** `src/pages/supplier/Orders.tsx` lines 104-178 (EditOrderModal)
**Apply to:** `RejectOrderModal` (new inline component, copy shell exactly)
```tsx
<div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={onClose}>
  <div
    className="bg-white rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto"
    onClick={(e) => e.stopPropagation()}
  >
    <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
    {/* content */}
  </div>
</div>
```

### 15s Polling with Cleanup
**Source:** derived from project convention (Dashboard.tsx one-shot → extend to polling)
**Apply to:** `Orders.tsx` (orders list), `App.tsx` `SupplierLayout` (badge count)
```tsx
const interval = setInterval(fn, 15000)
return () => clearInterval(interval)
```

### Error Handling in Async Handlers
**Source:** `src/pages/supplier/Orders.tsx` lines 224-228
**Apply to:** all `async` event handlers in Orders.tsx
```tsx
  } catch {
    toast.error('Erro ao atualizar status')
  } finally {
    setUpdating((prev) => ({ ...prev, [order.id]: false }))
  }
```

### Supabase Count Query
**Source:** `src/services/supabase.ts` lines 355-359 (inside `getSupplierDashboard`)
**Apply to:** new `getPendingOrderCount` function
```typescript
supabase
  .from('orders')
  .select('id', { count: 'exact', head: true })
  .eq('supplier_id', supplierId)
  .eq('status', 'pending')
// result.count is the integer; return count || 0
```

---

## No Analog Found

All six files have close analogs — no entries in this section.

---

## Critical Implementation Notes (for planner)

1. **Remove `handleCancel`** from `Orders.tsx` entirely. It is a buyer action (`pending → cancelled`). Replace all call sites with `setRejectingOrder(order)`. `handleCancel` is at lines 231-264.

2. **`hasLoaded` ref** is mandatory. Without it, every 15s poll calls `setLoading(true)` → `<PageLoader />` flashes. Pattern: `const hasLoaded = useRef(false)` — set `hasLoaded.current = true` and call `setLoading(false)` only on the first `.finally()`.

3. **Two-section filter is client-side.** `getOrdersBySupplier` now returns only active statuses (`pending`, `confirmed`, `in_route`). The component filters further for each section. Do NOT add a second Supabase call just to split sections.

4. **`RejectOrderModal` is inline** (not a separate file). Place it before `SupplierOrders` default export, mirroring where `EditOrderModal` is declared (line 35).

5. **Reason list** (D-08, verbatim): `['Sem estoque', 'Fora de temporada', 'Região/dia inválido', 'Pedido mínimo não atingido', 'Preço desatualizado', 'Outro']`. When `selectedReason === 'Outro'`, show a `<textarea>` and use its value as the actual reason passed to `updateOrderStatus`.

6. **`useAuthStore` must expose `supplier`** in `SupplierLayout`. Current `App.tsx` line 54 only destructures `{ profile, isLoading }`. Add `supplier` to the destructure.

7. **Order of guards vs hooks** in `SupplierLayout`: `useEffect` and `useState` must be called BEFORE any early `return` statements (React hooks rule). Structure: declare all state and effects first, then the guard returns.

---

## Metadata

**Analog search scope:** `src/pages/supplier/`, `src/components/layout/`, `src/services/`, `src/utils/`, `src/App.tsx`, `api/`
**Files read:** 6 source files (Orders.tsx, SupplierNav.tsx, supabase.ts, App.tsx, utils/index.ts, api/[...route].ts)
**Pattern extraction date:** 2026-05-14
