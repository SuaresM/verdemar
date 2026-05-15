---
plan: 02-03
phase: 02-supplier-order-flow
status: complete
completed: 2026-05-14
commits:
  - c4ce438 feat(02-03): rewrite supplier Orders.tsx
key-files:
  created: []
  modified:
    - src/pages/supplier/Orders.tsx
---

# Plan 02-03 Summary — Orders.tsx Rewrite + RejectOrderModal

## What Was Built

**Task 2 — Orders.tsx full rewrite (c4ce438):**

Two-section layout: "Pendentes" (pending) + "Em andamento" (confirmed/in_route).
Delivered/cancelled/rejected excluded. Client-side filter on active-only DB result.

STATUS_TRANSITIONS updated: Aceitar (pending→confirmed), Em rota (confirmed→in_route), Entregue (in_route→delivered). In_delivery legacy kept.

RejectOrderModal bottom sheet (EditOrderModal pattern): 6 predefined reasons + Outro with mandatory free text. Submit disabled until valid. Available on pending AND confirmed orders. On submit: updateOrderStatus with rejectionReason + WhatsApp toast.

15s polling with hasLoaded ref guard (no spinner flash). Deep-link via useSearchParams ?order=id — scrolls + expands card on mount. handleCancel removed (buyer-only action).

## Human Verification Checklist

1. Two sections render: "Pendentes (N)" and "Em andamento"
2. "Aceitar" on pending confirms immediately, no dialog
3. "Recusar" opens bottom sheet; blocked without reason
4. "Outro" requires free text before submit enables
5. After reject: WhatsApp toast action appears
6. Confirmed order has both "Em rota" and "Recusar"
7. In-route order has only "Entregue" (no Recusar)
8. Push tap opens /supplier/orders?order=id; scrolls to card
9. List refreshes silently every 15s
10. Delivered/cancelled/rejected orders not shown

## Self-Check: PASSED

- Two sections render correctly
- STATUS_TRANSITIONS uses in_route, not in_delivery
- Recusar on pending + confirmed
- Submit blocked without valid reason
- Deep-link useSearchParams wired
- handleCancel removed
- TypeScript: 0 errors
