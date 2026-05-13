# Coding Conventions

**Analysis Date:** 2026-05-13

## Naming Patterns

**Files:**
- PascalCase for React components: `ProductCard.tsx`, `ErrorBoundary.tsx`
- camelCase for utility files, hooks, services, and stores: `cartStore.ts`, `useOnboarding.ts`, `supabase.ts`
- camelCase for constants and configuration files: `apiClient.ts`
- UPPER_SNAKE_CASE for exported constants: `CITIES`, `STORAGE_KEY_PREFIX`, `CATEGORIES`
- Test files append `.test.ts` or `.test.tsx`: `cartStore.test.ts`, `utils/index.test.ts`

**Functions:**
- camelCase for all functions (exported and internal)
- Descriptive verb-noun pattern: `formatCurrency()`, `calculatePricePerKg()`, `getDeliveryDaysLabel()`
- Utility functions use `get`, `format`, `calculate`, `update`, `remove` prefixes based on operation type
- Event handlers use `handle` prefix: `handleAdd()`, `handleDecrease()`, `handleRefresh()`, `handleReset()`
- Custom hooks use `use` prefix: `useCartStore()`, `useAuthStore()`, `useOnboarding()`

**Variables:**
- camelCase for all variables and object properties
- Descriptive names reflecting content: `sections`, `sectionTotal`, `deliveryTimePreference`
- React state naming: `const [loading, setLoading] = useState(true)` with descriptive prefix
- Store methods follow action pattern: `addItem()`, `removeItem()`, `updateQuantity()`, `clearAll()`
- Temporary/loop variables: single letters acceptable in tight scopes (`i`, `s` in map/reduce operations)

**Types:**
- PascalCase for all type/interface names: `Product`, `Supplier`, `OrderStatus`, `BadgeProps`
- Union types use PascalCase: `OrderStatus = 'pending' | 'confirmed' | 'in_delivery'`
- Props interfaces append `Props` suffix: `HeaderProps`, `ProductCardProps`, `BadgeProps`
- Type imports with `type` keyword: `import type { Product, Supplier } from '../types'`

## Code Style

**Formatting:**
- Target: 80-120 character line length (observed in codebase)
- No Prettier config present; formatting follows ESLint rules
- Semicolons: Required (enforced by TypeScript/ESLint config)
- Trailing commas: Used in multi-line objects/arrays
- Quotes: Single quotes in JS/TS, double quotes in JSX attributes

**Linting:**
- Tool: ESLint 9.39.1 with TypeScript 5.9.3
- Config: `eslint.config.js` (flat format)
- Extends: `@eslint/js`, `typescript-eslint`, `react-hooks`, `react-refresh`
- Key rules enforced:
  - React Hooks rules enabled (`react-hooks.configs.flat.recommended`)
  - React Refresh rules for development (`react-refresh.configs.vite`)
  - TypeScript strict mode (see tsconfig.app.json)
  - No unused variables or parameters (disabled in tsconfig: `noUnusedLocals: false`)

**TypeScript:**
- Strict mode enabled: `strict: true`
- Target: ES2022
- Module system: ESNext with bundler resolution
- JSX: `react-jsx` (no React import needed)
- Path aliases: `@/*` → `./src/*` configured in tsconfig
- Type checking: Enabled with `verbatimModuleSyntax` and `noFallthroughCasesInSwitch`

## Import Organization

**Order:**
1. React and third-party libraries: `import { useState } from 'react'`, `import { create } from 'zustand'`
2. Project types: `import type { Product, Supplier } from '../types'`
3. Project services/stores: `import { useCartStore } from '../../stores/cartStore'`, `import { supabase } from '../lib/supabaseClient'`
4. Project components: `import { ProductCard } from '../../components/product/ProductCard'`
5. Project utilities: `import { formatCurrency } from '../../utils'`
6. CSS/assets: `import 'intro.js/introjs.css'`

**Path Aliases:**
- `@/` resolves to `src/` directory
- Always use aliases for imports across directories
- Example: `import { useAuthStore } from '@/stores/authStore'` (though relative paths also used in codebase)

**Barrel Files:**
- Used selectively: `src/utils/index.ts` exports all utility functions
- Used in constants: `src/constants/` may export multiple items
- Not consistently used throughout (components import directly)

## Error Handling

**Patterns:**
- Async errors wrapped in try-catch blocks
- Service layer throws errors: `if (error) throw error` in `supabase.ts`
- Components catch errors: `useEffect` chains handle promise rejections with `.finally()`
- Silent error handling in specific cases: `getProfile()` returns `null` on error instead of throwing
- Error boundary: `ErrorBoundary` class component catches React render errors and provides recovery UI
- Custom error messages: `throw new Error(\`HTTP ${res.status}: ${body}\`)` in `apiClient.ts`
- API errors propagated with context: HTTP status codes included in error messages

**Silent Handling Pattern:**
- Database lookups return `null` on RLS or not-found errors (see `getProfile`, `getBuyer`, `getSupplier`)
- Rationale: Transient errors should not force logout; layout redirects on null profile
- Logging: Errors logged with `console.error()` or `console.warn()` for debugging

