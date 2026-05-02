import { createClient } from '@supabase/supabase-js'

// Rota Verde Supabase project (anon key is public by design)
const DEFAULT_SUPABASE_URL = 'https://vpomchqkkmjjeschanch.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwb21jaHFra21qamVzY2hhbmNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1Mzk5NTYsImV4cCI6MjA4OTExNTk1Nn0.PZP2cHX00MwDfVVZnaAcRmLNOGTm8LShLOk3JEJ8NQM'

const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const envAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

// Use env values only if they point to the correct Rota Verde project.
// Prevents stale/incorrect Vercel env vars from breaking production.
const supabaseUrl =
  envUrl && envUrl.includes('vpomchqkkmjjeschanch') ? envUrl : DEFAULT_SUPABASE_URL
const supabaseAnonKey = envAnonKey && envUrl?.includes('vpomchqkkmjjeschanch')
  ? envAnonKey
  : DEFAULT_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
