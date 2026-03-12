import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, TrendingUp, Clock, Plus } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { getSupplierDashboard } from '../../services/supabase'
import type { Order } from '../../types'
import { OrderStatusBadge } from '../../components/shared/Badge'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { formatCurrency, formatDate } from '../../utils'

interface DashboardData {
  todayCount: number
  pendingCount: number
  monthTotal: number
  recentOrders: Order[]
}

export default function Dashboard() {
  const { supplier } = useAuthStore()
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supplier) return
    getSupplierDashboard(supplier.id).then((d) => {
      setData(d)
      setLoading(false)
    })
  }, [supplier])

  if (loading) return <PageLoader />

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-extrabold text-primary">🌿 VerdeMar</p>
            <p className="text-sm text-gray-500 mt-0.5">Painel do Fornecedor</p>
          </div>
          <button
            onClick={() => navigate('/supplier/products/new')}
            className="flex items-center gap-1.5 bg-primary text-white text-sm font-semibold px-3 py-2 rounded-xl"
          >
            <Plus size={16} />
            Produto
          </button>
        </div>
        {supplier && (
          <div className="mt-3 bg-gradient-to-r from-primary to-primary-light rounded-2xl p-4 text-white">
            <p className="text-sm opacity-90">Bem-vindo de volta,</p>
            <p className="font-bold text-lg">{supplier.store_name} 👋</p>
          </div>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl shadow-sm p-3 text-center">
            <div className="flex justify-center mb-1">
              <Clock size={20} className="text-accent" />
            </div>
            <p className="text-2xl font-extrabold text-gray-900">{data?.todayCount || 0}</p>
            <p className="text-xs text-gray-500">Hoje</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-3 text-center">
            <div className="flex justify-center mb-1">
              <Package size={20} className="text-warning" />
            </div>
            <p className="text-2xl font-extrabold text-gray-900">{data?.pendingCount || 0}</p>
            <p className="text-xs text-gray-500">Pendentes</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-3 text-center">
            <div className="flex justify-center mb-1">
              <TrendingUp size={20} className="text-success" />
            </div>
            <p className="text-lg font-extrabold text-gray-900">
              {data?.monthTotal ? formatCurrency(data.monthTotal).replace('R$', '') : '0'}
            </p>
            <p className="text-xs text-gray-500">Este mês</p>
          </div>
        </div>

        {/* Recent orders */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-gray-900">Últimos Pedidos</p>
            <button
              onClick={() => navigate('/supplier/orders')}
              className="text-sm text-primary font-semibold"
            >
              Ver todos
            </button>
          </div>

          {(!data?.recentOrders || data.recentOrders.length === 0) ? (
            <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
              <div className="text-4xl mb-2">📦</div>
              <p className="text-gray-500 text-sm">Nenhum pedido ainda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.recentOrders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => navigate('/supplier/orders')}
                  className="bg-white rounded-2xl shadow-sm p-4 cursor-pointer active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-gray-900">
                        {order.buyer?.company_name || 'Cliente'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {order.created_at ? formatDate(order.created_at) : ''}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {order.items?.length || 0} itens
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <OrderStatusBadge status={order.status} />
                      <p className="font-bold text-primary">{formatCurrency(order.total_value)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
