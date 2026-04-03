import { NavLink } from 'react-router-dom'
import { Home, Search, ShoppingCart, User } from 'lucide-react'
import { useCartStore } from '../../stores/cartStore'

export function BuyerNav() {
  const sections = useCartStore((s) => s.sections)
  const itemCount = sections.reduce(
    (total, section) => total + section.items.reduce((sum, item) => sum + item.quantity, 0),
    0
  )

  const navItems = [
    { to: '/', icon: Home, label: 'Início', exact: true, id: 'nav-home' },
    { to: '/search', icon: Search, label: 'Buscar', exact: false, id: 'nav-search' },
    { to: '/cart', icon: ShoppingCart, label: 'Carrinho', exact: false, id: 'nav-cart' },
    { to: '/profile', icon: User, label: 'Perfil', exact: false, id: 'nav-profile' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom z-50">
      <div className="flex items-stretch justify-around max-w-lg mx-auto">
        {navItems.map(({ to, icon: Icon, label, exact, id }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            id={id}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-2 px-4 flex-1 min-h-[56px] transition-colors ${
                isActive ? 'text-primary' : 'text-gray-400'
              }`
            }
          >
            <div className="relative">
              <Icon size={22} strokeWidth={2} />
              {to === '/cart' && itemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-accent text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold mt-0.5">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
