import { supabase } from './supabaseClient'

const REQUEST_TIMEOUT_MS = 30_000

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Tempo limite da requisição esgotado. Verifique sua conexão e tente novamente.')
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HTTP ${res.status}: ${body}`)
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
