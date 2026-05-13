---
phase: 01-schema-api-backbone
plan: "04"
subsystem: api
tags:
  - security
  - authorization
  - state-machine
  - push-notifications
  - idempotency
dependency_graph:
  requires:
    - "01-01"  # DB migration adding rejection_reason, status_history, idempotency_key columns
    - "01-02"  # OrderStatus type expansion (in_route, rejected)
    - "01-03"  # src/services/supabase.ts updateOrderStatus signature
  provides:
    - "Secure PATCH /orders/:id/status with auth + state-machine enforcement"
    - "Multi-device push via sendPush() with 410/404 stale-row purge"
    - "sendPushToBuyer() helper for buyer status notifications"
    - "Idempotent POST /orders using upsert on idempotency_key"
    - "Composite-key POST /push/subscribe upsert on (user_id, endpoint)"
  affects:
    - "api/[...route].ts"
tech_stack:
  added: []
  patterns:
    - "fetch-then-check ownership pattern (vs. filter-in-update) for orders"
    - "ALLOWED transition table (actor + from[] guards) for state-machine"
    - "fire-and-forget push via .catch(() => {}) on async function"
    - "multi-device push iteration with per-row stale subscription purge"
    - "conditional upsert (idempotency_key present → include in payload)"
key_files:
  created: []
  modified:
    - "api/[...route].ts"
decisions:
  - "Used fetch-first pattern (select then update) for PATCH /orders/:id/status because buyer_id and supplier_id are different columns; cannot use single .eq() ownership filter in the update"
  - "sendPushToBuyer makes a second DB query to get buyer_id because orderId alone is available in the PATCH handler; accepted cost for clean separation"
  - "idempotency_key upsert uses ignoreDuplicates: false so the DB returns the existing row on conflict — frontend gets the same order in the response body either way"
  - "sendPushToBuyer .single() is acceptable because orderId is a PK lookup, guaranteed unique; only sendPush (multi-user-device) needed the iterator"
metrics:
  duration: "6m 34s"
  completed: "2026-05-13T23:22:02Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
  files_created: 0
---

# Phase 01 Plan 04: API Security — Auth Guard + State Machine + Multi-Device Push Summary

**One-liner:** PATCH /orders/:id/status secured with buyer/supplier ownership check and ALLOWED transition table; sendPush refactored to iterate all devices and purge stale 410/404 subscriptions; POST /orders made idempotent via upsert on idempotency_key; POST /push/subscribe fixed to composite (user_id, endpoint) key.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite PATCH /orders/:id/status with full auth and state machine | ad4a7f5 | api/[...route].ts |
| 2 | Refactor sendPush + add sendPushToBuyer + POST /orders idempotency + push/subscribe composite key | a3bd7ca | api/[...route].ts |

## What Was Built

### Task 1: PATCH /orders/:id/status — Secure Handler

Replaced the 11-line insecure handler with a 70-line handler that:

1. Validates `newStatus` against a known-values list (400 on unknown)
2. Fetches the order row (status, buyer_id, supplier_id, status_history)
3. Establishes caller role: `isBuyer` or `isSupplier` — returns 403 if neither
4. Checks the ALLOWED transition table (actor role + valid predecessor states) — 422 on invalid transition with descriptive message
5. Requires `reason` when `newStatus === 'rejected'` — 400 if missing
6. Builds update payload with JS-side status_history append (read array → push entry → write full array)
7. Writes to DB via adminSupabase
8. Calls `sendPushToBuyer(orderId, newStatus).catch(() => {})` fire-and-forget

### Task 2: Four Further Changes

**A. sendPush() rewrite (multi-device):**
- Changed signature from `(supplierId, orderId)` to `(userId, payload: object)`
- Replaced `.single()` with no-filter select returning all rows
- Iterates `for (const row of data ?? [])` calling `webpush.sendNotification` per row
- Catches errors and purges rows with statusCode 410 or 404

**B. sendPushToBuyer() new helper:**
- Fetches `buyer_id` from orders table by orderId
- Maps newStatus to Portuguese push labels
- Calls `sendPush(buyer_id, { title, body, url })`

**C. POST /orders idempotency:**
- Extracts `idempotency_key?` from request JSON
- Conditionally builds `orderPayload` (includes key only if present)
- Changed `.insert()` to `.upsert({ onConflict: 'idempotency_key', ignoreDuplicates: false })`
- Returns existing row on duplicate key

**D. POST /push/subscribe composite key:**
- Extracts `endpoint` from subscription object
- Stores `endpoint` as separate column in upsert payload
- Changed `onConflict: 'user_id'` to `onConflict: 'user_id,endpoint'`

Also updated the `sendPush` call in POST /orders to use the new 2-arg payload object signature.

## Deviations from Plan

None — plan executed exactly as written. All seven changes described in the objective were applied across two tasks.

## Security Outcomes

All STRIDE threats from the threat model are now mitigated:

| Threat | Mitigation Applied |
|--------|--------------------|
| T-01-P-01: Unauthorized status manipulation | isBuyer/isSupplier check + ALLOWED actor rule → 403 |
| T-01-P-02: Status transition attacks | ALLOWED[newStatus].from check → 422 with current/target in message |
| T-01-P-03: Spoofing buyer/supplier identity | JWT-extracted userId compared to DB buyer_id/supplier_id |
| T-01-P-04: status_history injection | status_history built server-side only; request body supplies only status + reason |
| T-01-P-05: Push subscription pollution | requireAuth ensures userId comes from JWT, not request body |
| T-01-P-06: Duplicate order injection | POST /orders upserts on idempotency_key |
| T-01-P-07: buyer_id info disclosure | buyer_id fetched server-side, never in response body |

## Known Stubs

None.

## Threat Flags

No new security-relevant surface introduced beyond what was already in the plan's threat model. The PATCH handler moves from zero authorization to full authorization — it reduces attack surface.

## Self-Check

- [x] `api/[...route].ts` exists and is modified
- [x] Commit ad4a7f5 exists (Task 1)
- [x] Commit a3bd7ca exists (Task 2)
- [x] No api/ TypeScript errors (`npx tsc --noEmit` shows no api/ errors)
- [x] grep -c "isBuyer" returns 3+ lines
- [x] grep -c "isSupplier" returns 3+ lines
- [x] grep -c "ALLOWED" returns 2 lines in PATCH handler
- [x] grep -c "status_history" returns 5+ lines
- [x] grep -c "sendPushToBuyer" returns 2 (definition + call)
- [x] grep -c "for (const row of data" returns 1
- [x] grep -c "statusCode === 410" returns 1
- [x] grep -c "statusCode === 404" returns 1
- [x] grep -c "idempotency_key" returns 6
- [x] grep -c "onConflict: 'user_id,endpoint'" returns 1
- [x] grep -c "onConflict: 'user_id'" returns 0

## Self-Check: PASSED
