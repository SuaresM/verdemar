# Codebase Structure

**Analysis Date:** 2026-05-13

## Directory Layout

```
verdemar/
├── src/
│   ├── pages/                    # Role-based route pages (lazy-loaded)
│   │   ├── public/               # Auth pages: login, register, password reset
│   │   ├── buyer/                # Buyer features: home, search, cart, profile, order history
│   │   ├── supplier/             # Supplier dashboard, products, orders, settings
│   │   └── admin/                # Admin: dashboard, suppliers, products, orders, team
│   │
│   ├── components/               # Reusable React components
│   │   ├── ui/                   # Radix-based primitives (buttons, inputs, selects, etc.)
│   │   ├── shared/               # App-wide components (ErrorBoundary, LoadingSpinner, Badge)
│   │   ├── layout/               # Navigation & page wrappers (BuyerNav, SupplierNav, Header)
│   │   ├── product/              # Product-specific UI (ProductCard, PriceTag)
│   │   ├── cart/                 # Cart components (CartItem)
│   │   └── supplier/             # Supplier-specific UI (SupplierCard)
│   │
│   ├── stores/                   # Zustand state managers
│   │   ├── authStore.ts          # User auth, profile, role state (singleton)
│   │   ├── cartStore.ts          # Shopping cart per-supplier (persisted to localStorage)
│   │   └── storage.ts            # (Not currently used; storage utils)
│   │
│   ├── services/                 # Business logic & Supabase queries
│   │   ├── supabase.ts           # All DB operations: auth, profiles, products, orders, admin
│   │   ├── whatsapp.ts           # (Not present but referenced in App.tsx imports)
│   │   └── storage.ts            # (Not present; may be removed)
│   │
│   ├── lib/                      # Low-level clients & utilities
│   │   ├── supabaseClient.ts     # Initialized Supabase client
│   │   ├── apiClient.ts          # HTTP fetch wrapper with auth token injection
│   │   ├── pushNotifications.ts  # Web push subscription & messaging
│   │   └── supabase.ts           # (Backend only; admin client setup in api/_lib/)
│   │
│   ├── hooks/                    # Custom React hooks
│   │   └── useOnboarding.ts      # Guided tour with intro.js (role-specific)
│   │
│   ├── types/                    # TypeScript definitions
│   │   └── index.ts              # All domain types: Profile, Product, Order, etc.
│   │
│   ├── utils/                    # Utility functions
│   │   └── index.ts              # Formatters: currency, CNPJ, phone, dates, WhatsApp messages
│   │
│   ├── constants/                # Configuration & static data
│   │   └── cities.ts             # City/state list for dropdown (+ .test.ts)
│   │
│   ├── assets/                   # Images, icons, static files
│   │   └── (favicon, logos, etc.)
│   │
│   ├── test/                     # Test setup & helpers
│   │   └── setup.ts              # Vitest/JSDOM setup
│   │
│   ├── App.tsx                   # Root component: auth init, router setup, layouts
│   ├── main.tsx                  # Entry point: Sentry init, error handling, React mount
│   ├── index.css                 # Global Tailwind directives
│   └── sw.ts                     # Service worker for PWA (Workbox + precaching)
│
├── api/                          # Vercel serverless backend (Hono.js on Node.js runtime)
│   ├── [...]route].ts            # Hono app: /api/* routes (orders, suppliers, admin, webhooks)
│   └── _lib/                     # Backend-only utilities
│       ├── auth.ts               # Hono middleware: requireAuth, requireAdmin (JWT validation)
│       └── supabase.ts           # Admin Supabase client (service role key)
│
├── supabase/                     # Database migrations & config
│   └── migrations/               # (Not shown; typically version-controlled)
│
├── public/                       # Static assets served as-is
│   ├── icons/                    # PWA icons (192x192, 512x512)
│   ├── favicon.ico
│   └── ...
│
├── dist/                         # Built app output (Vite)
├── docs/                         # Project documentation
├── node_modules/                 # Dependencies (git-ignored)
│
├── vite.config.ts                # Vite + PWA plugin config
├── tsconfig.app.json             # TypeScript config (src/ compilation)
├── eslint.config.js              # ESLint rules
├── tailwind.config.js            # Tailwind CSS config
├── postcss.config.js             # PostCSS plugins
├── package.json                  # Scripts, dependencies, metadata
├── index.html                    # Entry HTML (Vite serves this)
│
├── .env                          # Environment variables (git-ignored)
├── .env.example                  # Example env vars (committed)
├── .gitignore                    # Git exclusions
│
├── supabase-schema.sql           # Database schema definition
├── supabase-trigger.sql          # Database triggers (total_sold increment)
├── supabase-trigger-total-sales.sql
├── supabase-push-subscriptions.sql
│
├── HANDOFF.md                    # Project handoff documentation
├── README.md                     # Project overview
└── .planning/                    # GSD planning output
    └── codebase/
        ├── ARCHITECTURE.md
        ├── STRUCTURE.md
        ├── CONVENTIONS.md
        ├── TESTING.md
        ├── STACK.md
        ├── INTEGRATIONS.md
        └── CONCERNS.md
```

