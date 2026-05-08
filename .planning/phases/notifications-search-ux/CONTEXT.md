---
phase: notifications-search-ux
created: 2026-05-08
status: ready-for-planning
---

# Phase: Notificações + UX Fixes — Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Quatro melhorias concretas ao fluxo de pedidos e UX do app:

1. **Notificação confiável ao fornecedor** — garantir que o fornecedor sempre receba a mensagem quando o comprador finaliza um pedido (tornar WhatsApp obrigatório na tela de sucesso do comprador)
2. **Notificação confiável ao comprador** — quando o fornecedor avança o status do pedido, notificar o comprador via toast com botão WhatsApp (em vez de auto-open que pode ser bloqueado pelo PWA)
3. **Tutorial redimensionado** — corrigir o layout completo do tooltip do intro.js (não só o botão "Pular") para todos os roles no mobile
4. **Nome do fornecedor no ProductCard** — exibir o nome do fornecedor abaixo do nome do produto em todos os ProductCards onde o supplier estiver disponível

</domain>

<decisions>
## Implementation Decisions

### D-01 — Notificação ao fornecedor (pedido novo)

- **Tornar WhatsApp obrigatório:** Na tela de sucesso do pedido (`Cart.tsx`), bloquear o botão "Ver meus pedidos" até o comprador tocar em "Enviar pedido no WhatsApp". O botão "Ver meus pedidos" só deve ser clicável APÓS o comprador abrir o WhatsApp (ou seja, após o click no link de WhatsApp). Implementar com estado `whatsappOpened: boolean`.
- **Push notification:** Manter mensagem genérica atual `'Novo pedido recebido!'` no `sendPush` — sem alteração na mensagem (sem expor dados do comprador).
- **Arquivo afetado:** `src/pages/buyer/Cart.tsx` — adicionar estado `whatsappOpened` e desabilitar botão "Ver meus pedidos" enquanto `!whatsappOpened`

### D-02 — Notificação ao comprador (mudança de status)

- **Substituir `openWhatsApp()` direto por toast persistente com botão:** Em `src/pages/supplier/Orders.tsx`, a função `handleUpdateStatus` não deve mais chamar `openWhatsApp()` diretamente. Em vez disso, deve exibir um toast persistente (como o modal de edição já faz) com botão "Abrir WhatsApp".
- **Em todas as transições:** Aplicar em todas: `pending→confirmed`, `confirmed→in_delivery`, `in_delivery→delivered`, e cancelamento via `handleCancel`.
- **Padrão de referência:** O `EditOrderModal` já usa o padrão correto: `toast.success('...', { description: '...', action: { label: '💬 Abrir WhatsApp', onClick: () => window.open(url, '_blank') }, duration: 15000 })` — replicar exatamente esse padrão.
- **Arquivo afetado:** `src/pages/supplier/Orders.tsx` — refatorar `handleUpdateStatus` e `handleCancel`

### D-03 — Tutorial: redimensionamento completo

- **Escopo:** Fix completo do tooltip do intro.js — não apenas o botão "Pular", mas também largura máxima, padding interno e tamanho de fonte para caber bem no mobile.
- **Todos os roles:** Comprador, fornecedor e admin usam o mesmo CSS global do intro.js (`src/index.css`). Um único fix beneficia todos.
- **Abordagem:** Adicionar/ajustar regras CSS nas classes `.introjs-tooltip`, `.introjs-skipbutton`, `.introjs-tooltiptext` em `src/index.css`. Usar `max-width: calc(100vw - 2rem)` para responsividade mobile.
- **Arquivo afetado:** `src/index.css`

### D-04 — Nome do fornecedor no ProductCard

