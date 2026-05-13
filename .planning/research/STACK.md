# Stack Research — Order Flow

**Project:** Rota Verde — Milestone v1.1 Fluxo de Pedidos
**Researched:** 2026-05-13
**Confidence:** HIGH (verified against Supabase official docs and Context7)

---

## New Dependencies Needed

| Package | Version | Why | Alternative Considered |
|---------|---------|-----|----------------------|
| `date-fns` | `^3.6.0` | Format order timestamps, relative time ("há 2 horas"), date range filters for order history. Tree-shakeable; only used functions are bundled. Already the ecosystem standard with 83M weekly downloads. | `dayjs` (3 KB smaller but plugin-based TypeScript is lossy); `Intl` native API (sufficient for relative time only, not for formatting `"Seg, 12 mai"` style date labels) |

That's it. One package. See rationale below.

---

## Existing Stack Sufficient For

**Supabase Realtime (order status push to buyer)**
`@supabase/supabase-js 2.99.0` already ships the full Realtime client. No extra package needed. Subscribe to `postgres_changes` on `orders` table filtered by `buyer_id = eq.{userId}` to receive status updates live. The existing `supabaseClient.ts` instance is the correct entry point.

**Push notifications to supplier on new order**
`web-push 3.6.7` and the VAPID key infra are already in place. The existing `sendPush()` helper in `api/[...route].ts` just needs to be called from the order status change handler (PATCH `/api/orders/:id/status`). No new package; extend existing flow.

**Order confirmation screen**
React Router 7 navigation + Zustand already used in checkout. The confirmation screen is a new route reading `orderId` from router state or URL param. No library additions required.

**Supplier order management panel (accept/reject)**
`react-hook-form 7.71.2` + `zod 4.3.6` handle the reject-with-reason form. Radix UI Dialog for the reject modal. `sonner 2.0.7` for success/error feedback. All present.

**Order history filters (status, date range)**
Zustand store holds filter state. Supabase `.eq()`, `.gte()`, `.lte()`, `.order()` query builders handle server-side filtering. No pagination library needed at MVP scale (< 1000 orders per supplier is safe for `limit/offset`).

**Tracking status display (pendente → confirmado → em rota → entregue)**
Tailwind + Radix UI (or plain `div` + Tailwind) for a 4-step progress indicator. No dedicated stepper library.

**State for order tracking**
Zustand 5 handles async actions natively without middleware. Add an `useOrderStore` slice (orders list, selected order, filters, loading, error). Pattern: async `fetchOrders()` action calls Supabase, `set()` updates state. `subscribeWithSelector` middleware from zustand (already bundled in v5) enables fine-grained component subscriptions without re-render storms.

---

## What NOT To Add

| Package | Why Not |
|---------|---------|
| `@tanstack/react-query` | Introduces a parallel data-fetching layer that conflicts with the Zustand-as-source-of-truth pattern already established. Overkill for 4 screens. Adds ~12 KB and significant conceptual overhead. |
| `socket.io-client` | Supabase Realtime is already WebSocket-based. Two competing WS connections would be wasteful and confusing. |
| `luxon` / `dayjs` | `date-fns` is the right choice (see above). Adding a second date library is unnecessary. |
| `react-virtualized` / `@tanstack/virtual` | Order lists at MVP scale (tens to low hundreds of rows per filtered view) do not need virtualization. Add only if profiling proves it's needed. |
| `recharts` / `chart.js` | No chart requirement in v1.1 scope. Defer to a future analytics milestone. |
| `swr` | Same argument as react-query. Zustand + direct Supabase calls is the project's established pattern. |
| `@supabase/realtime-js` (standalone) | Already included inside `@supabase/supabase-js`. Never import separately. |

---

## Supabase Realtime vs Polling

### Recommendation: Supabase Realtime with a defensive polling fallback

**Use Supabase Realtime** (`postgres_changes`) as the primary update mechanism for order status. The implementation is 10–15 lines using the existing client:

