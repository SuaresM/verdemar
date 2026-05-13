# Pitfalls Research — Order Flow

**Milestone:** v1.1 Fluxo de Pedidos
**Researched:** 2026-05-13
**Overall confidence:** HIGH (all critical claims verified against codebase + official docs)

---

## Critical Pitfalls

These are show-stoppers if ignored — they cause silent data corruption, security holes, or complete feature breakage.

### CP-1: PATCH /orders/:id/status Has No Authorization Check

**What goes wrong:** The current `PATCH /orders/:id/status` endpoint at `api/[...route].ts:67` calls `requireAuth` but performs no role or ownership verification. Any authenticated user — buyer, supplier, or another supplier — can set any order's status to any string value. The `adminSupabase` client bypasses RLS entirely (service role key), so the database offers no backstop.

**Root cause:** The endpoint was scaffolded with `adminSupabase` (correct for creation, where RLS coordination is complex), but ownership filtering was never applied. The pattern used in `/products/:id/stock` — `.eq('supplier_id', userId)` as a guard — was not replicated for orders.

**Consequences:**
- A buyer can set their own order status to `'delivered'` without supplier involvement
- A supplier can update a competitor's order
- A buyer can cancel after the supplier has already dispatched goods
- Any string is accepted: `status: "refunded"` or `status: "paid"` would be silently written

**Prevention:** See RLS Security Gaps section for the full permission matrix and the API-level fix.

---

### CP-2: Push Subscription Stored Per User, Not Per Device

**What goes wrong:** `push_subscriptions` upserts on `user_id` with `onConflict: 'user_id'`. A supplier using both their phone and tablet gets only the tablet's subscription stored (whichever registered last). New order push goes to only the last-registered device.

**Root cause:** The upsert design assumes one device per user. For suppliers who juggle multiple devices (common in the field), this silently drops the other device's subscription.

**Consequences:** Supplier misses new-order notifications on their primary device. For a B2B hortifrúti marketplace where response time matters, this causes order delays and churn.

**Prevention:** Change the `push_subscriptions` primary key to `(user_id, endpoint)` and send to all rows matching the user. The `endpoint` field inside the subscription object is already unique per device/browser.

---

### CP-3: iOS Push Subscriptions Vanish After Inactivity

**What goes wrong:** iOS (all browsers, all use WebKit) silently cancels web push subscriptions when the installed PWA has not been opened for an extended period (reports range from 1–2 weeks). Additionally, if the service worker receives a push event but `showNotification` is not called (e.g., throws inside the handler), iOS treats it as a "silent push" and may cancel the subscription after a few occurrences.

**Root cause:** iOS background process management is far more aggressive than Android. Apple deliberately restricts silent background execution for PWAs.

**Consequences:** Suppliers who use the app infrequently (common for smaller vendors) stop receiving new order alerts entirely. The subscription row remains stale in `push_subscriptions` — the server doesn't know it's dead until `webpush.sendNotification` returns a 410 Gone response.

**Prevention:** See Push Notification Gotchas section.

---

### CP-4: No Idempotency on Order Creation Combined With Status Flow

**What goes wrong:** `CONCERNS.md` already flags the idempotency gap on order creation (`Cart.tsx:220-259`). When this milestone adds status transitions, duplicate orders amplify the problem: a supplier sees two identical pending orders and accepts one. The buyer's order history shows both, one stays `pending` forever, and push notifications fire twice.

**Root cause:** Network hiccup after order insert but before 201 response causes the frontend to retry or re-submit. The existing `sendPush(...).catch(() => {})` fires for both rows.

**Prevention:** Before adding any order lifecycle UI, add an idempotency key to order creation (phase 1 prerequisite). See Prevention Checklist.

---

## Concurrent State Issues

### CS-1: Supplier Accepts While Buyer Cancels Simultaneously

**Scenario:** Buyer opens order history, sees `pending`, taps "Cancel". At the same moment, supplier opens dashboard, sees the same order, taps "Accept". Both PATCH requests hit the server within milliseconds of each other.

