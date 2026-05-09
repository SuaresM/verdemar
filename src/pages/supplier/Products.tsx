import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit2, Trash2, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '../../stores/authStore'
import { getProductsBySupplier, deleteProduct, updateProduct, createProduct } from '../../services/supabase'
import { apiClient } from '../../lib/apiClient'
import type { Product } from '../../types'
import { Header } from '../../components/layout/Header'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { EmptyState } from '../../components/shared/EmptyState'
import { CategoryBadge } from '../../components/shared/Badge'
import { ImageSkeleton } from '../../components/shared/ImageSkeleton'
import { PriceTag } from '../../components/product/PriceTag'

const CATEGORIES = [
  { value: 'all', label: 'Todos' },
  { value: 'fruit', label: '🍎 Frutas' },
  { value: 'vegetable', label: '🥕 Legumes' },
  { value: 'greens', label: '🥬 Verduras' },
  { value: 'other', label: '🌾 Outros' },
]

export default function Products() {
  const { supplier } = useAuthStore()
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('all')
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'unavailable'>('all')
  const [editingStock, setEditingStock] = useState<Record<string, string>>({})
  const [stockSaving, setStockSaving] = useState<Record<string, boolean>>({})

  const load = async () => {
    if (!supplier) return
    try {
      const data = await getProductsBySupplier(supplier.id)
      setProducts(data ?? [])
    } catch (err) {
      console.error('Erro ao carregar produtos:', err)
      toast.error('Erro ao carregar produtos')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [supplier])

  const handleToggleAvailability = async (product: Product) => {
    try {
      await updateProduct(product.id, { is_available: !product.is_available })
      setProducts((prev) =>
        prev.map((p) => p.id === product.id ? { ...p, is_available: !p.is_available } : p)
      )
      toast.success(product.is_available ? 'Produto desativado' : 'Produto ativado')
    } catch {
      toast.error('Erro ao atualizar')
    }
  }

  const handleStockSave = async (product: Product) => {
    const rawVal = editingStock[product.id]
    if (rawVal === undefined) return
    const newQty = parseFloat(rawVal)
    if (isNaN(newQty) || newQty < 0) {
      setEditingStock((p) => { const n = { ...p }; delete n[product.id]; return n })
      toast.error('Valor inválido')
      return
    }
    setStockSaving((p) => ({ ...p, [product.id]: true }))
    try {
      await apiClient.patch(`/products/${product.id}/stock`, { stock_quantity: newQty })
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, stock_quantity: newQty } : p))
      )
      toast.success('Estoque atualizado')
    } catch {
      toast.error('Erro ao atualizar estoque')
    } finally {
      setStockSaving((p) => { const n = { ...p }; delete n[product.id]; return n })
      setEditingStock((p) => { const n = { ...p }; delete n[product.id]; return n })
    }
  }

  const handleStockCancel = (product: Product) => {
    setEditingStock((p) => { const n = { ...p }; delete n[product.id]; return n })
  }

  const handleToggleSellWithoutStock = async (product: Product) => {
    const newVal = !product.sell_without_stock
    // optimistic update
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, sell_without_stock: newVal } : p))
    )
    try {
      await apiClient.patch(`/products/${product.id}/sell-without-stock`, { sell_without_stock: newVal })
      toast.success(newVal ? 'Venda sem estoque ativada' : 'Venda sem estoque desativada')
    } catch {
      // revert
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, sell_without_stock: !newVal } : p))
      )
      toast.error('Erro ao atualizar')
    }
  }

  const handleDelete = async (product: Product) => {
    if (!confirm(`Excluir "${product.name}"?`)) return
    try {
      await deleteProduct(product.id)
      setProducts((prev) => prev.filter((p) => p.id !== product.id))
      toast.success('Produto excluído')
    } catch {
      toast.error('Erro ao excluir')
    }
  }

  const handleDuplicate = async (product: Product) => {
    if (!supplier) return
    try {
      const { id, created_at, updated_at, total_sold, supplier: _s, ...rest } = product
      await createProduct({ ...rest, name: `${rest.name} (cópia)` })
      await load()
      toast.success('Produto duplicado')
    } catch {
      toast.error('Erro ao duplicar')
    }
  }

  const filtered = products
    .filter((p) => category === 'all' || p.category === category)
    .filter((p) => {
      if (availabilityFilter === 'available') return p.is_available
      if (availabilityFilter === 'unavailable') return !p.is_available
      return true
    })

  if (loading) return <PageLoader />

  return (
    <div className="min-h-screen">
      <Header title="Meus Produtos" />

      {/* Filters */}
      <div className="bg-white px-4 py-3 border-b border-gray-100 space-y-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
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
        <div className="flex gap-2">
          {(['all', 'available', 'unavailable'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setAvailabilityFilter(v)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                availabilityFilter === v ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {v === 'all' ? 'Todos' : v === 'available' ? 'Disponíveis' : 'Indisponíveis'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 pb-24">
        {filtered.length === 0 ? (
          <EmptyState title="Nenhum produto" description="Adicione seu primeiro produto" />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((product) => (
              <div key={product.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden ${!product.is_available ? 'opacity-60' : ''}`}>
                <div className="relative">
                  <ImageSkeleton src={product.image_url} alt={product.name} aspectRatio="aspect-[4/3]" />
                  <div className="absolute top-2 left-2">
                    <CategoryBadge category={product.category} />
                  </div>
                  {/* Toggle availability */}
                  <button
                    onClick={() => handleToggleAvailability(product)}
                    className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 border-white transition-colors ${
                      product.is_available ? 'bg-success' : 'bg-gray-300'
                    }`}
                  />
                </div>
                <div className="p-2">
                  <p className="font-bold text-gray-900 text-xs line-clamp-2 mb-1">{product.name}</p>
                  <PriceTag product={product} size="sm" />

                  {/* D-02: inline stock edit */}
                  <div className="mt-2">
                    {editingStock[product.id] !== undefined ? (
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        autoFocus
                        value={editingStock[product.id]}
                        onChange={(e) => setEditingStock((p) => ({ ...p, [product.id]: e.target.value }))}
                        onBlur={() => handleStockSave(product)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleStockSave(product)
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault()
                            handleStockCancel(product)
                          }
                        }}
                        className="w-full px-2 py-1 border border-primary rounded-lg text-xs text-center"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingStock((p) => ({ ...p, [product.id]: String(product.stock_quantity ?? 0) }))}
                        className="text-xs text-gray-500 underline-offset-2 hover:underline w-full text-left"
                        disabled={stockSaving[product.id]}
                      >
                        {stockSaving[product.id] ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="w-3 h-3 border border-gray-400 border-t-primary rounded-full animate-spin inline-block" />
                            salvando...
                          </span>
                        ) : (
                          <>{product.stock_quantity ?? 0} em estoque</>
                        )}
                      </button>
                    )}
                  </div>

                  {/* D-02: sell_without_stock toggle */}
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-gray-500">Vender sem estoque</p>
                    <button
                      type="button"
                      onClick={() => handleToggleSellWithoutStock(product)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${product.sell_without_stock ? 'bg-primary' : 'bg-gray-300'}`}
                      aria-label="Vender sem estoque"
                      aria-pressed={product.sell_without_stock}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${product.sell_without_stock ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>

                  <div className="flex gap-1 mt-2">
                    <button
                      onClick={() => navigate(`/supplier/products/${product.id}/edit`)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-primary/10 text-primary text-xs font-semibold rounded-lg"
                    >
                      <Edit2 size={11} />
                    </button>
                    <button
                      onClick={() => handleDuplicate(product)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg"
                    >
                      <Copy size={11} />
                    </button>
                    <button
                      onClick={() => handleDelete(product)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-red-50 text-danger text-xs font-semibold rounded-lg"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate('/supplier/products/new')}
        className="fixed bottom-20 right-4 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center z-40"
      >
        <Plus size={28} />
      </button>
    </div>
  )
}
