import type { OrderStatus } from '../../types'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted'
  size?: 'sm' | 'md'
}

export function Badge({ children, variant = 'primary', size = 'sm' }: BadgeProps) {
  const variantClasses = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    danger: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
    muted: 'bg-gray-100 text-gray-600',
  }

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  }

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full ${variantClasses[variant]} ${sizeClasses[size]}`}
    >
      {children}
    </span>
  )
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config: Record<OrderStatus, { label: string; variant: BadgeProps['variant'] }> = {
    pending: { label: 'Aguardando', variant: 'warning' },
    confirmed: { label: 'Confirmado', variant: 'info' },
    in_delivery: { label: 'Em Rota', variant: 'primary' },
    delivered: { label: 'Entregue', variant: 'success' },
    cancelled: { label: 'Cancelado', variant: 'danger' },
  }

  const { label, variant } = config[status]
  return <Badge variant={variant}>{label}</Badge>
}

export function CategoryBadge({ category }: { category: string }) {
  const config: Record<string, { label: string; emoji: string }> = {
    fruit: { label: 'Fruta', emoji: '🍎' },
    vegetable: { label: 'Legume', emoji: '🥕' },
    greens: { label: 'Verdura', emoji: '🥬' },
    other: { label: 'Outro', emoji: '🌿' },
  }
  const { label, emoji } = config[category] || { label: category, emoji: '🌿' }
  return <Badge variant="muted">{emoji} {label}</Badge>
}