**What goes wrong:** Both requests use `adminSupabase.from('orders').update({status}).eq('id', orderId)` — a blind overwrite with no version check. Whichever lands second wins. The loser's request returns `{ok: true}` as if it succeeded. Both users see success. The actual outcome depends on network race, not business intent.

**Consequence:** Supplier believes order is confirmed, starts preparing. Buyer believes order is cancelled. Neither is notified of the conflict. Goods are prepared for an order the buyer considers void.

**Prevention options (pick one):**

Option A — Database-level guard (recommended for this scale): Add a `version` integer column to `orders`. The update endpoint accepts `expected_version` and uses it in the WHERE clause:
```sql
UPDATE orders SET status = $1, version = version + 1
WHERE id = $2 AND version = $3
RETURNING id
```
If `RETURNING` returns no rows, the version was stale — respond 409 Conflict. The client re-fetches and shows the actual current state.

Option B — Postgres transition table (more complex, full audit): Add a `status_transitions` table with `from_status`, `to_status`, `actor_id`, `created_at`. A Postgres function validates the transition is legal before committing it. Invalid concurrent transition raises an exception, which Hono converts to 409.

Option C — Allowed-actor guard only (minimum viable): The status update endpoint checks who is allowed to perform the requested transition. Supplier can only move `pending → confirmed | rejected`, buyer can only move `pending → cancelled`. If the order is not in the expected state for the transition, return 409. This does not prevent concurrent writes to the same transition but prevents cross-role corruption.

**For this milestone, implement Option C with a plain allowed-actor guard.** It eliminates the most dangerous cross-role conflict without requiring schema changes.

---

### CS-2: Optimistic UI Update That Conflicts With Real State

**Scenario:** Supplier dashboard shows a list of pending orders. Supplier rapidly taps "Accept" on order A while the page is still loading (Supabase query not resolved). The optimistic update shows A as confirmed. The actual server state is still `pending` because the transition hasn't been applied yet.

**What goes wrong:** If a second supplier account or admin concurrently changes the same order, the optimistic state diverges permanently. The user never sees the true state unless they reload.

**Prevention:** React 19's `useOptimistic` hook is the right primitive here. Always pair optimistic updates with a post-mutation refetch (not just rollback on error). The pattern:
1. Optimistically set UI to target state
2. Fire PATCH
3. On success: trigger a re-fetch of the order from Supabase (not just trust the 200 response)
4. On error: roll back to pre-mutation state and show error toast

The re-fetch in step 3 is the key addition — it catches cases where the server accepted the request but the DB value is different from what was sent (e.g., a constraint check changed the final value).

---

### CS-3: Supplier Updating Items While Status Transitions Happen

**What goes wrong:** `PATCH /orders/:id/items` (line 80) allows the buyer to edit item quantities and subtotals. If this endpoint is still callable after a supplier has accepted (`confirmed`), the supplier's prepared quantity becomes incorrect.

**Prevention:** Add a guard in `/orders/:id/items` — refuse edits if `current_status NOT IN ('pending')`. Query the current status before applying the update. This is a single additional `adminSupabase.from('orders').select('status').eq('id', orderId).single()` call.

---

## Push Notification Gotchas

### PN-1: iOS Requires PWA to Be Installed — No In-Browser Fallback

**Hard constraint:** Web push on iOS only works when the app is installed via Safari's "Add to Home Screen" with `"display": "standalone"` in the manifest. Regular Safari tabs, Chrome for iOS, Firefox for iOS — all use WebKit and all refuse the Push API outside of a Home Screen installation.

**Impact on this milestone:** When a buyer visits the site in mobile Safari (not installed), calling `Notification.requestPermission()` will either be silently refused or never prompted. The push subscribe flow must check `window.matchMedia('(display-mode: standalone)')` before attempting subscription. If not standalone, show an "Install the app to receive notifications" prompt instead of attempting permission — failed permission attempts can permanently block future prompts.

---

### PN-2: Stale Subscription Token — 410 Gone Not Handled

