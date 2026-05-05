import { describe, it, expect } from 'vitest'
import { CITIES, getCityLabel } from './cities'

describe('CITIES', () => {
  it('has at least 41 entries', () => {
    expect(CITIES.length).toBeGreaterThanOrEqual(41)
  })

  it('every entry has non-empty city and state', () => {
    CITIES.forEach((c) => {
      expect(c.city.length).toBeGreaterThan(0)
      expect(c.state.length).toBeGreaterThan(0)
    })
  })

  it('has no duplicate city names', () => {
    const names = CITIES.map((c) => c.city.toLowerCase())
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('getCityLabel', () => {
  it('formats city with em-dash separator', () => {
    expect(getCityLabel({ city: 'Brasília', state: 'DF' })).toBe('Brasília — DF')
  })
})
