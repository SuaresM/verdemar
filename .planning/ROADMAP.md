# Roadmap — v1.1 Fluxo de Pedidos

**Milestone:** v1.1 Fluxo de Pedidos
**Created:** 2026-05-13
**Phases:** 4
**Requirements:** 21

## Overview

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|-----------------|
| 01 | Schema + API Backbone | Fix authorization hole, establish safe data layer before any UI ships | API-01, API-02, API-03 | 4 criteria |
| 02 | Supplier Order Flow | Suppliers can see and manage incoming orders on mobile | SUPP-01, SUPP-02, SUPP-03, SUPP-04, SUPP-05, PUSH-01 | 5 criteria |
| 03 | Buyer Order Detail + Confirmation Upgrade | Close the loop for buyers — visible status, timeline, deep-link from push | CONF-01, CONF-02, CONF-03, CONF-04, TRACK-01, TRACK-02, TRACK-03, TRACK-04, PUSH-02 | 5 criteria |
| 04 | Order History + Filters | Make order history operationally useful for both roles | HIST-01, HIST-02, HIST-03 | 3 criteria |

## Phase Details

### Phase 01: Schema + API Backbone

**Goal:** Fix the authorization hole in PATCH /orders/:id/status, add required schema columns, and establish a safe data layer before any new UI ships.

**Requirements:**
- API-01: Atualização de status de pedido valida papel do ator (comprador só cancela enquanto pendente; fornecedor controla confirmado/em rota/entregue/recusado) e rejeita transições inválidas com mensagem de erro clara
- API-02: Criação de pedido é idempotente — reenvio com mesmo idempotency-key retorna pedido existente sem duplicar
- API-03: Subscriptions de push suportam múltiplos dispositivos por usuário (composite key user_id+endpoint; send itera todos; purga 410/404 stale)

**Success Criteria:**
1. A buyer attempting to set an order to "confirmed" via direct API call receives a 403 error — only the supplying fornecedor can confirm
2. Submitting the same order twice (network retry) results in one order in the database, not two
3. A supplier logged into both phone and tablet receives push notifications on both devices simultaneously
4. An invalid status transition (e.g., pending → delivered) returns a clear error message, not a silent success

**Depends on:** —

**Plans:** 5 plans (3 waves)

Plans:
- Wave 1 (parallel):
  - [x] 01-01-PLAN.md — Write Supabase migration SQL (rejection_reason, status_history, idempotency_key, status CHECK, push_subscriptions composite key)
  - [x] 01-02-PLAN.md — Update TypeScript types (OrderStatus union, StatusHistoryEntry interface, Order interface extensions)
- Wave 2:
  - [x] 01-03-PLAN.md — [BLOCKING] Apply migration to live Supabase project mdwifcuaekjboukvsnvg (depends: 01-01)
- Wave 3 (parallel, depends: 01-02 + 01-03):
  - [ ] 01-04-PLAN.md — Rewrite PATCH /orders/:id/status with auth + state machine + push; fix sendPush multi-device; add idempotency to POST /orders
  - [ ] 01-05-PLAN.md — Add getOrderById() and update updateOrderStatus() signature in services

---

### Phase 02: Supplier Order Flow

**Goal:** Suppliers can see incoming orders, accept or reject with a reason, and progress orders through to delivery — all from a mobile screen.

**Requirements:**
- SUPP-01: Fornecedor vê lista de pedidos pendentes com contador de não lidos
- SUPP-02: Fornecedor aceita pedido com um toque (sem dialog de confirmação)
- SUPP-03: Fornecedor recusa pedido com motivo obrigatório (lista predefinida: Sem estoque, Fora de temporada, Região/dia inválido, Pedido mínimo, Preço desatualizado, Outro + campo livre)
- SUPP-04: Fornecedor marca pedido como "Em rota"
- SUPP-05: Fornecedor marca pedido como "Entregue"
- PUSH-01: Fornecedor recebe push ao chegar novo pedido; tap abre pedido diretamente

**Success Criteria:**
1. The supplier's orders screen shows a badge with the count of unread pending orders
2. Tapping "Aceitar" on a pending order updates the status immediately without a confirmation dialog
3. Tapping "Recusar" opens a reason selector; submitting without selecting a reason is blocked
4. A supplier who installed the PWA to home screen receives a push notification when a buyer places an order, and tapping it opens that specific order
5. Supplier can tap "Em rota" and then "Entregue" on a confirmed order, advancing its status each time