```typescript
// In useOrderStore or a dedicated hook
const channel = supabase
  .channel(`order-${orderId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'orders',
    filter: `id=eq.${orderId}`,
  }, (payload) => {
    useOrderStore.getState().updateOrderStatus(payload.new.status)
  })
  .subscribe()

// Cleanup on unmount
return () => { supabase.removeChannel(channel) }
```

**Add a polling fallback** on reconnect. Supabase Realtime does NOT have a long-polling fallback; a dropped WebSocket means missed updates. The pattern:

```typescript
channel.subscribe((status) => {
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
    // Re-fetch current order state via REST to fill the gap
    useOrderStore.getState().fetchOrder(orderId)
  }
})
```

This is not full polling — it's a one-shot re-fetch on reconnect to catch any updates missed during the disconnected window. No interval timers needed.

**Why NOT pure polling:** For a mobile PWA used on Brazilian mobile networks (often 4G with variable quality), polling every 5s × N open tabs × M concurrent users creates unnecessary Supabase query load and battery drain. Realtime is more efficient when the connection holds.

**Why NOT pure Realtime without fallback:** Supabase documentation explicitly warns that reconnects drop any changes that occurred during the disconnection window. For an order status screen — where a supplier confirming an order MUST be seen by the buyer — silent stale state is unacceptable.

**RLS consideration:** Supabase Realtime respects RLS on `postgres_changes`. The existing `authenticated` role policies on the `orders` table must include a `SELECT` policy covering `buyer_id = auth.uid()` (buyer side) and `supplier_id = auth.uid()` (supplier side). If those policies exist for the REST queries, they'll work for Realtime too. Verify this before shipping. The `CHANNEL_ERROR` fallback also catches the case where a user subscribes to rows they can't access.

**Scale note (not relevant now, worth knowing):** At 100+ simultaneous subscribers to the same table, each INSERT/UPDATE triggers one RLS auth check per subscriber. For the current scale of Rota Verde (DF & entorno, early growth), this is not a concern. Flag for re-evaluation if concurrent active users exceed 500.

---

## Recommendation

**Add one package: `date-fns ^3.6.0`.** Everything else required for the v1.1 order flow is already present in the stack.

Concrete additions to implement:

1. **`date-fns`** — install and use `format`, `formatDistanceToNow`, `isToday`, `parseISO` for order timestamps and history date labels. Import only what you use (tree-shaking handles the rest).

2. **`useOrderStore` (Zustand slice)** — new store file, no new library. Holds `orders[]`, `selectedOrder`, `filters`, `loading`, `error`, and async actions `fetchOrders`, `fetchOrder`, `updateOrderStatus`.

3. **Supabase Realtime subscription** — inside the order detail screen component or a custom hook `useOrderRealtime(orderId)`. Uses existing `supabaseClient`. Add subscribe-on-mount / unsubscribe-on-unmount lifecycle. Include the `CHANNEL_ERROR` re-fetch fallback.

4. **Push notification trigger for supplier** — extend the existing PATCH `/api/orders/:id/status` Hono handler to call `sendPush()` when `status` transitions to `pendente` (new order created) or when buyer-relevant transitions occur. No new infrastructure.

5. **Order confirmation route** — new React Router route at `/orders/:id/confirmation`, reading order data from Zustand or a fresh Supabase fetch. No new routing library.

---

## Sources

- [Supabase Realtime Postgres Changes docs](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Supabase subscribe() reference](https://supabase.com/docs/reference/javascript/subscribe)
- [Supabase Realtime reliability discussion](https://github.com/orgs/supabase/discussions/5641)
- [Supabase does not have WS long-polling fallback](https://github.com/orgs/supabase/discussions/17644)
- [date-fns vs dayjs 2026 comparison](https://www.pkgpulse.com/guides/date-fns-v4-vs-temporal-api-vs-dayjs-2026)
- [Zustand async actions pattern](https://github.com/pmndrs/zustand/discussions/1415)
- [Supabase RLS production patterns](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
