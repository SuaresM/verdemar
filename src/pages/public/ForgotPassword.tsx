import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabaseClient'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
})

type FormData = z.infer<typeof schema>

export default function ForgotPassword() {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async ({ email }: FormData) => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setSent(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar e-mail')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link to="/login" className="flex items-center gap-2 text-sm text-gray-500 mb-8 hover:text-primary transition-colors">
            <ArrowLeft size={16} />
            Voltar ao login
          </Link>

          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Mail size={28} className="text-primary" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Esqueci minha senha</h1>
              <p className="text-sm text-gray-500 mt-1">
                {sent
                  ? 'Verifique seu e-mail para continuar.'
                  : 'Informe seu e-mail e enviaremos um link de redefinição.'}
              </p>
            </div>

            {sent ? (
              <div className="text-center space-y-4">
                <div className="text-4xl">📬</div>
                <p className="text-sm text-gray-600">
                  Link enviado! Verifique também a caixa de spam.
                </p>
                <Link
                  to="/login"
                  className="block w-full bg-primary text-white font-bold py-3 rounded-xl text-center"
                >
                  Voltar ao login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">E-mail</label>
                  <input
                    {...register('email')}
                    type="email"
                    placeholder="seu@email.com"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                  {errors.email && (
                    <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : 'Enviar link de redefinição'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
