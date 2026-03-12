import { useState } from 'react'
import { Plus, Minus, ShoppingCart } from 'lucide-react'
import type { Product, Supplier } from '../../types'
import { useCartStore } from '../../stores/cartStore'
import { ImageSkeleton } from '../shared/ImageSkeleton'
import { CategoryBadge } from '../shared/Badge'
import { PriceTag } from './PriceTag'

interface ProductCardProps {
  product: Product
  supplier?: Supplier
  onClick?: () => void
}

export function ProductCard({ product, supplier, onClick }: ProductCardProps) {
  const [showQuantity, setShowQuantity] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const addItem = useCartStore((s) => s.addItem)

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!supplier && !product.supplier) return
    setShowQuantity(true)
  }

  const handleConfirm = (e: React.MouseEvent) => {
    e.stopPropagation()
    const sup = supplier || product.supplier
    if (!sup) return
    addItem(product, quantity, sup)
    setShowQuantity(false)
    setQuantity(1)
  }

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowQuantity(false)
    setQuantity(1)
  }

  return (
    <div
      className="bg-white rounded-2xl shadow-sm overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
      onClick={onClick}
    >
      <div className="relative">
        <ImageSkeleton
          src={product.image_url}
          alt={product.name}
          aspectRatio="aspect-[4/3]"
        />
        <div className="absolute top-2 left-2">
          <CategoryBadge category={product.category} />
        </div>
      </div>

      <div className="p-3">
        <p className="font-bold text-gray-900 text-sm line-clamp-2 mb-1">{product.name}</p>
        <PriceTag product={product} size="sm" />

        {!showQuantity ? (
          <button
            onClick={handleAdd}
            disabled={!product.is_available}
            className="mt-2 w-full flex items-center justify-center gap-1 bg-primary text-white text-sm font-semibold py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed active:bg-primary/90 transition-colors"
          >
            <Plus size={16} />
            Adicionar
          </button>
        ) : (
          <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-1">
              <button
                onClick={(e) => { e.stopPropagation(); setQuantity(Math.max(1, quantity - 1)) }}
                className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-700"
              >
                <Minus size={14} />
              </button>
              <span className="font-bold text-sm">{quantity}</span>
              <button
                onClick={(e) => { e.stopPropagation(); setQuantity(quantity + 1) }}
                className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-700"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="flex-1 py-1.5 text-xs font-semibold text-gray-500 border border-gray-200 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-1.5 text-xs font-semibold text-white bg-primary rounded-xl flex items-center justify-center gap-1"
              >
                <ShoppingCart size={12} />
                Adicionar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