## Directory Purposes

**src/pages/:**
- Purpose: Route-based page components, one per URL path
- Contains: Feature implementations (forms, lists, detail views)
- Key files: `Home.tsx`, `Cart.tsx`, `ProductDetail.tsx`, `Dashboard.tsx` (supplier), `Orders.tsx` (admin)

**src/components/:**
- Purpose: Reusable UI building blocks
- Contains: Buttons, inputs, forms, cards, modals, navigation
- Key files: `ui/*` (Radix primitives), `shared/ErrorBoundary.tsx`, `layout/BuyerNav.tsx`, `product/ProductCard.tsx`

**src/stores/:**
- Purpose: Global state management via Zustand
- Contains: Auth state, cart state (with localStorage persistence)
- Key files: `authStore.ts` (user profile, role), `cartStore.ts` (shopping cart sections)

**src/services/supabase.ts:**
- Purpose: Encapsulate all database queries and external calls
- Contains: ~100 exported async functions (getProfile, searchProducts, createOrder, etc.)
- Organization: Grouped by domain (AUTH, PROFILES, PRODUCTS, ORDERS, ADMIN, DELIVERY ZONES)

**src/lib/:**
- Purpose: Low-level clients and shared utilities
- Contains: Supabase client initialization, HTTP fetch wrapper, web push helpers
- Key files: `supabaseClient.ts` (singleton), `apiClient.ts` (fetch wrapper), `pushNotifications.ts`

**src/hooks/:**
- Purpose: Custom React hooks encapsulating logic
- Contains: `useOnboarding()` (guided tour initialization and cleanup)

**src/types/index.ts:**
- Purpose: Single source of TypeScript domain types
- Contains: Interfaces for Profile, Buyer, Supplier, Product, Order, CartItem, etc.

**src/utils/index.ts:**
- Purpose: Pure utility functions (no side effects)
- Contains: Formatters (currency, CNPJ, phone, dates), WhatsApp message builders, label mappers

**api/[...route].ts:**
- Purpose: Vercel serverless API layer (Hono framework)
- Contains: Order creation, admin operations, webhook handlers
- Auth: Middleware validates JWT; routes check role-based permissions

**api/_lib/:**
- Purpose: Backend-only utilities (not exposed to frontend)
- Contains: Admin Supabase client (service role key), auth middleware

## Key File Locations

**Entry Points:**
- `src/main.tsx`: React root initialization, Sentry setup, chunk-reload error handler
- `src/App.tsx`: Router setup, layout components, auth state initialization
- `api/[...route].ts`: Hono app entry; all `/api/*` routes routed through here

**Configuration:**
- `vite.config.ts`: Vite build, PWA plugin, path aliases (@/)
- `tsconfig.app.json`: TypeScript compiler options, path mapping
- `tailwind.config.js`: Tailwind CSS theme and plugins
- `.env.example`: Template for required environment variables

**Core Logic:**
- `src/services/supabase.ts`: ~420 lines, all database operations
- `src/stores/authStore.ts`: Auth state machine, profile loading with mutex
- `src/stores/cartStore.ts`: Cart state with localStorage sync
- `api/[...route].ts`: ~150+ lines of order, admin, and webhook endpoints

**Testing:**
- `src/**/*.test.ts`, `src/**/*.test.tsx`: Vitest unit tests (co-located)
- `src/test/setup.ts`: Vitest globals + jsdom config
- `src/constants/cities.test.ts`: Example test file
- `src/stores/cartStore.test.ts`: Cart store snapshot + action tests

## Naming Conventions

**Files:**
- Page components: `PascalCase.tsx` (e.g., `Home.tsx`, `ProductDetail.tsx`)
- Utility functions: `camelCase.ts` (e.g., `utils/index.ts`, `lib/apiClient.ts`)
- Components: `PascalCase.tsx` (e.g., `ProductCard.tsx`, `BuyerNav.tsx`)
- Tests: `*.test.ts` or `*.test.tsx` suffix (co-located with source)
- Types: Interfaces in `src/types/index.ts`, no separate `*.types.ts` files

