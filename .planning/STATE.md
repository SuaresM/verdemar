---
milestone: v1.1
name: Fluxo de Pedidos
status: planning
phase: 1
progress:
  phases_complete: 0
  phases_total: 4
  tasks_complete: 0
  tasks_total: 5
updated: 2026-05-13
---

## Current Position

Phase: 01 — Schema + API Backbone (planned, ready to execute)
Plan: 5 plans in 3 waves
Status: Phase 01 planned ✓
Last activity: 2026-05-13 — Phase 01 plans created (5 plans, 3 waves)

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-13)

**Core value:** Comprador consegue fazer pedido de hortifrúti para múltiplos fornecedores em uma única sessão, com entrega agendada na janela certa.
**Current focus:** v1.1 Fluxo de Pedidos

## Accumulated Context

### Key Decisions

- Push notifications infra existente (fase notifications-search-ux) — reusar para notificações de pedido
- Tabela `orders` existente com colunas `status` e `delivery_time_preference`
- WhatsApp link já gerado no checkout (botão pós-confirmação) — mantido, não substituído
- Phase 01 must complete before any UI phase — PATCH /orders/:id/status has zero authorization (live security hole confirmed in api/[...route].ts:67)
- Supabase Realtime + RLS is a known broken combination (issue #35195) — use 15s polling on order history; Realtime deferred to v1.2

### Pending Todos

(none)

### Blockers

(none)
