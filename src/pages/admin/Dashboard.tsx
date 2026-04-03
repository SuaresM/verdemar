import { useState, useEffect } from 'react'
import { getAdminDashboard } from '../../services/supabase'
import { Header } from '../../components/layout/Header'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { formatCurrency } from '../../utils'
import { Users, Store, Package, ClipboardList } from 'lucide-react'
import { useOnboarding } from '../../hooks/useOnboarding'

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)

  useOnboarding('admin')

  const [stats, setStats] = useState({
    suppliersCount: 0,
    buyersCount: 0,
    productsCount: 0,
    ordersCount: 0,
    recentOrders: [] as any[],
  })

  useEffect(() => {
    getAdminDashboard()
      .then(setStats)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoader />

  const cards = [
    { label: 'Fornecedores', value: stats.suppliersCount, icon: Store, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Compradores', value: stats.buyersCount, icon: Users, color: 'text-blue-600 bg-blue-50' },
    { label: 'Produtos', value: stats.productsCount, icon: Package, color: 'text-orange-600 bg-orange-50' },
    { label: 'Pedidos', value: stats.ordersCount, icon: ClipboardList, color: 'text-purple-600 bg-purple-50' },
  ]

  return (
    <div className="min-h-screen bg-background">
      <Header title="Painel Admin" />

      <div className="px-4 py-4 space-y-4">
        <div id="onboarding-admin-stats" className="grid grid-cols-2 gap-3">
          {cards.map((card) => (
            <div key={card.label} className="bg-white rounded-2xl shadow-sm p-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${card.color}`}>
                <card.icon size={20} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-500">{card.label}</p>
            </div>
          ))}
        </div>

        {stats.recentOrders.length > 0 && (
          <div>
            <h2 className="font-bold text-gray-900 mb-3">Pedidos Recentes</h2>
            <div className="space-y-2">
              {stats.recentOrders.map((order: any) => (
                <div key={order.id} className="bg-white rounded-2xl shadow-sm p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-sm text-gray-800">
                      {order.buyer?.company_name || 'Comprador'}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      order.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                      order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                      order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {order.status === 'pending' ? 'Pendente' :
                       order.status === 'confirmed' ? 'Confirmado' :
                       order.status === 'in_delivery' ? 'Em entrega' :
                       order.status === 'delivered' ? 'Entregue' :
                       'Cancelado'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Fornecedor: {order.supplier?.store_name || '-'}
                  </p>
                  <p className="text-sm font-bold text-primary mt-1">
                    {formatCurrency(order.total_value)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
