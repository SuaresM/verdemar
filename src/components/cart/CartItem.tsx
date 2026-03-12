import { Minus, Plus, Trash2 } from 'lucide-react'
import type { CartItem as CartItemType } from '../../types'
import { useCartStore } from '../../stores/cartStore'
import { formatCurrency } from '../../utils'
import { ImageSkeleton } from '../shared/ImageSkeleton'
import { getSaleUnitLabel } from '../../utils'

interface CartItemProps {
  item: CartItemType
  supplierId: string
}

export function CartItemCard({ item, supplierId }: CartItemProps) {
  const { updateQuantity, removeItem } = useCartStore()
  const unitLabel = getSaleUnitLabel(item.product.sale_unit, item.product.unit_description)

  const handleDecrement = () => {
    if (item.quantity <= 1) {
      removeItem(item.product.id, supplierId)
    } else {
      updateQuantity(item.product.id, supplierId, item.quantity - 1)
    }
  }

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
        <ImageSkeleton
          src={item.product.image_url}
          alt={item.product.name}
          aspectRatio="aspect-square"
          className="w-full h-full"
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm line-clamp-1">{item.product.name}</p>
        <p className="text-xs text-gray-500">{unitLabel}</p>
        <p className="text-sm font-bold text-primary mt-0.5">{formatCurrency(item.subtotal)}</p>
      </div>

      <div className="flex flex-col items-end gap-2">
        <button
          onClick={() => removeItem(item.product.id, supplierId)}
          className="p-1 text-gray-300 hover:text-danger transition-colors"
        >
          <Trash2 size={14} />
        </button>

        <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-1">
          <button
            onClick={handleDecrement}
            className="w-7 h-7 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-700"
          >
            <Minus size={12} />
          </button>
          <span className="text-sm font-bold min-w-[24px] text-center">{item.quantity}</span>
          <button
            onClick={() => updateQuantity(item.product.id, supplierId, item.quantity + 1)}
            className="w-7 h-7 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-700"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}
