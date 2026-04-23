import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import type { Profile, Buyer, Supplier } from '../types'
import { supabase } from '../lib/supabaseClient'
import { getProfile, getBuyer, getSupplier } from '../services/supabase'

interface AuthStore {
  user: User | null
  profile: Profile | null
  buyer: Buyer | null
  supplier: Supplier | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  loadProfile: (opts?: { silent?: boolean }) => Promise<void>
  setUser: (user: User | null) => void
  setSupplier: (supplier: Supplier) => void
  setBuyer: (buyer: Buyer) => void
}

// Module-level mutex: prevents concurrent loadProfile() calls from racing
// (signIn + onAuthStateChange can both trigger loadProfile simultaneously).
let loadProfileInFlight: Promise<void> | null = null

export const useAuthStore = create<AuthStore>()((set, get) => ({
  user: null,
  profile: null,
  buyer: null,
  supplier: null,
  isLoading: true,

  setUser: (user) => set({ user }),
  setSupplier: (supplier) => set({ supplier }),
  setBuyer: (buyer) => set({ buyer }),

  signIn: async (email, password) => {
    set({ isLoading: true })
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      // Load the profile. If it fails transiently (network, RLS hiccup),
      // don't force a sign-out — the session is valid. The auth state listener
      // will retry. Only treat a *confirmed null* profile as "not found".
      await get().loadProfile()
      // Re-fetch profile directly to tell transient error vs missing row apart.
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        throw new Error('Sessão expirada. Tente novamente.')
      }
      if (!get().profile) {
        // Only sign out + error if we got here with a valid session but truly no profile row.
        const profile = await getProfile(session.user.id).catch(() => undefined)
        if (profile === null) {
          await supabase.auth.signOut()
          set({ user: null, isLoading: false })
          throw new Error('Perfil não encontrado. Por favor, cadastre-se novamente.')
        }
        // profile === undefined means the fetch failed — keep session and let the app retry.
      }
    } finally {
      set({ isLoading: false })
    }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null, buyer: null, supplier: null })
  },

  loadProfile: async (opts) => {
    if (loadProfileInFlight) return loadProfileInFlight
    const silent = opts?.silent === true
    loadProfileInFlight = (async () => {
      // Only flip isLoading on non-silent (initial) loads. Background refreshes
      // triggered by onAuthStateChange must NOT remount the whole app.
      if (!silent) set({ isLoading: true })
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          set({ user: null, profile: null, buyer: null, supplier: null, isLoading: false })
          return
        }

        const user = session.user
        const profile = await getProfile(user.id)

        if (!profile) {
          set({ user, profile: null, buyer: null, supplier: null, isLoading: false })
          return
        }

        let buyer: Buyer | null = null
        let supplier: Supplier | null = null

        if (profile.role === 'buyer') {
          buyer = await getBuyer(user.id)
        } else if (profile.role === 'supplier') {
          supplier = await getSupplier(user.id)
        }

        set({ user, profile, buyer, supplier, isLoading: false })
      } catch (err) {
        // Transient errors should not forcefully sign the user out — just
        // release loading. Only an explicit signOut() clears the session.
        console.error('Erro ao carregar perfil:', err)
        set({ isLoading: false })
      }
    })()
    try {
      await loadProfileInFlight
    } finally {
      loadProfileInFlight = null
    }
  },
}))
