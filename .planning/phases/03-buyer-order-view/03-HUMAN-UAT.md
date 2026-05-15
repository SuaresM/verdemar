---
status: partial
phase: 03-buyer-order-view
source: [03-VERIFICATION.md]
started: 2026-05-15
updated: 2026-05-15
---

## Current Test

[awaiting human testing]

## Tests

### 1. OrderDetail renders with real Supabase data
expected: Navigate to /orders/:id for a real order — supplier name, items list, and status badge all appear; joined data (supplier.store_name, order.items) is not null/empty
result: [pending]

### 2. Cancel flow works end-to-end
expected: On a pending order, tap "Cancelar pedido" — spinner shows, status changes to "Cancelado pelo comprador", cancel button disappears; cancel on non-pending order shows no button
result: [pending]

### 3. Checkout overlay shows correct data
expected: Complete a checkout — overlay shows order number (#XXXXXXXX), items with quantities and subtotals, section total, delivery slot (if set); "Ver Pedido" button navigates to /orders/:id
result: [pending]

### 4. Push notification deep-link
expected: Install PWA to home screen, place an order from another session, receive push when supplier confirms/rejects — tapping notification opens /orders/:id on the correct order detail page
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
