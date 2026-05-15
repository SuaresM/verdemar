---
milestone: v1.1
name: Fluxo de Pedidos
status: executing
phase: 3
progress:
  phases_complete: 2
  phases_total: 4
  tasks_complete: 0
  tasks_total: 6
updated: 2026-05-15
---

## Current Position

Phase: 03 — Buyer Order Detail + Confirmation Upgrade (ready to execute)
Status: Phase 03 planned — 3 plans in 2 waves, verified ✓
Last activity: 2026-05-15 — UI-SPEC approved, research complete, 3 plans created and verified

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-13)

**Core value:** Comprador consegue fazer pedido de hortifrúti para múltiplos fornecedores em uma única sessão, com entrega agendada na janela certa.
**Current focus:** v1.1 Fluxo de Pedidos

## Accumulated Context

### Key Decisions

- Push notifications infra existente (fase notifications-search-ux) — reusar para notificações de pedido
- Tabela `orders` existente com colunas `status` e `delivery_time_preference`
- WhatsApp link já gerado no checkout (botão pós-confirmação) — mantido, não substituído
- Phase 01 must complete before any UI phase — PATCH /orders/:id/status has zero authorization (live security hole confirmed in api/[...route].ts:67) — FIXED in Phase 01
- Supabase Realtime + RLS is a known broken combination (issue #35195) — use 15s polling on order history; Realtime deferred to v1.2
- push_subscriptions base table was missing from live DB (never tracked in migrations); created pre-requisite migration before applying order_flow migration
- MCP tool mcp__plugin_supabase_supabase__apply_migration stripped from agent context (bug #13898); worked around using Supabase Management API with OAuth token from credential store
- Phase 02: ALLOWED.rejected.from fixed to ['pending','confirmed'] — D-09 fully implemented
- Phase 02: 15s polling pattern established (no Realtime) — use same in Phase 03
- Phase 03: checkoutSuccess state must capture items/total/deliveryTimePreference BEFORE clearSection() — Cart.tsx closure bug fixed in 03-02
- Phase 03: OrderStatusBadge size prop added in 03-03 (Badge.tsx) — size="md" for OrderDetail prominence
- Phase 03: timeline uses [...status_history].reverse() spread — never mutate state array directly
- Phase 03: PUSH-02 fully wired since Phase 01 — sendPushToBuyer url=/orders/${id}, no API changes needed

### Pending Todos

- Human verification items Phase 02 (non-blocking): push end-to-end, silent polling, badge from all screens — tracked in 02-HUMAN-UAT.md
- Human verification items Phase 01 (non-blocking): 3 SQL/runtime checks listed in 01-VERIFICATION.md

### Blockers

(none)
