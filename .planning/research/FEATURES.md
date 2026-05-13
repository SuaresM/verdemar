# Features Research — Order Flow

**Domain:** B2B fresh produce wholesale marketplace (restaurantes, mercados, feirantes buying from producers/distributors in Distrito Federal)
**Milestone:** v1.1 — Fluxo de Pedidos
**Researched:** 2026-05-13
**Overall confidence:** HIGH for table stakes (cross-verified across Choco, Fresho, Orderlion, Mercury VMP, MercurJS, Baymard); MEDIUM for B2B produce specifics (domain-verified but no DF-specific source)

---

## Category: Order Confirmation (Buyer)

### Table Stakes

These are expected by every buyer who clicks "Finalizar Pedido." Missing any of these causes distrust.

| Feature | Why Expected | Complexity |
|---------|--------------|------------|
| Order number prominently displayed | Reference for any follow-up; buyers copy this to WhatsApp supplier | Low |
| Visual success state (checkmark + "Pedido enviado") | Eliminates anxiety: "did it go through?" | Low |
| Per-supplier order summary (items, quantities, unit + total price) | Cart split by supplier already exists; confirmation must mirror that split | Low |
| Scheduled delivery slot confirmation | Buyer chose a specific day/window — confirmation must echo it back | Low |
| Supplier name + contact for each sub-order | Buyer will contact supplier via WhatsApp if problem; link already exists in codebase | Low |
| "Aguardando confirmação do fornecedor" status message | Sets correct expectation: order is not yet accepted | Low |
| Navigation back to home or order history | User flow must not dead-end | Low |

### Differentiators

Features that go beyond expected but add real value in this B2B context.

| Feature | Value Proposition | Complexity |
|---------|-------------------|------------|
| WhatsApp deep-link to supplier per sub-order | Friction-free escalation channel; matches how DF produce buyers already operate | Low |
| Estimated response window ("Fornecedores geralmente confirmam em X horas") | Calibrates buyer patience; reduces support queries | Low |
| "Repetir pedido" shortcut from confirmation screen | High reorder frequency in B2B; surfacing it immediately captures intent | Medium |

### Anti-Features (avoid)

| Anti-Feature | Why Avoid |
|--------------|-----------|
| Payment capture on confirmation screen | Payments are offline/negotiated; adding payment UI creates false expectation |
| Email confirmation at this stage | No email infra, users are PWA users on mobile; push notification + screen is sufficient |
| Rating/review prompt on confirmation | Way too early; buyer has not received anything yet |
| Cross-sell / upsell | B2B buyers ordered what they need; promoting extras is noise |
| Account creation prompt | Auth already exists; this pattern is B2C |

---

## Category: Supplier Order Management

### Table Stakes

Every supplier panel for food wholesale that works on mobile must have these.

| Feature | Why Expected | Complexity |
|---------|--------------|------------|
| Pending orders list with unread badge/count | Mercury VMP pattern: badge count on icon for unviewed orders; standard mobile expectation | Low |
| Per-order detail view: buyer name, items, quantities, delivery slot requested | Supplier must see everything needed to decide without calling | Low |
| Accept button (one-tap, prominent) | Primary action; must be frictionless | Low |
| Reject button with mandatory reason field | Rejection without reason creates buyer confusion and phone calls; mandatory per Mercury VMP and B2B procurement best practices | Low |
| Reason selection (predefined list + free text) | Reduces typing on mobile; speeds up rejection; provides data | Low |
| Timestamp of order arrival | Supplier needs to know if order is "hot" (just arrived) vs stale | Low |
| Buyer's scheduled delivery day visible at list level | Supplier's primary constraint: do I deliver there on that day? | Low |

### Predefined Rejection Reasons (recommended set for hortifruti context)

Based on the ME.com.br API rejection codes and fresh produce domain specifics, the relevant reasons for this domain are:

1. **Sem estoque suficiente** (OutOfStock — most common in produce)
2. **Produto fora de temporada** (ItemIsNoLongerProduced adapted)
3. **Não entrego nessa região nesse dia** (DoesNotMeetTheSpecifiedDeliveryTime)
4. **Pedido mínimo não atingido** (DoNotAcceptTheConditionOfSupply)
5. **Preço desatualizado — entrar em contato** (pricing negotiation signal)
6. **Outro motivo** (free text required if selected)

### Differentiators

