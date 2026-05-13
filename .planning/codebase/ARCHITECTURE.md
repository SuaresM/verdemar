<!-- refreshed: 2026-05-13 -->
# Architecture

**Analysis Date:** 2026-05-13

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                          Browser / PWA Client Layer                          │
├────────────────────┬────────────────────┬──────────────────┬────────────────┤
│  Buyer Pages       │  Supplier Pages    │  Admin Pages     │  Public Auth   │
│  `src/pages/buyer` │ `src/supplier`     │ `src/pages/admin`│ `src/pages/pub`│
└────────┬───────────┴──────────┬─────────┴────────┬─────────┴────────┬───────┘
         │                      │                  │                  │
         ▼                      ▼                  ▼                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         UI Components & Routing                              │
│          `src/components` | `src/App.tsx` (BrowserRouter + Routes)           │
│                  `src/components/layout/` (Navigation)                       │
└──────────────────────────────┬──────────────────────────────────────────────┘
         │                      │                  │                  │
         ▼                      ▼                  ▼                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    State Management & Business Logic                         │
│  Zustand Stores: `src/stores/authStore.ts` | `src/stores/cartStore.ts`     │
│    Hooks: `src/hooks/useOnboarding.ts` | Services: `src/services/supabase` │
└──────────────────────────────┬──────────────────────────────────────────────┘
         │                      │                  │
         ▼                      ▼                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          API & Data Access Layer                             │
│   `src/lib/apiClient.ts` (HTTP) | `src/lib/supabaseClient.ts` (DB)         │
│   `src/services/supabase.ts` (Database queries & auth)                       │
│   `api/[...route].ts` (Vercel serverless backend, Hono.js)                   │
└──────────────────────────────┬──────────────────────────────────────────────┘
         │                      │                  │                  │
         ▼                      ▼                  ▼                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         External Services                                    │
│  Supabase (PostgreSQL + Auth) | Vercel (Deployment) | Sentry (Error Track)  │
│  WebPush Notifications | WhatsApp Integration                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| **Buyer Pages** | Shopping UI: home, search, product detail, cart, order history, profile | `src/pages/buyer/` |
| **Supplier Pages** | Dashboard, product management, order management, delivery zone config | `src/pages/supplier/` |
| **Admin Pages** | Platform management: suppliers, products, orders, team/users | `src/pages/admin/` |
| **Public Pages** | Authentication: login, register, password reset | `src/pages/public/` |
| **BuyerNav / SupplierNav / AdminNav** | Bottom tab navigation per role | `src/components/layout/` |
| **UI Components** | Reusable: buttons, inputs, badges, cards, modals (Radix + Tailwind) | `src/components/ui/`, `src/components/shared/` |
| **AuthStore** | Central user auth state: profile, buyer/supplier data, session | `src/stores/authStore.ts` |
| **CartStore** | Shopping cart per-supplier, persisted to localStorage | `src/stores/cartStore.ts` |
| **Supabase Service** | All database operations: profiles, products, orders, queries | `src/services/supabase.ts` |
| **API Client** | HTTP client with Supabase auth token injection | `src/lib/apiClient.ts` |
| **Backend (Hono)** | Order creation, order status updates, admin operations, webhooks | `api/[...route].ts` |

## Pattern Overview

**Overall:** Multi-role SPA with Vercel serverless backend, PWA-enabled via Workbox, real-time state via Zustand, database-first auth via Supabase.

**Key Characteristics:**
- **Role-based routing** — Distinct feature sets for buyer/supplier/admin via React Router layout components
- **Lazy-loaded pages** — Chunk splitting per route for faster initial load (PWA optimized)
- **Zustand + localStorage** — Persistent cart and auth state without Redux complexity
- **Supabase RLS** — Row-level security prevents clients from bypassing auth; serverless API layer adds authorization gates
- **PWA offline-ready** — Service worker caches routes + assets; injects manifest via Vite plugin
- **Vercel edge deployment** — Hono framework on Nodejs runtime; admin operations isolated to backend

