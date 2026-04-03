import { NavLink } from 'react-router-dom'
import { BarChart2, Package, ClipboardList, Settings } from 'lucide-react'

export function SupplierNav() {
  const navItems = [
    { to: '/supplier/dashboard', icon: BarChart2, label: 'Painel', id: 'nav-supplier-dashboard' },
    { to: '/supplier/products', icon: Package, label: 'Produtos', id: 'nav-supplier-products' },
    { to: '/supplier/orders', icon: ClipboardList, label: 'Pedidos', id: 'nav-supplier-orders' },
    { to: '/supplier/settings', icon: Settings, label: 'Loja', id: 'nav-supplier-settings' },
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
      </div>
    </nav>
  )
}
