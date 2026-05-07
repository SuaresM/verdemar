import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.tsx'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN as string | undefined,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.2,
  enabled: import.meta.env.PROD,
})

// Auto-reload once on ChunkLoadError (stale SW evicting old hashed chunks).
// sessionStorage prevents infinite loops: first failure → silent reload,
// second failure → ErrorBoundary shows "Algo deu errado" as fallback.
function isChunkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return (
    err.name === 'ChunkLoadError' ||
    /loading chunk \d+ failed/i.test(err.message) ||
    /failed to fetch dynamically imported module/i.test(err.message)
  )
}

window.addEventListener('error', (event) => {
  if (isChunkError(event.error)) {
    if (!sessionStorage.getItem('chunk-reload-attempted')) {
      sessionStorage.setItem('chunk-reload-attempted', '1')
      window.location.reload()
    }
  }
})

window.addEventListener('unhandledrejection', (event) => {
  if (isChunkError(event.reason)) {
    event.preventDefault()
    if (!sessionStorage.getItem('chunk-reload-attempted')) {
      sessionStorage.setItem('chunk-reload-attempted', '1')
      window.location.reload()
    }
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