| Feature | Value Proposition | Complexity |
|---------|-------------------|------------|
| Partial acceptance (accept some items, reject others) | Very common in produce: "tenho batata mas não tenho cebola"; avoids full rejection of a good order | High |
| Counter-offer on quantity (accept with modified qty) | Supplier has 80% of requested qty; buyer may prefer partial delivery to none | High |
| Delivery confirmation (mark as "Em rota" and "Entregue") | Closes the lifecycle loop; provides delivery proof; enables history | Low |
| Order sorting: newest first, with overdue flag | Orders not responded within X hours surface first | Low |

### Anti-Features

| Anti-Feature | Why Avoid |
|--------------|-----------|
| Complex ERP integration | Scope too large; suppliers in DF are small operators, not enterprise | — |
| Invoice generation from order panel | NF-e complexity; explicitly out of scope in PROJECT.md | — |
| Supplier-to-supplier messaging | Not in scope; WhatsApp handles supplier-buyer communication | — |
| Bulk accept all | Dangerous in fresh produce; each order needs at least a glance for stock reality | — |

---

## Category: Status Tracking

### Table Stakes

| Feature | Why Expected |
|---------|--------------|
| Status visible on order detail screen for buyer | Buyer tracks without calling supplier |
| Status visible on order card in supplier panel | Supplier sees where each order is in lifecycle |
| Status update triggers push notification to buyer | Real-time awareness; reduces inbound "cadê meu pedido?" contacts |

### States That Matter in B2B Produce

The existing codebase defines: `pendente → confirmado → em rota → entregue`. This is the correct set for this domain. Evidence from Fresho, Choco, and generic B2B food research confirms this 4-state model. Rationale per state:

| State | Trigger | Who Acts | Why It Matters |
|-------|---------|----------|----------------|
| **Pendente** | Buyer submits order | System (automatic) | Supplier has not yet seen/accepted; buyer is waiting |
| **Confirmado** | Supplier taps Accept | Supplier | Buyer can now plan receiving; order is locked |
| **Em rota** | Supplier taps "Saiu para entrega" | Supplier | Critical for fresh produce: buyer must be present or staff ready; very short shelf life means timing matters |
| **Entregue** | Supplier taps "Entregue" | Supplier | Closes loop; feeds history; enables re-order flow |
| **Recusado** | Supplier taps Reject + selects reason | Supplier | Buyer must know immediately so they can find alternative supplier |

**Additional state to consider (medium priority):**
- **Cancelado** — buyer cancels a pending order before supplier acts. Relevant because FRESHFARM Markets data shows buyers sometimes cancel within hours. Prevents supplier from preparing unnecessary orders.

### States NOT Worth Building Now

- "Em separação" (picking) — too granular for small DF producers
- "Parcialmente entregue" — requires partial fulfillment logic; defer to v1.2
- GPS "em rota" with live coordinates — explicitly out of scope (PROJECT.md)

---

## Category: Order History

### Table Stakes

| Feature | Why Expected | Complexity |
|---------|--------------|------------|
| Buyer: list of all their orders, newest first | Standard expectation; buyer needs to check status of recent orders | Low |
| Supplier: list of received orders, newest first | Supplier operational memory; "what did I deliver last Tuesday?" | Low |
| Order status visible in list without opening | Scan-and-filter behavior; buyer looks for "pendente" items | Low |
| Tap to open full order detail | Items, quantities, value, delivery slot, supplier/buyer info | Low |
| Date of order visible in list | Primary sort/filter anchor | Low |

### Filters That Matter

**Buyer filters (in priority order):**
1. **Status** (pendente / confirmado / em rota / entregue / recusado) — most used; buyer wants to see what is outstanding
2. **Fornecedor** — "show me all orders from Hortifruti Fachini"
3. **Date range** — "last 30 days" default; custom range for accountants
4. **Search by order number** — for WhatsApp references ("pedido #1234")

**Supplier filters (in priority order):**
1. **Status** — primary operational filter; "show me pending" is the most important view
2. **Date range** — "today's orders", "this week"
3. **Buyer name** — "show me orders from Restaurante X"
4. **Delivery date** — "what do I deliver tomorrow?"

**Implementation note:** OrderEase and B2B Wave research shows status + date range are the two filters 100% of B2B wholesale apps implement. Supplier + buyer name filters are secondary but meaningful at 3+ months of data. Build status and date first.

### Differentiators

