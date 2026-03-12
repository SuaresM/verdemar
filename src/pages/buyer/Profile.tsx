import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, MessageCircle, User, Building, MapPin, Phone, Clock, Edit2, Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '../../stores/authStore'
import { updateBuyer } from '../../services/supabase'
import { Header } from '../../components/layout/Header'
import { openSupportWhatsApp } from '../../services/whatsapp'
import { formatCNPJ, formatPhone } from '../../utils'

export default function Profile() {
  const { buyer, profile, signOut } = useAuthStore()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    company_name: buyer?.company_name || '',
    contact_phone: buyer?.contact_phone || '',
    business_hours: buyer?.business_hours || '',
    address_street: buyer?.address_street || '',
    address_number: buyer?.address_number || '',
    address_complement: buyer?.address_complement || '',
    address_neighborhood: buyer?.address_neighborhood || '',
    address_city: buyer?.address_city || '',
    address_state: buyer?.address_state || '',
    address_zip: buyer?.address_zip || '',
  })

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
    toast.success('Até logo!')
  }

  const handleSave = async () => {
    if (!buyer) return
    setSaving(true)
    try {
      await updateBuyer(buyer.id, form)
      toast.success('Dados atualizados!')
      setEditing(false)
    } catch {
      toast.error('Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const Field = ({ label, value }: { label: string; value: string }) => (
    <div>
      <p className="text-xs text-gray-400 font-semibold">{label}</p>
      <p className="text-sm font-semibold text-gray-800 mt-0.5">{value || '-'}</p>
    </div>
  )

  const Input = ({
    label,
    field,
  }: {
    label: string
    field: keyof typeof form
  }) => (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <input
        value={form[field]}
        onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  )

  return (
    <div className="min-h-screen">
      <Header
        title="Meu Perfil"
        right={
          editing ? (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="p-2 text-gray-400">
                <X size={18} />
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1 bg-primary text-white text-sm font-semibold px-3 py-1.5 rounded-xl"
              >
                <Save size={14} />
                Salvar
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="p-2 text-primary">
              <Edit2 size={18} />
            </button>
          )
        }
      />

      <div className="px-4 py-4 space-y-4">
        {/* Avatar */}
        <div className="flex flex-col items-center py-6 bg-white rounded-2xl shadow-sm">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary text-3xl font-bold mb-3">
            {profile?.full_name?.[0] || 'U'}
          </div>
          <p className="font-extrabold text-gray-900 text-lg">{profile?.full_name}</p>
          <p className="text-sm text-gray-500 mt-0.5">{buyer?.email}</p>
        </div>

        {/* Company info */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <Building size={16} className="text-primary" />
            <p className="font-bold text-gray-700">Empresa</p>
          </div>
          {editing ? (
            <div className="space-y-3">
              <Input label="Razão Social" field="company_name" />
              <Input label="Horário de Funcionamento" field="business_hours" />
              <Input label="Telefone de Contato" field="contact_phone" />
            </div>
          ) : (
            <div className="space-y-3">
              <Field label="Razão Social" value={buyer?.company_name || ''} />
              <Field label="CNPJ" value={buyer?.cnpj ? formatCNPJ(buyer.cnpj) : ''} />
              {buyer?.state_registration && <Field label="Inscrição Estadual" value={buyer.state_registration} />}
              <Field label="Horário" value={buyer?.business_hours || ''} />
              <Field label="Telefone" value={buyer?.contact_phone ? formatPhone(buyer.contact_phone) : ''} />
            </div>
          )}
        </div>

        {/* Address */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <MapPin size={16} className="text-primary" />
            <p className="font-bold text-gray-700">Endereço de Entrega</p>
          </div>
          {editing ? (
            <div className="space-y-3">
              <Input label="CEP" field="address_zip" />
              <Input label="Rua" field="address_street" />
              <div className="grid grid-cols-2 gap-2">
                <Input label="Número" field="address_number" />
                <Input label="Complemento" field="address_complement" />
              </div>
              <Input label="Bairro" field="address_neighborhood" />
              <div className="grid grid-cols-2 gap-2">
                <Input label="Cidade" field="address_city" />
                <Input label="Estado" field="address_state" />
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm text-gray-700">
              <p>{buyer?.address_street}, {buyer?.address_number}{buyer?.address_complement ? `, ${buyer.address_complement}` : ''}</p>
              <p>{buyer?.address_neighborhood} - {buyer?.address_city}/{buyer?.address_state}</p>
              <p>CEP: {buyer?.address_zip}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={openSupportWhatsApp}
            className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 text-left"
          >
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <MessageCircle size={20} className="text-green-600" />
            </div>
            <div>
              <p className="font-bold text-gray-900">Falar com Suporte</p>
              <p className="text-xs text-gray-500">WhatsApp</p>
            </div>
          </button>

          <button
            onClick={handleSignOut}
            className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 text-left"
          >
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <LogOut size={20} className="text-danger" />
            </div>
            <p className="font-bold text-danger">Sair da conta</p>
          </button>
        </div>
      </div>
    </div>
  )
}
