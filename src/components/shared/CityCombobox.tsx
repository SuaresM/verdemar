import { useState, useEffect, useRef } from 'react'
import { CITIES } from '../../constants/cities'

interface CityComboboxProps {
  value: string
  onChange: (city: string, state: string) => void
  placeholder?: string
  error?: string
  strict?: boolean
}

export function CityCombobox({ value, onChange, placeholder = 'Digite a cidade...', error, strict = false }: CityComboboxProps) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const lastValidCity = useRef<string>(value)
  const [internalError, setInternalError] = useState<string>('')

  useEffect(() => {
    setQuery(value)
    lastValidCity.current = value
  }, [value])

  const filtered = query
    ? CITIES.filter((c) => c.city.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : CITIES.slice(0, 8)

  const handleSelect = (city: string, state: string) => {
    lastValidCity.current = city
    setQuery(city)
    setInternalError('')
    onChange(city, state)
    setOpen(false)
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => {
          setOpen(false)
          if (strict) {
            const isValid = CITIES.some((c) => c.city === query)
            if (!isValid) {
              setQuery(lastValidCity.current)
              setInternalError('Selecione uma cidade da lista')
            } else {
              setInternalError('')
            }
          }
        }, 150)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
      />
      {(internalError || error) && (
        <p className="text-danger text-xs mt-1">{internalError || error}</p>
      )}
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((c) => (
            <button
              key={c.city}
              type="button"
              onMouseDown={() => handleSelect(c.city, c.state)}
              className="w-full px-4 py-2 min-h-[44px] text-left text-sm hover:bg-gray-50 font-bold text-gray-800"
            >
              {c.city} <span className="text-gray-400 text-xs">— {c.state}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
