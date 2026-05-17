import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, CalendarClock } from 'lucide-react'
import { toast } from 'sonner'
import { useCartStore } from '../../stores/cartStore'
import { useAuthStore } from '../../stores/authStore'
import { CartItemCard } from '../../components/cart/CartItem'
import { EmptyState } from '../../components/shared/EmptyState'
import { Header } from '../../components/layout/Header'
import { formatCurrency, formatWhatsAppMessage } from '../../utils'
import { createOrder, getDeliveryZonesBySupplier, markOrderWhatsAppSent } from '../../services/supabase'
import type { CartSection, DeliveryZone } from '../../types'

const DAY_LABELS: Record<string, string> = {
  monday: 'Segunda',
  tuesday: 'Terça',
  wednesday: 'Quarta',
  thursday: 'Quinta',
  friday: 'Sexta',
  saturday: 'Sábado',
  sunday: 'Domingo',
}
const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const MONTHS_SHORT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

function nextOccurrenceDate(dayKey: string): Date {
  const dayIndex = DAY_ORDER.indexOf(dayKey)
  // DAY_ORDER: 0=monday … 6=sunday; JS getDay: 0=sunday, 1=monday … 6=saturday
  const targetJsDay = dayIndex === 6 ? 0 : dayIndex + 1
  const today = new Date()
  const todayJsDay = today.getDay()
  let daysUntil = targetJsDay - todayJsDay
  if (daysUntil <= 0) daysUntil += 7 // always the NEXT occurrence, not today
  const result = new Date(today)
  result.setDate(today.getDate() + daysUntil)
  return result
}