**Directories:**
- Feature domains: `camelCase` (e.g., `src/pages/buyer`, `src/pages/supplier`, `api/_lib`)
- Component categories: `camelCase` (e.g., `src/components/shared`, `src/components/ui`)
- Store/service: `camelCase.ts` (e.g., `authStore.ts`, `supabase.ts`)

**Functions:**
- Async service functions: `verb + noun` in camelCase (e.g., `getProfile`, `createOrder`, `searchProducts`)
- React components: `PascalCase` (e.g., `BuyerNav`, `ProductCard`)
- Hooks: `use + PascalCaseLogic` (e.g., `useOnboarding`, `useAuthStore`)
- Util functions: camelCase (e.g., `formatCurrency`, `calculatePricePerKg`)

**Variables:**
- Constants: `UPPER_SNAKE_CASE` (e.g., `PAGE_SIZE`, `STORAGE_KEY_PREFIX`)
- State variables: camelCase (e.g., `isLoading`, `sections`, `cartItems`)
- React props: camelCase (e.g., `onClick`, `productId`, `isActive`)

**Types:**
- Interfaces: `PascalCase` (e.g., `Profile`, `Product`, `CartItem`)
- Type aliases: `PascalCase` (e.g., `UserRole = 'buyer' | 'supplier' | 'admin'`)
- Union types: `PascalCase` (e.g., `OrderStatus = 'pending' | 'confirmed' | ...`)

## Where to Add New Code

**New Buyer Feature (e.g., Favorites list):**
- Page component: `src/pages/buyer/Favorites.tsx`
- Route: Add route in `src/App.tsx` under BuyerLayout
- Service queries: Add functions to `src/services/supabase.ts` (e.g., `getFavorites()`, `addFavorite()`)
- Store state (if needed): Add to `src/stores/authStore.ts` or create `src/stores/favoritesStore.ts`
- Components: Reuse from `src/components/product/ProductCard.tsx` or `src/components/shared/`
- Tests: Create `src/pages/buyer/Favorites.test.tsx` + service test stubs

**New Supplier Dashboard Widget:**
- Page: Modify `src/pages/supplier/Dashboard.tsx`
- Service query: Add function to `src/services/supabase.ts` (e.g., `getSupplierAnalytics()`)
- Component: Create `src/components/supplier/AnalyticsWidget.tsx` if reusable
- Styling: Use Tailwind classes; no CSS modules (inline + clsx)
- Hook: Extract data fetching to custom hook if complex (e.g., `useSupplierAnalytics()`)

**New Admin Page:**
- Page: Create `src/pages/admin/NewFeature.tsx`
- Route: Add to `src/App.tsx` under AdminLayout
- Service: Add API client call to `src/services/supabase.ts` that routes through backend
- Backend logic: Add handler to `api/[...route].ts` with `requireAdmin` middleware
- Component: Use existing UI primitives from `src/components/ui/` or create domain component

**New Utility or Helper:**
- If formatting/pure logic: Add to `src/utils/index.ts`
- If data transformation: Keep in service file where it's used
- If validation: Add to a new `src/utils/validators.ts` or domain service

**New Backend Endpoint:**
- Add handler to `api/[...route].ts` (keep file as single route handler)
- Auth middleware: Use `requireAuth` (any logged-in user) or `requireAdmin` (admin only)
- Implementation: Query admin Supabase client (`adminSupabase` from `_lib/supabase.ts`)
- Error handling: Return JSON error with HTTP status code

**New Test:**
- Unit test: Co-locate with source (`src/utils/index.test.ts` for utils, etc.)
- Page test: Create `src/pages/buyer/Cart.test.tsx` (mock services + stores)
- Service test: Create `src/services/supabase.test.ts` (mock Supabase client)
- Use `describe()` + `it()` from Vitest globals; no imports needed

## Special Directories

**src/test/:**
- Purpose: Vitest setup and shared test utilities
- Generated: No
- Committed: Yes
- Key: `setup.ts` imported by `vite.config.ts`

**dist/:**
- Purpose: Built application output (Vite)
- Generated: Yes (by `npm run build`)
- Committed: No (git-ignored)

**node_modules/:**
- Purpose: Installed dependencies
- Generated: Yes (by `npm install`)
- Committed: No (git-ignored)

**supabase/ (if exists):**
- Purpose: Database migrations, triggers, RLS policies
- Generated: No
- Committed: Yes
- Key: Schema SQL files checked into root for reference

**api/_lib/:**
- Purpose: Backend-only secrets and utilities (not bundled to frontend)
- Generated: No
- Committed: Yes (but .env secrets are git-ignored)

---

*Structure analysis: 2026-05-13*
