import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  calculatePricePerKg,
  formatCNPJ,
  formatPhone,
  getDeliveryDaysLabel,
  getSaleUnitLabel,
  formatDate,
  formatDateShort,
  cn,
} from './index'

describe('formatCurrency', () => {
  it('formats BRL currency correctly', () => {
    expect(formatCurrency(10)).toContain('10,00')
    expect(formatCurrency(1234.56)).toContain('1.234,56')
    expect(formatCurrency(0)).toContain('0,00')
  })
})

describe('calculatePricePerKg', () => {
  it('calculates price per kg from box price and weight', () => {
    expect(calculatePricePerKg(100, 10)).toBe(10)
    expect(calculatePricePerKg(50, 25)).toBe(2)
  })

  it('returns 0 for zero or missing weight', () => {
    expect(calculatePricePerKg(100, 0)).toBe(0)
  })
})

describe('formatCNPJ', () => {
  it('formats a valid CNPJ string', () => {
    expect(formatCNPJ('12345678000199')).toBe('12.345.678/0001-99')
  })

  it('handles already partially formatted input', () => {
    expect(formatCNPJ('12.345.678/0001-99')).toBe('12.345.678/0001-99')
  })
})

describe('formatPhone', () => {
  it('formats 11-digit phone (mobile)', () => {
    expect(formatPhone('11999887766')).toBe('(11) 99988-7766')
  })

  it('formats 10-digit phone (landline)', () => {
    expect(formatPhone('1133445566')).toBe('(11) 3344-5566')
  })
})

describe('getDeliveryDaysLabel', () => {
  it('returns abbreviated day names in order', () => {
    expect(getDeliveryDaysLabel(['monday', 'wednesday', 'friday'])).toBe('Seg, Qua, Sex')
  })

  it('returns empty string for empty array', () => {
    expect(getDeliveryDaysLabel([])).toBe('')
  })

  it('preserves correct order regardless of input order', () => {
    expect(getDeliveryDaysLabel(['friday', 'monday'])).toBe('Seg, Sex')
  })
})

describe('getSaleUnitLabel', () => {
  it('returns correct labels', () => {
    expect(getSaleUnitLabel('box')).toBe('caixa')
    expect(getSaleUnitLabel('kg')).toBe('kg')
    expect(getSaleUnitLabel('unit')).toBe('unidade')
  })

  it('uses custom unit description for unit type', () => {
    expect(getSaleUnitLabel('unit', 'maço')).toBe('maço')
  })
})

describe('formatDate', () => {
  it('formats ISO date to pt-BR with time', () => {
    const result = formatDate('2024-03-15T14:30:00Z')
    expect(result).toMatch(/15\/03\/2024/)
  })
})

describe('formatDateShort', () => {
  it('formats ISO date to pt-BR date only', () => {
    const result = formatDateShort('2024-03-15T14:30:00Z')
    expect(result).toBe('15/03/2024')
  })
})

describe('cn', () => {
  it('joins truthy class names', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c')
  })

  it('filters out falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b')
  })

  it('returns empty string for no classes', () => {
    expect(cn()).toBe('')
  })
})
