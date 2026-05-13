-- supabase/migrations/20260513000000_order_flow.sql
-- Phase 01: Add rejection_reason, status_history, idempotency_key to orders;
--           replace status CHECK constraint to include in_route and rejected;
--           change push_subscriptions unique key to (user_id, endpoint) for multi-device support.

-- ── ORDERS: new columns ───────────────────────────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS status_history JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS idempotency_key UUID;

-- ── ORDERS: replace status CHECK constraint ───────────────────────────────────
-- The old constraint (orders_status_check) uses 'in_delivery'; v1.1 uses 'in_route'.
-- Drop first (IF EXISTS is safe — migration won't fail if name differs slightly).

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add the new constraint using NOT VALID to avoid ACCESS EXCLUSIVE table lock.
-- NOT VALID means existing rows are not checked immediately.
ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'confirmed', 'in_route', 'delivered', 'cancelled', 'rejected'))
  NOT VALID;

-- Validate in a separate statement (uses SHARE UPDATE EXCLUSIVE lock — allows concurrent reads).
ALTER TABLE orders VALIDATE CONSTRAINT orders_status_check;

-- ── ORDERS: idempotency key unique index ──────────────────────────────────────
-- Partial index: only non-NULL idempotency_key values are deduplicated.
-- Allows rows with NULL idempotency_key (old orders) to coexist without conflict.
CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_idx
  ON orders (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ── PUSH_SUBSCRIPTIONS: composite key (user_id, endpoint) ────────────────────
-- Remove the old single-column unique constraint on user_id alone.
ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_key;

-- Add endpoint TEXT column (populated by the application on upsert).
-- Application sends subscription.endpoint as a top-level field alongside the JSONB blob.
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS endpoint TEXT;

-- Composite unique index: one row per (user, device endpoint).
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_endpoint_idx
  ON public.push_subscriptions (user_id, endpoint);
