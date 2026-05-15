import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronUp, Phone, Pencil, Minus, Plus, CheckCircle, PackageOpen } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '../../stores/authStore'
import { getOrdersBySupplier, updateOrderStatus, updateOrderItemsAndTotal } from '../../services/supabase'
import type { Order, OrderItem, OrderStatus } from '../../types'
import { Header } from '../../components/layout/Header'
import { OrderStatusBadge } from '../../components/shared/Badge'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { formatCurrency, formatDate, formatPhone, formatOrderStatusMessage, formatOrderEditMessage } from '../../utils'

const STATUS_TRANSITIONS: Record<OrderStatus, { label: string; next: OrderStatus | null }> = {
  pending:     { label: 'Aceitar',   next: 'confirmed' },
  confirmed:   { label: 'Em rota',   next: 'in_route' },
  in_route:    { label: 'Entregue',  next: 'delivered' },
  in_delivery: { label: 'Entregue',  next: 'delivered' }, // legacy — type safety
  delivered:   { label: 'Entregue',  next: null },
  cancelled:   { label: 'Cancelado', next: null },
  rejected:    { label: 'Recusado',  next: null },
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

      const message = formatOrderEditMessage(supplier, editedForMessage, newTotalFromDb)
      const whatsappUrl = `https://wa.me/${order.buyer.contact_phone.replace(/\D/g, '')}?text=${message}`

      onSaved(newTotalFromDb, items)

      // Show persistent toast so supplier taps the link (window.open after async
      // is blocked by browsers/PWA — an <a> tag opened by the user is not).
      toast.success('Pedido atualizado!', {
        description: 'Toque abaixo para notificar o comprador via WhatsApp.',
        action: {
          label: '💬 Abrir WhatsApp',
          onClick: () => window.open(whatsappUrl, '_blank'),
        },
        duration: 15000,
      })
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

// ---- Reject Order Modal ----

function RejectOrderModal({
  order,
  onClose,
  onReject,
}: {
  order: Order
  onClose: () => void
  onReject: (reason: string) => Promise<void>
}) {
  const REASONS = [
    'Sem estoque',
    'Fora de temporada',
    'Região/dia inválido',
    'Pedido mínimo não atingido',
    'Preço desatualizado',
    'Outro',
  ]
  const [selected, setSelected] = useState<string | null>(null)
  const [customReason, setCustomReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const isDisabled =
    !selected || (selected === 'Outro' && customReason.trim() === '')

  const handleSubmit = async () => {
    if (isDisabled) return
    setRejecting(true)
    try {
      await onReject(selected === 'Outro' ? customReason.trim() : selected!)
    } finally {
      setRejecting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-1">Recusar Pedido</h2>
        <p className="text-sm text-gray-500 mb-4">
          Selecione o motivo da recusa. O comprador será notificado.
        </p>
        <div className="space-y-2 mb-4">
          {REASONS.map((reason) => (
            <button
              key={reason}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                selected === reason
                  ? 'bg-primary/10 border border-primary/30'
                  : 'bg-gray-50 border border-transparent'
              }`}
              onClick={() => setSelected(reason)}
              disabled={rejecting}
            >
              <span
                className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                  selected === reason
                    ? 'border-primary bg-primary'
                    : 'border-gray-300 bg-white'
                }`}
              />
              <span className="text-sm font-bold text-gray-800">{reason}</span>
            </button>
          ))}
        </div>
        {selected === 'Outro' && (
          <textarea
            className="w-full mt-2 p-3 text-sm border border-input rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            rows={3}
            placeholder="Descreva o motivo..."
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            autoFocus
          />
        )}
        <button
          onClick={handleSubmit}
          disabled={isDisabled || rejecting}
          className={`w-full bg-danger text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 mt-4 ${
            isDisabled ? 'opacity-50' : ''
          }`}
        >
          {rejecting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            'Confirmar Recusa'
          )}
        </button>
        <button className="w-full py-3 text-gray-500 font-bold" onClick={onClose}>
          Cancelar
        </button>
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
  const [rejectingOrder, setRejectingOrder] = useState<Order | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const hasLoaded = useRef(false)
  const [searchParams] = useSearchParams()
  const targetOrderId = searchParams.get('order')

  // Polling load — 15s interval, hasLoaded guard prevents spinner flash on refresh
  useEffect(() => {
    if (!supplier) return
    const load = () => {
      getOrdersBySupplier(supplier.id)
        .then((data) => setOrders(data))
        .catch(() => toast.error('Erro ao carregar pedidos'))
        .finally(() => {
          if (!hasLoaded.current) {
            hasLoaded.current = true
            setLoading(false)
          }
        })
    }
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [supplier])

  // Deep-link: expand + scroll + highlight card when ?order=<id> is in URL
  useEffect(() => {
    if (!targetOrderId || orders.length === 0) return
    const found = orders.find((o) => o.id === targetOrderId)
    if (!found) return
    setExpanded((prev) => ({ ...prev, [targetOrderId]: true }))
    setTimeout(() => {
      document.getElementById(`order-card-${targetOrderId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
      setHighlightedId(targetOrderId)
      setTimeout(() => setHighlightedId(null), 1500)
    }, 200)
  }, [orders, targetOrderId])

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
      if (order.buyer?.contact_phone) {
        const message = formatOrderStatusMessage(nextStatus, order, supplier)
        const phone = order.buyer.contact_phone.replace(/\D/g, '')
        const whatsappUrl = `https://wa.me/${phone}?text=${message}`
        toast.success('Status atualizado!', {
          description: 'Toque abaixo para notificar o comprador via WhatsApp.',
          action: {
            label: '💬 Abrir WhatsApp',
            onClick: () => window.open(whatsappUrl, '_blank'),
          },
          duration: 15000,
        })
      } else {
        toast.success('Status atualizado!')
      }
    } catch {
      toast.error('Erro ao atualizar status')
    } finally {
      setUpdating((prev) => ({ ...prev, [order.id]: false }))
    }
  }

  const handleReject = async (order: Order, reason: string) => {
    if (!supplier) return
    setUpdating((prev) => ({ ...prev, [order.id]: true }))
    try {
      await updateOrderStatus(order.id, 'rejected', reason)
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id ? { ...o, status: 'rejected' as const, rejection_reason: reason } : o
        )
      )
      setRejectingOrder(null)
      if (order.buyer?.contact_phone) {
        const message = formatOrderStatusMessage('rejected', order, supplier)
        const phone = order.buyer.contact_phone.replace(/\D/g, '')
        const whatsappUrl = `https://wa.me/${phone}?text=${message}`
        toast.success('Pedido recusado.', {
          description: 'Toque abaixo para notificar o comprador via WhatsApp.',
          action: {
            label: '💬 Abrir WhatsApp',
            onClick: () => window.open(whatsappUrl, '_blank'),
          },
          duration: 15000,
        })
      } else {
        toast.success('Pedido recusado.')
      }
    } catch {
      toast.error('Erro ao recusar pedido')
    } finally {
      setUpdating((prev) => ({ ...prev, [order.id]: false }))
    }
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

  const renderCard = (order: Order) => {
    const isExpanded = expanded[order.id]
    const isUpdating = updating[order.id]
    const canEdit = order.status === 'pending' || order.status === 'confirmed'
    const canReject = order.status === 'pending' || order.status === 'confirmed'

    return (
      <div
        key={order.id}
        id={`order-card-${order.id}`}
        className={`bg-white rounded-2xl shadow-sm overflow-hidden transition-shadow ${
          highlightedId === order.id ? 'ring-2 ring-primary ring-offset-2' : ''
        }`}
      >
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

            {/* Action buttons — per-status layout per UI-SPEC */}
            <div className="mt-3 space-y-2">
              {/* pending: Aceitar + Recusar + Editar */}
              {order.status === 'pending' && (
                <>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateStatus(order)}
                      disabled={isUpdating}
                      className="flex-1 bg-primary text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center"
                    >
                      {isUpdating ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        'Aceitar'
                      )}
                    </button>
                    <button
                      onClick={() => setRejectingOrder(order)}
                      className="px-4 py-2.5 bg-red-50 text-danger font-bold rounded-xl text-sm"
                    >
                      Recusar
                    </button>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => setEditingOrder(order)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-600"
                    >
                      <Pencil size={14} />
                      Editar itens do pedido
                    </button>
                  )}
                </>
              )}

              {/* confirmed: Em rota + Recusar + Editar */}
              {order.status === 'confirmed' && (
                <>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateStatus(order)}
                      disabled={isUpdating}
                      className="flex-1 bg-primary text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center"
                    >
                      {isUpdating ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        'Em rota'
                      )}
                    </button>
                    {canReject && (
                      <button
                        onClick={() => setRejectingOrder(order)}
                        className="px-4 py-2.5 bg-red-50 text-danger font-bold rounded-xl text-sm"
                      >
                        Recusar
                      </button>
                    )}
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => setEditingOrder(order)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-600"
                    >
                      <Pencil size={14} />
                      Editar itens do pedido
                    </button>
                  )}
                </>
              )}

              {/* in_route: Entregue only — no Recusar, no Editar */}
              {order.status === 'in_route' && (
                <button
                  onClick={() => handleUpdateStatus(order)}
                  disabled={isUpdating}
                  className="w-full bg-primary text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center"
                >
                  {isUpdating ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Entregue'
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (loading) return <PageLoader />

  const pendingOrders = orders.filter((o) => o.status === 'pending')
  const activeOrders = orders.filter((o) => o.status === 'confirmed' || o.status === 'in_route')

  return (
    <div className="min-h-screen">
      <Header title="Pedidos" />

      <div className="px-4 py-4 space-y-6 pb-24">
        {/* Section: Pendentes */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1 mb-2">
              {pendingOrders.length > 0 ? `PENDENTES (${pendingOrders.length})` : 'PENDENTES'}
            </span>
          </div>
          {pendingOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle size={48} className="text-green-400 mb-3" />
              <h3 className="font-bold text-gray-800 mb-1">Tudo em dia!</h3>
              <p className="text-sm text-gray-500">Nenhum pedido aguardando resposta.</p>
            </div>
          ) : (
            <div className="space-y-3">{pendingOrders.map(renderCard)}</div>
          )}
        </section>

        <hr className="border-border my-2" />

        {/* Section: Em andamento */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1 mb-2">
              EM ANDAMENTO
            </span>
          </div>
          {activeOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <PackageOpen size={48} className="text-gray-300 mb-3" />
              <h3 className="font-bold text-gray-800 mb-1">Nada em andamento</h3>
              <p className="text-sm text-gray-500">Pedidos confirmados e em rota aparecem aqui.</p>
            </div>
          ) : (
            <div className="space-y-3">{activeOrders.map(renderCard)}</div>
          )}
        </section>
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

      {rejectingOrder && (
        <RejectOrderModal
          order={rejectingOrder}
          onClose={() => setRejectingOrder(null)}
          onReject={(reason) => handleReject(rejectingOrder, reason)}
        />
      )}
    </div>
  )
}
