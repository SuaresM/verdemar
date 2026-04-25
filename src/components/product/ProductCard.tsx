import { Plus, Minus } from 'lucide-react'
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
  const { sections, addItem, updateQuantity } = useCartStore()

  const sup = supplier || product.supplier
  const cartSection = sup ? sections.find((s) => s.supplier.id === sup.id) : null
  const cartItem = cartSection?.items.find((i) => i.product.id === product.id)
  const currentQty = cartItem?.quantity ?? 0

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!sup) return
    addItem(product, 1, sup)
  }

  const handleIncrease = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!sup) return
    updateQuantity(product.id, sup.id, currentQty + 1)
  }

  const handleDecrease = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!sup) return
    updateQuantity(product.id, sup.id, currentQty - 1)
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
        {currentQty > 0 && (
          <div className="absolute top-2 right-2 bg-primary text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {currentQty}
          </div>
        )}
      </div>

      <div className="p-3">
        <p className="font-bold text-gray-900 text-sm line-clamp-2 mb-1">{product.name}</p>
        <PriceTag product={product} size="sm" />

        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
          {currentQty === 0 ? (
            <button
              onClick={handleAdd}
              disabled={!product.is_available || !sup}
              className="w-full flex items-center justify-center gap-1 bg-primary text-white text-sm font-semibold py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed active:bg-primary/90 transition-colors"
            >
              <Plus size={16} />
              Adicionar
            </button>
          ) : (
            <div className="flex items-center justify-between bg-primary/10 rounded-xl p-1">
              <button
                onClick={handleDecrease}
                className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-primary"
              >
                <Minus size={14} />
              </button>
              <span className="font-bold text-sm text-primary">{currentQty}</span>
              <button
                onClick={handleIncrease}
                className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-primary"
              >
                <Plus size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
