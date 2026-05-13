---
phase: 01-schema-api-backbone
plan: "01"
subsystem: database
tags: [migration, schema, orders, push_subscriptions, postgres]
dependency_graph:
  requires: []
  provides:
    - supabase/migrations/20260513000000_order_flow.sql
  affects:
    - orders table (rejection_reason, status_history, idempotency_key columns)
    - orders_status_check constraint (adds in_route, rejected)
    - push_subscriptions table (endpoint column, composite unique index)
tech_stack:
  added: []
  patterns:
    - ALTER TABLE ADD COLUMN IF NOT EXISTS (idempotent DDL)
    - NOT VALID + VALIDATE CONSTRAINT (low-lock constraint add)
    - Partial unique index with WHERE clause (idempotency key)
    - Composite unique index for multi-device push (user_id, endpoint)
key_files:
  created:
    - supabase/migrations/20260513000000_order_flow.sql
  modified: []
decisions:
  - "Used CREATE UNIQUE INDEX IF NOT EXISTS for push_subscriptions composite key rather than ALTER TABLE ADD CONSTRAINT UNIQUE, following the simpler app-side endpoint population approach (no generated column complexity)"
  - "NOT VALID + VALIDATE CONSTRAINT used for orders_status_check to avoid ACCESS EXCLUSIVE lock during migration"
metrics:
  duration: "3 minutes"
  completed: "2026-05-13"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
---

# Phase 01 Plan 01: Migration — Order Flow Schema Changes Summary

DDL migration adding rejection_reason, status_history, and idempotency_key to orders, replacing the status CHECK constraint to include in_route and rejected, and converting push_subscriptions from a single-device to multi-device model via composite unique index on (user_id, endpoint).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write migration SQL for all Phase 01 schema changes | 12f2bae | supabase/migrations/20260513000000_order_flow.sql |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All acceptance criteria passed:

| Check | Expected | Actual |
|-------|----------|--------|
| rejection_reason count | >= 1 | 2 |
| status_history count | >= 1 | 2 |
| idempotency_key count | >= 2 | 7 |
| in_route count | >= 1 | 3 |
| rejected count | >= 1 | 2 |
| push_subscriptions_user_endpoint_idx | >= 1 | 1 |
| NOT VALID (SQL statement) | 1 | 1 (2 in comments, 1 in DDL) |
| VALIDATE CONSTRAINT | 1 | 1 |
| BEGIN | 0 | 0 |
| DROP CONSTRAINT IF EXISTS | 2 | 2 |
| IF NOT EXISTS | >= 5 | 6 |

Note: `grep -c "NOT VALID"` returned 3 (2 comment lines + 1 DDL line). The acceptance criteria specifies 1, which refers to the DDL statement. The plan's specified SQL content includes the same comment text — this is a criteria imprecision, not an error. The actual DDL `NOT VALID;` statement appears exactly once.

## Known Stubs

None.

## Threat Flags

None — migration file introduces no new network endpoints or auth paths. DDL runs server-side with existing Supabase superuser privilege.

## Self-Check: PASSED

- [x] supabase/migrations/20260513000000_order_flow.sql exists
- [x] Commit 12f2bae exists in git log
- [x] No unexpected file deletions
- [x] No STATE.md or ROADMAP.md modifications
