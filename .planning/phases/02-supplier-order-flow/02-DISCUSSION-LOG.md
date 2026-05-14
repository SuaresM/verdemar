# Phase 02: Supplier Order Flow - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 02-supplier-order-flow
**Areas discussed:** Escopo da lista de pedidos, Badge de não lidos, UX de recusa, Deep-link de push

---

## Escopo da lista de pedidos

### Q1: O que a tela principal deve mostrar?

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Apenas pendentes (foco total) | Só pedidos 'pending'. Outros ficam em outra tela. | ✓ |
| Todos os ativos | Pending + confirmed + in_route juntos | |
| Tudo em abas separadas | Aba Pendentes / Ativos / Histórico | |

**Escolha:** Apenas pendentes (foco total)

### Q2: Onde ficam confirmed/in_route para SUPP-04/05?

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Seção abaixo: "Em andamento" | Duas seções na mesma página, sem abas | ✓ |
| Aba separada "Ativos" | Aba Pendentes + aba Ativos | |
| Mesma lista, filtro por status | Lista única com chip/filtro | |

**Escolha:** Seção abaixo "Em andamento"

### Q3: Pedidos finalizados aparecem?

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Não — só ativos nesta fase | Histórico completo é Fase 04 | ✓ |
| Sim — seção "Histórico" resumida | Últimos 10 finalizados | |

**Escolha:** Não — só ativos nesta fase

---

## Badge de não lidos

### Q1: O que o badge conta?

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Todos os pedidos pendentes | Badge = count de status 'pending'. Simples. | ✓ |
| Apenas novos desde a última visita | Exige timestamp de last_seen | |

**Escolha:** Todos os pedidos pendentes

### Q2: Onde o badge aparece?

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| No ícone de navegação (SupplierNav) | Badge vermelho sobre ícone Pedidos | ✓ |
| Só no título da página | "Pedidos (3)" no cabeçalho | |

**Escolha:** SupplierNav

### Q3: Como se mantém atualizado?

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Polling 15s (padrão do projeto) | Atualiza junto com reload da lista | ✓ |
| Polling 5s só para badge | Mais responsivo, mais requisições | |

**Escolha:** Polling 15s

---

## UX de recusa (SUPP-03)

### Q1: Como "Recusar" aparece?

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Bottom sheet (padrão do app) | Igual ao EditOrderModal | ✓ |
| Expansão inline no card | Sem modal separado | |
| Tela separada (rota nova) | /supplier/orders/:id/reject | |

**Escolha:** Bottom sheet

### Q2: Quando o botão "Recusar" fica disponível?

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Só em pedidos pendentes | Recusa antes de confirmar | |
| Pendentes e confirmados | Fornecedor pode recusar até entregar | ✓ |

**Escolha:** Pendentes e confirmados

### Q3: Notificação ao comprador?

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Sim — push automático (já implementado) | sendPushToBuyer wired no PATCH handler | |
| Sim + WhatsApp link também | Push automático + toast com link WhatsApp | ✓ |

**Escolha:** Push automático + WhatsApp link

---

## Deep-link de push (PUSH-01)

### Q1: Como abrir pedido específico?

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Query param + auto-expand | /supplier/orders?order=<id> sem rota nova | ✓ |
| Rota de detalhe por pedido | /supplier/orders/:id (nova rota) | |

**Escolha:** Query param + auto-expand

### Q2: Onde o deep-link é configurado?

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| No service worker existente (src/sw.ts) | notificationclick já trata data.url | ✓ |
| Via payload do sendPush | (resposta não aplicável — mesmo resultado) | |

**Escolha:** SW já pronto — só mudar URL no payload (api/[...route].ts linha 97)

---

## Claude's Discretion

- Layout visual das duas seções (separador, título, espaçamento)
- Animação de scroll até o card no deep-link

## Deferred Ideas

- Aceite parcial (PART-01/02) — v1.2
- Push de lembrete após 2h sem ação (QOL-03) — v1.2
- Histórico completo do fornecedor (HIST-02) — Fase 04
