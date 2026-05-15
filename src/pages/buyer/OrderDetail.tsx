import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { CalendarClock, XCircle, AlertTriangle, PackageOpen } from 'lucide-react'
import { getOrderById, updateOrderStatus } from '../../services/supabase'
import { useAuthStore } from '../../stores/authStore'
import type { Order, OrderStatus, StatusHistoryEntry } from '../../types'
import { Header } from '../../components/layout/Header'
import { OrderStatusBadge } from '../../components/shared/Badge'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { EmptyState } from '../../components/shared/EmptyState'
import { formatCurrency, formatDate } from '../../utils'

const STATUS_DOT_CLASSES: Record<OrderStatus, string> = {
  pending:     'bg-yellow-400 ring-yellow-200',
  confirmed:   'bg-blue-400 ring-blue-200',
  in_route:    'bg-primary ring-primary/30',
  in_delivery: 'bg-primary ring-primary/30',
  delivered:   'bg-green-500 ring-green-200',
  cancelled:   'bg-gray-400 ring-gray-200',
  rejected:    'bg-red-500 ring-red-200',
}

const STATUS_LABEL_CLASSES: Record<OrderStatus, string> = {
  pending:     'text-yellow-700',
  confirmed:   'text-blue-700',
  in_route:    'text-primary',
  in_delivery: 'text-primary',
  delivered:   'text-green-700',
  cancelled:   'text-gray-500',
  rejected:    'text-red-700',
}

const STATUS_LABELS_PT: Record<OrderStatus, string> = {
  pending:     'Aguardando confirmação',
  confirmed:   'Confirmado',
  in_route:    'Em rota',
  in_delivery: 'Em entrega',
  delivered:   'Entregue',
  cancelled:   'Cancelado pelo comprador',
  rejected:    'Recusado',
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { buyer } = useAuthStore()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)

  // Scroll to top on mount (avoid inheriting Cart scroll position)
  useEffect(() => { window.scrollTo(0, 0) }, [])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const load = () =>
      getOrderById(id)
        .then((data) => { if (!cancelled) setOrder(data) })
        .catch(() => { if (!cancelled) toast.error('Erro ao carregar pedido') })
        .finally(() => { if (!cancelled) setLoading(false) })
    load()
    const interval = setInterval(load, 15000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [id])

  const handleCancel = async () => {
    if (!order || cancelling) return
    if (order.buyer_id !== buyer?.id) {
      toast.error('Você não tem permissão para cancelar este pedido.')
      return
    }
    setCancelling(true)
    try {
      await updateOrderStatus(order.id, 'cancelled', undefined)
      const updated = await getOrderById(order.id)
      if (updated) {
        setOrder(updated)
      } else {
        setOrder((prev) => prev ? { ...prev, status: 'cancelled' } : prev)
      }
      toast.success('Pedido cancelado')
    } catch {
      toast.error('Erro ao cancelar pedido. Tente novamente.')
    } finally {
      setCancelling(false)
    }
  }

  const timelineEntries: StatusHistoryEntry[] =
    order && (order.status_history?.length ?? 0) > 0
      ? [...order.status_history!].reverse()
      : order
      ? [{ status: order.status, at: order.updated_at ?? order.created_at ?? '' }]
      : []

  if (loading && !order) return <PageLoader />
  if (!order) return (
    <EmptyState
      title="Pedido não encontrado"
      description="Este pedido não existe ou você não tem permissão para visualizá-lo."
      icon={<PackageOpen size={64} />}
      action={
        <button
          onClick={() => navigate('/orders')}
          className="bg-primary text-white font-bold px-6 py-3 rounded-2xl"
        >
          Ver meus pedidos
        </button>
      }
    />
  )

  return (
    <div className="min-h-screen bg-background">
      <Header title="Detalhe do Pedido" showBack />
      <div className="px-4 py-4 space-y-4 pb-24">

        {/* Status section card */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wide mb-1">
                Fornecedor
              </p>
              <p className="text-lg font-bold text-gray-900">{order.supplier?.store_name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{formatDate(order.created_at ?? '')}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Pedido <span className="font-bold text-gray-700">#{order.id.slice(0, 8).toUpperCase()}</span>
              </p>
            </div>
            {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
            {/* @ts-expect-error size prop added in Plan 03-03 */}
            <OrderStatusBadge status={order.status} size="md" />
          </div>
          {order.delivery_time_preference && (
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
              <CalendarClock size={13} />
              <span>Entrega: <span className="font-bold text-gray-700">{order.delivery_time_preference}</span></span>
            </div>
          )}
        </div>

        {/* Rejection reason block — conditional */}
        {order.status === 'rejected' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3">
            <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-700 mb-0.5">Pedido recusado</p>
              <p className="text-sm text-red-600">
                Motivo: {order.rejection_reason ?? 'Não informado'}
              </p>
            </div>
          </div>
        )}

        {/* Items summary card */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Itens</p>
          <div className="space-y-2">
            {order.items?.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-gray-600">{item.quantity}x {item.product_name}</span>
                <span className="font-bold text-gray-800">{formatCurrency(item.subtotal)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between">
            <span className="font-bold text-gray-700">Total</span>
            <span className="font-bold text-primary text-sm">{formatCurrency(order.total_value)}</span>
          </div>
        </div>

        {/* Timeline card */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Histórico</p>
          <div className="relative">
            {/* Vertical connecting line — behind dots */}
            <div className="absolute left-[5px] top-3 bottom-3 w-0.5 bg-gray-200" />
            <div className="space-y-5">
              {timelineEntries.map((entry, index) => (
                <div key={index} className="flex gap-4 relative">
                  <div
                    className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ring-2 z-10 ${STATUS_DOT_CLASSES[entry.status]}`}
                  />
                  <div className="-mt-0.5">
                    <p className={`text-sm font-bold ${STATUS_LABEL_CLASSES[entry.status]}`}>
                      {STATUS_LABELS_PT[entry.status]}
                    </p>
                    <p className="text-xs text-gray-400">{formatDate(entry.at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cancel button — conditional on pending status and ownership */}
        {order.status === 'pending' && order.buyer_id === buyer?.id && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="w-full border-2 border-red-300 text-red-600 font-bold py-3 rounded-2xl
                       flex items-center justify-center gap-2 active:scale-95 transition-transform
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelling ? (
              <div className="w-5 h-5 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
            ) : (
              <>
                <XCircle size={18} />
                Cancelar pedido
              </>
            )}
          </button>
        )}

      </div>
    </div>
  )
}
