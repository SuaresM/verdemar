import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { getAllProducts, updateProduct, deleteProduct } from '../../services/supabase'
import { Header } from '../../components/layout/Header'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { EmptyState } from '../../components/shared/EmptyState'
import { formatCurrency } from '../../utils'
import type { Product } from '../../types'

const CATEGORIES = [
  { value: '', label: 'Todos' },
  { value: 'fruit', label: 'Frutas' },
  { value: 'vegetable', label: 'Legumes' },
  { value: 'greens', label: 'Verduras' },
  { value: 'other', label: 'Outros' },
]

function getProductPrice(product: Product): number {
  if (product.sale_unit === 'box') return product.box_price || 0
  if (product.sale_unit === 'kg') return product.price_per_kg || 0
  return product.price_per_unit || 0
}

export default function AdminProducts() {
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [category, setCategory] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const load = async () => {
    const result = await getAllProducts(0)
    setProducts(result.data)
    setHasMore(result.hasMore)
    setPage(0)
    setLoading(false)
  }

  const loadMore = async () => {
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const result = await getAllProducts(nextPage)
      setProducts((prev) => [...prev, ...result.data])
      setHasMore(result.hasMore)
      setPage(nextPage)
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = category
    ? products.filter((p) => p.category === category)
    : products

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; products: Product[] }>()
    for (const p of filtered) {
      const supplierId = p.supplier_id
      const supplierName = p.supplier?.store_name || 'Fornecedor desconhecido'
      if (!map.has(supplierId)) {
        map.set(supplierId, { name: supplierName, products: [] })
      }
      map.get(supplierId)!.products.push(p)
    }
    return Array.from(map.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name))
  }, [filtered])

  const toggleCollapse = (supplierId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(supplierId)) {
        next.delete(supplierId)
      } else {
        next.add(supplierId)
      }
      return next
    })
  }

  const collapseAll = () => {
    setCollapsed(new Set(grouped.map(([id]) => id)))
  }

  const expandAll = () => {
    setCollapsed(new Set())
  }

  const allCollapsed = grouped.length > 0 && collapsed.size === grouped.length

  const handleToggle = async (product: Product) => {
    try {
      await updateProduct(product.id, { is_available: !product.is_available })
      toast.success(product.is_available ? 'Produto desativado' : 'Produto ativado')
      await load()
    } catch {
      toast.error('Erro ao atualizar produto')
    }
  }

  const handleDelete = async (product: Product) => {
    if (!confirm(`Deletar "${product.name}"? Esta acao nao pode ser desfeita.`)) return
    try {
      await deleteProduct(product.id)
      toast.success('Produto deletado')
      await load()
    } catch {
      toast.error('Erro ao deletar produto')
    }
  }

  if (loading) return <PageLoader />

  return (
    <div className="min-h-screen bg-background">
      <Header title="Produtos" />

      <div className="px-4 py-4 space-y-4">
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

        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">{filtered.length} produto(s)</p>
          {grouped.length > 1 && (
            <button
              onClick={allCollapsed ? expandAll : collapseAll}
              className="text-xs text-primary font-semibold"
            >
              {allCollapsed ? 'Expandir todos' : 'Recolher todos'}
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="Nenhum produto" description="Nenhum produto encontrado" />
        ) : (
          <div className="space-y-4">
            {grouped.map(([supplierId, group]) => {
              const isCollapsed = collapsed.has(supplierId)
              return (
                <div key={supplierId} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <button
                    onClick={() => toggleCollapse(supplierId)}
                    className="w-full flex items-center gap-3 p-4 text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                      {group.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800 text-sm truncate">{group.name}</p>
                      <p className="text-[10px] text-gray-500">{group.products.length} produto(s)</p>
                    </div>
                    {isCollapsed ? (
                      <ChevronRight size={18} className="text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown size={18} className="text-gray-400 flex-shrink-0" />
                    )}
                  </button>

                  {!isCollapsed && (
                    <div className="px-4 pb-4 space-y-3">
                      {group.products.map((product) => (
                        <div key={product.id} className="bg-gray-50 rounded-xl p-3">
                          <div className="flex items-start gap-3 mb-2">
                            {product.image_url ? (
                              <img src={product.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400 text-[10px]">
                                Sem foto
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-800 text-sm truncate">{product.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-sm font-bold text-primary">
                                  {formatCurrency(getProductPrice(product))}
                                  {product.sale_unit === 'kg' ? '/kg' : product.sale_unit === 'unit' ? '/un' : '/cx'}
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                                  product.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  {product.is_available ? 'Ativo' : 'Inativo'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleToggle(product)}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                product.is_available
                                  ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                  : 'bg-green-100 text-green-700 hover:bg-green-200'
                              }`}
                            >
                              {product.is_available ? 'Desativar' : 'Ativar'}
                            </button>
                            <button
                              onClick={() => handleDelete(product)}
                              className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                            >
                              Deletar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-3 bg-white rounded-2xl text-sm font-semibold text-primary hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
              >
                {loadingMore ? 'Carregando...' : 'Carregar mais produtos'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
