import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Camera, MessageCircle, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { updateSupplier } from '../../services/supabase'
import { uploadSupplierLogo, uploadSupplierBanner } from '../../services/storage'
import { Header } from '../../components/layout/Header'
import { openSupportWhatsApp } from '../../services/whatsapp'

const DAYS = [
  { value: 'monday', label: 'Seg' },
  { value: 'tuesday', label: 'Ter' },
  { value: 'wednesday', label: 'Qua' },
  { value: 'thursday', label: 'Qui' },
  { value: 'friday', label: 'Sex' },
  { value: 'saturday', label: 'Sáb' },
  { value: 'sunday', label: 'Dom' },
]

const schema = z.object({
  store_name: z.string().min(2, 'Nome obrigatório'),
  whatsapp: z.string().min(10, 'WhatsApp inválido'),
  address_city: z.string().min(2, 'Cidade obrigatória'),
  address_state: z.string().min(2, 'Estado obrigatório'),
  description: z.string().optional(),
  delivery_hours_start: z.string().min(1, 'Obrigatório'),
  delivery_hours_end: z.string().min(1, 'Obrigatório'),
  min_order_value: z.string().optional(),
  min_order_quantity: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function StoreSettings() {
  const { supplier, signOut, setSupplier } = useAuthStore()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [deliveryDays, setDeliveryDays] = useState<string[]>(supplier?.delivery_days || [])
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState(supplier?.logo_url || '')
  const [bannerPreview, setBannerPreview] = useState(supplier?.banner_url || '')

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      store_name: supplier?.store_name || '',
      whatsapp: supplier?.whatsapp || '',
      address_city: supplier?.address_city || '',
      address_state: supplier?.address_state || '',
      description: supplier?.description || '',
      delivery_hours_start: supplier?.delivery_hours_start || '',
      delivery_hours_end: supplier?.delivery_hours_end || '',
      min_order_value: supplier?.min_order_value?.toString() || '',
      min_order_quantity: supplier?.min_order_quantity?.toString() || '',
    },
  })

  const toggleDay = (day: string) => {
    setDeliveryDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBannerFile(file)
    setBannerPreview(URL.createObjectURL(file))
  }

  const onSubmit = async (data: FormData) => {
    if (!supplier) return
    if (deliveryDays.length === 0) {
      toast.error('Selecione ao menos um dia de entrega')
      return
    }
    setSaving(true)
    try {
      let logo_url = supplier.logo_url
      let banner_url = supplier.banner_url

      if (logoFile) logo_url = await uploadSupplierLogo(logoFile, supplier.id)
      if (bannerFile) banner_url = await uploadSupplierBanner(bannerFile, supplier.id)

      const updates = {
        store_name: data.store_name,
        whatsapp: data.whatsapp.replace(/\D/g, ''),
        address_city: data.address_city,
        address_state: data.address_state,
        description: data.description,
        delivery_days: deliveryDays,
        delivery_hours_start: data.delivery_hours_start,
        delivery_hours_end: data.delivery_hours_end,
        min_order_value: data.min_order_value ? parseFloat(data.min_order_value) : undefined,
        min_order_quantity: data.min_order_quantity ? parseInt(data.min_order_quantity) : undefined,
        logo_url: logo_url || undefined,
        banner_url: banner_url || undefined,
      }

      await updateSupplier(supplier.id, updates)

      // Mirror the persisted changes into the auth store so the UI shows the
      // new logo/banner (and other fields) without needing a page reload.
      setSupplier({ ...supplier, ...updates })

      // Clear the pending files so we don't re-upload on the next save and
      // swap the blob preview for the just-uploaded public URL.
      setLogoFile(null)
      setBannerFile(null)
      if (logo_url) setLogoPreview(logo_url)
      if (banner_url) setBannerPreview(banner_url)

      toast.success('Loja atualizada!')
    } catch (err) {
      console.error('Erro ao salvar loja:', err)
      toast.error('Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const InputField = ({
    label,
    error,
    ...props
  }: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <label className="block text-sm font-semibold text-gray-600 mb-1">{label}</label>
      <input {...props} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
      {error && <p className="text-danger text-xs mt-1">{error}</p>}
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <Header title="Configurações da Loja" />

      <form onSubmit={handleSubmit(onSubmit)} className="px-4 py-4 space-y-4 pb-24">
        {/* Images */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* Banner */}
          <label className="cursor-pointer block relative h-28 bg-gray-100">
            <input type="file" accept="image/*" onChange={handleBannerChange} className="hidden" />
            {bannerPreview ? (
              <img src={bannerPreview} alt="banner" className="w-full h-full object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">Toque para adicionar banner</div>
            )}
            <div className="absolute bottom-2 right-2 bg-primary text-white rounded-full p-1.5">
              <Camera size={14} />
            </div>
          </label>

          {/* Logo */}
          <div className="px-4 pb-4 -mt-8">
            <label className="cursor-pointer inline-block">
              <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
              <div className="relative w-16 h-16 rounded-full border-4 border-white bg-gray-100 overflow-hidden shadow-md">
                {logoPreview ? (
                  <img src={logoPreview} alt="logo" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center w-full h-full text-gray-400 text-xs text-center">Logo</div>
                )}
                <div className="absolute bottom-0 right-0 bg-primary text-white rounded-full p-1">
                  <Camera size={10} />
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Basic info */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
          <p className="font-bold text-gray-700">Informações da Loja</p>
          <InputField label="Nome da Loja *" placeholder="Hortifrúti do João" error={errors.store_name?.message} {...register('store_name')} />
          <InputField label="WhatsApp *" placeholder="(11) 99999-9999" error={errors.whatsapp?.message} {...register('whatsapp')} />
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Cidade *" placeholder="São Paulo" error={errors.address_city?.message} {...register('address_city')} />
            <InputField label="Estado *" placeholder="SP" error={errors.address_state?.message} {...register('address_state')} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Descrição</label>
            <textarea {...register('description')} placeholder="Sobre sua loja..." className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" rows={3} />
          </div>
        </div>

        {/* Delivery */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
          <p className="font-bold text-gray-700">Entrega</p>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-2">Dias de Entrega *</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
                    deliveryDays.includes(day.value) ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Início" type="time" error={errors.delivery_hours_start?.message} {...register('delivery_hours_start')} />
            <InputField label="Fim" type="time" error={errors.delivery_hours_end?.message} {...register('delivery_hours_end')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Mínimo (R$)" type="number" placeholder="Ex: 200" error={errors.min_order_value?.message} {...register('min_order_value')} />
            <InputField label="Mínimo (itens)" type="number" placeholder="Ex: 10" error={errors.min_order_quantity?.message} {...register('min_order_quantity')} />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-primary text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : 'Salvar Configurações'}
        </button>

        {/* Support and signout */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={openSupportWhatsApp}
            className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <MessageCircle size={20} className="text-green-600" />
            </div>
            <p className="font-bold text-gray-900">Falar com Suporte</p>
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <LogOut size={20} className="text-danger" />
            </div>
            <p className="font-bold text-danger">Sair da conta</p>
          </button>
        </div>
      </form>
    </div>
  )
}
