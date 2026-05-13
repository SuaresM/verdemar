---
status: partial
phase: buyer-delivery-select
source: [buyer-delivery-select-VERIFICATION.md]
started: 2026-05-13T03:00:00-03:00
updated: 2026-05-13T03:00:00-03:00
---

## Current Test

[awaiting human testing]

## Tests

### 1. CityCombobox blur-reset behavior
expected: Type a partial city name (e.g. "Gama"), blur without selecting from dropdown → input resets to last valid city (or empty if none selected before), error "Selecione uma cidade da lista" appears below input
result: [pending]

### 2. Profile edit mode layout
expected: City field shows full-width CityCombobox. Estado field below it shows read-only input (gray background, gray text) auto-filled when city is selected. No side-by-side grid for Cidade+Estado.
result: [pending]

### 3. Cart — supplier with zero delivery zones
expected: Delivery section shows red message "Fornecedor ainda não configurou horários de entrega". "Finalizar pedido" button is disabled.
result: [pending]

### 4. Cart end-to-end zone+day flow
expected: Step 1 shows zones as "Seg, Qua, Sex — 07:00 às 09:00". Selecting a zone reveals Step 2. Step 2 shows full Portuguese day names (Segunda, Quarta, Sexta). Selecting a day stores "Quarta — 07:00 às 09:00" and enables the checkout button.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
