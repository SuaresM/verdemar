import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Camera } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '../../stores/authStore'
import { createProduct, updateProduct, getProductById } from '../../services/supabase'
import { uploadProductImage } from '../../services/storage'
import { Header } from '../../components/layout/Header'
import { PageLoader } from '../../components/shared/LoadingSpinner'
import { calculatePricePerKg, formatCurrency } from '../../utils'

const schema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  description: z.string().optional(),
  category: z.enum(['fruit', 'vegetable', 'greens', 'other']),
  sale_unit: z.enum(['box', 'kg', 'unit']),
  box_weight_kg: z.string().optional(),
  box_unit_quantity: z.string().optional(),
  box_price: z.string().optional(),
  price_per_kg: z.string().optional(),
  price_per_unit: z.string().optional(),
  unit_description: z.string().optional(),
  is_available: z.boolean(),
  is_featured: z.boolean(),
})

type FormData = z.infer<typeof schema>

export default function ProductForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const { supplier } = useAuthStore()
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [existingImageUrl, setExistingImageUrl] = useState<string>('')

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: 'fruit',
      sale_unit: 'box',
      is_available: true,
      is_featured: false,
    },
  })

  const saleUnit = watch('sale_unit')
  const boxPrice = watch('box_price')
  const boxWeightKg = watch('box_weight_kg')

  const pricePerKgPreview =
    saleUnit === 'box' && boxPrice && boxWeightKg
      ? calculatePricePerKg(parseFloat(boxPrice), parseFloat(boxWeightKg))
      : null

  useEffect(() => {
    if (!isEdit || !id) return
    getProductById(id).then((product) => {
      if (!product) return
      setExistingImageUrl(product.image_url || '')
      setLoading(false)
    })
  }, [id, isEdit])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const onSubmit = async (data: FormData) => {
    if (!supplier) return
    setSaving(true)
    try {
      let image_url = existingImageUrl
      if (imageFile) {
        image_url = await uploadProductImage(imageFile, supplier.id)
      }

      const productData = {
        supplier_id: supplier.id,
        name: data.name,
        description: data.description,
        category: data.category,
        image_url: image_url || undefined,
        sale_unit: data.sale_unit,
        box_weight_kg: data.box_weight_kg ? parseFloat(data.box_weight_kg) : undefined,
        box_unit_quantity: data.box_unit_quantity ? parseInt(data.box_unit_quantity) : undefined,
        box_price: data.box_price ? parseFloat(data.box_price) : undefined,
        price_per_kg: data.price_per_kg ? parseFloat(data.price_per_kg) : undefined,
        price_per_unit: data.price_per_unit ? parseFloat(data.price_per_unit) : undefined,
        unit_description: data.unit_description,
        is_available: data.is_available,
        is_featured: data.is_featured,
      }

      if (isEdit && id) {
        await updateProduct(id, productData)
        toast.success('Produto atualizado!')
      } else {
        await createProduct(productData)
        toast.success('Produto criado!')
      }
      navigate('/supplier/products')
    } catch (err) {
      toast.error('Erro ao salvar produto')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoader />

  return (
    <div className="min-h-screen bg-background">
      <Header title={isEdit ? 'Editar Produto' : 'Novo Produto'} showBack />

      <form onSubmit={handleSubmit(onSubmit)} className="px-4 py-4 space-y-4 pb-24">
        {/* Image upload */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="font-bold text-gray-700 mb-3">Foto do Produto</p>
          <label className="cursor-pointer block">
            <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            <div className="relative aspect-[4/3] bg-gray-50 rounded-2xl overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-200">
              {imagePreview || existingImageUrl ? (
                <img
                  src={imagePreview || existingImageUrl}
                  alt="preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <Camera size={40} />
                  <span className="text-sm">Toque para adicionar foto</span>
                </div>
              )}
              <div className="absolute bottom-3 right-3 bg-primary text-white rounded-full p-2">
                <Camera size={16} />
              </div>
            </div>
          </label>
        </div>

        {/* Basic info */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
          <p className="font-bold text-gray-700">Informações</p>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Nome *</label>
            <input {...register('name')} placeholder="Ex: Banana Prata" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            {errors.name && <p className="text-danger text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Categoria *</label>
            <select {...register('category')} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="fruit">🍎 Fruta</option>
              <option value="vegetable">🥕 Legume</option>
              <option value="greens">🥬 Verdura</option>
              <option value="other">🌾 Outro</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Descrição</label>
            <textarea {...register('description')} placeholder="Descrição opcional..." className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" rows={2} />
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
          <p className="font-bold text-gray-700">Preço e Unidade</p>

          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-2">Unidade de venda *</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'box', label: '📦 Por Caixa' },
                { value: 'kg', label: '⚖️ Por Kg' },
                { value: 'unit', label: '🔢 Por Unidade' },
              ] as const).map((opt) => (
                <label key={opt.value} className="cursor-pointer">
                  <input {...register('sale_unit')} type="radio" value={opt.value} className="sr-only" />
                  <div className={`text-center py-3 px-2 rounded-xl text-xs font-semibold border-2 transition-colors ${
                    saleUnit === opt.value ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-500'
                  }`}>
                    {opt.label}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {saleUnit === 'box' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Peso da caixa (kg)</label>
                  <input {...register('box_weight_kg')} type="number" step="0.001" placeholder="Ex: 20" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Qtd. unidades</label>
                  <input {...register('box_unit_quantity')} type="number" placeholder="Ex: 24" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Preço da caixa (R$) *</label>
                <input {...register('box_price')} type="number" step="0.01" placeholder="Ex: 45.00" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              {pricePerKgPreview !== null && pricePerKgPreview > 0 && (
                <div className="bg-primary/5 rounded-xl p-3">
                  <p className="text-xs text-gray-500">Preço por kg (calculado)</p>
                  <p className="text-lg font-bold text-primary">{formatCurrency(pricePerKgPreview)}/kg</p>
                </div>
              )}
            </div>
          )}

          {saleUnit === 'kg' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Preço por kg (R$) *</label>
              <input {...register('price_per_kg')} type="number" step="0.01" placeholder="Ex: 3.50" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          )}

          {saleUnit === 'unit' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Preço por unidade (R$) *</label>
                <input {...register('price_per_unit')} type="number" step="0.01" placeholder="Ex: 2.00" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Descrição da unidade</label>
                <input {...register('unit_description')} placeholder="Ex: maço, dúzia, pé" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
          )}
        </div>

        {/* Toggles */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <Controller
            name="is_available"
            control={control}
            render={({ field }) => (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">Disponível</p>
                  <p className="text-xs text-gray-500">Produto visível aos compradores</p>
                </div>
                <button
                  type="button"
                  onClick={() => field.onChange(!field.value)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${field.value ? 'bg-primary' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${field.value ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>
            )}
          />
          <Controller
            name="is_featured"
            control={control}
            render={({ field }) => (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">Destaque</p>
                  <p className="text-xs text-gray-500">Aparece na seção "Mais Vendidos"</p>
                </div>
                <button
                  type="button"
                  onClick={() => field.onChange(!field.value)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${field.value ? 'bg-accent' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${field.value ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>
            )}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-primary text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : isEdit ? 'Salvar Alterações' : 'Criar Produto'}
        </button>
      </form>
    </div>
  )
}
