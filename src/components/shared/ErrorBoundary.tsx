import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  // Hard recovery: unregister the service worker, purge caches, clear the
  // Supabase auth token that may be stale/locked, then reload. This is the
  // "reloading doesn't help" escape hatch for users stuck on a cached broken
  // bundle or a corrupted session.
  handleHardReset = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
      // Drop the Supabase auth token if it's locked/corrupted.
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
        .forEach((k) => localStorage.removeItem(k))
    } catch (err) {
      console.error('Hard reset failed:', err)
    }
    // Hard reload, bypassing cache.
    window.location.href = '/login'
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
          <div className="text-5xl mb-4">😵</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Algo deu errado</h2>
          <p className="text-sm text-gray-500 mb-6">
            Ocorreu um erro inesperado. Use "Recarregar tudo" se recarregar a página não resolver.
          </p>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <button
              onClick={this.handleReset}
              className="px-6 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              Tentar novamente
            </button>
            <button
              onClick={this.handleHardReset}
              className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors"
            >
              Recarregar tudo (limpa cache)
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
