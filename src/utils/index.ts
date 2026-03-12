import type { OrderItem, Order, Buyer, SaleUnit } from '../types'

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function calculatePricePerKg(boxPrice: number, boxWeightKg: number): number {
  if (!boxWeightKg || boxWeightKg === 0) return 0
  return boxPrice / boxWeightKg
}

export function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '')
  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  )
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) {
    return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')
  }
  return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3')
}

export function getDeliveryDaysLabel(days: string[]): string {
  const dayMap: Record<string, string> = {
    monday: 'Seg',
    tuesday: 'Ter',
    wednesday: 'Qua',
    thursday: 'Qui',
    friday: 'Sex',
    saturday: 'Sáb',
    sunday: 'Dom',
  }
  const order = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  return order
    .filter((d) => days.includes(d))
    .map((d) => dayMap[d])
    .join(', ')
}

export function getSaleUnitLabel(unit: SaleUnit, unitDescription?: string): string {
  if (unit === 'box') return 'caixa'
  if (unit === 'kg') return 'kg'
  if (unit === 'unit') return unitDescription || 'unidade'
  return unit
}

export function formatWhatsAppMessage(order: Order, buyer: Buyer, items: OrderItem[]): string {
  const itemsList = items
    .map((item) => {
      const unitLabel = getSaleUnitLabel(item.sale_unit as SaleUnit)
      return `• ${item.quantity}x ${item.product_name} (${unitLabel}) — ${formatCurrency(item.subtotal)}`
    })
    .join('\n')

  const address = `${buyer.address_street}, ${buyer.address_number}${
    buyer.address_complement ? `, ${buyer.address_complement}` : ''
  } - ${buyer.address_neighborhood}, ${buyer.address_city}/${buyer.address_state} - CEP: ${buyer.address_zip}`

  return encodeURIComponent(
    `🛒 NOVO PEDIDO - VerdeMar
━━━━━━━━━━━━━━━━━━━

👤 Cliente: ${buyer.company_name}
📄 CNPJ: ${formatCNPJ(buyer.cnpj)}
📍 Endereço: ${address}
📞 Telefone: ${formatPhone(buyer.contact_phone)}

🛍 ITENS DO PEDIDO:
${itemsList}

💰 TOTAL: ${formatCurrency(order.total_value)}
💳 Pagamento: À vista na entrega

⏰ Horário preferencial: ${order.delivery_time_preference || 'Não informado'}
📝 Observações: ${order.notes || 'Nenhuma'}

Pedido realizado via VerdeMar`
  )
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString))
}

export function formatDateShort(dateString: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateString))
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
