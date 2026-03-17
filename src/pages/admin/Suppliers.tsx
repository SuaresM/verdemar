import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { getAllSuppliers, deactivateSupplier, activateSupplier, deleteSupplierAdmin } from '../../services/supabase'
import { Header } from '../../components/layout/Header'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { EmptyState } from '../../components/shared/EmptyState'
import type { Supplier } from '../../types'

type Filter = 'all' | 'active' | 'inactive'

export default function AdminSuppliers() {
  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState<(Supplier & { profile?: any })[]>([])
  const [filter, setFilter] = useState<Filter>('all')

  const load = async () => {
    const data = await getAllSuppliers()
    setSuppliers(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = suppliers.filter((s) => {
    if (filter === 'active') return s.is_active
    if (filter === 'inactive') return !s.is_active
    return true
  })

  const handleToggle = async (supplier: Supplier) => {
    try {
      if (supplier.is_active) {
        await deactivateSupplier(supplier.id)
        toast.success('Fornecedor desativado')
      } else {
        await activateSupplier(supplier.id)
        toast.success('Fornecedor ativado')
      }
      await load()
    } catch {
      toast.error('Erro ao atualizar fornecedor')
    }
  }

  const handleDelete = async (supplier: Supplier) => {
    if (!confirm(`Deletar "${supplier.store_name}" e todos os seus produtos? Esta acao nao pode ser desfeita.`)) return
    try {
      await deleteSupplierAdmin(supplier.id)
      toast.success('Fornecedor deletado')
      await load()
    } catch {
      toast.error('Erro ao deletar fornecedor')
    }
  }

  if (loading) return <PageLoader />

  return (
    <div className="min-h-screen bg-background">
      <Header title="Fornecedores" />

      <div className="px-4 py-4 space-y-4">
        <div className="flex gap-2">
          {([
            { value: 'all', label: 'Todos' },
            { value: 'active', label: 'Ativos' },
            { value: 'inactive', label: 'Inativos' },
          ] as const).map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                filter === f.value ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {f.label} {f.value === 'all' ? `(${suppliers.length})` :
                f.value === 'active' ? `(${suppliers.filter(s => s.is_active).length})` :
                `(${suppliers.filter(s => !s.is_active).length})`}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="Nenhum fornecedor" description="Nenhum fornecedor encontrado" />
        ) : (
          <div className="space-y-3">
            {filtered.map((supplier) => (
              <div key={supplier.id} className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {supplier.logo_url ? (
                      <img src={supplier.logo_url} alt="" className="w-12 h-12 rounded-xl object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                        {supplier.store_name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-gray-800">{supplier.store_name}</p>
                      <p className="text-xs text-gray-500">{supplier.address_city}, {supplier.address_state}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    supplier.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {supplier.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                  <span>Vendas: {supplier.total_sales}</span>
                  <span>WhatsApp: {supplier.whatsapp}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggle(supplier)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
                      supplier.is_active
                        ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {supplier.is_active ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    onClick={() => handleDelete(supplier)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                  >
                    Deletar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
