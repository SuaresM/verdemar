import { MapPin, Clock, Truck, Flame } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Supplier } from '../../types'
import { formatCurrency, getDeliveryDaysLabel } from '../../utils'
import { ImageSkeleton } from '../shared/ImageSkeleton'

interface SupplierCardProps {
  supplier: Supplier
}

export function SupplierCard({ supplier }: SupplierCardProps) {
  return (
    <Link to={`/supplier/${supplier.id}`}>
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden active:scale-[0.99] transition-transform">
        <div className="flex items-center gap-3 p-4">
          <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
            {supplier.logo_url ? (
              <ImageSkeleton
                src={supplier.logo_url}
                alt={supplier.store_name}
                aspectRatio="aspect-square"
                className="w-full h-full"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-xl">
                {supplier.store_name[0]}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 truncate">{supplier.store_name}</p>

            <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
              <MapPin size={11} />
              <span>{supplier.address_city}, {supplier.address_state}</span>
            </div>

            <div className="flex flex-wrap gap-2 mt-1.5">
              {supplier.delivery_days.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <Truck size={11} />
                  {getDeliveryDaysLabel(supplier.delivery_days)}
                </span>
              )}
              {(supplier.min_order_value || supplier.min_order_quantity) && (
                <span className="text-xs text-gray-500">
                  {supplier.min_order_value
                    ? `Mín. ${formatCurrency(supplier.min_order_value)}`
                    : `Mín. ${supplier.min_order_quantity} itens`}
                </span>
              )}
            </div>
          </div>

          {supplier.total_sales > 0 && (
            <div className="flex flex-col items-center text-accent">
              <Flame size={16} />
              <span className="text-xs font-bold">{supplier.total_sales}</span>
              <span className="text-[9px] text-gray-400">pedidos</span>
            </div>
          )}
        </div>

        {supplier.delivery_hours_start && supplier.delivery_hours_end && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Clock size={11} />
              <span>Entrega: {supplier.delivery_hours_start} às {supplier.delivery_hours_end}</span>
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}
