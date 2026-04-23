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
      // loadProfile is the single authority. If the profile fetch throws
      // transiently (network, RLS hiccup, auth lock timeout), we keep the
      // session and let the auth-state listener retry — do NOT force signOut.
      // The layout components will either render the app (profile loaded)
      // or redirect to /login (profile still null) on the next tick.
      await get().loadProfile()
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
