# Codebase Concerns

**Analysis Date:** 2026-05-13

## Tech Debt

**Unsafe type assertions in product form:**
- Issue: `productData as any` type assertion bypasses TypeScript validation when saving products
- Files: `src/pages/supplier/ProductForm.tsx` (lines 176, 179)
- Impact: Type errors not caught at compile time; malformed data can reach the API if the Record construction is wrong
- Fix approach: Create a proper Product type conversion function that validates all fields before API submission, eliminating the need for `as any`

**Module-level state mutations in auth:**
- Issue: `loadProfileInFlight` is a module-level variable that holds a Promise, acting as a runtime mutex
- Files: `src/stores/authStore.ts` (line 23)
- Impact: Not a crash risk, but harder to test and debug concurrent auth state changes; global state makes testing less isolated
- Fix approach: Migrate to a Zustand action queue or introduce a proper async state machine using a library like `xstate` for concurrent request handling

**Hardcoded Supabase environment variables with fallback:**
- Issue: Although `src/lib/supabaseClient.ts` uses `import.meta.env.VITE_*`, the HANDOFF.md notes that Vercel env vars were historically wrong; code has a guard but it's not transparent
- Files: `src/lib/supabaseClient.ts`, `.env`
- Impact: Production deploys can silently work with wrong credentials if env vars are misconfigured; difficult to debug in production
- Fix approach: Add explicit validation that throws at runtime if URL/key don't match a whitelist of known project IDs, making misconfigs fail fast

**Promise fire-and-forget pattern in API:**
- Issue: Multiple `.catch(() => {})` patterns swallow errors silently without logging
- Files: `api/[...route].ts` (lines 50-54, 57-60, 62), `src/pages/buyer/Cart.tsx` (line 223), `src/pages/supplier/Dashboard.tsx`
- Impact: Silent failures in order increment operations, push notifications, and WhatsApp status updates go unnoticed; no observability for analytics or stock updates
- Fix approach: Replace all `.catch(() => {})` with proper error logging and metrics; ensure critical operations (stock increment, sales tracking) are awaited with user feedback

## Known Bugs

**Delivery zones not fetched before order submission:**
- Symptoms: User can select a delivery zone in cart, but if the zone list fails to load, they can still proceed to checkout with undefined zone state
- Files: `src/pages/buyer/Cart.tsx` (lines 173-186)
- Trigger: Network error or slow API during cart page load; user enters checkout before zones are loaded
- Workaround: Page reload forces zones to reload; zones fetch has no timeout/retry

**Missing `created_at` field in delivery zones response:**
- Symptoms: DeliveryZone type expects `created_at?: string`, but API creation does not return timestamp metadata
- Files: `src/types/index.ts` (line 125), `api/[...route].ts` (lines 194-201)
- Trigger: If frontend code ever relies on `zone.created_at` for sorting or filtering, it will get `undefined`
- Workaround: Postgres automatically adds `created_at` on insert if column has default, but API doesn't select it

**Order items validation missing cart quantity check:**
- Symptoms: Cart allows adding unlimited quantity of items, but when sent to API there's no quantity_per_item limit enforced
- Files: `src/stores/cartStore.ts`, API order creation does not validate `quantity` field bounds
- Trigger: User manually edits cart state in browser console or adds 1000+ units
- Workaround: Supabase RLS/triggers don't block high quantities; relying on UI validation only

## Security Considerations

**Unvalidated status string in order update:**
- Risk: API accepts any string as order `status` without enum validation; bad actors could set `status: "paid"` or `status: "refunded"` without business logic
- Files: `api/[...route].ts` (line 69)
- Current mitigation: Frontend only sends valid statuses; Supabase RLS policies don't explicitly restrict status values
- Recommendations: 
  1. Add Zod schema validation for status enum in API route before update
  2. Add Postgres check constraint `CHECK (status IN ('pending', 'confirmed', 'in_delivery', 'delivered', 'cancelled'))`

**Product data mutation allows setting arbitrary fields:**
- Risk: API endpoint for stock/sell_without_stock updates receives `Record<string, unknown>` and builds update object without schema validation
- Files: `api/[...route].ts` (line 26) `/orders` endpoint uses untyped body
- Current mitigation: API only updates specific columns (stock_quantity, sell_without_stock) via explicit field assignment
- Recommendations:
  1. Define strict Zod schemas for all POST/PATCH bodies
  2. Use `.pick()` to whitelist fields before database update

**Service role key exposure risk:**
- Risk: Service role key (`SUPABASE_SERVICE_ROLE_KEY`) must be stored in Vercel secrets; if leaked, attacker can bypass all RLS policies
- Files: `api/_lib/supabase.ts`, `.env` (should NOT be versioned but may be in history)
- Current mitigation: Key is env-only (not hardcoded), stored in Vercel secret manager
- Recommendations:
  1. Rotate service role key immediately if any git history reveals it (check with `git log -p | grep SUPABASE_SERVICE_ROLE`)
  2. Audit Vercel logs for unauthorized API calls
  3. Consider using Postgres `row_level_security` functions instead of service role for sensitive operations

