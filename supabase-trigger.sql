-- ============================================================
-- VerdeMar - Auth trigger for automatic profile creation
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Drop existing if needed
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Function: auto-creates profile + buyer/supplier from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  meta JSONB;
  reg  JSONB;
BEGIN
  meta := COALESCE(NEW.raw_user_meta_data, '{}'::JSONB);

  -- Reject invalid roles (only buyer and supplier allowed via signup)
  IF meta->>'role' IS NULL THEN
    RETURN NEW;
  END IF;

  IF meta->>'role' NOT IN ('buyer', 'supplier') THEN
    RAISE EXCEPTION 'Invalid role: %. Only buyer and supplier are allowed.', meta->>'role';
  END IF;

  INSERT INTO public.profiles (id, role, full_name, phone)
  VALUES (
    NEW.id,
    meta->>'role',
    COALESCE(NULLIF(meta->>'full_name', ''), 'Usuário'),
    COALESCE(NULLIF(meta->>'phone', ''), '')
  )
  ON CONFLICT (id) DO NOTHING;

  BEGIN
    reg := (meta->>'registration_data')::JSONB;
  EXCEPTION WHEN OTHERS THEN
    reg := NULL;
  END;

  IF reg IS NULL THEN
    RETURN NEW;
  END IF;

  IF meta->>'role' = 'buyer' THEN
    INSERT INTO public.buyers (
      id, company_name, cnpj, state_registration, email,
      address_street, address_number, address_complement,
      address_neighborhood, address_city, address_state, address_zip,
      business_hours, contact_phone
    ) VALUES (
      NEW.id, reg->>'company_name', reg->>'cnpj',
      NULLIF(reg->>'state_registration', ''), reg->>'email',
      reg->>'address_street', reg->>'address_number',
      NULLIF(reg->>'address_complement', ''),
      reg->>'address_neighborhood', reg->>'address_city',
      reg->>'address_state', reg->>'address_zip',
      reg->>'business_hours', reg->>'contact_phone'
    ) ON CONFLICT (id) DO NOTHING;
  END IF;

  IF meta->>'role' = 'supplier' THEN
    INSERT INTO public.suppliers (
      id, store_name, description, whatsapp,
      min_order_value, min_order_quantity,
      delivery_days, delivery_hours_start, delivery_hours_end,
      address_city, address_state, is_active
    ) VALUES (
      NEW.id, reg->>'store_name', NULLIF(reg->>'description', ''), reg->>'whatsapp',
      CASE WHEN reg->>'min_order_value' IS NOT NULL AND reg->>'min_order_value' NOT IN ('', 'null')
           THEN (reg->>'min_order_value')::DECIMAL ELSE NULL END,
      CASE WHEN reg->>'min_order_quantity' IS NOT NULL AND reg->>'min_order_quantity' NOT IN ('', 'null')
           THEN (reg->>'min_order_quantity')::INTEGER ELSE NULL END,
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(reg->'delivery_days', '[]'::JSONB))),
      COALESCE(NULLIF(reg->>'delivery_hours_start', ''), '08:00')::TIME,
      COALESCE(NULLIF(reg->>'delivery_hours_end', ''), '18:00')::TIME,
      reg->>'address_city', reg->>'address_state', TRUE
    ) ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
