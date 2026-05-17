import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, MessageCircle, Building, MapPin, Edit2, Save, X, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '../../stores/authStore'
import { updateBuyer } from '../../services/supabase'
import { Header } from '../../components/layout/Header'
import { openSupportWhatsApp } from '../../services/whatsapp'
import { formatCNPJ, formatPhone } from '../../utils'
import { supabase } from '../../lib/supabaseClient'
import { CITIES } from '../../constants/cities'

export default function Profile() {
  const { buyer, profile, signOut, setBuyer } = useAuthStore()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPwModal, setShowPwModal] = useState(false)
  const [pwForm, setPwForm] = useState({ password: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
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
      setBuyer({ ...buyer, ...form })
      toast.success('Dados atualizados!')
      setEditing(false)
    } catch {
      toast.error('Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleSavePassword = async () => {
    if (pwForm.password.length < 8) {
      toast.error('Senha deve ter no mínimo 8 caracteres')
      return
    }
    if (pwForm.password !== pwForm.confirm) {
      toast.error('As senhas não coincidem')
      return
    }
    setPwSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: pwForm.password })
      if (error) throw error
      toast.success('Senha alterada com sucesso!')
      setShowPwModal(false)
      setPwForm({ password: '', confirm: '' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao alterar senha')
    } finally {
      setPwSaving(false)
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
    placeholder,
  }: {
    label: string
    field: keyof typeof form
    placeholder?: string
  }) => (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <input
        value={form[field]}
        onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
        placeholder={placeholder}
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
              {/* Bairro: free-text for the specific sub-neighborhood within the RA */}
              <Input
                label="Bairro (opcional)"
                field="address_neighborhood"
                placeholder="Ex: Asa Sul, Setor Comercial..."
              />
              {/* address_city stores the Região Administrativa — delivery matching uses this field */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Região Administrativa (RA)</label>
                <select
                  value={form.address_city}
                  onChange={(e) => {
                    const selected = CITIES.find((c) => c.city === e.target.value)
                    setForm((prev) => ({ ...prev, address_city: e.target.value, address_state: selected?.state ?? '' }))
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                >
                  <option value="">Selecione a RA...</option>
                  {CITIES.map((c) => (
                    <option key={`${c.city}-${c.state}`} value={c.city}>{c.city} — {c.state}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Estado</label>
                <input
                  value={form.address_state}
                  readOnly
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-500 focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm text-gray-700">
              <p>{buyer?.address_street}, {buyer?.address_number}{buyer?.address_complement ? `, ${buyer.address_complement}` : ''}</p>
              <p>
                {buyer?.address_neighborhood ? `${buyer.address_neighborhood} — ` : ''}
                {buyer?.address_city}/{buyer?.address_state}
              </p>
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
            onClick={() => setShowPwModal(true)}
            className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 text-left"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Lock size={20} className="text-blue-600" />
            </div>
            <p className="font-bold text-gray-700">Alterar senha</p>
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

      {/* Password modal */}
      {showPwModal && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setShowPwModal(false)}>
          <div className="bg-white rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <h3 className="text-xl font-extrabold text-gray-900 mb-4">Alterar senha</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Nova senha</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={pwForm.password}
                  onChange={(e) => setPwForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Confirmar nova senha</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <button
                type="button"
                onClick={handleSavePassword}
                disabled={pwSaving}
                className="w-full bg-primary text-white font-bold py-4 rounded-2xl disabled:opacity-60 flex items-center justify-center"
              >
                {pwSaving ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : 'Salvar'}
              </button>
              <button type="button" onClick={() => setShowPwModal(false)} className="w-full py-3 text-gray-500 font-semibold">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
