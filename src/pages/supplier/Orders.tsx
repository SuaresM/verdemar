import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Phone, Pencil, Minus, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '../../stores/authStore'
import { getOrdersBySupplier, updateOrderStatus, updateOrderItemsAndTotal } from '../../services/supabase'
import type { Order, OrderItem, OrderStatus } from '../../types'
import { Header } from '../../components/layout/Header'
import { OrderStatusBadge } from '../../components/shared/Badge'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { EmptyState } from '../../components/shared/EmptyState'
import { formatCurrency, formatDate, formatPhone, formatOrderStatusMessage, formatOrderEditMessage } from '../../utils'
import { openWhatsApp } from '../../services/whatsapp'

const STATUS_TRANSITIONS: Record<OrderStatus, { label: string; next: OrderStatus | null }> = {
  pending: { label: 'Confirmar Pedido', next: 'confirmed' },
  confirmed: { label: 'Iniciar Entrega', next: 'in_delivery' },
  in_delivery: { label: 'Marcar Entregue', next: 'delivered' },
  delivered: { label: 'Entregue', next: null },
  cancelled: { label: 'Cancelado', next: null },
}

// ---- Edit Order Modal ----

interface EditItem extends OrderItem {
  editQty: number
}

interface EditOrderModalProps {
  order: Order
  onClose: () => void
  onSaved: (newTotal: number, updatedItems: EditItem[]) => void
}

