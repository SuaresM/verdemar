import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ChevronRight, Store, ShoppingBag, ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

const DAYS = [
  { value: 'monday', label: 'Seg' },
  { value: 'tuesday', label: 'Ter' },
  { value: 'wednesday', label: 'Qua' },
  { value: 'thursday', label: 'Qui' },
  { value: 'friday', label: 'Sex' },
  { value: 'saturday', label: 'Sáb' },
  { value: 'sunday', label: 'Dom' },
]

const baseSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  full_name: z.string().min(2, 'Nome obrigatório'),
  phone: z.string().min(10, 'Telefone inválido'),
})

const buyerSchema = baseSchema.extend({
  company_name: z.string().min(2, 'Razão social obrigatória'),
  cnpj: z.string().min(14, 'CNPJ inválido'),
  state_registration: z.string().optional(),
  address_street: z.string().min(2, 'Rua obrigatória'),
  address_number: z.string().min(1, 'Número obrigatório'),
  address_complement: z.string().optional(),
  address_neighborhood: z.string().min(2, 'Bairro obrigatório'),
  address_city: z.string().min(2, 'Cidade obrigatória'),
  address_state: z.string().min(2, 'Estado obrigatório'),
  address_zip: z.string().min(8, 'CEP inválido'),
  business_hours: z.string().min(2, 'Horário obrigatório'),
  contact_phone: z.string().min(10, 'Telefone de contato inválido'),
})

const supplierSchema = baseSchema.extend({
  store_name: z.string().min(2, 'Nome da loja obrigatório'),
  whatsapp: z.string().min(10, 'WhatsApp inválido'),
  address_city: z.string().min(2, 'Cidade obrigatória'),
  address_state: z.string().min(2, 'Estado obrigatório'),
  description: z.string().optional(),
  min_order_value: z.string().optional(),
  min_order_quantity: z.string().optional(),
  delivery_hours_start: z.string().min(1, 'Horário de início obrigatório'),
  delivery_hours_end: z.string().min(1, 'Horário de fim obrigatório'),
})

type BuyerForm = z.infer<typeof buyerSchema>
type SupplierForm = z.infer<typeof supplierSchema>

