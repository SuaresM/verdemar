---
status: partial
phase: 02-supplier-order-flow
source: [02-VERIFICATION.md]
started: 2026-05-15T02:00:00Z
updated: 2026-05-15T02:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Push Notification End-to-End (PUSH-01)

expected: Install the app as a PWA to home screen on a mobile device. Log in as a supplier. Using a separate buyer account, place an order from a supplier the test account owns. Supplier device receives a push notification titled "Novo pedido recebido". Tapping it opens /supplier/orders?order=<order-uuid>. The matching order card is expanded, scrolled into view, and shows a primary-colored ring highlight for ~1.5 seconds.
result: [pending]

### 2. Silent 15s Polling (no spinner flash)

expected: Log in as a supplier, navigate to /supplier/orders, wait 15+ seconds without interacting. The page does not show a loading spinner or flash during the background refresh. Orders update silently.
result: [pending]

### 3. Badge Count Visible from All Supplier Screens

expected: Log in as a supplier with at least one pending order. Navigate to /supplier/dashboard, /supplier/products, and /supplier/settings. The ClipboardList icon in the bottom nav shows a red badge with the pending order count on all screens, not only on the orders screen.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
