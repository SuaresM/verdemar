# Technology Stack

**Analysis Date:** 2026-05-13

## Languages

**Primary:**
- TypeScript ~5.9.3 - All application code, frontend and backend

**Secondary:**
- JavaScript (ES2022) - Configuration files (vite.config.ts, tailwind.config.js, etc.)
- SQL - Supabase schema and migrations

## Runtime

**Environment:**
- Node.js (no specific version pinned, uses npm lockfile)

**Package Manager:**
- npm - Package management
- Lockfile: `package-lock.json` present (resolved dependencies)

## Frameworks

**Core:**
- React 19.2.0 - Frontend UI framework with concurrent features
- Vite 7.3.1 - Frontend build tool and dev server
- Hono 4.12.16 - Backend API framework, runs on Vercel Edge/Node.js runtime
- React Router DOM 7.13.1 - Client-side routing

**Testing:**
- Vitest 4.1.2 - Unit/integration testing framework
- @testing-library/react 16.3.2 - React component testing utilities
- @testing-library/jest-dom 6.9.1 - Custom Jest matchers for DOM

**Build/Dev:**
- Vite PWA Plugin 1.2.0 - Progressive Web App generation
- TypeScript Compiler 5.9.3 - Type checking and compilation
- ESLint 9.39.1 - Code linting (flat config)
- Tailwind CSS 3.4.19 - Utility-first CSS framework
- PostCSS 8.5.8 - CSS transformations
- Autoprefixer 10.4.27 - CSS vendor prefixes

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.99.0 - Supabase client SDK, core database and auth
- @sentry/react 10.51.0 - Error tracking and performance monitoring
- web-push 3.6.7 - Server-side Web Push protocol implementation
- workbox-core 7.4.0, workbox-routing 7.4.0, workbox-strategies 7.4.0, workbox-precaching 7.4.0, workbox-expiration 7.4.0 - Service Worker toolkit for PWA

**UI/Form:**
- @radix-ui/react-* (accordion, checkbox, dialog, label, select, slot, switch, tabs, toast) - Headless UI component library
- @hookform/resolvers 5.2.2 - Form validation resolvers
- react-hook-form 7.71.2 - Performant form state management
- zod 4.3.6 - TypeScript-first schema validation
- class-variance-authority 0.7.1 - CSS class composition
- clsx 2.1.1 - Classname utility
- tailwind-merge 3.5.0 - Tailwind CSS class merging
- sonner 2.0.7 - Toast notifications
- lucide-react 0.577.0 - Icon library
- intro.js 8.3.2 - Product tour/onboarding library

**State Management:**
- zustand 5.0.11 - Lightweight state management library

**Utilities:**
- @vercel/node 5.7.15 - Vercel runtime utilities for Node.js functions
- @types/web-push 3.6.4 - TypeScript definitions for web-push

**Development:**
- @vitejs/plugin-react 5.1.1 - Vite React Fast Refresh support
- typescript-eslint 8.48.0 - TypeScript ESLint integration
- eslint-plugin-react-hooks 7.0.1 - React hooks linting rules
- eslint-plugin-react-refresh 0.4.24 - React Fast Refresh linting
- jsdom 29.0.1 - DOM implementation for Node.js testing
- globals 16.5.0 - Global types for ESLint

## Configuration

**Environment:**
- Client-side vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`, `VITE_SENTRY_DSN`, `VITE_SUPPORT_WHATSAPP`
- Server-side vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_EMAIL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
- Config file: `.env` (local, not committed per `.gitignore`)
- Example template: `.env.example`

**Build:**
- Main config: `vite.config.ts` - PWA manifest, React plugin, path aliases
- TypeScript: `tsconfig.json` (references), `tsconfig.app.json` (app), `tsconfig.node.json` (build tools)
- Styles: `tailwind.config.js` - Custom color palette (primary: #2d6a4f green, accent: #f4a261 orange)
- Post-CSS: `postcss.config.js` - Tailwind and autoprefixer plugins
- ESLint: `eslint.config.js` - Flat config with React, hooks, TypeScript rules
- Vercel: `vercel.json` - Cache headers for SW, SPA rewrite rules

## Platform Requirements

**Development:**
- Node.js (modern LTS recommended based on package versions)
- npm (bundled with Node.js)
- Browser with Service Worker support for PWA features

**Production:**
- Vercel (primary hosting platform)
- Supabase PostgreSQL database
- Edge Functions/Node.js runtime on Vercel (API serverless functions)
- Service Workers in browsers for offline/PWA capabilities

---

*Stack analysis: 2026-05-13*
