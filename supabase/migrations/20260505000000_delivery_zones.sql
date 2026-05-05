-- supabase/migrations/20260505000000_delivery_zones.sql

-- Table
CREATE TABLE IF NOT EXISTS delivery_zones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  city        TEXT NOT NULL,
  state       TEXT NOT NULL,
  days        TEXT[] NOT NULL DEFAULT '{}',
  hours_start TEXT NOT NULL,
  hours_end   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delivery_zones_select_all" ON delivery_zones
  FOR SELECT USING (true);

CREATE POLICY "delivery_zones_insert_own" ON delivery_zones
  FOR INSERT WITH CHECK (supplier_id = auth.uid());

CREATE POLICY "delivery_zones_update_own" ON delivery_zones
  FOR UPDATE USING (supplier_id = auth.uid())
  WITH CHECK (supplier_id = auth.uid());

CREATE POLICY "delivery_zones_delete_own" ON delivery_zones
  FOR DELETE USING (supplier_id = auth.uid());

-- Atomic increment RPCs (search_path locked to prevent hijacking)
CREATE OR REPLACE FUNCTION increment_product_sold(p_id uuid, p_amount int)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE products SET total_sold = total_sold + p_amount WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION increment_supplier_sales(p_id uuid, p_amount numeric)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE suppliers SET total_sales = total_sales + p_amount WHERE id = p_id;
$$;

-- Lock down RPC execution: only the service role (Hono adminSupabase) may call these.
-- Without this, any authenticated user with the anon key could inflate counters directly.
REVOKE EXECUTE ON FUNCTION increment_product_sold(uuid, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION increment_supplier_sales(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_product_sold(uuid, int) TO service_role;
GRANT EXECUTE ON FUNCTION increment_supplier_sales(uuid, numeric) TO service_role;