function formatDayOption(dayKey: string): string {
  const label = DAY_LABELS[dayKey] ?? dayKey
  const d = nextOccurrenceDate(dayKey)
  return `${label}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

/**
 * Given all zones for a supplier, returns the unique set of delivery days
 * sorted by DAY_ORDER. Each entry includes the zone it belongs to (for
 * internal label construction) — this detail is NOT shown to the buyer.
 */
function getAvailableDays(zones: DeliveryZone[]): Array<{ day: string; zone: DeliveryZone }> {
  const seen = new Set<string>()
  const result: Array<{ day: string; zone: DeliveryZone }> = []
  for (const zone of zones) {
    for (const day of zone.days ?? []) {
      if (!seen.has(day)) {
        seen.add(day)
        result.push({ day, zone })
      }
    }
  }
  result.sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day))
  return result
}

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

/**
 * Returns true when the supplier has zones configured and NONE of them
 * match the buyer's city. A supplier with no zones configured is not
 * considered a mismatch (zones not set up yet).
 */
function hasCityMismatch(
  supplierId: string,
  buyerCity: string | undefined,
  supplierZones: Record<string, DeliveryZone[]>
): boolean {
  if (!buyerCity) return false
  const zones = supplierZones[supplierId]
  if (!zones || zones.length === 0) return false
  return !zones.some((z) => z.city === buyerCity)
}

export default function Cart() {
  const { sections, updateNotes, updateDeliveryTime, clearSection } = useCartStore()
  const { buyer } = useAuthStore()
  const navigate = useNavigate()
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [checkoutSection, setCheckoutSection] = useState<CartSection | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutSuccess, setCheckoutSuccess] = useState<{
    whatsappUrl: string
    supplierName: string
    orderId: string
    items: CartSection['items']
    sectionTotal: number
    // Buyer-facing label: only the day name, no zone hours
    deliveryDayLabel: string | null
  } | null>(null)
  const [whatsappOpened, setWhatsappOpened] = useState(false)
  const [supplierZones, setSupplierZones] = useState<Record<string, DeliveryZone[]>>({})
  // selectedDay maps supplierId -> { day key, zone } so we can reconstruct the
  // full internal label at checkout time without storing zone details in the cart.
  const [selectedDay, setSelectedDay] = useState<Record<string, { day: string; zone: DeliveryZone }>>({})

  const totalAll = sections.reduce((sum, s) => sum + s.sectionTotal, 0)

  useEffect(() => {
    if (sections.length === 0) return
    Promise.all(
      sections.map((s) =>
        getDeliveryZonesBySupplier(s.supplier.id)
          .then((zones) => ({ id: s.supplier.id, zones }))
          .catch(() => ({ id: s.supplier.id, zones: [] as DeliveryZone[] }))
      )
    ).then((results) => {
      const map: Record<string, DeliveryZone[]> = {}
      results.forEach(({ id, zones }) => { map[id] = zones })
      setSupplierZones(map)
    })
  }, [sections])

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleDayChange = (supplierId: string, day: string, zone: DeliveryZone) => {
    setSelectedDay((prev) => ({ ...prev, [supplierId]: { day, zone } }))
    // Store day + date as the buyer-facing preference (e.g. "Segunda, 19 mai").
    // The full internal label (with zone hours) is built at checkout time for
    // the supplier's operational use — the buyer never sees the hour window.
    updateDeliveryTime(supplierId, formatDayOption(day))
  }

  const handleCheckout = async () => {
    if (!checkoutSection || !buyer) {
      toast.error('Sessão expirada. Faça login novamente.')
      return
    }

    // Issue 2 guard: block order if supplier doesn't deliver to buyer's city.
    if (hasCityMismatch(checkoutSection.supplier.id, buyer.address_city, supplierZones)) {
      toast.error(`Este fornecedor não entrega em ${buyer.address_city}. Escolha outro fornecedor.`)
      setCheckoutSection(null)
      return
    }

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

      // Build the full internal delivery label (day + zone hours) for the supplier.
      // This goes into the order record and the WhatsApp message — NOT shown to the buyer.
      const sel = selectedDay[checkoutSection.supplier.id]
      const internalDeliveryLabel = sel
        ? `${DAY_LABELS[sel.day] ?? sel.day} — ${sel.zone.hours_start} às ${sel.zone.hours_end}`
        : (checkoutSection.deliveryTimePreference || null)

      const order = await createOrder(
        {
          buyer_id: buyer.id,
          supplier_id: checkoutSection.supplier.id,
          status: 'pending',
          total_value: checkoutSection.sectionTotal,
          notes: checkoutSection.notes,
          delivery_time_preference: internalDeliveryLabel ?? undefined,
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
        { ...order, notes: checkoutSection.notes, delivery_time_preference: internalDeliveryLabel ?? undefined } as import('../../types').Order,
        buyer,
        orderItems as import('../../types').OrderItem[]
      )

      const rawDigits = (checkoutSection.supplier.whatsapp ?? '').replace(/\D/g, '')
      if (!/^\d{10,13}$/.test(rawDigits)) {
        toast.error('Fornecedor sem número de WhatsApp válido. Contate o suporte.')
        setCheckoutLoading(false)
        return
      }
      const whatsappUrl = `https://wa.me/${rawDigits}?text=${message}`

      // Buyer-facing label: day name + date (e.g. "Segunda, 19 mai"); no zone hours
      const buyerDayLabel = sel ? formatDayOption(sel.day) : null

      const capturedItems = checkoutSection.items
      const capturedTotal = checkoutSection.sectionTotal
      clearSection(checkoutSection.supplier.id)
      setCheckoutSection(null)
      setCheckoutSuccess({
        whatsappUrl,
        supplierName: checkoutSection.supplier.store_name,
        orderId: order.id,
        items: capturedItems,
        sectionTotal: capturedTotal,
        deliveryDayLabel: buyerDayLabel,
      })
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
          const zones = supplierZones[section.supplier.id]
          const hasNoZones = zones !== undefined && zones.length === 0
          const cityMismatch = hasCityMismatch(section.supplier.id, buyer?.address_city, supplierZones)
          // Compute unique delivery days across all zones for this supplier
          const availableDays = zones ? getAvailableDays(zones) : []
          const currentDayKey = selectedDay[section.supplier.id]?.day ?? ''

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

                  {/* City delivery warning — shown when zones loaded and city doesn't match */}
                  {cityMismatch && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
                      <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-red-600" />
                      <p className="text-xs text-red-700 font-semibold">
                        Este fornecedor não entrega em {buyer?.address_city}. Remova os itens ou altere seu endereço.
                      </p>
                    </div>
                  )}

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

                  {/* Delivery day — single picker showing only day names (no zone/window details) */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Dia preferencial de entrega</label>
                    {hasNoZones ? (
                      <p className="text-xs text-danger font-semibold">
                        Fornecedor ainda não configurou dias de entrega
                      </p>
                    ) : zones ? (
                      <select
                        value={currentDayKey}
                        onChange={(e) => {
                          const day = e.target.value
                          const match = availableDays.find((d) => d.day === day)
                          if (match) handleDayChange(section.supplier.id, day, match.zone)
                        }}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none"
                      >
                        <option value="">Selecione o dia de entrega</option>
                        {availableDays.map(({ day }) => (
                          <option key={day} value={day}>{formatDayOption(day)}</option>
                        ))}
                      </select>
                    ) : (
                      <select disabled className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl opacity-50">
                        <option>Carregando...</option>
                      </select>
                    )}
                  </div>

                  {/* Checkout button — also blocked when city doesn't match */}
                  <button
                    onClick={() => setCheckoutSection(section)}
                    disabled={!isValid || zones === undefined || hasNoZones || !section.deliveryTimePreference || cityMismatch}
                    className="w-full bg-primary text-white font-bold py-3 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                  >
                    {cityMismatch
                      ? `Fornecedor não entrega em ${buyer?.address_city}`
                      : getCheckoutLabel(section)}
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
      {checkoutSuccess && (() => {
        const { whatsappUrl, supplierName, orderId, items, sectionTotal, deliveryDayLabel } = checkoutSuccess
        return (
          <div className="fixed inset-0 z-50 flex flex-col bg-white">
            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto px-6 pt-8 pb-4">
              {/* Header */}
              <div className="text-center mb-6">
                <div className="text-5xl mb-3">🎉</div>
                <h2 className="text-2xl font-bold text-gray-900">Pedido registrado!</h2>
                <p className="text-xs text-gray-400 mt-1">
                  #{orderId.slice(0, 8).toUpperCase()}
                </p>
              </div>

              {/* Instruction */}
              <p className="text-sm text-gray-500 text-center mb-6">
                Envie a mensagem no WhatsApp para que o fornecedor{' '}
                <span className="font-bold text-gray-700">{supplierName}</span>{' '}
                receba e confirme seu pedido.
              </p>

              {/* Items summary */}
              <div className="bg-gray-50 rounded-2xl p-4 mb-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Itens</p>
                {items.map((item) => (
                  <div key={item.product.id} className="flex justify-between text-sm py-1">
                    <span className="text-gray-600">{item.quantity}x {item.product.name}</span>
                    <span className="font-bold">{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
                <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-bold">
                  <span className="text-gray-700">Total</span>
                  <span className="text-sm font-bold text-primary">{formatCurrency(sectionTotal)}</span>
                </div>
              </div>

              {/* Delivery day — shows only the day name, no zone hours */}
              {deliveryDayLabel && (
                <div className="bg-primary/5 rounded-2xl p-4 mb-4 flex items-center gap-3">
                  <CalendarClock size={18} className="text-primary flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-gray-500">Dia de entrega</p>
                    <p className="text-sm font-bold text-gray-800">{deliveryDayLabel}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Fixed action area */}
            <div className="px-6 pb-8 pt-4 space-y-3 border-t border-gray-100">
              {/* Primary CTA — WhatsApp (unchanged behavior) */}
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  setWhatsappOpened(true)
                  markOrderWhatsAppSent(orderId).catch(() => {})
                }}
                className="flex items-center justify-center gap-3 w-full bg-green-500 text-white font-bold py-4 rounded-2xl text-sm shadow-lg active:scale-95 transition-transform"
              >
                <span className="text-xl">💬</span>
                Enviar pedido no WhatsApp
              </a>
              <p className="text-xs text-center text-gray-400">
                Toque no botão acima — isso abrirá o WhatsApp com a mensagem pronta. Basta enviar!
              </p>
              {/* Secondary CTA — always enabled (no WhatsApp gate per D-04) */}
              <button
                onClick={() => {
                  setCheckoutSuccess(null)
                  setWhatsappOpened(false)
                  navigate(`/orders/${orderId}`)
                }}
                className="w-full py-3 border border-primary/30 text-primary font-bold rounded-2xl text-sm active:bg-primary/5 transition-colors"
              >
                Ver Pedido
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
