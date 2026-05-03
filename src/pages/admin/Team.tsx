import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { getAllProfiles, updateUserRole } from '../../services/supabase'
import { Header } from '../../components/layout/Header'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { EmptyState } from '../../components/shared/EmptyState'
import type { Profile, UserRole } from '../../types'

const ROLE_LABELS: Record<UserRole, string> = {
  buyer: 'Comprador',
  supplier: 'Fornecedor',
  admin: 'Admin',
}

const ROLE_COLORS: Record<UserRole, string> = {
  buyer: 'bg-blue-100 text-blue-700',
  supplier: 'bg-green-100 text-green-700',
  admin: 'bg-purple-100 text-purple-700',
}

export default function AdminTeam() {
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)

  const load = async (reset = false) => {
    const currentPage = reset ? 0 : page
    if (!reset) setLoadingMore(true)
    try {
      const { data, hasMore: more } = await getAllProfiles(currentPage)
      setProfiles(reset ? data : (prev) => [...prev, ...data])
      setHasMore(more)
      if (!reset) setPage((p) => p + 1)
    } catch {
      toast.error('Erro ao carregar usuários')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => { load(true) }, [])

  const handleRoleChange = async (userId: string, role: UserRole) => {
    setUpdating(userId)
    try {
      await updateUserRole(userId, role)
      setProfiles((prev) => prev.map((p) => p.id === userId ? { ...p, role } : p))
      toast.success('Função atualizada')
    } catch {
      toast.error('Erro ao atualizar função')
    } finally {
      setUpdating(null)
    }
  }

  if (loading) return <PageLoader />

  return (
    <div className="min-h-screen bg-background">
      <Header title="Equipe" />

      <div className="px-4 py-4 space-y-3">
        {profiles.length === 0 ? (
          <EmptyState title="Nenhum usuário" description="Nenhum usuário cadastrado ainda" />
        ) : (
          <>
            {profiles.map((profile) => (
              <div key={profile.id} className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-bold text-gray-800">{profile.full_name || '—'}</p>
                    <p className="text-xs text-gray-400">{profile.phone || '—'}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ROLE_COLORS[profile.role]}`}>
                    {ROLE_LABELS[profile.role]}
                  </span>
                </div>

                <div className="flex gap-2">
                  {(['buyer', 'supplier', 'admin'] as UserRole[]).map((role) => (
                    <button
                      key={role}
                      disabled={profile.role === role || updating === profile.id}
                      onClick={() => handleRoleChange(profile.id, role)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-colors disabled:opacity-40 ${
                        profile.role === role
                          ? 'bg-gray-200 text-gray-500 cursor-default'
                          : 'bg-gray-100 text-gray-600 hover:bg-primary/10 hover:text-primary'
                      }`}
                    >
                      {ROLE_LABELS[role]}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {hasMore && (
              <button
                onClick={() => load()}
                disabled={loadingMore}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 disabled:opacity-60"
              >
                {loadingMore ? 'Carregando...' : 'Carregar mais'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
