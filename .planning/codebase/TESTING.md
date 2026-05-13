# Testing Patterns

**Analysis Date:** 2026-05-13

## Test Framework

**Runner:**
- Vitest 4.1.2
- Config: `vite.config.ts` with test configuration (not separate vitest.config.ts)
- Environment: jsdom (browser DOM simulation)

**Assertion Library:**
- Vitest built-in expect syntax (compatible with Jest)

**Run Commands:**
```bash
npm test              # Run all tests once
npm run test:watch   # Run tests in watch mode
```

## Test File Organization

**Location:**
- Co-located with source files: `src/utils/index.test.ts`, `src/stores/cartStore.test.ts`
- Constants test: `src/constants/cities.test.ts`
- Setup file: `src/test/setup.ts`

**Naming:**
- Test files append `.test.ts` or `.test.tsx` suffix
- Excluded from TypeScript compilation: `tsconfig.app.json` excludes `src/**/*.test.ts` and `src/test`

**Structure:**
```
src/
├── test/
│   └── setup.ts                    # Test environment setup
├── utils/
│   ├── index.ts                    # Implementation
│   └── index.test.ts               # Tests
├── stores/
│   ├── cartStore.ts                # Implementation
│   └── cartStore.test.ts           # Tests
└── constants/
    ├── cities.ts                   # Implementation
    └── cities.test.ts              # Tests
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest'

describe('cartStore', () => {
  beforeEach(() => {
    useCartStore.setState({ sections: [] })
  })

  it('starts with empty cart', () => {
    expect(useCartStore.getState().sections).toHaveLength(0)
  })

  it('adds item and creates a section', () => {
    // Arrange
    const product = mockProduct()
    
    // Act
    useCartStore.getState().addItem(product, 2, mockSupplier)

    // Assert
    const { sections } = useCartStore.getState()
    expect(sections).toHaveLength(1)
  })
})
```

**Patterns:**
- Top-level `describe()` blocks organize by module/feature
- Nested `describe()` blocks for grouped functionality (not observed yet, but one level used)
- Each `it()` tests single behavior or assertion group
- Arrange-Act-Assert pattern implicit (not explicitly separated with comments)

## Mocking

**Framework:** Vitest built-in mocking (vitest/mock utilities available)

**Patterns:**
```typescript
// Mock objects for stores (not functions)
const mockSupplier: Supplier = {
  id: 'sup-1',
  store_name: 'Fazenda Teste',
  whatsapp: '11999999999',
  // ... properties
}

// Mock factory functions
const mockProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'prod-1',
  supplier_id: 'sup-1',
  name: 'Banana',
  // ... defaults
  ...overrides,  // Allow test-specific overrides
})
```

**Usage:**
- Mock data passed to components/stores directly
- Store reset before each test: `useCartStore.setState({ sections: [] })`
- No observable mocking (vitest.mock) used in examined tests
- Direct state manipulation for testing: `useCartStore.getState()`

**What to Mock:**
- External services (Supabase) — use mock objects for data
- Third-party libraries — not observed in current tests
- API responses — mock data passed to functions

**What NOT to Mock:**
- Store/state management logic — test actual Zustand stores
- Utility functions — test actual implementation
- Type definitions — not mocked, only used as interfaces

## Fixtures and Factories

**Test Data:**
```typescript
// Store constants
const mockSupplier: Supplier = {
  id: 'sup-1',
  store_name: 'Fazenda Teste',
  // ... complete object
}

// Factory function for varied test data
const mockProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'prod-1',
  supplier_id: 'sup-1',
  // ... defaults
  ...overrides,  // Merge custom properties
})

// Usage in tests
const product = mockProduct()  // Default
const product = mockProduct({ box_price: 35.5 })  // Custom variant
```

**Location:**
- Fixtures defined at top of test file
- Factories as utility functions in same file
- No shared fixtures directory; each test file self-contained

## Coverage

**Requirements:** None enforced (no coverage config in package.json)

**View Coverage:**
- No npm script provided
- Run manually with Vitest: `vitest run --coverage` (if coverage provider installed)

## Test Types

**Unit Tests:**
- Scope: Individual utility functions and store methods
- Approach: Pure function testing with various input combinations
- Examples: `formatCurrency()`, `cartStore` state mutations
- Assertion: Return values and state changes

**Integration Tests:**
- Not found in examined files
- Would test: Data flow between stores and components
- Would use: Component rendering + store state

**E2E Tests:**
- Framework: Not used
- Would use: Playwright or Cypress (not configured)

## Common Patterns