**WhatsApp number hardcoded in environment:**
- Risk: `VITE_SUPPORT_WHATSAPP` is visible in browser bundle and can be easily scraped/phished
- Files: `src/services/whatsapp.ts`, referenced in `src/pages/supplier/StoreSettings.tsx`
- Current mitigation: It's a support number, not a payment destination, so low financial risk
- Recommendations:
  1. Consider moving WhatsApp routing to backend API endpoint to allow dynamic configuration
  2. Document that this number is public and not a security secret

**Admin role creation bypass:**
- Risk: No way to create admin accounts via frontend; only manual SQL or auth.admin API can create them
- Files: `supabase-trigger.sql` blocks admin creation in trigger
- Current mitigation: Prevents accidental admin creation during signup
- Recommendations:
  1. Document the admin creation process in HANDOFF.md with clear steps
  2. Consider adding admin approval workflow (pending admin requests) if multi-tenant support is needed

## Performance Bottlenecks

**Store settings page renders 500+ lines with minimal re-use:**
- Problem: `StoreSettings.tsx` is 564 lines, includes delivery zone form, password change modal, image upload, and settings form all in one component
- Files: `src/pages/supplier/StoreSettings.tsx`
- Cause: No component extraction; all state (zones, form fields, modals) managed in single component; every form change re-renders the entire page
- Improvement path:
  1. Extract delivery zones to `DeliveryZonesManager.tsx` with local state
  2. Extract password change to `PasswordChangeModal.tsx`
  3. Use React.memo() for stable zone list display
  4. Lazy-load zone edit form only when editing

**Cart page re-fetches zones on every section change:**
- Problem: Delivery zones query in useEffect has `[sections]` dependency; adding/removing items re-runs the Promise.all
- Files: `src/pages/buyer/Cart.tsx` (lines 173-186)
- Cause: Missing dependency array optimization; zones are stable unless supplier list changes
- Improvement path:
  1. Change dependency from `[sections]` to `[sections.map(s => s.supplier.id).join(',')]` to detect supplier changes only
  2. Cache zone data in a separate store (e.g., `useDeliveryZonesStore`) with 5-minute TTL

**Admin dashboard loads all suppliers without pagination:**
- Problem: `getAdminDashboard()` calls `getAllSuppliers()` which fetches all rows
- Files: `src/services/supabase.ts` (approx. line 160-200), `src/pages/admin/Dashboard.tsx`
- Cause: No `.limit()` applied; Supabase RLS can fetch hundreds of supplier records on initial dashboard load
- Improvement path:
  1. Add `.limit(10)` to dashboard queries
  2. Show "Load more" button if `hasMore` returned
  3. Cache dashboard metrics with 1-minute TTL to reduce repeated API calls

## Fragile Areas

**Order checkout flow with no idempotency key:**
- Files: `src/pages/buyer/Cart.tsx` (lines 220-259), `api/[...route].ts` (lines 24-64)
- Why fragile: If network hiccup occurs after order creation but before success screen, user can retry and create duplicate orders
- Safe modification: 
  1. Add `idempotencyKey` UUID to order creation request
  2. Store recently-created order IDs in Supabase with 1-minute TTL
  3. Check for duplicates before insertion using `ON CONFLICT`
- Test coverage: No test for duplicate order scenario; only basic cartStore tests exist

**Product form image upload without abort handling:**
- Files: `src/pages/supplier/ProductForm.tsx` (lines 121-129, 141-142)
- Why fragile: User navigates away mid-upload; file handle and preview URL may not clean up properly
- Safe modification:
  1. Store AbortController in ref alongside file
  2. Cancel upload in useEffect cleanup
  3. Add max file size validation before upload starts
- Test coverage: Zero tests for ProductForm; only ProductCard has basic snapshot tests

**Delivery zone days array mutation:**
- Files: `src/pages/supplier/StoreSettings.tsx` (line 66), `api/[...route].ts` (line 190)
- Why fragile: Days array passed directly through form state without immutability checks; accidental mutation in zone edit could lose data
- Safe modification:
  1. Use `Array.from()` or spread operator `[...days]` when cloning zones
  2. Add schema validation to ensure days is non-empty array
  3. Test that editing one zone doesn't affect others
- Test coverage: No tests for zone management

## Scaling Limits

**Cart state persisted to localStorage without size limit:**
- Current capacity: localStorage typically 5-10MB per origin
- Limit: If buyer has 1000+ items across many suppliers, serialized cart could exceed limits
- Scaling path:
  1. Add cart size warning at 500 items
  2. Implement cart compression (drop item descriptions, store only IDs)
  3. Move cart to IndexedDB for 50+ MB capacity
  4. Add cleanup mechanism to remove carts older than 30 days