| Feature | Value Proposition | Complexity |
|---------|-------------------|------------|
| "Repetir pedido" from history | High-frequency B2B reorders; one-tap to copy previous order to cart | Medium |
| Order value totals per period | Buyer expense tracking without spreadsheet; supplier revenue visibility | Low |
| Export (CSV or PDF) | Buyer accountants need records; monthly purchase reconciliation | Medium |

### Anti-Features

| Anti-Feature | Why Avoid |
|--------------|-----------|
| Advanced analytics dashboard | Scope creep; not needed for MVP; defer to v1.3+ |
| Real-time inventory in history view | History is historical; live stock belongs in browse/cart flow |

---

## Category: Lifecycle Notifications

### Table Stakes

**For Supplier (inbound):**
- Push notification when new order arrives — most critical; suppliers are not watching the app. Source: Choco pattern ("receive notifications when someone wants to order"), Mercury VMP ("push notification when new orders arrive")
- Notification must deep-link to the pending order detail, not to home screen

**For Buyer (outbound, triggered by status changes):**
- "Seu pedido foi confirmado por [Fornecedor]" → when supplier accepts
- "Seu pedido foi recusado por [Fornecedor]. Motivo: [reason]" → when supplier rejects; critical because buyer needs to act
- "Seu pedido está em rota" → when supplier marks em rota; buyer must be ready
- "Pedido entregue!" → when supplier marks entregue; closes loop for buyer

**Content principles (from push notification best practices research):**
- Include supplier name in every notification so buyer knows which of potentially several orders this relates to
- Include order number for reference
- Maximum 60 characters in title; keep body under 100 characters
- Deep-link to the specific order detail, not generic screen

### Notification Template Set (recommended)

| Event | Title (PT-BR) | Body |
|-------|--------------|------|
| New order (supplier) | "Novo pedido recebido" | "[Comprador] fez um pedido • #[número]" |
| Order confirmed (buyer) | "Pedido confirmado ✓" | "[Fornecedor] confirmou seu pedido #[número]" |
| Order rejected (buyer) | "Pedido não aceito" | "[Fornecedor]: [motivo resumido] • #[número]" |
| Em rota (buyer) | "Pedido a caminho" | "[Fornecedor] saiu para entrega • #[número]" |
| Delivered (buyer) | "Pedido entregue" | "[Fornecedor] confirmou a entrega • #[número]" |

### Differentiators

| Feature | Value Proposition | Complexity |
|---------|-------------------|------------|
| Notification for approaching cutoff ("Seu pedido ainda está pendente — entre em contato") | Fresh produce is time-sensitive; if supplier hasn't confirmed by X hours before delivery day, buyer needs to know | Medium |
| Supplier: reminder if pending order unactioned for 2+ hours | Prevents silent order loss; suppliers are busy and may miss initial push | Medium |

### Anti-Features

| Anti-Feature | Why Avoid |
|--------------|-----------|
| Marketing notifications (promotions, new suppliers) | Out of scope for this milestone; dilutes trust in transactional notifications |
| Notification preferences UI (granular on/off per event) | Premature optimization; all lifecycle events are high-signal for B2B users |
| SMS fallback | Infrastructure cost; PWA push sufficient for this stage |

---

## B2B Produce Context

**What makes this domain different from standard ecommerce orders:**

**1. Time compression and perishability**
Fresh produce has a 24–96 hour usability window after harvest. Orders placed today for tomorrow's delivery mean the acceptance window is hours, not days. CEASA-DF research confirms the wholesale market opens at 4h30 and transactions happen in the morning. Suppliers who buy at CEASA in the early morning need to confirm orders before 8–9am. This means: notification urgency is higher than standard ecommerce, and a pending order at 10am for a next-day delivery slot is already borderline.

**2. Variability in fulfillment**
Fresh produce availability changes daily. A supplier may have 80% of a requested item or none. Unlike SKU-based products, quantity is a variable, not a fixed attribute. This makes partial fulfillment a real operational reality (though complex to build — see Differentiators above). At minimum, rejection reason "Sem estoque suficiente" must exist as a first-class option.

**3. No payment in the platform (for now)**
B2B food wholesale in Brazil runs on confiança (trust) and offline payment (boleto, PIX, prazo). No payment integration means order confirmation is about logistics acknowledgment, not financial commitment. The confirmation screen should not imply payment was captured.