## Layers

**Presentation (Pages + Components):**
- Purpose: Render UI, handle user interaction, delegate to stores and services
- Location: `src/pages/`, `src/components/`
- Contains: `.tsx` files with React hooks, forms, lists
- Depends on: Zustand stores, services/supabase, React Router
- Used by: Browser entry point

**State Management:**
- Purpose: Centralize async auth, loading, user profile, shopping cart
- Location: `src/stores/`
- Contains: Zustand store definitions with persist middleware
- Depends on: Supabase service, localStorage API
- Used by: All pages and components

**Business Logic / Services:**
- Purpose: Encapsulate database queries, auth flows, external API calls
- Location: `src/services/supabase.ts`, `src/lib/`
- Contains: Async functions (getProfile, searchProducts, createOrder, etc.)
- Depends on: Supabase client, HTTP client, types
- Used by: Stores and pages

**Data Access:**
- Purpose: Low-level database client and HTTP transport
- Location: `src/lib/supabaseClient.ts`, `src/lib/apiClient.ts`
- Contains: Initialized clients, basic fetch/query wrapper
- Depends on: External SDKs (@supabase/supabase-js)
- Used by: Services layer

**Backend API:**
- Purpose: Enforce authorization, create orders atomically, call RPC functions, send webhooks
- Location: `api/[...route].ts`
- Contains: Hono middleware + route handlers
- Depends on: Supabase admin client, web-push library
- Used by: Frontend via `/api/*` endpoints

## Data Flow

### Primary Request Path: Add Product to Cart

1. **User clicks "Add to Cart"** → `src/pages/buyer/Home.tsx` or `ProductCard.tsx`
2. **Dispatch Zustand action** → `useCartStore.addItem()` (`src/stores/cartStore.ts`)
3. **Calculate subtotal + update sections** → In-memory mutation + localStorage persist
4. **Component re-renders** → Cart count badge appears in `BuyerNav`
5. **No server call yet** — Cart is client-side only

### Secondary Flow: Create Order

1. **User submits order from Cart page** → `src/pages/buyer/Cart.tsx`
2. **Call `createOrder()` service** → `src/services/supabase.ts`
3. **Service invokes `apiClient.post('/orders', ...)` → `/api/orders` handler**
4. **Backend (Hono):**
   - Check `requireAuth` middleware → Verify JWT token
   - Validate order.buyer_id matches authenticated user
   - Insert order + order_items into Supabase
   - Call RPC `increment_product_sold` for each product
   - Call RPC `increment_supplier_sales` for supplier
   - Trigger `sendPush()` to notify supplier
   - Return order record
5. **Frontend catches response** → Clear `cartStore`, navigate to confirmation

### Admin Update Supplier Status

1. **Admin clicks "Deactivate"** → `src/pages/admin/Suppliers.tsx`
2. **Call `deactivateSupplier(id)` service**
3. **Service invokes `apiClient.patch('/admin/suppliers/:id/status', ...)`**
4. **Backend checks `requireAdmin` middleware** → Only admin can proceed
5. **Update suppliers table** → set is_active=false
6. **Frontend refetches suppliers list** on success

**State Management:**
- **Auth state** lives in `useAuthStore` → loaded on app init via `App.tsx` useEffect
- **Cart state** lives in `useCartStore` → synced to localStorage on every change
- **UI loading states** local to component useState (no global loading flag)

## Key Abstractions

**Role-based Layout Components:**
- Purpose: Enforce access control + render role-specific nav
- Examples: `BuyerLayout`, `SupplierLayout`, `AdminLayout` in `src/App.tsx`
- Pattern: Layout wraps `<Outlet />`, guards redirect to `/login` or alternate role dashboard

