# External Integrations

**Analysis Date:** 2026-05-13

## APIs & External Services

**Web Push Notifications:**
- Web Push Protocol - Browser push notifications for suppliers on new orders
  - SDK/Client: web-push 3.6.7
  - Auth: VAPID_PUBLIC_KEY (client), VAPID_PRIVATE_KEY + VAPID_EMAIL (server)
  - Implementation: `api/[...route].ts` (sendPush function), `src/lib/pushNotifications.ts` (client subscription)

**Error Tracking & Performance Monitoring:**
- Sentry - Real-time error tracking and performance monitoring
  - SDK: @sentry/react 10.51.0
  - Auth: VITE_SENTRY_DSN (client DSN)
  - Config: `src/main.tsx` (init with browserTracingIntegration, 20% trace sample rate, production-only)
  - Features: Browser tracing, ChunkLoadError handling with auto-reload

**WhatsApp Integration:**
- WhatsApp (indirect) - Order notifications sent to suppliers
  - Support flag: VITE_SUPPORT_WHATSAPP (feature toggle)
  - Trigger: `api/[...route].ts` PATCH `/orders/:id/whatsapp-sent` endpoint
  - Status tracking in orders table via `whatsapp_sent` boolean field

## Data Storage

**Databases:**
- Supabase PostgreSQL
  - Connection: SUPABASE_URL, SUPABASE_ANON_KEY (client), SUPABASE_SERVICE_ROLE_KEY (server)
  - Client: @supabase/supabase-js 2.99.0
  - Tables: profiles, buyers, suppliers, products, orders, order_items, delivery_zones, push_subscriptions
  - Schema files: `supabase-schema.sql`, `supabase-trigger.sql`, `supabase-trigger-total-sales.sql`, `supabase-push-subscriptions.sql`
  - Migrations: `supabase/migrations/` (Supabase CLI managed)

**File Storage:**
- Not explicitly configured - likely using Supabase Storage for:
  - `logo_url` (supplier logos)
  - `banner_url` (supplier banners)
  - `image_url` (product images)

**Caching:**
- None configured at application level
- Service Worker caching via Workbox (precaching, runtime strategies)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (built-in PostgreSQL auth)
  - Implementation: Uses Supabase auth.users table extended with custom profiles table
  - Roles: buyer, supplier, admin (stored in profiles.role)
  - Token flow: JWT bearer tokens in Authorization header
  - Client-side: `src/lib/supabaseClient.ts` creates Supabase client with persistSession, autoRefreshToken, detectSessionInUrl
  - Server-side: `api/_lib/auth.ts` provides requireAuth and requireAdmin middleware for Hono routes
  - Password reset: Admin-only endpoint at POST `/api/admin/reset-password` generates recovery link

**Authorization:**
- Role-based access control (RBAC) via custom middleware
  - Profile data: `src/lib/supabaseClient.ts` (client) and `api/_lib/supabase.ts` (server admin client)
  - Middleware: `api/_lib/auth.ts` requireAuth (token → user.id), requireAdmin (user.id → role check)

## Monitoring & Observability

**Error Tracking:**
- Sentry (see APIs section above)
- Client-side error boundaries: `src/components/shared/ErrorBoundary.tsx`
- ChunkLoadError recovery: Auto-reload + fallback in `src/main.tsx`

**Logs:**
- No centralized logging infrastructure configured
- Browser console only (dev/test environments)
- Sentry serves as primary observability layer for errors in production

**Performance:**
- Sentry browser tracing enabled (20% sample rate in production)
- Service Worker metrics via Workbox

## CI/CD & Deployment

**Hosting:**
- Vercel - Primary platform for frontend and API serverless functions
  - Project ID: prj_NFCxMYHgSR01w1xWoY9Q2YPvsM52
  - Org ID: team_oujqLiJtkxEQ2mAvCeSmivKn
  - Config: `vercel.json` with cache headers for service workers and SPA rewrite
  - Runtime: Node.js (via @vercel/node 5.7.15) for `api/[...route].ts` handler

**CI Pipeline:**
- None explicitly configured in codebase (likely Vercel Git integration with default build)
- Build command: `tsc -b && vite build` (from package.json scripts)
- Test command: `vitest run` (available but not enforced in CI)

## Environment Configuration

**Required env vars:**

Client-side (prefixed VITE_):
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Public anonymous key for client auth
- `VITE_VAPID_PUBLIC_KEY` - Web Push VAPID public key
- `VITE_SENTRY_DSN` - Sentry project DSN (production only)
- `VITE_SUPPORT_WHATSAPP` - Feature flag for WhatsApp support

Server-side (Vercel env):
- `SUPABASE_URL` - Supabase project URL (server context)
- `SUPABASE_SERVICE_ROLE_KEY` - Admin key for server operations (must not leak to client)
- `VAPID_EMAIL` - Email for VAPID key generation
- `VAPID_PUBLIC_KEY` - Web Push VAPID public key (also needed server-side)
- `VAPID_PRIVATE_KEY` - Web Push VAPID private key (server-only, sign push payloads)

**Secrets location:**
- `.env` file (local development, not committed)
- Vercel project settings (Environment Variables section) for production/staging
- Example template: `.env.example`

## Webhooks & Callbacks

**Incoming:**
- Web Push delivery from browser → Server subscription stored in push_subscriptions table
  - Endpoint: POST `/api/push/subscribe` (authenticated)
  - Payload: Service Worker registration push subscription object

**Outgoing:**
- Web Push notifications sent FROM server TO browsers via push_subscriptions
  - Triggered on new order: `api/[...route].ts` sendPush() helper
  - Payload: JSON with title, body, url (deep link to /supplier/orders)
  - Library: web-push (web-push.sendNotification)

**Order Notifications:**
- WhatsApp: Endpoint to mark `whatsapp_sent = true` but no actual webhook call code visible
  - PATCH `/api/orders/:id/whatsapp-sent` (authenticated)
  - Likely external WhatsApp API integration handles actual message sending

## Database Operations & RPC Calls

**Remote Procedure Calls (PostgreSQL):**
- `increment_product_sold(p_id, p_amount)` - Called in `api/[...route].ts` when order placed
- `increment_supplier_sales(p_id, p_amount)` - Called in `api/[...route].ts` when order placed

**Direct Operations:**
- Orders create: POST `/api/orders` inserts into orders + order_items
- Order status updates: PATCH `/api/orders/:id/status`
- Order item updates: PATCH `/api/orders/:id/items`
- Product stock management: PATCH `/api/products/:id/stock` (supplier-only)
- Product sell-without-stock: PATCH `/api/products/:id/sell-without-stock` (supplier-only)
- Supplier delivery zones: CRUD endpoints at `/api/supplier/delivery-zones/*`
- Admin user management: GET/PATCH `/api/admin/users/*`
- Admin supplier management: PATCH/DELETE `/api/admin/suppliers/:id/*`

---

*Integration audit: 2026-05-13*
