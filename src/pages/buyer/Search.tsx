import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search as SearchIcon, X } from 'lucide-react'
import { searchProducts, searchSuppliers } from '../../services/supabase'
import type { Product, Supplier } from '../../types'
import { ProductCard } from '../../components/product/ProductCard'
import { SupplierCard } from '../../components/supplier/SupplierCard'
import { EmptyState } from '../../components/shared/EmptyState'
import { LoadingSpinner } from '../../components/shared/LoadingSpinner'

const CATEGORIES = [
  { value: '', label: 'Todos' },
  { value: 'fruit', label: '🍎 Frutas' },
  { value: 'vegetable', label: '🥕 Legumes' },
  { value: 'greens', label: '🥬 Verduras' },
  { value: 'other', label: '🌾 Outros' },
]

type TabType = 'products' | 'suppliers'

export default function Search() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<TabType>('products')
  const [category, setCategory] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [productPage, setProductPage] = useState(0)
  const [supplierPage, setSupplierPage] = useState(0)
  const [hasMoreProducts, setHasMoreProducts] = useState(false)
  const [hasMoreSuppliers, setHasMoreSuppliers] = useState(false)
  const lastSearchRef = useRef({ query: '', category: '' })
  const skipNextCategoryEffect = useRef(false)

  useEffect(() => {
    const catParam = searchParams.get('category')
    if (catParam) {
      // The [category] effect below will see this change and try to re-fetch.
      // Skip it to avoid a duplicate Supabase round-trip.
      skipNextCategoryEffect.current = true
      setCategory(catParam)
      setLoading(true)
      setHasSearched(true)
      Promise.all([
        searchProducts(undefined, catParam, 0),
        searchSuppliers('', undefined, 0),
      ]).then(([prodResult, supResult]) => {
        setProducts(prodResult.data)
        setHasMoreProducts(prodResult.hasMore)
        setSuppliers(supResult.data)
        setHasMoreSuppliers(supResult.hasMore)
        setProductPage(0)
        setSupplierPage(0)
        lastSearchRef.current = { query: '', category: catParam }
      }).finally(() => setLoading(false))
    }
  }, [searchParams])

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim() && !category) return
    setLoading(true)
    setHasSearched(true)
    setProductPage(0)
    setSupplierPage(0)
    lastSearchRef.current = { query: q.trim(), category }
    try {
      const [prodResult, supResult] = await Promise.all([
        searchProducts(q.trim() || undefined, category || undefined, 0),
        searchSuppliers(q, undefined, 0),
      ])
      setProducts(prodResult.data)
      setHasMoreProducts(prodResult.hasMore)
      setSuppliers(supResult.data)
      setHasMoreSuppliers(supResult.hasMore)
    } finally {
      setLoading(false)
    }
  }, [category])

  const loadMoreProducts = async () => {
    const nextPage = productPage + 1
    setLoadingMore(true)
    try {
      const { query: q, category: cat } = lastSearchRef.current
      const result = await searchProducts(q || undefined, cat || undefined, nextPage)
      setProducts((prev) => [...prev, ...result.data])
      setHasMoreProducts(result.hasMore)
      setProductPage(nextPage)
    } finally {
      setLoadingMore(false)
    }
  }

  const loadMoreSuppliers = async () => {
    const nextPage = supplierPage + 1
    setLoadingMore(true)
    try {
      const { query: q } = lastSearchRef.current
      const result = await searchSuppliers(q, undefined, nextPage)
      setSuppliers((prev) => [...prev, ...result.data])
      setHasMoreSuppliers(result.hasMore)
      setSupplierPage(nextPage)
    } finally {
      setLoadingMore(false)
    }
  }

  // Auto-search when category changes (if user already searched or came from home)
  useEffect(() => {
    if (skipNextCategoryEffect.current) {
      skipNextCategoryEffect.current = false
      return
    }
    if (hasSearched || category) {
      handleSearch(query)
    }
  }, [category]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch(query)
  }

  const clearSearch = () => {
    setQuery('')
    setProducts([])
    setSuppliers([])
    setHasSearched(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search header */}
      <div className="bg-white px-4 pt-4 pb-3 border-b border-gray-100 space-y-3">
        <div className="relative">
          <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar produto ou fornecedor..."
            className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          {query && (
            <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1">
          {(['products', 'suppliers'] as TabType[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                tab === t ? 'bg-white text-primary shadow-sm' : 'text-gray-500'
              }`}
            >
              {t === 'products' ? 'Produtos' : 'Fornecedores'}
            </button>
          ))}
        </div>

        {/* Category filter (products only) */}
        {tab === 'products' && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  category === cat.value
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        )}

        {!loading && !hasSearched && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🔍</div>
            <p className="font-bold text-gray-600">Busque por produtos ou fornecedores</p>
            <p className="text-sm text-gray-400 mt-1">Digite algo e pressione Enter</p>
          </div>
        )}

        {!loading && hasSearched && tab === 'products' && (
          <>
            {products.length === 0 ? (
              <EmptyState title="Nenhum produto encontrado" description="Tente outro termo de busca" />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    supplier={product.supplier}
                    onClick={() => navigate(`/product/${product.id}`)}
                  />
                ))}
              </div>
            )}
            {hasMoreProducts && (
              <button
                onClick={loadMoreProducts}
                disabled={loadingMore}
                className="w-full mt-4 py-3 bg-white rounded-2xl text-sm font-semibold text-primary hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
              >
                {loadingMore ? 'Carregando...' : 'Carregar mais produtos'}
              </button>
            )}
          </>
        )}

        {!loading && hasSearched && tab === 'suppliers' && (
          <>
            {suppliers.length === 0 ? (
              <EmptyState title="Nenhum fornecedor encontrado" description="Tente outro termo de busca" />
            ) : (
              <div className="space-y-3">
                {suppliers.map((supplier) => (
                  <SupplierCard key={supplier.id} supplier={supplier} />
                ))}
              </div>
            )}
            {hasMoreSuppliers && (
              <button
                onClick={loadMoreSuppliers}
                disabled={loadingMore}
                className="w-full mt-4 py-3 bg-white rounded-2xl text-sm font-semibold text-primary hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
              >
                {loadingMore ? 'Carregando...' : 'Carregar mais fornecedores'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
