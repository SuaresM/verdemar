import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapPin, Clock, Truck, ShoppingCart, Phone } from 'lucide-react'
import { getSupplierById, getProductsBySupplier } from '../../services/supabase'
import type { Supplier, Product } from '../../types'
import { ProductCard } from '../../components/product/ProductCard'
import { ImageSkeleton } from '../../components/shared/ImageSkeleton'
import { Header } from '../../components/layout/Header'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { EmptyState } from '../../components/shared/EmptyState'
import { useCartStore } from '../../stores/cartStore'
import { formatCurrency, getDeliveryDaysLabel } from '../../utils'

const CATEGORIES = [
  { value: 'all', label: 'Todos' },
  { value: 'fruit', label: '🍎 Frutas' },
  { value: 'vegetable', label: '🥕 Legumes' },
  { value: 'greens', label: '🥬 Verduras' },
  { value: 'other', label: '🌾 Outros' },
]

export default function SupplierProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'products' | 'about'>('products')
  const [category, setCategory] = useState('all')

  const sections = useCartStore((s) => s.sections)
  const supplierSection = sections.find((s) => s.supplier.id === id)
  const cartCount = supplierSection?.items.reduce((sum, i) => sum + i.quantity, 0) || 0

  useEffect(() => {
    if (!id) return
    Promise.all([getSupplierById(id), getProductsBySupplier(id)])
      .then(([sup, prods]) => {
        setSupplier(sup)
        setProducts(prods ?? [])
      })
      .catch((err) => {
        console.error('Erro ao carregar fornecedor:', err)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [id])

  if (loading) return <PageLoader />
  if (!supplier) return <div className="p-4 text-center text-gray-500">Fornecedor não encontrado</div>

  const filteredProducts =
    category === 'all' ? products.filter((p) => p.is_available) : products.filter((p) => p.category === category && p.is_available)

  return (
    <div className="min-h-screen">
      <Header showBack />

      {/* Banner */}
      <div className="relative h-36 bg-primary/20">
        {supplier.banner_url && (
          <ImageSkeleton src={supplier.banner_url} alt="banner" className="w-full h-full" aspectRatio="aspect-auto" />
        )}
        {/* Logo */}
        <div className="absolute -bottom-8 left-4 w-16 h-16 rounded-full border-4 border-white overflow-hidden bg-white shadow-md">
          {supplier.logo_url ? (
            <ImageSkeleton src={supplier.logo_url} alt={supplier.store_name} aspectRatio="aspect-square" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-2xl">
              {supplier.store_name[0]}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-10 pb-4">
        <h1 className="text-xl font-extrabold text-gray-900">{supplier.store_name}</h1>
        <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
          <MapPin size={13} />
          <span>{supplier.address_city}, {supplier.address_state}</span>
        </div>

        <div className="flex flex-wrap gap-3 mt-3">
          {supplier.delivery_days.length > 0 && (
            <div className="flex items-center gap-1 bg-gray-50 rounded-xl px-3 py-1.5">
              <Truck size={13} className="text-primary" />
              <span className="text-xs font-semibold text-gray-700">{getDeliveryDaysLabel(supplier.delivery_days)}</span>
            </div>
          )}
          <div className="flex items-center gap-1 bg-gray-50 rounded-xl px-3 py-1.5">
            <Clock size={13} className="text-primary" />
            <span className="text-xs font-semibold text-gray-700">{supplier.delivery_hours_start} - {supplier.delivery_hours_end}</span>
          </div>
          {(supplier.min_order_value || supplier.min_order_quantity) && (
            <div className="bg-accent/10 rounded-xl px-3 py-1.5">
              <span className="text-xs font-semibold text-accent">
                Mín. {supplier.min_order_value ? formatCurrency(supplier.min_order_value) : `${supplier.min_order_quantity} itens`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 mx-4 rounded-xl p-1 mb-4">
        {(['products', 'about'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
              tab === t ? 'bg-white text-primary shadow-sm' : 'text-gray-500'
            }`}
          >
            {t === 'products' ? 'Produtos' : 'Sobre'}
          </button>
        ))}
      </div>

      {tab === 'products' && (
        <div className="px-4">
          {/* Category filter */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  category === cat.value ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {filteredProducts.length === 0 ? (
            <EmptyState title="Nenhum produto disponível" />
          ) : (
            <div className="grid grid-cols-2 gap-3 pb-24">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  supplier={supplier}
                  onClick={() => navigate(`/product/${product.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'about' && (
        <div className="px-4 pb-24 space-y-4">
          {supplier.description && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="font-bold text-gray-700 mb-2">Sobre a loja</p>
              <p className="text-sm text-gray-600">{supplier.description}</p>
            </div>
          )}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="font-bold text-gray-700 mb-3">Informações</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Phone size={14} className="text-primary" />
                <span>WhatsApp: {supplier.whatsapp}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin size={14} className="text-primary" />
                <span>{supplier.address_city}, {supplier.address_state}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Truck size={14} className="text-primary" />
                <span>Entrega: {getDeliveryDaysLabel(supplier.delivery_days)}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Clock size={14} className="text-primary" />
                <span>Horário: {supplier.delivery_hours_start} às {supplier.delivery_hours_end}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating cart button */}
      {cartCount > 0 && (
        <button
          onClick={() => navigate('/cart')}
          className="fixed bottom-20 left-4 right-4 bg-primary text-white font-bold py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2 z-40"
        >
          <ShoppingCart size={20} />
          Ver Carrinho ({cartCount} itens) · {formatCurrency(supplierSection?.sectionTotal || 0)}
        </button>
      )}
    </div>
  )
}
