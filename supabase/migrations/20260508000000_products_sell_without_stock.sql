-- supabase/migrations/20260508000000_products_sell_without_stock.sql
-- D-02: Add sell_without_stock flag to products so suppliers can opt-in to accepting orders when stock_quantity = 0.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sell_without_stock boolean NOT NULL DEFAULT false;