**Current code:** `sendPush()` at `api/[...route].ts:309` catches nothing:
```typescript
sendPush(order.supplier_id, orderData.id).catch(() => {})
```
When a subscription is expired or the device unregistered it, the push service returns HTTP 410 Gone. `web-push` throws an error with `statusCode: 410`. The current `.catch(() => {})` swallows this silently.

**What should happen:** On 410 response, delete the stale row from `push_subscriptions`. On 429 (rate limited), implement exponential backoff. Currently neither happens.

**Fix:**
```typescript
async function sendPush(userId: string, payload: object) {
  const { data } = await adminSupabase
    .from('push_subscriptions')
    .select('id, subscription')
    .eq('user_id', userId)

  for (const row of data ?? []) {
    try {
      await webpush.sendNotification(row.subscription, JSON.stringify(payload))
    } catch (err: any) {
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        // Subscription gone — purge it
        await adminSupabase.from('push_subscriptions').delete().eq('id', row.id)
      }
    }
  }
}
```

This also handles CP-2 (multi-device) since we now iterate rows instead of `.single()`.

---

### PN-3: Service Worker showNotification Must Be Wrapped in event.waitUntil

**What goes wrong:** If the push event handler in the service worker does not call `event.waitUntil(self.registration.showNotification(...))`, iOS will see the push as "silent" (no visible notification), and after a few occurrences it will cancel the subscription automatically. This is an iOS-specific behavior that does not occur on Android or desktop.

**Prevention:** In the service worker push handler, always:
```javascript
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: data.url },
    })
  )
})
```
Never let the push handler resolve without calling `showNotification`. Add a fallback notification if the payload fails to parse.

---

### PN-4: Push for Status Changes Requires Knowing the Buyer's Push Endpoint

**Current state:** `sendPush()` only sends to supplier (new order event). The new status-change push (buyer receives confirmation, buyer receives dispatch notification) requires looking up the buyer's subscription by `buyer_id` on the order.

**Pitfall:** The buyer's subscription was recorded when they subscribed on their device. If the buyer uses a different device to check order history than they used when subscribing, the push goes to the wrong device. The multi-device upsert fix from CP-2 is a prerequisite for this to work reliably.

---

### PN-5: Delivery Rate on iOS Is Inherently Lower

**Realistic expectation:** iOS web push delivery rates are 70–85% vs 90–95% on Android. This is an Apple platform constraint, not a bug you can fix. Design the notification UX accordingly:
- In-app status indicators must be the primary feedback mechanism
- Push notifications are a supplement, not the primary alert channel
- Consider an in-app badge/count on the supplier dashboard that requires no push permission

---

## RLS Security Gaps

The current `/orders/:id/status` endpoint uses `adminSupabase` (service role — bypasses all RLS). RLS policies on the `orders` table cannot rescue you here. **All authorization must be enforced in the Hono handler.** The following matrix defines what must be implemented in application code:

### Permission Matrix

| Actor | Allowed Transitions | Forbidden Transitions | Notes |
|-------|--------------------|-----------------------|-------|
| Buyer | `pending → cancelled` | Any other transition | Can cancel only before supplier acts |
| Supplier | `pending → confirmed` | Buyer's transitions | Accepts order |
| Supplier | `pending → rejected` | — | Rejects with mandatory reason |
| Supplier | `confirmed → in_route` | — | Marks dispatch |
| Supplier | `in_route → delivered` | — | Marks delivery complete |
| Nobody | `* → pending` | — | Initial state only (set at creation) |
| Nobody | `confirmed → cancelled` | — | Once confirmed, cannot be cancelled |
| Nobody | `in_route → anything except delivered` | — | No rollback after dispatch |
| Nobody | `delivered → anything` | — | Terminal state |
| Nobody | `rejected → anything` | — | Terminal state |
| Nobody | `cancelled → anything` | — | Terminal state |

### Required API-Level Guard (Hono)