**Supabase RLS policy evaluation scales linearly with supplier count:**
- Current capacity: Works fine for <100 suppliers; Postgres can scan "view all active suppliers" in <50ms
- Limit: At 1000+ suppliers, policy checks may slow down
- Scaling path:
  1. Add database index on `suppliers(is_active, created_at DESC)`
  2. Consider materialized view for featured suppliers query
  3. Cache featured suppliers in Redis with 1-hour TTL

## Dependencies at Risk

**Workbox auto-update can leave app in broken state:**
- Risk: vite-plugin-pwa with autoUpdate enabled; if new build deployed mid-session, old JS tries to load new assets
- Impact: CORS errors, missing chunks, or cached API responses from old schema
- Migration plan:
  1. Add service worker message listener to detect updates and prompt user "New version available, reload now?"
  2. Or implement skip-waiting to swap immediately (more aggressive)
  3. Add integration test that deploys new version and checks PWA update flow

**react-hook-form + zod validation deeply nested:**
- Risk: No version pinning; react-hook-form 7.71.2 + @hookform/resolvers 5.2.2 combo hasn't been tested with zod 4.3.6
- Impact: Form validation could silently fail if zod changes serialization format
- Migration plan:
  1. Add explicit tests for register → zod validation → error display flow
  2. Pin devDependencies in package.json with exact versions (remove `^`)
  3. Add `npm audit fix` to CI/CD

**Supabase-js 2.99.0 approaching end-of-life for v2 (v3 released):**
- Risk: v2 will stop receiving security patches in late 2025
- Impact: Type changes required when upgrading from v2 → v3
- Migration plan:
  1. Create feature branch to upgrade to @supabase/supabase-js@^3.0
  2. Update `createClient` imports (v3 uses different options format)
  3. Test auth, storage, and RLS policies before merging

## Missing Critical Features

**No error retry mechanism for transient failures:**
- Problem: Network errors in product upload, order creation, or zone management fail immediately with no retry logic
- Blocks: Users on flaky connections (mobile) have bad experience; can't recover from temporary API outage
- Solution approach:
  1. Implement exponential backoff utility: `withRetry(fn, { maxRetries: 3, delay: 1000 })`
  2. Use it in all API calls from pages and services
  3. Show "Retrying..." spinner instead of immediate error

**No batch upload for product images:**
- Problem: Each product upload is serial; adding 10 products with images takes 10× the time
- Blocks: Suppliers with 50+ products can't quickly re-stock the catalog
- Solution approach:
  1. Add queue system using custom hook
  2. Implement parallel uploads with max 3 concurrent
  3. Show progress bar with item counts

**No offline support for order creation:**
- Problem: If user loses connection after filling cart but before submitting, order is lost
- Blocks: Important for mobile users on unreliable networks
- Solution approach:
  1. Store draft orders in IndexedDB on form submit attempt
  2. Add "Retry pending orders" button on reconnection
  3. Sync draft when online again

## Test Coverage Gaps

**API endpoints have zero test coverage:**
- What's not tested: All `/orders`, `/products`, `/admin` endpoints, request validation, permission checks
- Files: `api/[...route].ts`, `api/_lib/auth.ts`
- Risk: Silent breakage of core business logic (order creation, stock updates); permission bypass goes undetected
- Priority: **High** — Production critical

**Page components lack integration tests:**
- What's not tested: Checkout flow end-to-end, zone selection + order submission, product form with image upload, admin supplier activation
- Files: `src/pages/**/*.tsx` (except minimal unit test files)
- Risk: UI flow regressions (e.g., zones not loading, button disabled when shouldn't be) only caught in manual testing
- Priority: **High** — User-facing flows

**Services layer untested:**
- What's not tested: `src/services/supabase.ts` query construction, error handling from Supabase client
- Files: `src/services/supabase.ts`
- Risk: Query bugs (wrong filters, missing joins) ship to production; RLS violations not caught
- Priority: **Medium** — Data access layer is crucial but uses standard Supabase client

**Store mutations lack test coverage:**
- What's not tested: `authStore` (signIn flow, profile loading, session persistence), delivery zone selection in cart
- Files: `src/stores/authStore.ts` (no test file exists), `src/stores/cartStore.test.ts` is incomplete (only 50 lines)
- Risk: Auth state race conditions, cart corruption on navigation
- Priority: **Medium** — Core app state

**Hooks not tested:**
- What's not tested: `useOnboarding()` intro.js integration, responsive behavior
- Files: `src/hooks/useOnboarding.ts` (no test file)
- Risk: Onboarding breaks silently on role changes; users can't access tutorials
- Priority: **Low** — UX feature, not business-critical

---

*Concerns audit: 2026-05-13*
