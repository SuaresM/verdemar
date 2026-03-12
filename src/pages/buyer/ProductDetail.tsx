import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Plus, Minus, ShoppingCart, Store } from 'lucide-react'
import { getProductById } from '../../services/supabase'
import type { Product } from '../../types'
import { useCartStore } from '../../stores/cartStore'
import { Header } from '../../components/layout/Header'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { PriceTag } from '../../components/product/PriceTag'
import { CategoryBadge } from '../../components/shared/Badge'
import { ImageSkeleton } from '../../components/shared/ImageSkeleton'
import { toast } from 'sonner'

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const addItem = useCartStore((s) => s.addItem)

  useEffect(() => {
    if (!id) return
    getProductById(id).then((p) => {
      setProduct(p)
      setLoading(false)
    })
  }, [id])

  const handleAddToCart = () => {
    if (!product || !product.supplier) {
      toast.error('Informações do fornecedor não disponíveis')
      return
    }
    addItem(product, quantity, product.supplier)
    toast.success(`${quantity}x ${product.name} adicionado ao carrinho!`)
    navigate(-1)
  }

  if (loading) return <PageLoader />
  if (!product) return <div className="p-4 text-center text-gray-500">Produto não encontrado</div>

  return (
    <div className="min-h-screen bg-background">
      <Header showBack />

      {/* Product image */}
      <div className="relative">
        <ImageSkeleton
          src={product.image_url}
          alt={product.name}
          aspectRatio="aspect-[4/3]"
          className="w-full"
        />
        <div className="absolute top-3 left-3">
          <CategoryBadge category={product.category} />
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Name and price */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h1 className="text-xl font-extrabold text-gray-900 mb-1">{product.name}</h1>
          {product.description && (
            <p className="text-sm text-gray-500 mb-3">{product.description}</p>
          )}
          <PriceTag product={product} size="lg" />
        </div>

        {/* Quantity selector */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="font-bold text-gray-700 mb-3">Quantidade</p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-xl text-gray-700 text-xl font-bold"
            >
              <Minus size={20} />
            </button>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="flex-1 text-center text-2xl font-bold border-0 focus:outline-none"
              min={1}
            />
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-12 h-12 flex items-center justify-center bg-primary text-white rounded-xl text-xl font-bold"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        {/* Supplier info */}
        {product.supplier && (
          <Link to={`/supplier/${product.supplier.id}`}>
            <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                {product.supplier.logo_url ? (
                  <ImageSkeleton
                    src={product.supplier.logo_url}
                    alt={product.supplier.store_name}
                    aspectRatio="aspect-square"
                    className="rounded-full"
                  />
                ) : (
                  <Store size={20} className="text-primary" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900">{product.supplier.store_name}</p>
                <p className="text-xs text-gray-500">{product.supplier.address_city}, {product.supplier.address_state}</p>
              </div>
              <span className="text-xs text-primary font-semibold">Ver loja →</span>
            </div>
          </Link>
        )}
      </div>

      {/* Add to cart button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 safe-bottom">
        <button
          onClick={handleAddToCart}
          disabled={!product.is_available}
          className="w-full bg-primary text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <ShoppingCart size={20} />
          {product.is_available ? 'Adicionar ao Carrinho' : 'Produto Indisponível'}
        </button>
      </div>
    </div>
  )
}
