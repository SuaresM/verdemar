---
phase: product-stock-zones-ux
created: 2026-05-08
status: ready-for-planning
areas:
  - campos-condicionais-venda
  - gestao-estoque-rapida
  - bug-zonas-entrega
  - accordion-lista-ras
---

# Phase Context — product-stock-zones-ux

## Objective
Four independent UX improvements to the supplier flow: conditional sale unit fields, quick inline stock management, zone save bug fix, and collapsible RA list.

---

## D-01 — Campos condicionais por unidade de venda

**Decision: campos obrigatórios por sale_unit em ProductForm.tsx**

| sale_unit | Campos visíveis |
|-----------|----------------|
| `kg`      | `price_per_kg` + `box_weight_kg` (obrigatório — "Peso da caixa (kg)") |
| `box`     | `box_price` + `box_unit_quantity` (obrigatório — "Unidades por caixa"); **remover `box_weight_kg`** |
| `unit`    | `price_per_unit` + `unit_description` (sem alteração) |

**Changes to ProductForm.tsx:**
- For `saleUnit === 'kg'`: ADD `box_weight_kg` field (required, label "Peso da caixa (kg)"), keep `price_per_kg`
- For `saleUnit === 'box'`: REMOVE `box_weight_kg` field (keep only `box_unit_quantity` + `box_price`)
- For `saleUnit === 'unit'`: no change — keeps `price_per_unit` + `unit_description`
- Update Zod schema: `box_weight_kg` required when `sale_unit === 'kg'` (use `.superRefine` or conditional `.refine`)

**Rationale:** User said "caso seja no kg aparece a opção de escrever o peso da cx, caso seja por cx a quantidade de unidade que vem na caixa, caso seja por unidade, não precisa preencher a quantidade"

---

## D-02 — Gestão de estoque rápida

**Decision: campo editável inline + toggle "vender sem estoque"**

### Inline stock edit (Products.tsx)
- Each product card shows `stock_quantity`
- Tapping the number transitions it to an `<input type="number">` in-place
- On blur or Enter: call PATCH `/products/:id/stock` with `{ stock_quantity: newValue }`
- On Escape: revert to original value without saving
- Show spinner while saving; toast.success/error on result

### "Vender sem estoque" toggle
- Each product card gets a toggle/switch labeled "Vender sem estoque" (or "Aceitar pedidos sem estoque")
- Toggle state stored in `sell_without_stock: boolean` column on `products` table
- When `sell_without_stock = true`: product stays visible to buyers even when `stock_quantity = 0`
- API: PATCH `/products/:id/sell-without-stock` with `{ sell_without_stock: boolean }`
- Toggle calls this endpoint and updates local state

**DB migration required:**
```sql
ALTER TABLE products ADD COLUMN sell_without_stock boolean NOT NULL DEFAULT false;
```

**Backend routes to add:**
```
PATCH /products/:id/stock          — body: { stock_quantity: number }
PATCH /products/:id/sell-without-stock — body: { sell_without_stock: boolean }
```

Both routes in `api/[...route].ts`, `requireAuth`, verify `supplier_id = userId`.

---

## D-03 — Bug zonas de entrega (modal abre mas não salva)

**Symptom:** User clicks pencil on a configured DF RA zone → modal opens → click "Salvar" → zone does not update (API PUT fails or silent failure).

**Root cause areas to investigate and fix:**
1. `handleSaveZone` silently returns `if (!supplier) return` — no toast, modal stays open; check if `supplier` is ever null when the modal is open
2. `setShowZoneModal(false)` and `setEditingZone(null)` must both be called on every modal close path (save success, cancel button, background click) — currently Cancel and background don't reset `editingZone`
3. `updateDeliveryZone(editingZone.id, zoneForm)` — verify the PUT `/supplier/delivery-zones/:id` handler's `.eq('supplier_id', userId)` matches the `supplier_id` stored in DB for that zone; if zones were seeded with a different UUID, the update will silently affect 0 rows (no error from Supabase) and the PUT returns `{ ok: true }` with HTTP 200 — the zone appears saved but is not

**Fix approach:**
- Add `setEditingZone(null)` to all modal close paths (success, cancel, background)
- In the PUT handler: after `.update()`, check `count` > 0; if 0, return 400 with "Zona não encontrada ou sem permissão"
- In `handleSaveZone`: add explicit error handling for the "0 rows updated" case
- Ensure `setShowZoneModal(false)` always runs even on error

---

## D-04 — Accordion da lista de RAs (collapse/expand)

**Decision: lista começa recolhida; expandir ao clicar no cabeçalho**

- The "Regiões de Entrega — DF" section header gets a chevron icon (ChevronDown / ChevronUp)
- `useState(false)` → `showRaList`; default false = collapsed
- When `showRaList = false`: show only the section header + count of configured zones (e.g. "3 de 32 regiões configuradas")
- When `showRaList = true`: show all 32 DF_RAS rows (current behavior)
- Animation: optional `transition-all` or just toggle visibility
- The configured zone count badge in the header gives suppliers quick context even when collapsed

**Implementation in StoreSettings.tsx:**
```tsx
const [showRaList, setShowRaList] = useState(false)
const configuredCount = zones.filter(z => DF_RAS.includes(z.city)).length

// In JSX: replace current section header with clickable toggle
<button type="button" onClick={() => setShowRaList(v => !v)}>
  Regiões de Entrega — DF
  <span>{configuredCount}/{DF_RAS.length} configuradas</span>
  <ChevronDown className={showRaList ? 'rotate-180' : ''} />
</button>
{showRaList && <div className="space-y-2">...DF_RAS list...</div>}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/supplier/ProductForm.tsx` | D-01: conditional fields by sale_unit; update Zod schema |
| `src/pages/supplier/Products.tsx` | D-02: inline stock edit + sell_without_stock toggle |
| `src/pages/supplier/StoreSettings.tsx` | D-03: zone bug fix; D-04: accordion |
| `api/[...route].ts` | D-02: add 2 PATCH routes; D-03: fix PUT handler |
| Supabase migration | D-02: add sell_without_stock column |

## Non-goals (explicitly deferred)
- Push notifications when stock changes
- Bulk stock update for multiple products
- Stock history / audit log
- Zone delivery fees / pricing per RA