```typescript
app.patch('/orders/:id/status', requireAuth, async (c) => {
  const userId = c.get('userId')
  const orderId = c.req.param('id')
  const { status: newStatus, reason } = await c.req.json<{ status: string; reason?: string }>()

  // 1. Validate newStatus is a known enum value
  const VALID_STATUSES = ['pending', 'confirmed', 'rejected', 'in_route', 'delivered', 'cancelled']
  if (!VALID_STATUSES.includes(newStatus)) return c.json({ error: 'Invalid status' }, 400)

  // 2. Fetch current order to check ownership + current state
  const { data: order } = await adminSupabase
    .from('orders')
    .select('status, buyer_id, supplier_id')
    .eq('id', orderId)
    .single()
  if (!order) return c.json({ error: 'Not found' }, 404)

  // 3. Enforce role-based transition rules
  const isBuyer = order.buyer_id === userId
  const isSupplier = order.supplier_id === userId
  if (!isBuyer && !isSupplier) return c.json({ error: 'Forbidden' }, 403)

  const ALLOWED: Record<string, { actor: 'buyer' | 'supplier'; from: string[] }> = {
    cancelled: { actor: 'buyer', from: ['pending'] },
    confirmed: { actor: 'supplier', from: ['pending'] },
    rejected:  { actor: 'supplier', from: ['pending'] },
    in_route:  { actor: 'supplier', from: ['confirmed'] },
    delivered: { actor: 'supplier', from: ['in_route'] },
  }

  const rule = ALLOWED[newStatus]
  if (!rule) return c.json({ error: 'Transition not allowed' }, 422)
  if (rule.actor === 'buyer' && !isBuyer) return c.json({ error: 'Forbidden' }, 403)
  if (rule.actor === 'supplier' && !isSupplier) return c.json({ error: 'Forbidden' }, 403)
  if (!rule.from.includes(order.status)) return c.json({ error: `Cannot transition from ${order.status} to ${newStatus}` }, 422)

  // 4. Require rejection reason
  if (newStatus === 'rejected' && !reason?.trim()) return c.json({ error: 'Rejection reason required' }, 400)

  // 5. Apply update
  const updatePayload: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() }
  if (newStatus === 'rejected') updatePayload.rejection_reason = reason

  const { error } = await adminSupabase.from('orders').update(updatePayload).eq('id', orderId)
  if (error) return c.json({ error: error.message }, 400)

  return c.json({ ok: true })
})
```

### Also Required: Postgres CHECK Constraint as Defense-in-Depth

The API guard is the primary defense. Add a Postgres constraint as a second layer. For existing rows, use `NOT VALID` first to avoid table lock:

```sql
ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'confirmed', 'rejected', 'in_route', 'delivered', 'cancelled'))
  NOT VALID;

VALIDATE CONSTRAINT orders_status_check;
```

`NOT VALID` with subsequent `VALIDATE CONSTRAINT` uses `SHARE UPDATE EXCLUSIVE` lock instead of `ACCESS EXCLUSIVE`, allowing concurrent reads/writes during validation.

---

### RLS Policy Gap: Buyer SELECT on Orders

If Supabase Realtime (Postgres Changes) is used for live order status updates in the buyer's order history, the buyer needs a SELECT RLS policy on `orders`. **UPDATE policies without a matching SELECT policy fail silently** — the update call returns success but no rows are changed. Verify the existing SELECT policy covers both `buyer_id = auth.uid()` and `supplier_id = auth.uid()`:

```sql
-- Confirm this exists (or add it)
CREATE POLICY "orders_select_own"
  ON orders FOR SELECT
  USING (buyer_id = auth.uid() OR supplier_id = auth.uid());
```

---

## Stale State in Zustand

### ZS-1: Cart Section Persisted After Order Submission

**What goes wrong:** `cartStore` uses `persist` middleware with `name: 'rota-verde-cart'`. After a buyer submits an order, `clearSection(supplierId)` is called. If the success handler throws, or if the user navigates away mid-clear, the section persists in localStorage. When the buyer returns to the cart (back button or direct URL), they see items that were already ordered.

**Consequence:** Buyer re-orders the same items, creating duplicate orders. Combined with the lack of idempotency key (CP-4), this creates duplicate rows in `orders`.

