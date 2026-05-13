# Rota Verde

## What This Is

Rota Verde é um marketplace B2B mobile-first (PWA) para atacado de hortifrúti no Distrito Federal e entorno. Compradores (restaurantes, mercados, feirantes) descobrem fornecedores, montam pedidos por fornecedor, e agendam entregas dentro das janelas configuradas pelo fornecedor. Fornecedores gerenciam produtos, estoque, zonas de entrega e pedidos recebidos.

## Core Value

Comprador consegue fazer pedido de hortifrúti para múltiplos fornecedores em uma única sessão, com entrega agendada na janela certa.

## Current Milestone: v1.1 Fluxo de Pedidos

**Goal:** Fechar o ciclo completo de pedido — do clique em "Finalizar" até entrega confirmada — para comprador e fornecedor.

**Target features:**
- Tela de confirmação de pedido (comprador) com resumo e número
- Painel de pedidos do fornecedor: aceite/recusa com motivo
- Status de entrega rastreável (pendente → confirmado → em rota → entregue)
- Histórico de pedidos para comprador e fornecedor (com filtros básicos)
- Push notifications: fornecedor ao receber pedido, comprador ao ter status atualizado

## Requirements

### Validated

<!-- Shipped phases v1.0 (foundation) -->

- ✓ Comprador pode criar conta e editar perfil — user-settings-update
- ✓ Fornecedor pode criar conta e editar perfil — user-settings-update
- ✓ Push notifications funcionam (infra) — notifications-search-ux
- ✓ Comprador pode buscar produtos e fornecedores — notifications-search-ux
- ✓ Fornecedor configura zonas de entrega com dias/horários — product-stock-zones-ux
- ✓ Fornecedor gerencia estoque de produtos — product-stock-zones-ux
- ✓ Comprador seleciona cidade a partir de lista validada — buyer-delivery-select
- ✓ Comprador escolhe janela de entrega no carrinho (2 etapas: zona → dia) — buyer-delivery-select
- ✓ PWA funciona com cache de service worker — pwa-sw-fix

### Active

<!-- Milestone v1.1 — Fluxo de Pedidos -->

- [ ] Comprador vê tela de confirmação após finalizar pedido (resumo + número)
- [ ] Fornecedor vê pedidos pendentes e pode aceitar ou recusar (com motivo)
- [ ] Status do pedido é rastreável: pendente → confirmado → em rota → entregue
- [ ] Comprador vê histórico de pedidos com detalhes e status
- [ ] Fornecedor vê histórico de pedidos recebidos com filtros básicos
- [ ] Fornecedor recebe push notification ao chegar novo pedido
- [ ] Comprador recebe push notification quando status do pedido muda

### Out of Scope

- Pagamento online integrado — fora do escopo atual; negociação offline
- NF-e / faturamento automático — complexidade fiscal, defer
- Chat entre comprador e fornecedor — WhatsApp link é suficiente por ora
- Rastreamento GPS em tempo real — logistics too complex, defer
- App nativo (iOS/Android store) — PWA suficiente para MVP

## Context

- **Stack:** Vite 7 + React 19 + TypeScript + Zustand + Supabase (PostgreSQL + Auth + RLS) + Tailwind + Hono (API) + Vercel
- **Deploy:** Vercel via push em main do repo `github.com/SuaresM/verdemar`
- **Supabase:** projeto `mdwifcuaekjboukvsnvg` (região sa-east-1)
- **PWA:** Workbox autoUpdate, funciona em iOS mobile
- **Auth:** Supabase Auth com RLS; anon key hardcoded como fallback em `src/lib/supabaseClient.ts`
- **Orders:** Tabela `orders` existente; colunas `status`, `delivery_time_preference` (string), WhatsApp link já gerado no checkout
- **Push:** Infra de web push já implementada (fase notifications-search-ux); VAP ID keys configuradas no Vercel

## Constraints

- **Mobile-first:** Toda UI deve funcionar bem em iOS mobile (telas pequenas, toque)
- **PWA:** Sem app nativo; service worker deve ser mantido funcionando
- **Supabase RLS:** Segurança via Row Level Security — nenhuma operação bypassa auth
- **Sem backend dedicado complexo:** Operações críticas via Hono serverless no Vercel

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| CityCombobox strict mode | Garantir consistência de endereço para matching com zonas | ✓ Good |
| 2-step delivery selector (zona → dia) | Supplier configura zonas multi-dia; comprador escolhe dia específico | ✓ Good |
| delivery_time_preference como string | Evitar joins desnecessários; legível em order details sem DB | ✓ Good |
| WhatsApp link no checkout | Canal já usado pelos fornecedores; baixo custo de adoção | — Pending |
| Zustand persist para cart | Persistência local sem backend; risco de stale state controlado | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-13 — Milestone v1.1 started*
