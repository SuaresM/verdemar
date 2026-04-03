import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, RefreshCw } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { getFeaturedProducts, getFeaturedSuppliers } from '../../services/supabase'
import type { Product, Supplier } from '../../types'
import { ProductCard } from '../../components/product/ProductCard'
import { SupplierCard } from '../../components/supplier/SupplierCard'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { useOnboarding } from '../../hooks/useOnboarding'

const CATEGORIES = [
  { value: 'all', label: 'Todos', emoji: '🌿' },
  { value: 'fruit', label: 'Frutas', emoji: '🍎' },
  { value: 'vegetable', label: 'Legumes', emoji: '🥕' },
  { value: 'greens', label: 'Verduras', emoji: '🥬' },
  { value: 'other', label: 'Outros', emoji: '🌾' },
]

export default function Home() {
  const { buyer } = useAuthStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [refreshing, setRefreshing] = useState(false)

  useOnboarding('buyer')

  const load = useCallback(async () => {
    const [prods, sups] = await Promise.all([getFeaturedProducts(), getFeaturedSuppliers()])
    setProducts(prods)
    setSuppliers(sups)
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  const handleRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const handleCategoryClick = (value: string) => {
    if (value === 'all') {
      navigate('/search')
    } else {
      navigate('/search?category=' + value)
    }
  }

  if (loading) return <PageLoader />

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1 text-sm text-gray-500 mb-0.5">
              <span className="text-2xl font-extrabold text-primary">🌿 VerdeMar</span>
            </div>
            {buyer && (buyer.address_city || buyer.address_state) && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <MapPin size={11} />
                <span>{[buyer.address_city, buyer.address_state].filter(Boolean).join(', ')}</span>
              </div>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-full bg-gray-50 text-gray-400 disabled:opacity-50"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Welcome banner */}
        <div id="onboarding-welcome" className="mt-3 bg-gradient-to-r from-primary to-primary-light rounded-2xl p-4 text-white">
          <p className="text-sm opacity-90">Bem-vindo,</p>
          <p className="font-bold text-lg">{buyer?.company_name || 'Comprador'} 👋</p>
          <p className="text-xs opacity-80 mt-0.5">Encontre os melhores fornecedores de hortifrúti</p>
        </div>
      </div>

      {/* Categories */}
      <div id="onboarding-categories" className="px-4 py-4">
        <h2 className="font-bold text-gray-900 mb-3">Categorias</h2>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => handleCategoryClick(cat.value)}
              className="flex-shrink-0 flex flex-col items-center gap-1 px-4 py-3 rounded-2xl transition-colors bg-white text-gray-600 shadow-sm hover:bg-primary/5"
            >
              <span className="text-xl">{cat.emoji}</span>
              <span className="text-xs font-semibold whitespace-nowrap">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Featured Products */}
      {products.length > 0 && (
        <div id="onboarding-products" className="px-4 mb-6">
          <h2 className="font-bold text-gray-900 mb-3">Mais Vendidos</h2>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {products.map((product) => (
              <div key={product.id} className="flex-shrink-0 w-44">
                <ProductCard
                  product={product}
                  supplier={product.supplier}
                  onClick={() => navigate(`/product/${product.id}`)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Featured Suppliers */}
      {suppliers.length > 0 && (
        <div id="onboarding-suppliers" className="px-4">
          <h2 className="font-bold text-gray-900 mb-3">Fornecedores em Destaque</h2>
          <div className="space-y-3">
            {suppliers.map((supplier) => (
              <SupplierCard key={supplier.id} supplier={supplier} />
            ))}
          </div>
        </div>
      )}

      {products.length === 0 && suppliers.length === 0 && (
        <div className="px-4 py-12 text-center">
          <div className="text-4xl mb-3">🌱</div>
          <p className="font-bold text-gray-600">Nenhum produto disponível</p>
          <p className="text-sm text-gray-400 mt-1">Volte em breve para novidades</p>
        </div>
      )}
    </div>
  )
}