**CartSection:**
- Purpose: Group cart items by supplier (since each supplier has independent delivery rules)
- Examples: `src/types/index.ts` + `src/stores/cartStore.ts`
- Pattern: One CartSection per supplier; items within a section; notes + deliveryTimePreference per section

**Dashboard aggregation:**
- Purpose: Fetch stats without loading full order/product lists
- Examples: `getSupplierDashboard()`, `getAdminDashboard()` in services
- Pattern: Parallel Promise.all() queries with count-only queries for performance

**Onboarding state:**
- Purpose: Show guided tour once per role, stored in localStorage
- Examples: `useOnboarding(role)` hook, `resetOnboarding()` function
- Pattern: intro.js tour with element selectors; skip if elements missing (graceful degradation)

## Entry Points

**Frontend Entry:**
- Location: `src/main.tsx`
- Triggers: On page load, Vite serves `index.html`
- Responsibilities: Initialize Sentry, set up chunk-reload error handler, mount React to DOM

**App Component:**
- Location: `src/App.tsx`
- Triggers: React root creation
- Responsibilities: Initialize auth store, set up Supabase listener, render router + layouts

**Backend Entry:**
- Location: `api/[...route].ts`
- Triggers: HTTP request to `/api/*` path
- Responsibilities: Hono app routing, auth middleware, response serialization

## Architectural Constraints

- **Threading:** Single-threaded event loop (browser). Vercel Nodejs backend has worker concurrency but order atomicity enforced via Supabase RLS + RPC.
- **Global state:** `useAuthStore` and `useCartStore` are module-level singletons (Zustand). No race conditions in single-threaded browser; backend Supabase auth is per-request.
- **Circular imports:** None detected. Stores depend on services; services depend on lib; lib depends only on external SDKs.
- **localStorage capacity:** Cart can grow indefinitely but typically <1MB for avg. users. Risk: if cart exceeds browser limit, persist fails silently (catch in cartStore not observed).
- **RPC atomicity:** Orders rely on Supabase RPC `increment_product_sold` and `increment_supplier_sales`. If called but transaction fails upstream, increments orphan (no observability to detect).
- **Service worker scope:** PWA only caches assets under `src/sw.ts` precaching rules. Offline mode doesn't support API calls; order creation requires network.

## Anti-Patterns

### Inconsistent Error Handling

**What happens:** Some services throw errors, others return empty arrays (e.g., `getProfile()` returns null, `searchProducts()` returns `{ data: [], hasMore: false }`).

**Why it's wrong:** Callers can't distinguish "no results" from "network error." Pages silently render empty state, users unaware of failures.

**Do this instead:** Standardize to explicit error/success tuple or wrap in Result<T, E>. At minimum, log failures in try/catch and toast user.

### Mixed concerns in pages

**What happens:** Pages like `src/pages/buyer/Home.tsx` mix data fetching, state updates, onboarding tour initialization in useEffect.

**Why it's wrong:** Hard to test; side effects interleave; onboarding can fail silently and never alert component.

**Do this instead:** Extract data-fetching logic to custom hooks (e.g., `useFeaturedProducts()`) and separate onboarding to its own effect.

### Supabase client over API for sensitive operations

**What happens:** Most reads go direct to Supabase client; only orders go through backend API.

**Why it's wrong:** Frontend RLS relies on auth tokens; no application-level validation. A user could theoretically craft queries directly if they understand RLS structure.

**Do this instead:** For sensitive data (supplier revenues, buyer history), route through backend API with explicit permission checks. Leave reads open (product list, supplier profiles) to direct Supabase.

### CartStore persists across logout

**What happens:** `useCartStore` saves to localStorage; logout does not clear cart.

**Why it's wrong:** User logs out; next user logs in and sees previous user's cart if they use same device.

**Do this instead:** Call `useCartStore.setState({ sections: [] })` in `signOut()` action, or use session-scoped storage.

---

*Architecture analysis: 2026-05-13*
