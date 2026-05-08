# Phase: Notificações + UX Fixes — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** notifications-search-ux
**Areas discussed:** Notif. ao fornecedor, Notif. ao comprador, Tutorial: botão Pular, Nome do fornecedor na busca

---

## Notif. ao fornecedor

| Option | Description | Selected |
|--------|-------------|----------|
| Tornar WhatsApp obrigatório | Bloquear "Ver meus pedidos" até comprador tocar em WhatsApp | ✓ |
| Redirecionar automaticamente | Abrir WhatsApp diretamente sem tela intermediária | |
| Manter como está | Melhorar apenas o visual da tela de sucesso | |

**User's choice:** Tornar WhatsApp obrigatório
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Nome do comprador + valor | Ex: "Novo pedido de João Silva — R$ 450,00" | |
| Apenas 'Novo pedido recebido!' | Mensagem genérica atual | ✓ |
| Você decide | Manter ou ajustar conforme melhor julgamento | |

**User's choice:** Manter mensagem genérica no push

---

## Notif. ao comprador

| Option | Description | Selected |
|--------|-------------|----------|
| Toast + botão WhatsApp | Padrão do modal de edição — toast persistente com botão "Abrir WhatsApp" | ✓ |
| Manter abre automático | window.open() direto, mais rápido mas pode ser bloqueado | |
| Push notification ao comprador | Enviar push ao comprador (requer permissão) | |

**User's choice:** Toast + botão WhatsApp

| Option | Description | Selected |
|--------|-------------|----------|
| Em todas as transições | pending→confirmed, in_delivery, delivered, cancelamento | ✓ |
| Só nas importantes | Apenas Confirmar Pedido e Marcar Entregue | |
| Você decide | Planner escolhe | |

**User's choice:** Em todas as transições

---

## Tutorial: botão Pular

| Option | Description | Selected |
|--------|-------------|----------|
| Só o botão Pular | Fix pontual de CSS no posicionamento do botão | |
| Tutorial inteiro mal dimensionado | Redimensionar tooltip completo para mobile | ✓ |
| Desabilitar tutorial | Remover temporariamente | |

**User's choice:** Tutorial inteiro mal dimensionado

| Option | Description | Selected |
|--------|-------------|----------|
| Todos os roles | Buyer, supplier e admin — fix único no CSS global | ✓ |
| Só comprador | Priorizar fluxo do comprador | |
| Você decide | Planner ajusta conforme adequado | |

**User's choice:** Todos os roles

---

## Nome do fornecedor na busca

| Option | Description | Selected |
|--------|-------------|----------|
| Abaixo do nome do produto | "🏪 Hortifruti São Paulo" discreto abaixo do nome | ✓ |
| Overlay na imagem (canto) | Badge no canto inferior da imagem | |
| Acima do card separado | Cabeçalho fixo agrupando por fornecedor | |

**User's choice:** Abaixo do nome do produto

| Option | Description | Selected |
|--------|-------------|----------|
| Só na busca | Home já agrupa por fornecedor | |
| Em todos os ProductCards | Sempre que supplier estiver disponível | ✓ |

**User's choice:** Em todos os ProductCards

---

## Claude's Discretion

- Nenhuma área delegada ao Claude nesta fase — todas as decisões foram escolhidas pelo usuário.

## Deferred Ideas

- Push notifications para compradores quando status muda — requer permissão de notificação do comprador, complexidade extra; fase futura
- Email de confirmação de pedido — fora do escopo
- Histórico de notificações no app — fora do escopo
