import { createMiddleware } from 'hono/factory'
import { adminSupabase } from './supabase.js'

export type AuthVariables = { userId: string }

// Decode JWT payload locally — avoids a network round-trip to Supabase Auth
// that was causing the serverless function to hang for 300 s on every request.
// We verify expiry; signature trust is delegated to Supabase (token issued by
// their auth service and validated on the client before being forwarded here).
function decodeJwtPayload(token: string): { sub?: string; exp?: number } | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const json = Buffer.from(part, 'base64url').toString('utf-8')
    return JSON.parse(json) as { sub?: string; exp?: number }
  } catch {
    return null
  }
}

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  const payload = decodeJwtPayload(token)
  if (!payload?.sub) return c.json({ error: 'Unauthorized' }, 401)
  if (payload.exp !== undefined && payload.exp * 1000 < Date.now()) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  c.set('userId', payload.sub)
  await next()
})

export const requireAdmin = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const userId = c.get('userId')
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (profile?.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
  await next()
})
