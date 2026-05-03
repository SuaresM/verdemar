import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabaseClient'

const schema = z.object({
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'As senhas não coincidem',
  path: ['confirm'],
})

type FormData = z.infer<typeof schema>

export default function ResetPassword() {
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [ready, setReady] = useState(false)
  const navigate = useNavigate()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    // Supabase injeta o token na URL após o clique no link do e-mail
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true)
      } else {
        toast.error('Link inválido ou expirado.')
        navigate('/login')
      }
    })
  }, [navigate])

  const onSubmit = async ({ password }: FormData) => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      toast.success('Senha alterada com sucesso!')
      navigate('/login')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao redefinir senha')
    } finally {
      setLoading(false)
    }
  }

  if (!ready) return null

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🔒</div>
              <h1 className="text-xl font-bold text-gray-900">Nova senha</h1>
              <p className="text-sm text-gray-500 mt-1">Escolha uma senha forte com pelo menos 8 caracteres.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {(['password', 'confirm'] as const).map((field) => (
                <div key={field}>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    {field === 'password' ? 'Nova senha' : 'Confirmar senha'}
                  </label>
                  <div className="relative">
                    <input
                      {...register(field)}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                    {field === 'password' && (
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    )}
                  </div>
                  {errors[field] && (
                    <p className="text-red-500 text-xs mt-1">{errors[field]?.message}</p>
                  )}
                </div>
              ))}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : 'Salvar nova senha'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