**Async Testing:**
```typescript
// Not observed in current test suite
// When needed, would use:
it('loads data asynchronously', async () => {
  const promise = loader()
  await expect(promise).resolves.toEqual(expectedValue)
})
```

**Error Testing:**
```typescript
// Not explicitly tested in examined files
// Pattern would be:
it('throws on invalid input', () => {
  expect(() => formatCurrency(NaN)).toThrow()
})
```

**State Mutation Testing (Zustand):**
```typescript
it('updates state correctly', () => {
  // Get initial state
  expect(useCartStore.getState().sections).toHaveLength(0)
  
  // Act on store
  useCartStore.getState().addItem(product, 2, supplier)
  
  // Assert new state
  const { sections } = useCartStore.getState()
  expect(sections[0].items[0].quantity).toBe(2)
})
```

**Floating-Point Precision Testing:**
```typescript
it('avoids floating-point errors', () => {
  const product = mockProduct({ sale_unit: 'kg', price_per_kg: 0.1 })
  useCartStore.getState().addItem(product, 3, mockSupplier)
  
  const item = useCartStore.getState().sections[0].items[0]
  // Math.round used in store to prevent 0.30000000000000004
  expect(item.subtotal).toBe(0.3)
})
```

## Test Examples

### Utility Function Tests (`src/utils/index.test.ts`)
- 12 test suites across 6 functions
- Tests include: string formatting, calculation correctness, edge cases
- Uses matchers: `toContain()`, `toBe()`, `toMatch()`

```typescript
describe('formatCurrency', () => {
  it('formats BRL currency correctly', () => {
    expect(formatCurrency(10)).toContain('10,00')
    expect(formatCurrency(1234.56)).toContain('1.234,56')
  })
})

describe('formatDateShort', () => {
  it('formats ISO date to pt-BR date only', () => {
    const result = formatDateShort('2024-03-15T14:30:00Z')
    expect(result).toBe('15/03/2024')
  })
})
```

### Store Tests (`src/stores/cartStore.test.ts`)
- 20 test cases covering all store methods
- Tests: state initialization, item operations, quantity updates, section management
- Setup: Reset store before each test with `beforeEach`

```typescript
describe('cartStore', () => {
  beforeEach(() => {
    useCartStore.setState({ sections: [] })
  })

  it('increments quantity when adding same product again', () => {
    const product = mockProduct()
    useCartStore.getState().addItem(product, 2, mockSupplier)
    useCartStore.getState().addItem(product, 3, mockSupplier)
    
    const { sections } = useCartStore.getState()
    expect(sections[0].items[0].quantity).toBe(5)
  })

  it('calculates subtotal correctly for kg products', () => {
    const product = mockProduct({ sale_unit: 'kg', price_per_kg: 8.99 })
    useCartStore.getState().addItem(product, 5, mockSupplier)
    
    const item = useCartStore.getState().sections[0].items[0]
    expect(item.subtotal).toBe(44.95)
  })
})
```

### Constants Tests (`src/constants/cities.test.ts`)
- 3 test cases validating data integrity
- Tests: Count assertions, data validation, uniqueness checks

```typescript
describe('CITIES', () => {
  it('has at least 41 entries', () => {
    expect(CITIES.length).toBeGreaterThanOrEqual(41)
  })

  it('has no duplicate city names', () => {
    const names = CITIES.map((c) => c.city.toLowerCase())
    expect(new Set(names).size).toBe(names.length)
  })
})
```

## Test Configuration

**Setup Files:**
- `src/test/setup.ts` imports `@testing-library/jest-dom/vitest`
- Provides DOM matchers (`.toBeInTheDocument()`, etc.)
- Runs before each test suite

**Vitest Config (in vite.config.ts):**
```typescript
test: {
  globals: true,              // describe, it, expect available globally
  environment: 'jsdom',       // Browser DOM simulation
  setupFiles: ['./src/test/setup.ts'],  // Setup before tests
}
```

**Dependencies:**
- `vitest`: 4.1.2 (test runner)
- `@testing-library/react`: 16.3.2 (component testing utilities)
- `@testing-library/jest-dom`: 6.9.1 (DOM assertions)
- `jsdom`: 29.0.1 (DOM implementation)

## Testing Gaps

**Not Currently Tested:**
- React components (no component test files found)
- Service layer functions (Supabase queries)
- API client functions
- Async operations and data loading
- Form validation with React Hook Form
- Error boundaries and error scenarios
- Integration between stores and components

**Coverage Estimate:** ~15% (utility functions + store logic only)

**Recommended Test Targets:**
- Component rendering tests with React Testing Library
- Service layer integration tests
- Error handling scenarios
- Async data fetching in stores

---

*Testing analysis: 2026-05-13*
