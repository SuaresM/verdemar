# Phase: product-stock-zones-ux — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** product-stock-zones-ux
**Areas discussed:** Campos condicionais de venda, Gestão de estoque rápida, Bug zonas de entrega, Accordion lista de RAs

---

## Campos condicionais de venda

| Option | Description | Selected |
|--------|-------------|----------|
| peso da cx obrigatório para kg | Exige preenchimento de box_weight_kg quando sale_unit=kg | ✓ |
| peso da cx opcional | Campo disponível mas não obrigatório | |

**User's choice:** Obrigatório

| Option | Description | Selected |
|--------|-------------|----------|
| Só quantidade para box | Para venda por caixa: apenas box_unit_quantity (sem box_weight_kg) | ✓ |
| Quantidade + peso para box | Mostrar box_unit_quantity E box_weight_kg para box | |

**User's choice:** Só quantidade (sem peso da cx para venda em caixa)

**Notes:** User's original description: "caso seja no kg aparece a opção de escrever o peso da cx, caso seja por cx a quantidade de unidade que vem na caixa, caso seja por unidade, não precisa preencher a quantidade quem vem em cada unidade"

---

## Gestão de estoque rápida

| Option | Description | Selected |
|--------|-------------|----------|
| Botões +/- no card | Incrementa/decrementa inline | |
| Campo editável inline | Toca no número → vira input | ✓ |
| Ícone abre mini-modal | Modal separado para editar | |

**User's choice:** Campo editável inline

| Option | Description | Selected |
|--------|-------------|----------|
| Some automaticamente | Produto some quando estoque=0 (atual) | |
| Toggle 'aceitar mesmo sem estoque' | Cada produto tem opção de vender sem estoque | ✓ |

**User's choice:** Toggle por produto

**Notes:** Requires DB migration (sell_without_stock column) + 2 new API PATCH routes.

---

## Bug zonas de entrega

| Option | Description | Selected |
|--------|-------------|----------|
| Modal abre mas não salva | PUT API falha silenciosamente | ✓ |
| Botão editar não abre modal | Pencil não abre nada | |
| Zona some, não consegue recriar | Delete + create ciclo quebrado | |
| City/estado não salva corretamente | Salva com campos errados | |

**User's choice:** Modal abre mas não salva

**Notes:** Likely causes: (1) `supplier` null → silent return; (2) `setEditingZone(null)` missing on close paths; (3) `supplier_id` mismatch in PUT query (0 rows updated, no error). Planner to investigate and fix all three.

---

## Accordion lista de RAs

| Option | Description | Selected |
|--------|-------------|----------|
| Todas recolhidas | Lista começa escondida | ✓ |
| Configuradas expandidas | Apenas RAs com zona expandidas | |
| Todas expandidas | Mantém comportamento atual | |

**User's choice:** Todas recolhidas por padrão

**Notes:** Header shows count badge "X de 32 configuradas" even when collapsed. ChevronDown icon rotates on expand.

---

## Claude's Discretion

- Nenhuma área delegada ao Claude — todas as decisões foram escolhidas pelo usuário.

## Deferred Ideas

- Notificações de estoque baixo para o fornecedor
- Atualização de estoque em massa (múltiplos produtos)
- Histórico de movimentação de estoque
- Preço diferenciado por zona de entrega (RA)
