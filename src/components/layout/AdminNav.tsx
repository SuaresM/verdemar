import { NavLink } from 'react-router-dom'
import { BarChart2, Store, Package, ClipboardList } from 'lucide-react'

export function AdminNav() {
  const navItems = [
    { to: '/admin/dashboard', icon: BarChart2, label: 'Painel' },
    { to: '/admin/suppliers', icon: Store, label: 'Fornecedores' },
    { to: '/admin/products', icon: Package, label: 'Produtos' },
    { to: '/admin/orders', icon: ClipboardList, label: 'Pedidos' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom z-50">
      <div className="flex items-stretch justify-around max-w-lg mx-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
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
      </div>
    </nav>
  )
}