- **Posição:** Abaixo do nome do produto (`product.name`), antes do `PriceTag`. Ex: `🏪 Hortifruti São Paulo`.
- **Escopo:** Em TODOS os `ProductCard` onde `sup` (supplier) estiver disponível — não só na busca, mas também na Home e no SupplierProfile.
- **Campo a exibir:** `sup.store_name` (nome da loja do fornecedor).
- **Condicional:** Exibir somente quando `sup` existir (o prop já é opcional). Quando `sup` não existe, não exibir nada.
- **Arquivo afetado:** `src/components/product/ProductCard.tsx`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pedidos e status
- `src/pages/supplier/Orders.tsx` — fluxo de status de pedido, `handleUpdateStatus`, `handleCancel`, padrão atual de `openWhatsApp()`
- `src/pages/buyer/Cart.tsx` — tela de sucesso do pedido, `checkoutSuccess` state, botão WhatsApp

### Notificações
- `src/services/whatsapp.ts` — `openWhatsApp()` e `openSupportWhatsApp()`
- `src/lib/pushNotifications.ts` — `subscribeToPush()`
- `api/[...route].ts` — `sendPush()` (linha ~261), rota `POST /orders` que dispara push

### Tutorial
- `src/hooks/useOnboarding.ts` — intro.js setup, `skipLabel: 'Pular'`, `showProgress`, steps por role
- `src/index.css` — CSS overrides do intro.js (`.introjs-skipbutton`, `.introjs-helperLayer`, etc.)

### ProductCard
- `src/components/product/ProductCard.tsx` — layout atual do card, prop `supplier?: Supplier`
- `src/types/index.ts` — tipo `Supplier` com campo `store_name`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Toast com action button** (padrão EditOrderModal em `Orders.tsx` linhas 86-93): `toast.success('...', { description, action: { label: '💬 Abrir WhatsApp', onClick }, duration: 15000 })` — usar EXATAMENTE esse padrão em D-02
- **`openWhatsApp(phone, message)`** em `src/services/whatsapp.ts` — apenas constrói URL, não deve mudar
- **`formatOrderStatusMessage(status, order, supplier)`** em `src/utils` — já formata mensagem por status, já disponível
- **`.introjs-*` CSS classes** em `src/index.css` — já tem overrides para helperLayer, skipbutton, progressbar; adicionar tooltip width/padding

### Established Patterns
- **Toast persistente + action** já é o padrão estabelecido pelo EditOrderModal — não usar `window.open()` direto em handlers async
- **Estado por-pedido** (`updating[order.id]`) — padrão de loading state em `Orders.tsx`; para D-02, o toast substitui o loading state extra
- **`checkoutSuccess` state** em `Cart.tsx` — já controla exibição da tela de sucesso; adicionar `whatsappOpened` ao mesmo objeto ou como estado separado

### Integration Points
- D-01: `checkoutSuccess.whatsappUrl` já está disponível como `href` no `<a>` tag — adicionar `onClick` que seta `whatsappOpened = true`
- D-02: `handleUpdateStatus` e `handleCancel` já têm o supplier e order disponíveis; apenas trocar `openWhatsApp()` direto por toast
- D-04: `const sup = supplier || product.supplier` já existe no ProductCard — usar `sup?.store_name` diretamente

</code_context>

<specifics>
## Specific Ideas

- O botão "Ver meus pedidos" deve FICAR VISÍVEL na tela de sucesso mas desabilitado (opaco) até o comprador abrir o WhatsApp — não esconder o botão, apenas bloquear
- A mensagem do toast de status para o fornecedor deve ficar aberta por 15 segundos (igual ao EditOrderModal), não o padrão de 4s
- O nome do fornecedor no ProductCard deve ser pequeno e discreto — texto `xs` em cinza, com emoji 🏪 como prefixo

</specifics>

<deferred>
## Deferred Ideas

- Push notifications para compradores (quando status muda) — requer comprador conceder permissão; complexidade extra. Pode ser uma fase futura.
- Email de confirmação de pedido — fora do escopo desta fase
- Histórico de notificações no app — fora do escopo

</deferred>

---

*Phase: notifications-search-ux*
*Context gathered: 2026-05-08*
