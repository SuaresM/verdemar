import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '../../stores/authStore'
import { getOrdersByBuyer } from '../../services/supabase'
import type { Order, OrderStatus } from '../../types'
import { Header } from '../../components/layout/Header'
import { OrderStatusBadge } from '../../components/shared/Badge'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { EmptyState } from '../../components/shared/EmptyState'
import { formatCurrency, formatDate } from '../../utils'

const TABS: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'in_delivery', label: 'Em entrega' },
  { value: 'delivered', label: 'Entregues' },
]

export default function OrderHistory() {
  const { buyer } = useAuthStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<OrderStatus | 'all'>('all')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!buyer) return
    getOrdersByBuyer(buyer.id)
      .then((data) => setOrders(data))
      .catch(() => toast.error('Erro ao carregar pedidos'))
      .finally(() => setLoading(false))
  }, [buyer])

  const filteredOrders = tab === 'all' ? orders : orders.filter((o) => o.status === tab)

  if (loading) return <PageLoader />

  return (
    <div className="min-h-screen">
      <Header title="Meus Pedidos" />

      {/* Tabs */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
                tab === t.value ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {filteredOrders.length === 0 ? (
          <EmptyState title="Nenhum pedido encontrado" />
        ) : (
          filteredOrders.map((order) => {
            const isExpanded = expanded[order.id]
            return (
              <div key={order.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpanded((prev) => ({ ...prev, [order.id]: !prev[order.id] }))}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-gray-900">{order.supplier?.store_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{order.created_at ? formatDate(order.created_at) : ''}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {order.items?.slice(0, 3).map((item) => (
                          <span key={item.id} className="text-xs bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full">
                            {item.product_name}
                          </span>
                        ))}
                        {(order.items?.length || 0) > 3 && (
                          <span className="text-xs text-gray-400">+{(order.items?.length || 0) - 3}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <OrderStatusBadge status={order.status} />
                      <p className="font-bold text-primary">{formatCurrency(order.total_value)}</p>
                      {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </div>
                  </div>
                </button>

                {isExpanded && order.items && (
                  <div className="px-4 pb-4 border-t border-gray-50">
                    <div className="space-y-2 pt-3">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-gray-600">{item.quantity}x {item.product_name}</span>
                          <span className="font-semibold">{formatCurrency(item.subtotal)}</span>
                        </div>
                      ))}
                    </div>
                    {order.notes && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-xl">
                        <p className="text-xs font-semibold text-gray-500 mb-1">Observações</p>
                        <p className="text-sm text-gray-700">{order.notes}</p>
                      </div>
                    )}
                    {order.delivery_time_preference && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500">
                          Entrega preferencial: <span className="font-semibold">{order.delivery_time_preference}</span>
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
