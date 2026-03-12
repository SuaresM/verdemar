import type { Product } from '../../types'
import { formatCurrency, calculatePricePerKg } from '../../utils'

interface PriceTagProps {
  product: Product
  size?: 'sm' | 'md' | 'lg'
}

export function PriceTag({ product, size = 'md' }: PriceTagProps) {
  const priceClass = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-2xl' : 'text-base'
  const subClass = size === 'sm' ? 'text-xs' : 'text-sm'

  if (product.sale_unit === 'box') {
    const pricePerKg = product.box_weight_kg
      ? calculatePricePerKg(product.box_price || 0, product.box_weight_kg)
      : null
    return (
      <div>
        <p className={`font-bold text-primary ${priceClass}`}>
          {formatCurrency(product.box_price || 0)}{' '}
          <span className={`font-normal text-gray-500 ${subClass}`}>/ caixa</span>
        </p>
        {product.box_weight_kg && (
          <p className={`text-gray-500 ${subClass}`}>
            {product.box_weight_kg}kg
            {product.box_unit_quantity && ` · ${product.box_unit_quantity} un`}
            {pricePerKg && ` · ${formatCurrency(pricePerKg)}/kg`}
          </p>
        )}
      </div>
    )
  }

  if (product.sale_unit === 'kg') {
    return (
      <p className={`font-bold text-primary ${priceClass}`}>
        {formatCurrency(product.price_per_kg || 0)}{' '}
        <span className={`font-normal text-gray-500 ${subClass}`}>/ kg</span>
      </p>
    )
  }

  if (product.sale_unit === 'unit') {
    return (
      <p className={`font-bold text-primary ${priceClass}`}>
        {formatCurrency(product.price_per_unit || 0)}{' '}
        <span className={`font-normal text-gray-500 ${subClass}`}>
          / {product.unit_description || 'unidade'}
        </span>
      </p>
    )
  }

  return null
}