**Prevention:**
- Treat `clearSection` as part of the critical path, not a cleanup step. Await it before showing the success screen.
- On the order confirmation screen, include a "return to shopping" CTA that calls `clearSection` again as a safety flush.
- Add a versioned order-tracking key to localStorage: `submitted_order_ids: string[]`. On cart mount, filter out sections where a `submitted_order_id` matches a stored ID.

---

### ZS-2: Cart Holds Stale Product Prices

**What goes wrong:** `cartStore` stores the full `Product` object inside each `CartItem`. Product prices can change between when the buyer adds to cart and when they submit. The persisted cart can hold a price from days ago. The order creation sends the stale subtotal to the API, which inserts it without validation.

**Prevention for this milestone (minimal):** At cart mount, re-fetch product prices for items currently in the cart and update subtotals if prices changed. Show a toast: "Prices updated — please review your order." The existing `Cart.tsx` already fetches delivery zones on mount; a product price refresh hook follows the same pattern.

---

### ZS-3: Zustand Order State Separate From Cart — Stale After Navigation

**New problem this milestone introduces:** When adding order history, an `ordersStore` (or equivalent) will be needed. If implemented as a Zustand store with `persist`, the order list cached at last visit may be stale when the user navigates back.

**Prevention:** Do not persist order list in localStorage. Orders data is server-authoritative and changes without user action (supplier updates status). Use either:
- Direct Supabase queries on page mount (simplest, correct for this scale)
- Zustand without persist, with an `isStale` flag that triggers a refetch on mount

If using Supabase Realtime for live status, be aware of the RLS + Realtime interaction described in RLS Security Gaps.

---

### ZS-4: Cart `sections` Include Full Supplier Object — Stale After Supplier Profile Changes

**What goes wrong:** `addItem` stores the complete `Supplier` object in `sections[].supplier`. Supplier profile changes (name, address, phone) are never reflected in the persisted cart. The order confirmation screen displays the stale supplier name.

**Prevention for this milestone:** Order confirmation screen should re-fetch the supplier from Supabase using `supplier_id` rather than reading the cart's snapshot. The cart's supplier object is suitable for display while browsing, but the source of truth for the final order record must come from a fresh fetch.

---

## Mobile Supplier UX

### MU-1: Swipe-to-Action Conflict With Browser Back Gesture

**What goes wrong:** A common pattern for mobile order lists is swipe-right = accept, swipe-left = reject. On iOS Safari, left swipe within the viewport triggers the browser's back navigation gesture. The touch event may be intercepted by the browser before the app's handler fires, silently navigating the supplier away instead of rejecting the order.

**Prevention:** Do not use horizontal swipe for destructive actions (reject/cancel). Use explicit tap-to-action buttons. If swipe is desired, use `overscroll-behavior-x: contain` on the scrollable list and test specifically on iOS Safari (not just Chrome DevTools mobile emulation, which does not simulate iOS swipe-back behavior).

---

### MU-2: Reject Action Without Confirmation Modal Causes Accidental Rejections

**What goes wrong:** A supplier quickly scanning a list of pending orders on a small screen may tap "Reject" when intending to scroll. Without a confirmation step (reason required + confirm button), the rejection is immediate and irreversible (per the state machine — `rejected` is a terminal state).

**Prevention:** Rejection must open a bottom sheet or modal requiring a typed/selected reason. The confirmation tap must be a distinct, visually differentiated action from the initial reject tap. This also satisfies the business requirement ("aceite/recusa com motivo").

---

### MU-3: Long Order Lists Without Pagination Cause Scroll Performance Issues on iOS

**What goes wrong:** On iOS, Safari has historically struggled with long lists of complex elements (images, multiple text rows, action buttons). A supplier with 30+ pending orders in a single flat list will experience janky scrolling on older iPhones.

**Prevention:** Implement pagination or infinite scroll from the beginning. Fetch the 10 most recent pending orders. Add a "Load more" button or intersection-observer trigger. Use `React.memo` on order card components to prevent re-renders when unrelated state updates.

---

### MU-4: No Visual Differentiation Between Order Ages