## Logging

**Framework:** `console` object directly (no logging library)

**Patterns:**
- `console.error()` for error conditions: `console.error('ErrorBoundary caught:', error, info.componentStack)`
- `console.warn()` for warnings: `console.warn('Onboarding tour skipped:', err)`
- Debug context included: Error messages prefix with area (e.g., `'Erro ao carregar perfil:'`)
- No structured logging; messages are human-readable Portuguese/English mix
- Logged at component and store level for debugging; no comprehensive event logging

## Comments

**When to Comment:**
- Complex calculations: `calculateSubtotal()` has no comments (logic is clear)
- Non-obvious design decisions: Commented in `authStore.ts` (mutex pattern for `loadProfile`)
- Error recovery strategies: Detailed comments in `ErrorBoundary` (hard reset logic)
- Onboarding flow: Commented step configuration in `useOnboarding()`
- State mutation patterns: Comments in Zustand store update functions

**JSDoc/TSDoc:**
- Not used extensively
- No consistent JSDoc blocks on exported functions
- Type interfaces self-documented through property names
- Comments appear inline for complex logic only

## Function Design

**Size:** 
- Most utility functions: 5-20 lines
- Store methods: 10-30 lines (state update logic)
- Component functions: 40-150 lines (with JSX)
- No explicit line limit enforced; focus on readability

**Parameters:**
- Destructured from objects when >2 parameters: `({ product, quantity, supplier }) => { ... }`
- Optional parameters use default values: `formatWhatsAppMessage(order, buyer, items)`
- Type annotations required for all parameters in TypeScript files

**Return Values:**
- Explicit return types on function signatures: `async function getSupplier(userId: string): Promise<Supplier | null>`
- Nullable returns for database queries: `Promise<T | null>` pattern
- Store methods return void (state managed internally)
- Component functions return JSX.Element or ReactNode

## Module Design

**Exports:**
- Named exports for functions and types: `export function formatCurrency()`, `export type Product`
- Default exports for page components: `export default function Home()`
- Services export multiple functions: `export async function getProfile()`, `export async function createProfile()`
- Stores export single hook: `export const useCartStore = create<CartStore>()`

**Barrel Files:**
- `src/utils/index.ts` exports all formatter and helper functions
- `src/types/index.ts` exports all type definitions
- Enables single-line imports: `import { formatCurrency, calculatePricePerKg } from '@/utils'`
- Components do NOT use barrel files (import directly from specific component files)

## State Management

**Pattern:**
- Zustand for application state: `useCartStore`, `useAuthStore`
- Store syntax: `create<StoreType>()((set, get) => ({ ... }))`
- State mutations through action methods, not direct mutations
- Persist middleware used for cart: `.persist({ name: 'rota-verde-cart' })`
- Module-level mutex in auth store to prevent race conditions on `loadProfile`

**Form State:**
- React Hook Form for complex forms: `@hookform/resolvers`, `zod` for validation
- Local `useState` for simple UI state: `loading`, `refreshing`, `hasError`
- Component prop passing for controlled inputs

## React Patterns

**Component Structure:**
- Functional components with hooks (no class components except ErrorBoundary)
- Props destructured in function signature: `function Badge({ children, variant = 'primary' })`
- Props interfaces defined above component: `interface ProductCardProps { ... }`
- Event handlers defined before return statement
- Conditional rendering with ternary operators or logical AND

**Hooks:**
- `useState` for local UI state
- `useEffect` for side effects (data fetching, subscriptions)
- `useCallback` for memoized event handlers
- `useRef` for refs to DOM or non-React values
- Custom hooks for reusable logic: `useOnboarding()`, `useCartStore()`, `useAuthStore()`

**Async Patterns:**
- `useEffect` + `useState` for data loading
- `useCallback` with async IIFE for load functions: `const load = useCallback(async () => { ... }, [])`
- Promise.all for parallel requests: `const [prods, sups] = await Promise.all([...])`
- No async directly in useEffect; wrap in IIFE or extract to function

## Responsive Design

**Framework:** Tailwind CSS 3.4.19

**Patterns:**
- Mobile-first approach (no responsive modifier breakpoints in observed code)
- Max-width container: `max-w-lg` for constrained layouts
- Flexbox and grid for layout
- Padding/margin utilities: `px-4`, `py-2`, `gap-3`, `mb-1`
- Rounded corners: `rounded-xl` (11px), `rounded-full`, `rounded-lg`
- Colors: Primary color (green `#2d6a4f`), gray scale, semantic colors (success, warning, danger)

## Accessibility

**Patterns Observed:**
- `aria-label` on icon buttons: `aria-label="Voltar"` in Header
- Semantic HTML elements not consistently used
- Color contrast: Primary green on white meets WCAG standards
- No alt text on skeleton loaders
- Form inputs use labels with React Hook Form

---

*Convention analysis: 2026-05-13*