export default function Register() {
  const [step, setStep] = useState<1 | 2>(1)
  const [role, setRole] = useState<'buyer' | 'supplier' | null>(null)
  const [loading, setLoading] = useState(false)
  const [deliveryDays, setDeliveryDays] = useState<string[]>([])
  const navigate = useNavigate()

  const buyerForm = useForm<BuyerForm>({ resolver: zodResolver(buyerSchema) })
  const supplierForm = useForm<SupplierForm>({ resolver: zodResolver(supplierSchema) })

  const toggleDay = (day: string) => {
    setDeliveryDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const handleRoleSelect = (r: 'buyer' | 'supplier') => {
    setRole(r)
    setStep(2)
  }

  const onSubmitBuyer = async (data: BuyerForm) => {
    setLoading(true)
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            role: 'buyer',
            full_name: data.full_name,
            phone: data.phone.replace(/\D/g, ''),
            registration_data: JSON.stringify({
              company_name: data.company_name,
              cnpj: data.cnpj.replace(/\D/g, ''),
              state_registration: data.state_registration || null,
              email: data.email,
              address_street: data.address_street,
              address_number: data.address_number,
              address_complement: data.address_complement || null,
              address_neighborhood: data.address_neighborhood,
              address_city: data.address_city,
              address_state: data.address_state,
              address_zip: data.address_zip.replace(/\D/g, ''),
              business_hours: data.business_hours,
              contact_phone: data.contact_phone.replace(/\D/g, ''),
            }),
          },
        },
      })
      if (error) throw error

      if (authData.session) {
        toast.success('Cadastro realizado com sucesso!')
        navigate('/')
      } else {
        toast.success('Conta criada! Verifique seu e-mail para confirmar o cadastro.')
        navigate('/login')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cadastrar')
    } finally {
      setLoading(false)
    }
  }

  const onSubmitSupplier = async (data: SupplierForm) => {
    if (deliveryDays.length === 0) {
      toast.error('Selecione ao menos um dia de entrega')
      return
    }
    setLoading(true)
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            role: 'supplier',
            full_name: data.full_name,
            phone: data.phone.replace(/\D/g, ''),
            registration_data: JSON.stringify({
              store_name: data.store_name,
              description: data.description || null,
              whatsapp: data.whatsapp.replace(/\D/g, ''),
              min_order_value: data.min_order_value || null,
              min_order_quantity: data.min_order_quantity || null,
              delivery_days: deliveryDays,
              delivery_hours_start: data.delivery_hours_start,
              delivery_hours_end: data.delivery_hours_end,
              address_city: data.address_city,
              address_state: data.address_state,
            }),
          },
        },
      })
      if (error) throw error

      if (authData.session) {
        toast.success('Cadastro realizado com sucesso!')
        navigate('/supplier/dashboard')
      } else {
        toast.success('Conta criada! Verifique seu e-mail para confirmar o cadastro.')
        navigate('/login')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cadastrar')
    } finally {
      setLoading(false)
    }
  }

  const InputField = ({
    label,
    error,
    required,
    ...props
  }: { label: string; error?: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <input
        {...props}
        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
      />
      {error && <p className="text-danger text-xs mt-1">{error}</p>}
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3 z-40">
        {step === 2 ? (
          <button onClick={() => setStep(1)} className="p-2 -ml-2">
            <ArrowLeft size={20} />
          </button>
        ) : (
          <div className="text-xl font-extrabold text-primary">VerdeMar</div>
        )}
        <span className="text-sm font-semibold text-gray-500">
          {step === 1 ? 'Criar conta' : role === 'buyer' ? 'Dados do Comprador' : 'Dados do Fornecedor'}
        </span>
      </header>

      <div className="px-4 py-6 max-w-lg mx-auto">
        {/* Step 1 - Role selection */}
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Como você quer usar o VerdeMar?</h2>
            <p className="text-gray-500 text-sm mb-8">Escolha o seu perfil para continuar</p>

            <div className="space-y-4">
              <button
                onClick={() => handleRoleSelect('buyer')}
                className="w-full bg-white rounded-2xl shadow-sm p-6 flex items-center gap-4 text-left active:scale-[0.98] transition-transform border-2 border-transparent hover:border-primary"
              >
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <ShoppingBag size={28} className="text-primary" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-lg">Sou Comprador</p>
                  <p className="text-sm text-gray-500">Quero comprar hortifrúti no atacado</p>
                </div>
                <ChevronRight size={20} className="text-gray-400 ml-auto" />
              </button>

              <button
                onClick={() => handleRoleSelect('supplier')}
                className="w-full bg-white rounded-2xl shadow-sm p-6 flex items-center gap-4 text-left active:scale-[0.98] transition-transform border-2 border-transparent hover:border-primary"
              >
                <div className="w-14 h-14 bg-accent/20 rounded-2xl flex items-center justify-center">
                  <Store size={28} className="text-accent" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-lg">Sou Fornecedor</p>
                  <p className="text-sm text-gray-500">Quero vender hortifrúti no atacado</p>
                </div>
                <ChevronRight size={20} className="text-gray-400 ml-auto" />
              </button>
            </div>

            <p className="text-center text-sm text-gray-500 mt-8">
              Já tem conta?{' '}
              <Link to="/login" className="text-primary font-semibold">
                Entrar
              </Link>
            </p>
          </div>
        )}

        {/* Step 2 - Buyer form */}
        {step === 2 && role === 'buyer' && (
          <form onSubmit={buyerForm.handleSubmit(onSubmitBuyer)} className="space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
              <p className="font-bold text-gray-700 text-sm uppercase tracking-wide">Acesso</p>
              <InputField label="Nome completo" required placeholder="João Silva" error={buyerForm.formState.errors.full_name?.message} {...buyerForm.register('full_name')} />
              <InputField label="Telefone" required placeholder="(11) 99999-9999" error={buyerForm.formState.errors.phone?.message} {...buyerForm.register('phone')} />
              <InputField label="E-mail" required type="email" placeholder="joao@empresa.com" error={buyerForm.formState.errors.email?.message} {...buyerForm.register('email')} />
              <InputField label="Senha" required type="password" placeholder="Mínimo 8 caracteres" error={buyerForm.formState.errors.password?.message} {...buyerForm.register('password')} />
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
              <p className="font-bold text-gray-700 text-sm uppercase tracking-wide">Empresa</p>
              <InputField label="Razão Social" required placeholder="Empresa XYZ Ltda" error={buyerForm.formState.errors.company_name?.message} {...buyerForm.register('company_name')} />
              <InputField label="CNPJ" required placeholder="00.000.000/0000-00" error={buyerForm.formState.errors.cnpj?.message} {...buyerForm.register('cnpj')} />
              <InputField label="Inscrição Estadual" placeholder="Opcional" error={buyerForm.formState.errors.state_registration?.message} {...buyerForm.register('state_registration')} />
              <InputField label="Horário de Funcionamento" required placeholder="Seg-Sex 8h-18h" error={buyerForm.formState.errors.business_hours?.message} {...buyerForm.register('business_hours')} />
              <InputField label="Telefone de Contato" required placeholder="(11) 3333-3333" error={buyerForm.formState.errors.contact_phone?.message} {...buyerForm.register('contact_phone')} />
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
              <p className="font-bold text-gray-700 text-sm uppercase tracking-wide">Endereço de entrega</p>
              <InputField label="CEP" required placeholder="00000-000" error={buyerForm.formState.errors.address_zip?.message} {...buyerForm.register('address_zip')} />
              <InputField label="Rua" required placeholder="Rua das Flores" error={buyerForm.formState.errors.address_street?.message} {...buyerForm.register('address_street')} />
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Número" required placeholder="123" error={buyerForm.formState.errors.address_number?.message} {...buyerForm.register('address_number')} />
                <InputField label="Complemento" placeholder="Apto 1" error={buyerForm.formState.errors.address_complement?.message} {...buyerForm.register('address_complement')} />
              </div>
              <InputField label="Bairro" required placeholder="Centro" error={buyerForm.formState.errors.address_neighborhood?.message} {...buyerForm.register('address_neighborhood')} />
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Cidade" required placeholder="São Paulo" error={buyerForm.formState.errors.address_city?.message} {...buyerForm.register('address_city')} />
                <InputField label="Estado" required placeholder="SP" error={buyerForm.formState.errors.address_state?.message} {...buyerForm.register('address_state')} />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : 'Criar conta'}
            </button>
          </form>
        )}

        {/* Step 2 - Supplier form */}
        {step === 2 && role === 'supplier' && (
          <form onSubmit={supplierForm.handleSubmit(onSubmitSupplier)} className="space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
              <p className="font-bold text-gray-700 text-sm uppercase tracking-wide">Acesso</p>
              <InputField label="Nome completo" required placeholder="Maria Silva" error={supplierForm.formState.errors.full_name?.message} {...supplierForm.register('full_name')} />
              <InputField label="Telefone" required placeholder="(11) 99999-9999" error={supplierForm.formState.errors.phone?.message} {...supplierForm.register('phone')} />
              <InputField label="E-mail" required type="email" placeholder="fornecedor@email.com" error={supplierForm.formState.errors.email?.message} {...supplierForm.register('email')} />
              <InputField label="Senha" required type="password" placeholder="Mínimo 8 caracteres" error={supplierForm.formState.errors.password?.message} {...supplierForm.register('password')} />
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
              <p className="font-bold text-gray-700 text-sm uppercase tracking-wide">Loja</p>
              <InputField label="Nome da Loja" required placeholder="Hortifrúti do João" error={supplierForm.formState.errors.store_name?.message} {...supplierForm.register('store_name')} />
              <InputField label="WhatsApp" required placeholder="(11) 99999-9999" error={supplierForm.formState.errors.whatsapp?.message} {...supplierForm.register('whatsapp')} />
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Cidade" required placeholder="São Paulo" error={supplierForm.formState.errors.address_city?.message} {...supplierForm.register('address_city')} />
                <InputField label="Estado" required placeholder="SP" error={supplierForm.formState.errors.address_state?.message} {...supplierForm.register('address_state')} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Descrição</label>
                <textarea
                  {...supplierForm.register('description')}
                  placeholder="Conte sobre sua loja..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  rows={3}
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
              <p className="font-bold text-gray-700 text-sm uppercase tracking-wide">Entrega</p>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Dias de Entrega *</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
                        deliveryDays.includes(day.value)
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Horário Início" required type="time" error={supplierForm.formState.errors.delivery_hours_start?.message} {...supplierForm.register('delivery_hours_start')} />
                <InputField label="Horário Fim" required type="time" error={supplierForm.formState.errors.delivery_hours_end?.message} {...supplierForm.register('delivery_hours_end')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Pedido mínimo (R$)" type="number" placeholder="Ex: 200" error={supplierForm.formState.errors.min_order_value?.message} {...supplierForm.register('min_order_value')} />
                <InputField label="Pedido mínimo (itens)" type="number" placeholder="Ex: 10" error={supplierForm.formState.errors.min_order_quantity?.message} {...supplierForm.register('min_order_quantity')} />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : 'Criar conta'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