**4. Multi-supplier single session**
The cart already supports multi-supplier checkout. This means one "Finalizar Pedido" creates N orders (one per supplier). Confirmation screen must show N sub-orders with individual statuses. Notification triggers fire per order, not per session. History is order-level, not session-level.

**5. Relationship-based commerce**
In DF wholesale, buyer-supplier relationships are long-standing and personal. WhatsApp is the existing communication channel (already wired in checkout). Order management features should augment, not replace, the WhatsApp relationship. Rejection reason should be informative enough that the buyer understands without needing to call, but not so automated that it erodes the relationship.

**6. Buyer profile: restaurante/mercado, not tech-native**
Buyers (restaurants, markets, street vendors) use smartphones but are not tech enthusiasts. UI must be extremely literal — no ambiguous icons, no jargon, status labels in plain Portuguese. Order status must be readable at a glance without decoding.

**7. Supplier profile: small producer or local distributor**
Suppliers are individuals or small teams managing orders alongside physical operations (loading trucks, handling produce). Mobile UX must support one-handed operation, large tap targets, and minimal steps to confirm/reject. The supplier is probably doing this while walking in a warehouse.

---

## Mobile-First Considerations

**Supplier on mobile (critical path):**

- Pending orders list must be the default landing view for a logged-in supplier. Not a dashboard — just the list of things needing action.
- Each order card in the list must show: buyer name, delivery day, order total, item count, time received — enough to decide without opening.
- Accept = one tap. No confirmation dialog (the action is not destructive). Optimistic UI update.
- Reject = tap + bottom sheet with reason selection (not a modal that covers the screen). Reason list uses large radio buttons. Free text optional. Submit = one tap.
- Delivery confirmation ("Em rota", "Entregue") should be available from order detail AND from a persistent action button on the list card. Supplier should not navigate into detail just to tap "Entregue."
- Notification deep-link must open the specific order, not the home screen.

**Buyer on mobile (standard path):**

- Post-checkout confirmation screen replaces the cart view. Back navigation goes to home, not back into checkout.
- Order status in history is a color-coded chip/badge (green = entregue, amber = confirmado, red = recusado, gray = pendente). Do not rely on color alone — include label text for accessibility.
- History list default is "últimos 30 dias," status = all. Most common action is "tap status chip to filter by pendente."
- "Repetir pedido" button is secondary action on order detail — not primary. Primary is viewing details/status.
- Notification tap navigates to order detail directly, with clear back navigation to history.

**PWA-specific constraints:**

- Push notifications already work (infra from phase notifications-search-ux). Notification payload must include enough data for direct deep-link without extra API call on tap.
- Service worker cache strategy must not serve stale order status — order status reads must always be network-first (not cached).
- iOS PWA push limitations: iOS 16.4+ supports web push but requires the app to be added to home screen. Supplier must be told to add to home screen during onboarding for notifications to work reliably.

---

## Sources

- Choco supplier platform: https://choco.com/suppliers — order management, notification patterns
- Fresho fresh food wholesale: https://www.fresho.com/us — mobile order management for fresh produce
- Orderlion wholesale ordering: https://www.orderlion.com/en — B2B supplier order flow
- Mercury VMP order acceptance: https://help.mercuryvmp.com/vendor/mercurymobileios/Mercury/AcceptOrders.htm — accept/negotiate/decline with mandatory comments pattern
- ME.com.br B2B order API: https://developer.me.com.br/guides/order/acceptance — rejection reason codes taxonomy
- MercurJS B2B food marketplace guide: https://www.mercurjs.com/guides/b2b-food-marketplace/key-buyer-features-in-food-b2b-marketplace — buyer feature landscape
- Baymard order confirmation best practices: https://baymard.com/blog/order-confirmation-page — essential vs supplemental confirmation elements
- Wholesale Handler fresh produce OMS guide: https://wholesalehandler.com/articles/order-management-software-for-fresh-produce-wholesalers — domain-specific requirements
- CEASA-DF operating hours: https://www.ceasa.df.gov.br/funcionamento/ — DF wholesale market hours (domain context)
- BigCommerce B2B order management: https://www.bigcommerce.com/articles/b2b-ecommerce/b2b-order-management/ — industry standard features
- B2B Wave order history: https://docs.b2bwave.com/article/175-order-history-reordering — reorder and filter patterns
- Frubana LATAM B2B produce: https://medium.com/lightspeed-venture-partners/frubana-the-everything-store-for-latams-restaurant-industry-2336b081a9c6 — LATAM B2B produce market context