**Depends on:** Phase 01

**Plans:** TBD

**UI hint**: yes

---

### Phase 03: Buyer Order Detail + Confirmation Upgrade

**Goal:** Buyers see their order acknowledged, can track its status through a visual timeline, and arrive at the order detail from a push notification tap.

**Requirements:**
- CONF-01: Comprador vê tela de confirmação com número do pedido após finalizar checkout
- CONF-02: Confirmação mostra resumo por fornecedor (itens, quantidade, preço unitário, total)
- CONF-03: Confirmação mostra janela de entrega agendada por fornecedor
- CONF-04: Confirmação mostra link "Ver Pedido" que abre detalhes com status atual
- TRACK-01: Comprador vê status atual do pedido (pendente / confirmado / em rota / entregue / recusado / cancelado)
- TRACK-02: Comprador vê histórico de estados com timestamps (timeline visual)
- TRACK-03: Comprador pode cancelar pedido enquanto status = pendente
- TRACK-04: Comprador vê motivo da recusa quando pedido é recusado
- PUSH-02: Comprador recebe push quando pedido é confirmado, recusado, em rota ou entregue; tap abre detalhe do pedido

**Success Criteria:**
1. After checkout, the confirmation screen shows the order number, per-supplier item summary with totals, and the scheduled delivery slot
2. The order detail page shows a vertical timeline with each status change and its timestamp
3. A buyer can tap "Cancelar pedido" on a pending order and the status changes to cancelled; the button is absent on confirmed orders
4. When a supplier rejects an order, the buyer's order detail shows the rejection reason text
5. A buyer receives a push notification when their order status changes, and tapping it navigates directly to that order's detail page

**Depends on:** Phase 02

**Plans:** TBD

**UI hint**: yes

---

### Phase 04: Order History + Filters

**Goal:** Both buyers and suppliers can browse their complete order history and narrow it down by status or date range to find what they need.

**Requirements:**
- HIST-01: Comprador vê histórico de todos seus pedidos com status visível na lista
- HIST-02: Fornecedor vê histórico de pedidos recebidos com status visível na lista
- HIST-03: Comprador e fornecedor filtram histórico por status e por período de data

**Success Criteria:**
1. The buyer's history list shows all past orders with a color-coded status chip visible without opening each order
2. The supplier's history list shows all received orders with status visible at the card level
3. Applying a status filter (e.g., "Entregue") shows only orders in that status; applying a date range hides orders outside the window; both filters can be combined

**Depends on:** Phase 03

**Plans:** TBD

**UI hint**: yes

---

## Coverage

- Total requirements: 21
- Mapped: 21
- Unmapped: 0 ✓

| Requirement | Phase |
|-------------|-------|
| API-01 | Phase 01 |
| API-02 | Phase 01 |
| API-03 | Phase 01 |
| CONF-01 | Phase 03 |
| CONF-02 | Phase 03 |
| CONF-03 | Phase 03 |
| CONF-04 | Phase 03 |
| SUPP-01 | Phase 02 |
| SUPP-02 | Phase 02 |
| SUPP-03 | Phase 02 |
| SUPP-04 | Phase 02 |
| SUPP-05 | Phase 02 |
| TRACK-01 | Phase 03 |
| TRACK-02 | Phase 03 |
| TRACK-03 | Phase 03 |
| TRACK-04 | Phase 03 |
| PUSH-01 | Phase 02 |
| PUSH-02 | Phase 03 |
| HIST-01 | Phase 04 |
| HIST-02 | Phase 04 |
| HIST-03 | Phase 04 |

## Phases

- [ ] **Phase 01: Schema + API Backbone** — Fix authorization hole, add schema columns, establish safe data layer
- [ ] **Phase 02: Supplier Order Flow** — Enable suppliers to see and manage incoming orders on mobile
- [ ] **Phase 03: Buyer Order Detail + Confirmation Upgrade** — Close the loop for buyers with visible status, timeline, and push deep-links
- [ ] **Phase 04: Order History + Filters** — Make order history operationally useful for both roles

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 01. Schema + API Backbone | 3/5 | Executing | - |
| 02. Supplier Order Flow | 0/? | Not started | - |
| 03. Buyer Order Detail + Confirmation Upgrade | 0/? | Not started | - |
| 04. Order History + Filters | 0/? | Not started | - |
