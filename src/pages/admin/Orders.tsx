import { useState, useEffect } from 'react'
import { getAllOrders } from '../../services/supabase'
import { Header } from '../../components/layout/Header'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { EmptyState } from '../../components/shared/EmptyState'
import { formatCurrency } from '../../utils'
import type { Order, OrderStatus } from '../../types'

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'pending', label: 'Pendente' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'in_delivery', label: 'Em entrega' },
  { value: 'delivered', label: 'Entregue' },
  { value: 'cancelled', label: 'Cancelado' },
]

const statusLabel: Record<OrderStatus, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  in_delivery: 'Em entrega',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
}

const statusColor: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  in_delivery: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

export default function AdminOrders() {
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    getAllOrders(0)
      .then((result) => {
        setOrders(result.data)
        setHasMore(result.hasMore)
      })
      .finally(() => setLoading(false))
  }, [])

  const loadMore = async () => {
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const result = await getAllOrders(nextPage)
      setOrders((prev) => [...prev, ...result.data])
      setHasMore(result.hasMore)
      setPage(nextPage)
    } finally {
      setLoadingMore(false)
    }
  }

  const filtered = statusFilter
    ? orders.filter((o) => o.status === statusFilter)
    : orders

  if (loading) return <PageLoader />

  return (
    <div className="min-h-screen bg-background">
      <Header title="Pedidos" />

      <div className="px-4 py-4 space-y-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                statusFilter === opt.value ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-500">{filtered.length} pedido(s)</p>

        {filtered.length === 0 ? (
          <EmptyState title="Nenhum pedido" description="Nenhum pedido encontrado" />
        ) : (
          <div className="space-y-3">
            {filtered.map((order) => (
              <div key={order.id} className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-sm text-gray-800">
                    {order.buyer?.company_name || 'Comprador'}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    statusColor[order.status] || 'bg-gray-100 text-gray-700'
                  }`}>
                    {statusLabel[order.status] || order.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Fornecedor: {order.supplier?.store_name || '-'}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-sm font-bold text-primary">
                    {formatCurrency(order.total_value)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {order.items?.length || 0} item(ns)
                  </p>
                </div>
                {order.created_at && (
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(order.created_at).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
            ))}

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-3 bg-white rounded-2xl text-sm font-semibold text-primary hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
              >
                {loadingMore ? 'Carregando...' : 'Carregar mais pedidos'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
