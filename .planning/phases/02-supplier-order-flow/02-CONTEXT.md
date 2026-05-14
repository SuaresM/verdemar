# Phase 02: Supplier Order Flow - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Esta fase entrega a tela de gestão de pedidos do fornecedor — ver pedidos pendentes e em andamento, aceitar/recusar com motivo, avançar para "Em rota" e "Entregue", e receber push notification ao chegar novo pedido com deep-link para o pedido específico.

**Não inclui:** histórico completo (Fase 04), tracking para o comprador (Fase 03), ou qualquer funcionalidade do lado do comprador.

</domain>

<decisions>
## Implementation Decisions

### Escopo da lista de pedidos (SUPP-01, SUPP-04, SUPP-05)

- **D-01:** A tela de pedidos do fornecedor exibe **duas seções verticais** na mesma página (sem abas):
  1. **"Pendentes"** — pedidos com `status = 'pending'`, com badge de contagem
  2. **"Em andamento"** — pedidos com `status = 'confirmed'` ou `status = 'in_route'`
- **D-02:** Pedidos com `status = 'delivered'`, `'cancelled'` ou `'rejected'` **não aparecem** nesta tela. Histórico é Fase 04.
- **D-03:** O `STATUS_TRANSITIONS` atual usa `in_delivery` — deve ser atualizado para `in_route` (renomeado no Phase 01).

### Badge de não lidos (SUPP-01)

- **D-04:** Badge = **count de todos os pedidos com status 'pending'**. Não há rastreamento de "visto/não visto" — todos os pendentes contam.
- **D-05:** Badge localizado no **ícone de navegação de Pedidos em `SupplierNav`** — badge vermelho visível em qualquer tela do app.
- **D-06:** Atualização via **polling de 15s** — mesmo padrão do projeto. Badge atualiza junto com o reload da lista.

### Fluxo de recusa (SUPP-03)

- **D-07:** "Recusar" abre um **bottom sheet** (mesmo padrão do `EditOrderModal` existente).
- **D-08:** O bottom sheet exibe a lista predefinida de motivos: Sem estoque, Fora de temporada, Região/dia inválido, Pedido mínimo, Preço desatualizado, Outro. Quando "Outro" é selecionado, aparece um campo de texto livre obrigatório.
- **D-09:** O botão "Recusar" fica disponível tanto em pedidos **pendentes quanto confirmados** (fornecedor pode recusar até o momento da entrega).
- **D-10:** Após recusar: push automático para o comprador (já wired em `sendPushToBuyer` do Phase 01) + toast com link WhatsApp para o fornecedor notificar pessoalmente se quiser.

### Deep-link de push (PUSH-01)

- **D-11:** URL do push: `/supplier/orders?order=<id>` — query param, sem criar nova rota.
- **D-12:** Ao abrir a tela com `?order=<id>`, o app **rola até o card do pedido e o expande automaticamente**.
- **D-13:** O service worker `src/sw.ts` já trata `notificationclick` com `data.url` — só precisa que o payload inclua a URL correta. Mudança em `api/[...route].ts` linha 97: de `/supplier/orders` para `/supplier/orders?order=${order.id}`.

### Claude's Discretion

- Layout visual das duas seções (separador, título da seção, espaçamento) — seguir padrões existentes do app.
- Animação de scroll até o card no deep-link — usar `scrollIntoView` ou equivalente.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/ROADMAP.md` §Phase 02 — Requirements SUPP-01 through SUPP-05 and PUSH-01, success criteria
- `.planning/REQUIREMENTS.md` §Gestão de Pedidos — Full SUPP-01..05 requirement text
- `.planning/REQUIREMENTS.md` §Notificações Push — PUSH-01 requirement text

### Existing code to extend
- `src/pages/supplier/Orders.tsx` — página de pedidos existente com expandable cards, EditOrderModal pattern, STATUS_TRANSITIONS, WhatsApp links; base para todas as mudanças desta fase
- `src/components/layout/SupplierNav.tsx` — barra de navegação inferior do fornecedor; badge deve ser adicionado aqui
- `src/sw.ts` linhas 50-76 — service worker: `push` event handler e `notificationclick` com `data.url`
- `api/[...route].ts` linha 97 — `url: '/supplier/orders'` no sendPush do POST /orders; mudar para incluir order_id

### Phase 01 foundation
- `.planning/phases/01-schema-api-backbone/01-VERIFICATION.md` — API state machine, status transitions, sendPushToBuyer wiring
- `.planning/phases/01-schema-api-backbone/01-06-SUMMARY.md` — gap closure fixes aplicados

### Project constraints
- `.planning/PROJECT.md` §Constraints — mobile-first iOS, PWA, sem Supabase Realtime (polling 15s)
- `.planning/PROJECT.md` §Out of Scope — sem Realtime, sem aceite parcial (v1.2)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `EditOrderModal` (inline em `Orders.tsx`): bottom sheet pattern com `fixed inset-0 z-50 flex flex-col justify-end bg-black/40`, `rounded-t-3xl`, drag handle — **reutilizar exato padrão para o bottom sheet de recusa**
- `OrderStatusBadge` em `src/components/shared/Badge.tsx` — componente de badge de status já existente
- `toast` (Sonner) com `action` (label + onClick): padrão já usado para WhatsApp links após atualização de status — **reutilizar para toast pós-recusa**
- `updateOrderStatus` em `src/services/supabase.ts` — já aceita `rejectionReason` opcional (Phase 01); chamar com reason para recusa

### Established Patterns
- Cards expansíveis com `setExpanded` state (`Record<string, boolean>`) — padrão dominante em Orders.tsx
- `setUpdating` por order id para loading state por card — mesmo padrão
- Polling via `useEffect + setInterval` — não implementado ainda na página (carrega só uma vez); deve ser adicionado para refresh 15s
- WhatsApp link como toast.action após mudança de status — padrão para SUPP-02/03/04/05

### Integration Points
- `sendPush` em `api/[...route].ts`: payload `{title, body, url}` → url deve incluir `?order=${order.id}` para deep-link
- `updateOrderStatus(orderId, 'rejected', rejectionReason)` — assinatura já correta no Phase 01
- `getOrdersBySupplier` em services — query atual; pode precisar de filtro de status (active only: pending/confirmed/in_route)
- `SupplierNav` precisa receber count de pedidos pendentes como prop ou buscar via hook

</code_context>

<specifics>
## Specific Ideas

- Seção "Pendentes" deve ter o título em destaque com o count: ex. "Pendentes (3)" 
- Aceitar pedido (SUPP-02) é um toque sem diálogo — já existe como `handleUpdateStatus` para pending→confirmed; manter comportamento
- Motivos de recusa são exatamente: Sem estoque, Fora de temporada, Região/dia inválido, Pedido mínimo, Preço desatualizado, Outro (+ campo livre)
- "Recusar" deve usar vocabulário distinto de "Cancelar" — cancelar é ação do comprador (pending→cancelled), recusar é ação do fornecedor (→rejected)

</specifics>

<deferred>
## Deferred Ideas

- Aceite parcial (counter-offer de quantidade) — PART-01/02 em v1.2 REQUIREMENTS
- Push de lembrete após 2h sem ação em pedido pendente — QOL-03 em v1.2
- Histórico completo do fornecedor — HIST-02 em Fase 04

</deferred>

---

*Phase: 02-supplier-order-flow*
*Context gathered: 2026-05-14*
