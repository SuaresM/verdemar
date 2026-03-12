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
  loadProfile: () => Promise<void>
  setUser: (user: User | null) => void
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  user: null,
  profile: null,
  buyer: null,
  supplier: null,
  isLoading: true,

  setUser: (user) => set({ user }),

  signIn: async (email, password) => {
    set({ isLoading: true })
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      await get().loadProfile()
    } finally {
      set({ isLoading: false })
    }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null, buyer: null, supplier: null })
  },

  loadProfile: async () => {
    set({ isLoading: true })
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
    } catch {
      set({ isLoading: false })
    }
  },
}))
