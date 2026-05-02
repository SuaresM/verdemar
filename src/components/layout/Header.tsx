import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface HeaderProps {
  title?: string
  showBack?: boolean
  right?: React.ReactNode
  transparent?: boolean
}

export function Header({ title, showBack = false, right, transparent = false }: HeaderProps) {
  const navigate = useNavigate()

  return (
    <header
      className={`sticky top-0 z-40 flex items-center justify-between px-4 h-14 ${
        transparent ? 'bg-transparent' : 'bg-white border-b border-gray-100'
      }`}
    >
      <div className="flex items-center gap-3 flex-1">
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
        )}
        {title && (
          <h1 className="text-lg font-bold text-gray-900 truncate">{title}</h1>
        )}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </header>
  )
}

export function RotaVerdeHeader() {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 h-14 flex items-center">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🌿</span>
        <span className="text-xl font-extrabold text-primary">Rota Verde</span>
      </div>
    </header>
  )
}