**What goes wrong:** All pending orders look identical. A supplier cannot tell at a glance which orders were placed 5 minutes ago (time-sensitive) vs 2 hours ago (potentially stale). Without urgency signaling, suppliers may process newer orders first, frustrating buyers with older orders.

**Prevention:** Show relative timestamps ("3 min ago", "2 hr ago") on order cards. Consider a color or badge after a threshold (e.g., orange border if pending > 30 minutes). This is a UX feature, but the data (`created_at`) must be included in the order list query.

---

## Status Machine Integrity

### SM-1: No Check for Forbidden Transitions at Any Layer

**Current state:** The API accepts any status string and writes it. No transition validation exists. A buyer could call `PATCH /orders/:id/status` with `status: 'delivered'` and it would succeed.

**Fix:** The permission matrix in RLS Security Gaps above defines all legal transitions. Implement the guard in Hono before this milestone ships anything.

---

### SM-2: Rollback Scenario — Supplier Marks In-Route, Order Was Cancelled by Buyer

**Concrete sequence:**
1. Buyer submits order (`pending`)
2. Supplier taps "Accept" (`pending → confirmed`)
3. Push notification fires to buyer
4. Buyer does NOT see the notification (iOS subscription lapsed — PN-3)
5. Buyer logs in, sees order still showing as `pending` (stale cached state — ZS-3)
6. Buyer taps "Cancel" — but order is actually `confirmed`
7. Per the transition table: `confirmed → cancelled` is FORBIDDEN for buyer
8. Buyer receives 422 error with no explanation

**How to handle the 422:** The error message must include the current status (`"Pedido já confirmado — não é possível cancelar."`) so the buyer understands why their action was rejected. Generic "Transition not allowed" is unusable on mobile.

**Resolution path for the buyer:** Show the actual current status alongside the error. Provide a WhatsApp link to contact the supplier directly (already in scope — WhatsApp link is generated at checkout). This is the right resolution for this milestone scope.

---

### SM-3: Supplier Marks Delivered Without Buyer Confirmation

**Business reality:** In this domain (hortifrúti B2B), the supplier marks delivery as complete at their discretion. The buyer does not confirm receipt. This means `in_route → delivered` is a unilateral supplier action.

**Risk:** Supplier marks delivered, but goods never arrived (driver error, wrong address). The order is in a terminal state. The buyer has no way to dispute within the app.

**For this milestone:** Accept this limitation. Mark it clearly in the transition table: `delivered` is set by supplier only. Add a note in the order history view: "Entrega confirmada pelo fornecedor — em caso de divergência, entre em contato via WhatsApp." Dispute resolution is out of scope for v1.1.

---

### SM-4: Rejection Reason Column May Not Exist

**What goes wrong:** The `orders` table exists with a `status` column, but there is no `rejection_reason` column documented. When the supplier rejects with a reason and the API attempts to write `rejection_reason`, it will silently fail or return a Postgres error.

**Prevention:** Phase 1 of this milestone must include a migration:
```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
```
Run this before shipping any reject UI. Verify `CONCERNS.md` note about existing `status` column — the unvalidated status string is a known issue, and adding the enum constraint migration must happen in the same phase as this column addition.

---

### SM-5: Realtime Status Updates — The RLS + Postgres Changes Interaction

**What goes wrong:** If using Supabase Realtime Postgres Changes to push status updates live to the buyer's order history screen, there is a confirmed bug (tracked in supabase/supabase#35195) where enabling RLS on a table can prevent realtime callbacks from firing entirely, even with a `USING (true)` permissive policy.

**Workaround options:**
1. Use polling (simplest, correct for this scale — 15-second interval is acceptable for order status in this domain)
2. Use Supabase `realtime.broadcast_changes()` with a Postgres trigger (more robust than Postgres Changes + RLS, but requires a DB trigger and broadcast authorization RLS policy)
3. Keep the orders table RLS policies and use the `supabase-js` `channel().on('postgres_changes', ...)` subscription but with the `filter: 'buyer_id=eq.{userId}'` parameter to reduce the authorization check surface

