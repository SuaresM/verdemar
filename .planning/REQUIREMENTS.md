# Requirements: Rota Verde — v1.1 Fluxo de Pedidos

**Defined:** 2026-05-13
**Core Value:** Comprador consegue fazer pedido de hortifrúti para múltiplos fornecedores em uma única sessão, com entrega agendada na janela certa.

## v1.1 Requirements

### API / Segurança

- [ ] **API-01**: Atualização de status de pedido valida papel do ator (comprador só cancela enquanto pendente; fornecedor controla confirmado/em rota/entregue/recusado) e rejeita transições inválidas com mensagem de erro clara
- [ ] **API-02**: Criação de pedido é idempotente — reenvio com mesmo idempotency-key retorna pedido existente sem duplicar
- [ ] **API-03**: Subscriptions de push suportam múltiplos dispositivos por usuário (composite key user_id+endpoint; send itera todos; purga 410/404 stale)

### Confirmação de Pedido (comprador)

- [ ] **CONF-01**: Comprador vê tela de confirmação com número do pedido após finalizar checkout
- [ ] **CONF-02**: Confirmação mostra resumo por fornecedor (itens, quantidade, preço unitário, total)
- [ ] **CONF-03**: Confirmação mostra janela de entrega agendada por fornecedor
- [ ] **CONF-04**: Confirmação mostra link "Ver Pedido" que abre detalhes com status atual

### Gestão de Pedidos (fornecedor)

- [ ] **SUPP-01**: Fornecedor vê lista de pedidos pendentes com contador de não lidos
- [ ] **SUPP-02**: Fornecedor aceita pedido com um toque (sem dialog de confirmação)
- [ ] **SUPP-03**: Fornecedor recusa pedido com motivo obrigatório (lista predefinida: Sem estoque, Fora de temporada, Região/dia inválido, Pedido mínimo, Preço desatualizado, Outro + campo livre)
- [ ] **SUPP-04**: Fornecedor marca pedido como "Em rota"
- [ ] **SUPP-05**: Fornecedor marca pedido como "Entregue"

### Rastreamento de Status (comprador)

- [ ] **TRACK-01**: Comprador vê status atual do pedido (pendente / confirmado / em rota / entregue / recusado / cancelado)
- [ ] **TRACK-02**: Comprador vê histórico de estados com timestamps (timeline visual)
- [ ] **TRACK-03**: Comprador pode cancelar pedido enquanto status = pendente
- [ ] **TRACK-04**: Comprador vê motivo da recusa quando pedido é recusado

### Notificações Push

- [ ] **PUSH-01**: Fornecedor recebe push ao chegar novo pedido; tap abre pedido diretamente
- [ ] **PUSH-02**: Comprador recebe push quando pedido é confirmado, recusado, em rota ou entregue; tap abre detalhe do pedido

### Histórico de Pedidos

- [ ] **HIST-01**: Comprador vê histórico de todos seus pedidos com status visível na lista
- [ ] **HIST-02**: Fornecedor vê histórico de pedidos recebidos com status visível na lista
- [ ] **HIST-03**: Comprador e fornecedor filtram histórico por status e por período de data

---

## v1.2 Requirements (Deferred)

### Aceite Parcial

- **PART-01**: Fornecedor pode aceitar pedido com quantidade reduzida (counter-offer)
- **PART-02**: Comprador recebe notificação de aceite parcial e pode aceitar ou cancelar

### Qualidade de Vida

- **QOL-01**: Comprador pode repetir pedido a partir do histórico
- **QOL-02**: Fornecedor vê total de pedidos por período no histórico
- **QOL-03**: Fornecedor recebe push de lembrete se pedido pendente sem ação por 2+ horas
- **QOL-04**: Comprador pode buscar pedido por número no histórico

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Pagamento online | Fora do escopo MVP; negociação offline |
| NF-e / faturamento automático | Complexidade fiscal; defer |
| Chat comprador-fornecedor | WhatsApp link suficiente por ora |
| Rastreamento GPS em tempo real | Complexity disproportionate |
| Supabase Realtime para status | Bug conhecido (RLS #35195); usar polling 15s |
| Exportar CSV/PDF do histórico | Não solicitado; defer |
| Aceite parcial v1.1 | Complexidade de schema; v1.2 |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| API-01 | Phase 01 | Pending |
| API-02 | Phase 01 | Pending |
| API-03 | Phase 01 | Pending |
| CONF-01 | Phase 03 | Pending |
| CONF-02 | Phase 03 | Pending |
| CONF-03 | Phase 03 | Pending |
| CONF-04 | Phase 03 | Pending |
| SUPP-01 | Phase 02 | Pending |
| SUPP-02 | Phase 02 | Pending |
| SUPP-03 | Phase 02 | Pending |
| SUPP-04 | Phase 02 | Pending |
| SUPP-05 | Phase 02 | Pending |
| TRACK-01 | Phase 03 | Pending |
| TRACK-02 | Phase 03 | Pending |
| TRACK-03 | Phase 03 | Pending |
| TRACK-04 | Phase 03 | Pending |
| PUSH-01 | Phase 02 | Pending |
| PUSH-02 | Phase 03 | Pending |
| HIST-01 | Phase 04 | Pending |
| HIST-02 | Phase 04 | Pending |
| HIST-03 | Phase 04 | Pending |

**Coverage:**
- v1.1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-13*
*Last updated: 2026-05-13 — Roadmap created, traceability filled*
