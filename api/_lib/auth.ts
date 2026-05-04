import { createMiddleware } from 'hono/factory'
import { adminSupabase } from './supabase'

export type AuthVariables = { userId: string }

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  const {
    data: { user },
    error,
  } = await adminSupabase.auth.getUser(token)
  if (error || !user) return c.json({ error: 'Unauthorized' }, 401)

  c.set('userId', user.id)
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