function EditOrderModal({ order, onClose, onSaved }: EditOrderModalProps) {
  const { supplier } = useAuthStore()
  const [items, setItems] = useState<EditItem[]>(
    (order.items ?? []).map((item) => ({ ...item, editQty: item.quantity }))
  )
  const [saving, setSaving] = useState(false)

  const newTotal = items.reduce(
    (sum, item) =>
      item.editQty > 0
        ? sum + (item.unit_price * item.editQty)
        : sum,
    0
  )

  const changeQty = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, editQty: Math.max(0, item.editQty + delta) }
          : item
      )
    )
  }

  const handleSave = async () => {
    if (!supplier || !order.buyer) return
    setSaving(true)
    try {
      const payload = items.map((item) => ({
        id: item.id,
        quantity: item.editQty,
        subtotal: Math.round(item.unit_price * item.editQty * 100) / 100,
      }))

      const newTotalFromDb = await updateOrderItemsAndTotal(order.id, payload)

      // Build edited items list for WhatsApp message
      const editedForMessage = items.map((item) => ({
        product_name: item.product_name,
        quantity: item.editQty,
        subtotal: Math.round(item.unit_price * item.editQty * 100) / 100,
        removed: item.editQty === 0,
      }))

      const message = formatOrderEditMessage(order, supplier, editedForMessage, newTotalFromDb)
      openWhatsApp(order.buyer.contact_phone, message)

      toast.success('Pedido atualizado! Notificando comprador via WhatsApp...')
      onSaved(newTotalFromDb, items)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao atualizar pedido')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
        <h3 className="text-xl font-extrabold text-gray-900 mb-1">Editar Pedido</h3>
        <p className="text-xs text-gray-500 mb-4">
          Ajuste as quantidades. Itens com 0 serão removidos. O comprador será notificado via WhatsApp.
        </p>

        <div className="space-y-3 mb-4">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between p-3 rounded-xl ${item.editQty === 0 ? 'bg-red-50' : 'bg-gray-50'}`}
            >
              <div className="flex-1 min-w-0 mr-3">
                <p className={`text-sm font-semibold truncate ${item.editQty === 0 ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                  {item.product_name}
                </p>
                {item.editQty > 0 && (
                  <p className="text-xs text-gray-400">
                    {formatCurrency(item.unit_price * item.editQty)}
                  </p>
                )}
                {item.editQty === 0 && (
                  <p className="text-xs text-red-400 font-semibold">Removido</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changeQty(item.id, -1)}
                  className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-danger border border-red-100"
                >
                  <Minus size={14} />
                </button>
                <span className={`w-6 text-center font-bold text-sm ${item.editQty === 0 ? 'text-red-400' : 'text-gray-800'}`}>
                  {item.editQty}
                </span>
                <button
                  onClick={() => changeQty(item.id, 1)}
                  className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-primary border border-primary/20"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center p-3 bg-primary/5 rounded-xl mb-5">
          <span className="font-bold text-gray-700">Novo Total</span>
          <span className="text-lg font-extrabold text-primary">{formatCurrency(newTotal)}</span>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleSave}
            disabled={saving || items.every((i) => i.editQty === 0)}
            className="w-full bg-primary text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              '💬 Salvar e Notificar Comprador'
            )}
          </button>
          <button onClick={onClose} className="w-full py-3 text-gray-500 font-semibold">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Main Component ----

export default function SupplierOrders() {
  const { supplier } = useAuthStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [updating, setUpdating] = useState<Record<string, boolean>>({})
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)

  useEffect(() => {
    if (!supplier) return
    getOrdersBySupplier(supplier.id)
      .then((data) => setOrders(data))
      .catch(() => toast.error('Erro ao carregar pedidos'))
      .finally(() => setLoading(false))
  }, [supplier])

  const handleUpdateStatus = async (order: Order) => {
    const transition = STATUS_TRANSITIONS[order.status]
    if (!transition.next || !supplier) return
    setUpdating((prev) => ({ ...prev, [order.id]: true }))
    try {
      await updateOrderStatus(order.id, transition.next)
      const nextStatus = transition.next
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: nextStatus } : o))
      )
      toast.success('Status atualizado!')

      // Notify buyer via WhatsApp
      if (order.buyer?.contact_phone) {
        const message = formatOrderStatusMessage(nextStatus, order, supplier)
        openWhatsApp(order.buyer.contact_phone, message)
      }
    } catch {
      toast.error('Erro ao atualizar status')
    } finally {
      setUpdating((prev) => ({ ...prev, [order.id]: false }))
    }
  }

  const handleCancel = (order: Order) => {
    toast('Cancelar este pedido?', {
      action: {
        label: 'Sim, cancelar',
        onClick: async () => {
          try {
            await updateOrderStatus(order.id, 'cancelled')
            setOrders((prev) =>
              prev.map((o) => (o.id === order.id ? { ...o, status: 'cancelled' } : o))
            )
            toast.success('Pedido cancelado')

            // Notify buyer
            if (order.buyer?.contact_phone && supplier) {
              const message = formatOrderStatusMessage('cancelled', order, supplier)
              openWhatsApp(order.buyer.contact_phone, message)
            }
          } catch {
            toast.error('Erro ao cancelar')
          }
        },
      },
      cancel: { label: 'Voltar', onClick: () => {} },
      duration: 8000,
    })
  }

  const handleEditSaved = (orderId: string, newTotal: number, updatedItems: EditItem[]) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o
        const newItems: OrderItem[] = updatedItems
          .filter((i) => i.editQty > 0)
          .map((i) => ({
            ...i,
            quantity: i.editQty,
            subtotal: Math.round(i.unit_price * i.editQty * 100) / 100,
          }))
        return { ...o, total_value: newTotal, items: newItems }
      })
    )
    setEditingOrder(null)
  }

  if (loading) return <PageLoader />

  return (
    <div className="min-h-screen">
      <Header title="Pedidos Recebidos" />

      <div className="px-4 py-4 space-y-3">
        {orders.length === 0 ? (
          <EmptyState title="Nenhum pedido ainda" description="Os pedidos dos compradores aparecerão aqui" />
        ) : (
          orders.map((order) => {
            const isExpanded = expanded[order.id]
            const transition = STATUS_TRANSITIONS[order.status]
            const isUpdating = updating[order.id]
            const canEdit =
              order.status === 'pending' || order.status === 'confirmed'

            return (
              <div key={order.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <button
                  onClick={() =>
                    setExpanded((prev) => ({ ...prev, [order.id]: !prev[order.id] }))
                  }
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-gray-900">
                        {order.buyer?.company_name || 'Comprador'}
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
                      {isExpanded ? (
                        <ChevronUp size={16} className="text-gray-400" />
                      ) : (
                        <ChevronDown size={16} className="text-gray-400" />
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-50">
                    {/* Buyer info */}
                    {order.buyer && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-xl space-y-1">
                        <p className="text-xs font-bold text-gray-600">Dados do Comprador</p>
                        <p className="text-sm font-semibold">{order.buyer.company_name}</p>
                        <p className="text-xs text-gray-500">CNPJ: {order.buyer.cnpj}</p>
                        <p className="text-xs text-gray-500">
                          {order.buyer.address_street}, {order.buyer.address_number} -{' '}
                          {order.buyer.address_neighborhood}
                        </p>
                        <p className="text-xs text-gray-500">
                          {order.buyer.address_city}/{order.buyer.address_state} - CEP:{' '}
                          {order.buyer.address_zip}
                        </p>
                        <a
                          href={`https://wa.me/${order.buyer.contact_phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-green-600 font-semibold mt-1"
                        >
                          <Phone size={12} />
                          {formatPhone(order.buyer.contact_phone)}
                        </a>
                      </div>
                    )}

                    {/* Items */}
                    <div className="mt-3 space-y-1">
                      {order.items?.map((item) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-gray-600">
                            {item.quantity}x {item.product_name}
                          </span>
                          <span className="font-semibold">{formatCurrency(item.subtotal)}</span>
                        </div>
                      ))}
                      <div className="border-t border-gray-100 pt-1 flex justify-between font-bold">
                        <span>Total</span>
                        <span className="text-primary">{formatCurrency(order.total_value)}</span>
                      </div>
                    </div>

                    {/* Notes and delivery time */}
                    {order.delivery_time_preference && (
                      <p className="text-xs text-gray-500 mt-2">
                        Entrega preferencial:{' '}
                        <span className="font-semibold">{order.delivery_time_preference}</span>
                      </p>
                    )}
                    {order.notes && (
                      <div className="mt-2 p-2 bg-accent/10 rounded-xl">
                        <p className="text-xs text-gray-600">📝 {order.notes}</p>
                      </div>
                    )}

                    {/* Action buttons */}
                    {order.status !== 'delivered' && order.status !== 'cancelled' && (
                      <div className="mt-3 space-y-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateStatus(order)}
                            disabled={!transition.next || isUpdating}
                            className="flex-1 bg-primary text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center"
                          >
                            {isUpdating ? (
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              transition.label
                            )}
                          </button>
                          <button
                            onClick={() => handleCancel(order)}
                            className="px-4 py-2.5 bg-red-50 text-danger font-semibold rounded-xl text-sm"
                          >
                            Cancelar
                          </button>
                        </div>

                        {canEdit && (
                          <button
                            onClick={() => setEditingOrder(order)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600"
                          >
                            <Pencil size={14} />
                            Editar itens do pedido
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onSaved={(newTotal, updatedItems) =>
            handleEditSaved(editingOrder.id, newTotal, updatedItems)
          }
        />
      )}
    </div>
  )
}
