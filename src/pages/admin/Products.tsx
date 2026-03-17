import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
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
  const [products, setProducts] = useState<Product[]>([])
  const [category, setCategory] = useState('')

  const load = async () => {
    const data = await getAllProducts()
    setProducts(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = category
    ? products.filter((p) => p.category === category)
    : products

  // Group products by supplier
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

        <p className="text-xs text-gray-500">{filtered.length} produto(s)</p>

        {filtered.length === 0 ? (
          <EmptyState title="Nenhum produto" description="Nenhum produto encontrado" />
        ) : (
          <div className="space-y-6">
            {grouped.map(([supplierId, group]) => (
              <div key={supplierId}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {group.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{group.name}</p>
                    <p className="text-[10px] text-gray-500">{group.products.length} produto(s)</p>
                  </div>
                </div>

                <div className="space-y-3 pl-2 border-l-2 border-primary/20">
                  {group.products.map((product) => (
                    <div key={product.id} className="bg-white rounded-2xl shadow-sm p-4">
                      <div className="flex items-start gap-3 mb-2">
                        {product.image_url ? (
                          <img src={product.image_url} alt="" className="w-14 h-14 rounded-xl object-cover" />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                            Sem foto
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-800 truncate">{product.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm font-bold text-primary">
                              {formatCurrency(getProductPrice(product))}
                              {product.sale_unit === 'kg' ? '/kg' : product.sale_unit === 'unit' ? '/un' : '/cx'}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
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
                          className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
                            product.is_available
                              ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {product.is_available ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          onClick={() => handleDelete(product)}
                          className="flex-1 py-2 rounded-xl text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                        >
                          Deletar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
