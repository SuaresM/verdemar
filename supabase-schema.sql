-- ============================================================
-- Rota Verde - Supabase Database Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('buyer', 'supplier', 'admin')),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Buyers
CREATE TABLE IF NOT EXISTS buyers (
  id UUID REFERENCES profiles PRIMARY KEY,
  company_name TEXT NOT NULL,
  cnpj TEXT UNIQUE NOT NULL,
  state_registration TEXT,
  email TEXT NOT NULL,
  address_street TEXT NOT NULL,
  address_number TEXT NOT NULL,
  address_complement TEXT,
  address_neighborhood TEXT NOT NULL,
  address_city TEXT NOT NULL,
  address_state TEXT NOT NULL,
  address_zip TEXT NOT NULL,
  business_hours TEXT NOT NULL,
  contact_phone TEXT NOT NULL
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID REFERENCES profiles PRIMARY KEY,
  store_name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  banner_url TEXT,
  whatsapp TEXT NOT NULL,
  min_order_value DECIMAL(10,2),
  min_order_quantity INTEGER,
  delivery_days TEXT[] NOT NULL DEFAULT '{}',
  delivery_hours_start TIME NOT NULL DEFAULT '08:00',
  delivery_hours_end TIME NOT NULL DEFAULT '18:00',
  address_city TEXT NOT NULL,
  address_state TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  total_sales INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID REFERENCES suppliers NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('fruit','vegetable','greens','other')),
  image_url TEXT,
  sale_unit TEXT NOT NULL CHECK (sale_unit IN ('box','kg','unit')),
  box_weight_kg DECIMAL(10,3),
  box_unit_quantity INTEGER,
  box_price DECIMAL(10,2),
  price_per_kg DECIMAL(10,2),
  price_per_unit DECIMAL(10,2),
  unit_description TEXT,
  stock_quantity DECIMAL(10,3),
  is_available BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  total_sold INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID REFERENCES buyers NOT NULL,
  supplier_id UUID REFERENCES suppliers NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','in_delivery','delivered','cancelled')),
  total_value DECIMAL(10,2) NOT NULL,
  notes TEXT,
  delivery_time_preference TEXT,
  payment_method TEXT DEFAULT 'cash_on_delivery',
  whatsapp_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products NOT NULL,
  product_name TEXT NOT NULL,
  sale_unit TEXT NOT NULL,
  quantity DECIMAL(10,3) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Buyers policies
CREATE POLICY "Buyers can view own data" ON buyers
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Buyers can insert own data" ON buyers
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Buyers can update own data" ON buyers
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Suppliers can view buyer data for their orders" ON buyers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.buyer_id = buyers.id
      AND orders.supplier_id = auth.uid()
    )
  );

-- Suppliers policies
CREATE POLICY "Anyone can view active suppliers" ON suppliers
  FOR SELECT USING (is_active = true OR auth.uid() = id);

CREATE POLICY "Suppliers can insert own data" ON suppliers
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Suppliers can update own data" ON suppliers
  FOR UPDATE USING (auth.uid() = id);

-- Products policies
CREATE POLICY "Anyone can view available products" ON products
  FOR SELECT USING (is_available = true OR supplier_id = auth.uid());

CREATE POLICY "Suppliers can manage own products" ON products
  FOR ALL USING (supplier_id = auth.uid());

-- Orders policies
CREATE POLICY "Buyers can view own orders" ON orders
  FOR SELECT USING (buyer_id = auth.uid());

CREATE POLICY "Suppliers can view their orders" ON orders
  FOR SELECT USING (supplier_id = auth.uid());

CREATE POLICY "Buyers can create orders" ON orders
  FOR INSERT WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Suppliers can update order status" ON orders
  FOR UPDATE USING (supplier_id = auth.uid());

-- Order items policies
CREATE POLICY "Order participants can view items" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (orders.buyer_id = auth.uid() OR orders.supplier_id = auth.uid())
    )
  );

CREATE POLICY "Buyers can create order items" ON order_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.buyer_id = auth.uid()
    )
  );

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Increment supplier sales counter
CREATE OR REPLACE FUNCTION increment_supplier_sales(supplier_id UUID)
RETURNS void AS $$
BEGIN
  -- Only increment if caller has placed an order with this supplier
  IF NOT EXISTS (
    SELECT 1 FROM orders
    WHERE orders.supplier_id = increment_supplier_sales.supplier_id
    AND orders.buyer_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to increment sales for this supplier';
  END IF;

  UPDATE suppliers
  SET total_sales = total_sales + 1
  WHERE id = increment_supplier_sales.supplier_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- STORAGE BUCKETS
-- Run these in the Supabase dashboard Storage section
-- or via the API after setup:
-- ============================================================
-- Create bucket: product-images (public)
-- Create bucket: supplier-assets (public)

-- ============================================================
-- ADMIN ROLE SUPPORT
-- ============================================================

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin RLS policies
CREATE POLICY "Admin can read all profiles" ON profiles FOR SELECT USING (is_admin());
CREATE POLICY "Admin can update all profiles" ON profiles FOR UPDATE USING (is_admin());
CREATE POLICY "Admin can read all buyers" ON buyers FOR SELECT USING (is_admin());
CREATE POLICY "Admin can read all suppliers" ON suppliers FOR SELECT USING (is_admin());
CREATE POLICY "Admin can update all suppliers" ON suppliers FOR UPDATE USING (is_admin());
CREATE POLICY "Admin can delete suppliers" ON suppliers FOR DELETE USING (is_admin());
CREATE POLICY "Admin can read all products" ON products FOR SELECT USING (is_admin());
CREATE POLICY "Admin can update all products" ON products FOR UPDATE USING (is_admin());
CREATE POLICY "Admin can delete all products" ON products FOR DELETE USING (is_admin());
CREATE POLICY "Admin can read all orders" ON orders FOR SELECT USING (is_admin());
CREATE POLICY "Admin can read all order items" ON order_items FOR SELECT USING (is_admin());

-- Insert test data (optional)
-- INSERT INTO profiles...
