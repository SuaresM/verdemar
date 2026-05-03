import { NavLink, useNavigate } from 'react-router-dom'
import { BarChart2, Store, Package, ClipboardList, Users, LogOut } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { toast } from 'sonner'

export function AdminNav() {
  const navigate = useNavigate()
  const { signOut } = useAuthStore()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
    toast.success('Até logo!')
  }

  const navItems = [
    { to: '/admin/dashboard', icon: BarChart2, label: 'Painel', id: 'nav-admin-dashboard' },
    { to: '/admin/suppliers', icon: Store, label: 'Fornecedores', id: 'nav-admin-suppliers' },
    { to: '/admin/products', icon: Package, label: 'Produtos', id: 'nav-admin-products' },
    { to: '/admin/orders', icon: ClipboardList, label: 'Pedidos', id: 'nav-admin-orders' },
    { to: '/admin/team', icon: Users, label: 'Equipe', id: 'nav-admin-team' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom z-50">
      <div className="flex items-stretch justify-around max-w-lg mx-auto">
        {navItems.map(({ to, icon: Icon, label, id }) => (
          <NavLink
            key={to}
            to={to}
            id={id}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-2 px-4 flex-1 min-h-[56px] transition-colors ${
                isActive ? 'text-primary' : 'text-gray-400'
              }`
            }
          >
            <Icon size={22} strokeWidth={2} />
            <span className="text-[10px] font-semibold mt-0.5">{label}</span>
          </NavLink>
        ))}
        <button
          id="nav-admin-logout"
          onClick={handleSignOut}
          className="flex flex-col items-center justify-center py-2 px-4 flex-1 min-h-[56px] text-red-400 hover:text-red-600 transition-colors"
        >
          <LogOut size={22} strokeWidth={2} />
          <span className="text-[10px] font-semibold mt-0.5">Sair</span>
        </button>
      </div>
    </nav>
  )
}
