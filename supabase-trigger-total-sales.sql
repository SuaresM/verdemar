-- ============================================================
-- Rota Verde - Trigger para atualizar total_sales do supplier
-- Substitui o RPC increment_supplier_sales chamado pelo cliente
-- Rodar no SQL Editor do Supabase após supabase-schema.sql
-- ============================================================

-- Remove o RPC antigo (agora substituído pelo trigger)
DROP FUNCTION IF EXISTS public.increment_supplier_sales(UUID) CASCADE;

-- Função chamada pelo trigger em cada novo pedido
CREATE OR REPLACE FUNCTION public.update_supplier_total_sales()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE suppliers
  SET total_sales = total_sales + NEW.total_value
  WHERE id = NEW.supplier_id;
  RETURN NEW;
END;
$$;

-- Trigger: dispara após insert em orders
DROP TRIGGER IF EXISTS on_order_created_update_sales ON orders;
CREATE TRIGGER on_order_created_update_sales
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_supplier_total_sales();
