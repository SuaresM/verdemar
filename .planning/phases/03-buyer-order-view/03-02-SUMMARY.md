---
phase: 03-buyer-order-view
plan: "02"
subsystem: buyer-cart
tags: [cart, checkout, overlay, confirmation, bug-fix]
dependency_graph:
  requires: [03-01]
  provides: [enriched-checkout-overlay, CONF-01, CONF-02, CONF-03, CONF-04]
  affects: [src/pages/buyer/Cart.tsx]
tech_stack:
  added: []
  patterns: [IIFE-in-JSX, capture-before-clear]
key_files:
  created: []
  modified:
    - src/pages/buyer/Cart.tsx
decisions:
  - "Captured items/total/slot into local vars before clearSection() to fix closure bug"
  - "IIFE pattern in JSX for clean destructuring of checkoutSuccess without non-null assertion"
  - "Ver Pedido always enabled — WhatsApp gate (disabled={!whatsappOpened}) removed per D-04"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-15"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 03 Plan 02: Cart Checkout Overlay Enrichment Summary

**One-liner:** Fixed closure bug capturing cart items before clearSection() and replaced checkout overlay with full-screen scrollable confirmation showing order number, item list, totals, and delivery slot.

---

## Tasks Completed

| Task | Name | Commit | Files Modified |
|------|------|--------|---------------|
| 1 | Fix checkoutSuccess state type and capture order in handleCheckout | 5bfb8cb | src/pages/buyer/Cart.tsx |
| 2 | Replace checkout overlay JSX with enriched full-screen layout (CONF-01..04) | 8cd65c9 | src/pages/buyer/Cart.tsx |

---

## What Was Built

### Task 1 — Bug fix + state type expansion

Expanded `checkoutSuccess` state type from `{ whatsappUrl, supplierName, orderId }` to include:
- `items: CartSection['items']` — per-item data for the overlay
- `sectionTotal: number` — section total for display
- `deliveryTimePreference: string | null` — delivery slot text

Fixed the critical closure bug in `handleCheckout`: items, total, and slot were previously read from `checkoutSection` AFTER `clearSection()` and `setCheckoutSection(null)` had already nulled it. Now captured into `capturedItems`, `capturedTotal`, `capturedSlot` before the clear calls.

### Task 2 — Enriched overlay (CONF-01..04)

Replaced the generic success screen with a full-screen scrollable confirmation overlay:
- **CONF-01:** Order number `#{orderId.slice(0,8).toUpperCase()}` displayed below heading
- **CONF-02:** Items summary card with per-item quantity/name/subtotal and section total in BRL
- **CONF-03:** Delivery slot block (CalendarClock icon + "Janela de entrega" label) shown when `deliveryTimePreference` is truthy
- **CONF-04:** "Ver Pedido" button always enabled (no WhatsApp gate), navigates to `/orders/${orderId}`
- Added `CalendarClock` to Lucide imports
- Full-screen `flex flex-col` with `flex-1 overflow-y-auto` on content — action buttons pinned to bottom, never hidden on small phones
- WhatsApp CTA remains primary (first button, green, unchanged behavior)
- Removed `disabled={!whatsappOpened}` gate and old "Ver meus pedidos" ghost button

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Verification Results

1. TypeScript: zero errors in Cart.tsx
2. `capturedItems` declared at line 257, `clearSection` called at line 260 — correct order
3. `deliveryTimePreference` appears 9 times — state type + capture + setCheckoutSuccess payload + overlay conditional
4. `items.map` present in overlay block (line 479)
5. No `disabled={!whatsappOpened}` — WhatsApp gate removed
6. `navigate('/orders/${orderId}')` present (line 527)

---

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The `orderId` passed to `navigate()` is the server-assigned UUID from `createOrder()` response — not user-supplied. RLS on the orders table handles any unauthorized access attempts on the `/orders/:id` route.

---

## Self-Check: PASSED

- src/pages/buyer/Cart.tsx — FOUND (modified)
- Commit 5bfb8cb — FOUND (Task 1)
- Commit 8cd65c9 — FOUND (Task 2)
