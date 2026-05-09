---
status: partial
phase: product-stock-zones-ux
source: [product-stock-zones-ux-VERIFICATION.md]
started: 2026-05-09T00:00:00Z
updated: 2026-05-09T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. D-01: kg field conditional rendering + inline error
expected: Switching sale_unit to kg shows 'Peso da caixa (kg) *' field; submitting without it shows inline error 'Peso da caixa obrigatório'
result: [pending]

### 2. D-01: box field absence
expected: Switching sale_unit to box shows NO 'Peso da caixa (kg)' input in the pricing section
result: [pending]

### 3. D-02: Inline stock edit flow
expected: Tapping stock count auto-focuses input; pressing Enter shows toast 'Estoque atualizado' and updates list without reload
result: [pending]

### 4. D-02: sell_without_stock optimistic toggle
expected: Toggle flips immediately (optimistic); toast confirms; reverts to original state on API error
result: [pending]

### 5. D-03: Zone modal state cleanup — success path
expected: After saving an edit, modal closes; reopening Add modal shows empty form
result: [pending]

### 6. D-03: Zone modal state cleanup — Cancel and background paths
expected: Cancel and background overlay both close modal and clear editingZone; subsequent Add modal is empty
result: [pending]

### 7. D-04: Initial collapsed state + count badge
expected: StoreSettings 'Regiões de Entrega — DF' section starts collapsed; header shows '{N}/32 configuradas'
result: [pending]

### 8. D-04: Accordion toggle + chevron animation
expected: Clicking header expands list + chevron rotates 180deg; clicking again collapses
result: [pending]

### 9. D-04: 'Outra cidade' button independence
expected: Clicking 'Outra cidade' opens Add modal without expanding the RA accordion
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps
