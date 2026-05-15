# Phase 03: Buyer Order Detail + Confirmation Upgrade - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Esta fase entrega a visão do comprador sobre seus pedidos: tela de confirmação enriquecida após checkout, página de detalhe com timeline de status, botão de cancelamento, motivo de recusa, e push notification que abre diretamente no detalhe do pedido.

**Não inclui:** histórico completo com filtros (Fase 04). A tela `/orders` (OrderHistory.tsx) existente permanece como está — esta fase adiciona a rota `/orders/:id` ao lado dela.

</domain>

<decisions>
## Implementation Decisions

### Detalhe do pedido (TRACK-01..04, CONF-04)

- **D-01:** Criar nova página dedicada `src/pages/buyer/OrderDetail.tsx` na rota `/orders/:id`.
  - Rota adicionada em App.tsx dentro de `BuyerLayout`, lazy-loaded: `const OrderDetail = lazy(() => import('./pages/buyer/OrderDetail'))`
  - Path: `<Route path="/orders/:id" element={<OrderDetail />} />`
- **D-02:** A página exibe: Header com botão voltar, status atual com `OrderStatusBadge`, timeline vertical (D-05), botão "Cancelar pedido" quando `status === 'pending'` (D-06), motivo de recusa quando `status === 'rejected'` (D-07), resumo dos itens.
- **D-03:** Polling de 15s na OrderDetail — mesmo padrão estabelecido na Fase 02. `getOrderById(id)` já existe em services. Sem Supabase Realtime (bug #35195).

### Tela de confirmação (CONF-01..04)

- **D-04:** Enriquecer o overlay `checkoutSuccess` existente em `src/pages/buyer/Cart.tsx` — sem criar nova rota, sem navigate() após checkout.
  - Adicionar ao overlay: número do pedido (`#${order.id.slice(0, 8).toUpperCase()}`), lista de itens com quantidade + subtotal (já disponível em `checkoutSection.items`), janela de entrega (`checkoutSection.deliveryTimePreference`).
  - Manter botão WhatsApp como CTA primária (comportamento existente, não substituído).
  - Adicionar botão "Ver Pedido" → `navigate('/orders/${orderId}')` como ação secundária (não bloqueado pelo WhatsApp).
  - O state `checkoutSuccess` já guarda `{ whatsappUrl, supplierName, orderId }` — apenas enriquecer o JSX.

### Timeline visual (TRACK-02)

- **D-05:** Timeline vertical com dots e linha conectora:
  - `status_history: StatusHistoryEntry[]` do Order type (JSONB, Phase 01 migration). `StatusHistoryEntry = { status: OrderStatus; at: string }`.
  - Ordenar do mais recente para o mais antigo (reverse chronological — topo = último estado).
  - Cada entrada: círculo colorido (cor baseada no status) + label do status em PT-BR + timestamp formatado.
  - Linha vertical sólida conecta os dots.
  - Se `status_history` estiver vazio ou undefined (pedidos legados), exibir apenas o status atual como único entry.
  - Sem placeholder de estados futuros — apenas histórico real.

### Cancelamento pelo comprador (TRACK-03)

- **D-06:** Botão "Cancelar pedido" na OrderDetail:
  - Visível apenas quando `status === 'pending'`.
  - Sem dialog de confirmação — toque único (consistente com aceite do fornecedor).
  - Chama `updateOrderStatus(id, 'cancelled', undefined)` — mesmo service existente.
  - Após cancelar: toast "Pedido cancelado" + reload do order via `getOrderById`.

### Motivo de recusa (TRACK-04)

- **D-07:** Exibir `order.rejection_reason` na OrderDetail quando `status === 'rejected'`:
  - Bloco destacado com ícone de aviso + texto "Motivo: [reason]".
  - Campo `rejection_reason` já existe na tabela e no tipo Order (Phase 01).

### Push notification do comprador (PUSH-02)

- **D-08:** `sendPushToBuyer` em `api/[...route].ts` já está wired com `url: /orders/${orderId}` (Phase 01 — linha 453). Nenhuma mudança de API necessária.
  - Push dispara para: confirmed, in_route, delivered, rejected, cancelled (linha 171 — unconditional).
  - SW `notificationclick` → `data.url` → BrowserRouter rota para `/orders/:id` ✓.
  - Apenas a nova página `/orders/:id` precisa existir para PUSH-02 funcionar end-to-end.

### Claude's Discretion

- Layout visual da timeline (spacing, tamanho dos dots, cores por status) — seguir `OrderStatusBadge` em `src/components/shared/Badge.tsx` para consistência de cor.
- Scroll to top na OrderDetail ao montar (evitar posição herdada).
- Toast de erro em caso de falha no carregamento ou cancelamento.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/ROADMAP.md` §Phase 03 — Requirements CONF-01..04, TRACK-01..04, PUSH-02, success criteria
- `.planning/REQUIREMENTS.md` §Fluxo de Confirmação e Acompanhamento — full requirement text

### Existing code to extend/modify
- `src/pages/buyer/Cart.tsx` linhas 437-484 — overlay `checkoutSuccess` a ser enriquecido (CONF-01..04); state `checkoutSuccess = { whatsappUrl, supplierName, orderId }`
- `src/pages/buyer/OrderHistory.tsx` — padrão de cards expansíveis, `OrderStatusBadge` usage — referência de padrão visual
- `src/App.tsx` linhas 128-136 — BuyerLayout routes; adicionar `<Route path="/orders/:id" element={<OrderDetail />} />`
- `src/components/shared/Badge.tsx` — `OrderStatusBadge` componente; reusar cores de status na timeline
- `src/services/supabase.ts` linha 260 — `getOrderById(orderId)` já retorna `Order` com `items`, `supplier`, `buyer`
- `src/types/index.ts` linhas 93-96 — `StatusHistoryEntry { status, at }` e linhas 111-112 — `rejection_reason`, `status_history` na Order interface

### Phase 01 foundation (already implemented — verify before adding)
- `api/[...route].ts` linhas 434-455 — `sendPushToBuyer` já envia com `url: /orders/${orderId}` ✓
- `api/[...route].ts` linha 171 — `sendPushToBuyer` chamado unconditionally após cada status change ✓
- `api/[...route].ts` linhas 156-161 — `status_history` appended and `rejection_reason` saved on PATCH ✓

### Project constraints
- `.planning/PROJECT.md` §Constraints — mobile-first iOS PWA, sem Supabase Realtime (polling 15s), max-w-lg mx-auto
- `.planning/STATE.md` — accumulated context, 15s polling pattern established

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `OrderStatusBadge` em `src/components/shared/Badge.tsx` — badge de status existente; usa as mesmas cores para os dots da timeline
- `Header` em `src/components/layout/Header.tsx` — header padrão com título e botão voltar — usar na OrderDetail
- `formatCurrency`, `formatDate` de utils — usar para itens e timestamps da timeline
- Bottom sheet pattern (`fixed inset-0 z-50 flex flex-col justify-end bg-black/40`, `rounded-t-3xl`) — reutilizar se necessário (não obrigatório para esta fase)
- `EmptyState` em `src/components/shared/EmptyState.tsx` — usar se getOrderById retornar null

### Established Patterns
- `useParams()` do react-router-dom — para extrair `:id` na OrderDetail
- `useState<Order | null>` + polling `useEffect + setInterval(15000)` — padrão da Fase 02
- `setUpdating` por ação (cancel) — mesmo padrão de loading state por botão
- `toast.error` / `toast.success` (Sonner) — padrão de feedback ao usuário

### Integration Points
- `getOrderById(id)` retorna `Order | null` com `items: OrderItem[]`, `supplier: Supplier` — query completa, sem changes necessárias
- `updateOrderStatus(orderId, 'cancelled', undefined)` — assinatura existente no services
- `navigate('/orders')` — volta para lista após cancelamento ou via botão voltar no Header

</code_context>

<specifics>
## Specific Details

- Número do pedido formatado: `#${order.id.slice(0, 8).toUpperCase()}` — padrão já usado em `sendPushToBuyer` (linha 452)
- Labels PT-BR para status: Pendente, Confirmado, Em rota, Entregue, Cancelado, Recusado — verificar consistência com `formatOrderStatusMessage` em services
- Timeline deve funcionar com `status_history = []` ou `undefined` — fallback: exibir apenas `{ status: order.status, at: order.updated_at ?? order.created_at }`
- Overlay de confirmação: delivery slot usa `section.deliveryTimePreference` (string formatada como "Terça — 07:00 às 10:00" — já formatada em Cart.tsx handleDayChange linha 200)
- "Ver Pedido" no overlay não deve ser o primeiro botão — WhatsApp continua como CTA principal para não quebrar fluxo de notificação ao fornecedor

</specifics>

<deferred>
## Deferred Ideas

- Reorder button na OrderDetail (já existe em OrderHistory; adiar para Fase 04 ou não incluso no escopo)
- Rating/feedback após entrega — v1.2
- Countdown timer para entrega estimada — v1.2
- Push de lembrete pré-entrega — v1.2
- Histórico completo com filtros — Fase 04

</deferred>

---

*Phase: 03-buyer-order-view*
*Context gathered: 2026-05-15*
