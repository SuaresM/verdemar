import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, ChevronDown, ChevronUp, CheckCircle, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useCartStore } from '../../stores/cartStore'
import { useAuthStore } from '../../stores/authStore'
import { CartItemCard } from '../../components/cart/CartItem'
import { EmptyState } from '../../components/shared/EmptyState'
import { Header } from '../../components/layout/Header'
import { formatCurrency, formatWhatsAppMessage } from '../../utils'
import { createOrder } from '../../services/supabase'
import type { CartSection } from '../../types'

function SectionMinOrderStatus({ section }: { section: CartSection }) {
  const minValue = section.supplier.min_order_value
  const minQty = section.supplier.min_order_quantity

  if (minValue) {
    const ok = section.sectionTotal >= minValue
    return (
      <div className={`flex items-center gap-1.5 text-xs font-semibold ${ok ? 'text-success' : 'text-danger'}`}>
        {ok ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
        <span>
          {ok ? 'Pedido mínimo atingido' : `Mínimo: ${formatCurrency(minValue)} (faltam ${formatCurrency(minValue - section.sectionTotal)})`}
        </span>
      </div>
    )
  }

  if (minQty) {
    const totalItems = section.items.reduce((sum, i) => sum + i.quantity, 0)
    const ok = totalItems >= minQty
    return (
      <div className={`flex items-center gap-1.5 text-xs font-semibold ${ok ? 'text-success' : 'text-danger'}`}>
        {ok ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
        <span>
          {ok ? 'Pedido mínimo atingido' : `Mínimo: ${minQty} itens (faltam ${minQty - totalItems})`}
        </span>
      </div>
    )
  }

  return null
}

function isSectionValid(section: CartSection): boolean {
  const minValue = section.supplier.min_order_value
  const minQty = section.supplier.min_order_quantity
  if (minValue && section.sectionTotal < minValue) return false
  if (minQty) {
    const totalItems = section.items.reduce((sum, i) => sum + i.quantity, 0)
    if (totalItems < minQty) return false
  }
  return true
}

function getCheckoutLabel(section: CartSection): string {
  const minValue = section.supplier.min_order_value
  const minQty = section.supplier.min_order_quantity
  if (minValue && section.sectionTotal < minValue) {
    return `Adicione mais ${formatCurrency(minValue - section.sectionTotal)} para finalizar`
  }
  if (minQty) {
    const totalItems = section.items.reduce((sum, i) => sum + i.quantity, 0)
    if (totalItems < minQty) {
      const diff = minQty - totalItems
      return `Adicione mais ${diff} ${diff === 1 ? 'item' : 'itens'} para finalizar`
    }
  }
  return `Finalizar pedido com ${section.supplier.store_name}`
}

interface CheckoutDrawerProps {
  section: CartSection
  onConfirm: () => void
  onClose: () => void
  loading: boolean
}

function CheckoutDrawer({ section, onConfirm, onClose, loading }: CheckoutDrawerProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
        <h3 className="text-xl font-extrabold text-gray-900 mb-4">Confirmar Pedido</h3>

        <div className="bg-gray-50 rounded-2xl p-4 mb-4">
          <p className="font-bold text-gray-700 mb-2">{section.supplier.store_name}</p>
          {section.items.map((item) => (
            <div key={item.product.id} className="flex justify-between text-sm py-1">
              <span className="text-gray-600">{item.quantity}x {item.product.name}</span>
              <span className="font-semibold">{formatCurrency(item.subtotal)}</span>
            </div>
          ))}
          <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-bold">
            <span>Total</span>
            <span className="text-primary">{formatCurrency(section.sectionTotal)}</span>
          </div>
        </div>

        <div className="bg-accent/10 rounded-2xl p-4 mb-6 flex items-center gap-2">
          <span className="text-2xl">💳</span>
          <div>
            <p className="font-bold text-gray-800 text-sm">Pagamento</p>
            <p className="text-sm text-gray-600">À vista na entrega</p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={onConfirm}
            disabled={loading}
            className="w-full bg-primary text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>Confirmar Pedido</>
            )}
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 text-gray-500 font-semibold"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Cart() {
  const { sections, updateNotes, updateDeliveryTime, clearSection } = useCartStore()
  const { buyer } = useAuthStore()
  const navigate = useNavigate()
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [checkoutSection, setCheckoutSection] = useState<CartSection | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutSuccess, setCheckoutSuccess] = useState<{ whatsappUrl: string; supplierName: string } | null>(null)

  const totalAll = sections.reduce((sum, s) => sum + s.sectionTotal, 0)

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleCheckout = async () => {
    if (!checkoutSection || !buyer) return
    setCheckoutLoading(true)
    try {
      const itemsData = checkoutSection.items.map((item) => ({
        product_id: item.product.id,
        product_name: item.product.name,
        sale_unit: item.product.sale_unit,
        quantity: item.quantity,
        unit_price: item.product.sale_unit === 'box'
          ? item.product.box_price || 0
          : item.product.sale_unit === 'kg'
          ? item.product.price_per_kg || 0
          : item.product.price_per_unit || 0,
        subtotal: item.subtotal,
      }))

      const order = await createOrder(
        {
          buyer_id: buyer.id,
          supplier_id: checkoutSection.supplier.id,
          status: 'pending',
          total_value: checkoutSection.sectionTotal,
          notes: checkoutSection.notes,
          delivery_time_preference: checkoutSection.deliveryTimePreference,
          payment_method: 'cash_on_delivery',
          whatsapp_sent: false,
        },
        itemsData
      )

      const orderItems = itemsData.map((item) => ({
        ...item,
        id: '',
        order_id: order.id,
      }))

      const message = formatWhatsAppMessage(
        { ...order, notes: checkoutSection.notes, delivery_time_preference: checkoutSection.deliveryTimePreference } as import('../../types').Order,
        buyer,
        orderItems as import('../../types').OrderItem[]
      )

      const phone = checkoutSection.supplier.whatsapp.replace(/\D/g, '')
      const whatsappUrl = `https://wa.me/${phone}?text=${message}`

      clearSection(checkoutSection.supplier.id)
      setCheckoutSection(null)
      setCheckoutSuccess({ whatsappUrl, supplierName: checkoutSection.supplier.store_name })
    } catch (err) {
      toast.error('Erro ao finalizar pedido. Tente novamente.')
      console.error(err)
    } finally {
      setCheckoutLoading(false)
    }
  }

  if (sections.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Carrinho" />
        <EmptyState
          title="Seu carrinho está vazio"
          description="Explore os fornecedores e adicione produtos"
          icon={<ShoppingCart size={64} />}
          action={
            <button
              onClick={() => navigate('/')}
              className="bg-primary text-white font-bold px-6 py-3 rounded-2xl"
            >
              Explorar Fornecedores
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Carrinho" />

      <div className="flex-1 px-4 py-4 space-y-4 pb-28">
        {sections.map((section) => {
          const isExpanded = expandedSections[section.supplier.id] ?? true
          const isValid = isSectionValid(section)

          return (
            <div key={section.supplier.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.supplier.id)}
                className="w-full flex items-center justify-between p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                    {section.supplier.store_name[0]}
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-gray-900">{section.supplier.store_name}</p>
                    <p className="text-xs text-primary font-semibold">{formatCurrency(section.sectionTotal)}</p>
                  </div>
                </div>
                {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-2">
                  {/* Items */}
                  <div className="divide-y divide-gray-50">
                    {section.items.map((item) => (
                      <CartItemCard key={item.product.id} item={item} supplierId={section.supplier.id} />
                    ))}
                  </div>

                  {/* Min order status */}
                  <div className="pt-2">
                    <SectionMinOrderStatus section={section} />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Observações</label>
                    <textarea
                      value={section.notes}
                      onChange={(e) => updateNotes(section.supplier.id, e.target.value)}
                      placeholder="Ex: entregar antes das 10h, caixa de 18kg..."
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                      rows={2}
                    />
                  </div>

                  {/* Delivery time */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Horário preferencial de entrega</label>
                    <input
                      type="text"
                      value={section.deliveryTimePreference}
                      onChange={(e) => updateDeliveryTime(section.supplier.id, e.target.value)}
                      placeholder="Ex: 07h-09h"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  {/* Checkout button */}
                  <button
                    onClick={() => setCheckoutSection(section)}
                    disabled={!isValid}
                    className="w-full bg-primary text-white font-bold py-3 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                  >
                    {getCheckoutLabel(section)}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer total */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 safe-bottom">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-gray-600">Total geral</span>
          <span className="text-xl font-extrabold text-primary">{formatCurrency(totalAll)}</span>
        </div>
      </div>

      {/* Checkout drawer */}
      {checkoutSection && (
        <CheckoutDrawer
          section={checkoutSection}
          onConfirm={handleCheckout}
          onClose={() => setCheckoutSection(null)}
          loading={checkoutLoading}
        />
      )}

      {/* Success screen */}
      {checkoutSuccess && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white px-6">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2 text-center">
            Pedido registrado!
          </h2>
          <p className="text-gray-500 text-center text-sm mb-6">
            Seu pedido foi salvo com sucesso. Agora você precisa{' '}
            <span className="font-bold text-gray-700">enviar a mensagem no WhatsApp</span>{' '}
            para que o fornecedor{' '}
            <span className="font-bold text-gray-700">{checkoutSuccess.supplierName}</span>{' '}
            receba e confirme seu pedido.
          </p>

          <div className="w-full space-y-3">
            <a
              href={checkoutSuccess.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setCheckoutSuccess(null)}
              className="flex items-center justify-center gap-3 w-full bg-green-500 text-white font-bold py-4 rounded-2xl text-base shadow-lg active:scale-95 transition-transform"
            >
              <span className="text-xl">💬</span>
              Enviar pedido no WhatsApp
            </a>
            <p className="text-xs text-center text-gray-400">
              Toque no botão acima — isso abrirá o WhatsApp com a mensagem pronta.
              Basta enviar!
            </p>
            <button
              onClick={() => {
                setCheckoutSuccess(null)
                navigate('/orders')
              }}
              className="w-full py-3 text-gray-400 text-sm font-semibold"
            >
              Ver meus pedidos
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
