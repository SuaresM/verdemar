-- ============================================================
-- Rota Verde - Tabela push_subscriptions para Web Push API
-- Rodar no SQL Editor do Supabase após supabase-schema.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Supplier can read/write their own subscription
CREATE POLICY "supplier_own_subscription" ON public.push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- Service role (Vercel function) can read subscriptions to send pushes
-- (service_role key bypasses RLS by default, so no extra policy needed)