**Recommendation for this milestone:** Use polling with a short interval (15s) on the order history page. Realtime is a nice-to-have but adds complexity during a phase that already has security and state machine work to complete.

---

## Prevention Checklist

### Phase 1 (Foundation) — Must Complete Before Any UI Ships

- [ ] Add `rejection_reason TEXT` column to `orders` table via migration
- [ ] Add `CHECK (status IN ('pending','confirmed','rejected','in_route','delivered','cancelled'))` constraint to `orders` via `NOT VALID` + `VALIDATE CONSTRAINT`
- [ ] Rewrite `PATCH /orders/:id/status` with the permission matrix guard (actor + current state validation)
- [ ] Add Zod validation to the status update endpoint — enumerate valid statuses, require `reason` for `rejected`
- [ ] Fix `sendPush()` to: (a) iterate all subscriptions for a user not `.single()`, (b) delete stale subscriptions on 410/404 response
- [ ] Add an idempotency key to `POST /orders` (uuid v4 from frontend, stored as unique constraint on `orders`)

### Phase 2 (Supplier Dashboard) — Must Complete Before Supplier Accept/Reject UI

- [ ] Verify `push_subscriptions` table supports `(user_id, endpoint)` as composite key — migrate if needed
- [ ] Confirm service worker push handler uses `event.waitUntil(self.registration.showNotification(...))` with a fallback notification for parse failures
- [ ] Add "not standalone" detection in push subscribe flow — show install prompt instead of attempting permission on iOS in-browser
- [ ] Implement confirmation modal for reject action (reason required, cannot submit empty)
- [ ] Add pagination to pending orders list (page size 10), not a flat unbounded list
- [ ] Add `created_at` relative timestamps to order cards
- [ ] Add status-aware guard to `PATCH /orders/:id/items` — refuse edits if status not `pending`

### Phase 3 (Buyer Order History) — Must Complete Before History Page Ships

- [ ] Use server-fetched data only for order history — do not persist order list in Zustand
- [ ] On cart mount, re-fetch current prices for persisted cart items and update subtotals with a user-visible toast if changed
- [ ] On order confirmation success screen, call `clearSection(supplierId)` as part of the critical path (not as a side effect)
- [ ] Confirm SELECT RLS policy on `orders` covers both `buyer_id = auth.uid()` and `supplier_id = auth.uid()`

### Phase 4 (Push on Status Change) — Must Complete Before Buyer Status Push Ships

- [ ] `sendPush()` must look up buyer's subscription by `order.buyer_id` — add a new helper function for buyer-push specifically
- [ ] Status change push must fire from the status update handler, not fire-and-forget — use `await` not `.catch(() => {})`
- [ ] Add buyer-push call to the `PATCH /orders/:id/status` handler after successful status write
- [ ] Test push delivery on an actual iPhone with the PWA installed (not simulator, not Chrome DevTools)
- [ ] Document for team: iOS push delivery is 70–85%, not 100%. In-app status is the primary channel.

---

*Sources:*
- *[Supabase RLS Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)*
- *[Supabase RLS UPDATE policy requires SELECT policy issue](https://github.com/supabase/supabase/issues/28559)*
- *[Supabase Realtime RLS bug report](https://github.com/supabase/supabase/issues/35195)*
- *[Supabase Postgres Changes Docs](https://supabase.com/docs/guides/realtime/postgres-changes)*
- *[WebKit iOS Web Push announcement](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)*
- *[iOS PWA Push in 2026 — what works](https://webscraft.org/blog/pwa-pushspovischennya-na-ios-u-2026-scho-realno-pratsyuye?lang=en)*
- *[PostgreSQL Concurrency Control](https://www.postgresql.org/docs/current/mvcc.html)*
- *[Concurrent Optimistic Updates in React Query — tkdodo](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query)*
- *[Zustand Persist Docs](https://zustand.docs.pmnd.rs/reference/integrations/persisting-store-data)*
- *[Crunchy Data: Enums vs CHECK Constraints](https://www.crunchydata.com/blog/enums-vs-check-constraints-in-postgres)*
