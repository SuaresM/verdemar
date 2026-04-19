# VerdeMar — Documento Mestre de Handoff

> Documento único, autocontido, projetado para que qualquer pessoa (ou um novo agente) consiga entender o projeto, recuperá‑lo, depurá‑lo ou reiniciá‑lo do zero **sem depender de contexto externo**.
>
> Última atualização: 2026-04-19
> Último commit incluído: `a61d008` — *fix: prevent iOS auto-zoom on input focus and fix mobile viewport*

---

## 1. Visão Geral do Produto

**VerdeMar** é um marketplace B2B mobile-first (PWA) de hortifrúti para atacado. Três papéis de usuário:

| Papel | O que faz |
|------|-----------|
| `buyer` (comprador) | Restaurantes / mercearias / lojas. Navega fornecedores, adiciona ao carrinho, finaliza pedido via WhatsApp. |
| `supplier` (fornecedor) | Hortifrutis / distribuidoras. Cadastra produtos, recebe pedidos, atualiza status. |
| `admin` | Operador da plataforma. Visão global de fornecedores, produtos, pedidos. Não pode ser criado via signup (bloqueado no trigger). |

Fluxo comercial do MVP: pedido sai do carrinho → WhatsApp do fornecedor recebe a mensagem → entrega/cobrança off‑platform.

---

## 2. Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Build | Vite 7 + TypeScript 5.9 |
| UI | React 19 + React Router 7 + Tailwind 3.4 + lucide-react |
| Componentes primitivos | Radix UI (accordion, dialog, select, tabs, toast, etc.) |
| Forms | react-hook-form + zod |
| Estado cliente | Zustand (authStore, cartStore) |
| Backend | Supabase (Postgres + Auth + Storage + RLS) |
| PWA | vite-plugin-pwa (Workbox, autoUpdate) |
| Onboarding | intro.js 8 |
| Notificações | sonner (Toaster) |
| Testes | Vitest + @testing-library/react + jsdom |
| Hosting | Vercel (SPA com rewrite para `/index.html`) |
| Font | Nunito (Google Fonts) |

Node: **22+ recomendado** (package-lock gerado com 24).

---

## 3. Credenciais e Serviços

### 3.1 GitHub
- **Repo**: `https://github.com/SuaresM/verdemar.git`
- **Branch produção**: `main`
- **Dono da sessão local**: `jsuaresmoura@gmail.com`

### 3.2 Supabase
- **Projeto ID/ref**: `vpomchqkkmjjeschanch`
- **URL**: `https://vpomchqkkmjjeschanch.supabase.co`
- **Dashboard**: `https://supabase.com/dashboard/project/vpomchqkkmjjeschanch`
- **Anon key (pública por design — pode versionar)**:
  ```
  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwb21jaHFra21qamVzY2hhbmNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1Mzk5NTYsImV4cCI6MjA4OTExNTk1Nn0.PZP2cHX00MwDfVVZnaAcRmLNOGTm8LShLOk3JEJ8NQM
  ```
  (válida até 2036 — `exp: 2089115956`)
- **Service role key**: **NÃO versionar**. Obter em Dashboard → Project Settings → API.

### 3.3 Vercel
- **Projeto**: conectado ao repo GitHub acima via Git integration.
- Toda push em `main` → deploy automático de produção.
- **Env vars em produção** (historicamente estavam *erradas*, apontando para `mdwifcuaekjboukvsnvg.supabase.co` que não existe; hoje o código tem **fallback hardcoded** com guard de projeto — ver §7.2). Idealmente, atualizar no dashboard Vercel para:
  ```
  VITE_SUPABASE_URL=https://vpomchqkkmjjeschanch.supabase.co
  VITE_SUPABASE_ANON_KEY=<mesmo valor acima>
  VITE_SUPPORT_WHATSAPP=5561995761820
  ```

### 3.4 Variáveis de ambiente locais (`.env`)
```env
VITE_SUPABASE_URL=https://vpomchqkkmjjeschanch.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwb21jaHFra21qamVzY2hhbmNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1Mzk5NTYsImV4cCI6MjA4OTExNTk1Nn0.PZP2cHX00MwDfVVZnaAcRmLNOGTm8LShLOk3JEJ8NQM
VITE_SUPPORT_WHATSAPP=5561995761820
```
Obs: `import.meta.env.VITE_*` é **inlinado em build-time**, não em runtime — mudanças exigem novo build/deploy.

---

## 4. Contas Existentes

### 4.1 Admin (já criado, mantido através de todas as migrações)
| Campo | Valor |
|-------|-------|
| UUID | `65fe3c92-170b-433c-9c24-31085a5b4305` |
| E-mail | `jsuaresmoura@gmail.com` |
| Nome | Juan Suares Moura |
| Role | `admin` |
| Senha | *definida pelo dono — Supabase Auth* |

> Admin **não pode** ser criado via signup (trigger `handle_new_user` bloqueia role ≠ buyer/supplier). Para criar outro admin: criar usuário normal e promover manualmente via SQL — ver §8.4.

### 4.2 Comprador de teste
| Campo | Valor |
|-------|-------|
| E-mail | `comprador@verdemar.com` |
| Senha | `verdemar123` |
| Empresa | Restaurante Teste LTDA |
| CNPJ | `12.345.678/0001-00` |
| Cidade/UF | São Paulo / SP |

### 4.3 Fornecedor de teste
| Campo | Valor |
|-------|-------|
| E-mail | `vendedor@verdemar.com` |
| Senha | `verdemar123` |
| Loja | Hortifrúti Verde Mar |
| WhatsApp | `11999990002` |
| Pedido mínimo | R$ 100 |

---

## 5. Estrutura do Repositório

```
verdemar/
├─ index.html                  # viewport meta robusto (iOS-safe)
├─ vercel.json                 # SPA rewrite: /(.*) → /index.html
├─ vite.config.ts              # Vite + PWA (manifest + Workbox runtimeCaching)
├─ tailwind.config.js          # tema verde primário #2d6a4f
├─ tsconfig*.json
├─ package.json                # Scripts: dev | build | lint | preview | test
├─ supabase-schema.sql         # Tabelas + RLS + funções helpers
├─ supabase-trigger.sql        # Trigger on_auth_user_created (bloqueia admin)
├─ .env                        # credenciais Supabase (versionadas — anon é pública)
├─ .env.example
├─ public/
│  └─ icons/                   # PWA icons 192/512
└─ src/
   ├─ main.tsx                 # StrictMode + createRoot
   ├─ App.tsx                  # Layouts por role + rotas
   ├─ index.css                # globais + iOS no-zoom + introjs theme
   ├─ lib/
   │  └─ supabaseClient.ts     # fallback hardcoded com env-guard
   ├─ stores/
   │  ├─ authStore.ts          # signIn/signOut/loadProfile (Zustand)
   │  └─ cartStore.ts
   ├─ services/
   │  └─ supabase.ts           # todas as queries (getAdminDashboard, getSupplierDashboard, etc.)
   ├─ hooks/
   │  └─ useOnboarding.ts      # intro.js por role
   ├─ components/
   │  ├─ layout/               # Header, BuyerNav, SupplierNav, AdminNav
   │  └─ shared/               # ErrorBoundary, LoadingSpinner, Badge
   ├─ pages/
   │  ├─ public/               # Login, Register
   │  ├─ buyer/                # Home, Search, Cart, OrderHistory, Profile, ProductDetail, SupplierProfile
   │  ├─ supplier/             # Dashboard, Products, ProductForm, Orders, StoreSettings
   │  └─ admin/                # Dashboard, Suppliers, Products, Orders
   ├─ types/                   # tipos (Order, Product, Buyer, Supplier)
   ├─ utils/                   # formatCurrency, formatDate, etc.
   └─ test/                    # setup.ts + specs (34 testes)
```

---

## 6. Schema do Banco (Resumido)

Arquivos fonte: [`supabase-schema.sql`](./supabase-schema.sql) e [`supabase-trigger.sql`](./supabase-trigger.sql). Rodar na ordem.

### Tabelas (todas em `public`)
| Tabela | PK | Notas |
|--------|-----|-------|
| `profiles` | `id → auth.users` | role ∈ {buyer, supplier, admin} |
| `buyers` | `id → profiles` | company_name, cnpj (unique), endereço completo |
| `suppliers` | `id → profiles` | store_name, whatsapp, delivery_days[], is_active |
| `products` | UUID | supplier_id, category ∈ {fruit, vegetable, greens, other}, sale_unit ∈ {box, kg, unit} |
| `orders` | UUID | buyer_id, supplier_id, status ∈ {pending, confirmed, in_delivery, delivered, cancelled} |
| `order_items` | UUID | order_id (CASCADE), product_id |

### RLS
Todas tabelas têm RLS habilitado. Política **`is_admin()`** (SECURITY DEFINER, `search_path` fixo) dá ao admin leitura total + updates/deletes seletivos.

### Trigger chave
`on_auth_user_created` → `handle_new_user()` roda em `AFTER INSERT ON auth.users`:
1. Lê `raw_user_meta_data` do novo usuário.
2. **Rejeita** se role ∉ {buyer, supplier} → protege contra auto-promote a admin.
3. Insere em `profiles`.
4. Se `registration_data` presente, insere em `buyers` ou `suppliers`.

---

## 7. Histórico de Problemas (Situações Anteriores)

Cronológico — esta seção existe para que ninguém repita os mesmos erros.

### 7.1 Schema do Supabase apontava para projeto antigo (Farmácia) ❌→✅
**Sintoma**: `Não estou conseguindo logar`. Cadastros falhavam com erros de RLS e tabelas inexistentes.
**Causa**: O projeto Supabase `vpomchqkkmjjeschanch` tinha originalmente schema de uma "Farmácia" (tabelas `units, addresses, categories, delivery_zones, inventory, settings`), incompatível com o código do VerdeMar.
**Correção (opção B destrutiva, aplicada)**:
- Drop das tabelas antigas + funções + trigger + buckets.
- Re-aplicação de `supabase-schema.sql` + `supabase-trigger.sql`.
- Perfil admin preservado (UUID `65fe3c92-...`).
- Fixado `search_path` da função `update_updated_at` (avisos de "mutable search_path").

### 7.2 Env vars erradas no Vercel ❌→✅
**Sintoma**: login em produção "sumia" os dados — no site publicado, clicar *Entrar* resetava o formulário e não logava.
**Causa**: O bundle de produção tinha sido buildado com `VITE_SUPABASE_URL=https://mdwifcuaekjboukvsnvg.supabase.co` (um projeto inexistente). O cliente fazia DNS lookup, falhava silenciosamente, e o authStore caía no branch de "perfil não encontrado" → signOut automático.
**Correção permanente aplicada em `src/lib/supabaseClient.ts` (commit 5829477)**: o código agora tem os valores corretos como **default** e só usa env vars se a URL contiver `vpomchqkkmjjeschanch`. Isso torna o build imune a env vars stale no Vercel.
```ts
const supabaseUrl = envUrl && envUrl.includes('vpomchqkkmjjeschanch') ? envUrl : DEFAULT_SUPABASE_URL
const supabaseAnonKey = envAnonKey && envUrl?.includes('vpomchqkkmjjeschanch') ? envAnonKey : DEFAULT_SUPABASE_ANON_KEY
```
> Anon key é **pública por design** (só permite operações sujeitas a RLS), então hardcodar é seguro.

### 7.3 Mobile: zoom automático iOS em inputs ❌→✅
**Sintoma**: `ao entrar no site pelo telefone, não fica dimensionado corretamente, precisa ficar corrigindo manualmente`.
**Causa**: Safari iOS dá zoom quando o usuário foca um input com `font-size < 16px`. Todos os inputs usavam `text-sm` (14px). Após o zoom, o Safari **não volta sozinho** — requer pinch-out manual.
**Correção aplicada em `src/index.css` + `index.html` (commit a61d008)**:
- `font-size: 16px !important` em inputs/textarea/select sob `@media (max-width: 640px)`.
- `html, body, #root { width: 100%; overflow-x: hidden; min-height: 100dvh; }`.
- `-webkit-text-size-adjust: 100%`.
- `img, video { max-width: 100%; height: auto; }`.
- Viewport meta: `width=device-width, initial-scale=1.0, minimum-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content`.

### 7.4 Outros fixes históricos relevantes (veja `git log`)
| Commit | Fix |
|--------|-----|
| `197f6d7` | Onboarding interativo com intro.js |
| `78f62bc` | ErrorBoundary, paginação, Vitest (34 testes) |
| `eebee30` | Segurança fase 1: bloqueio de admin no signup + validação de upload de imagem |
| `656a34f` | Dedupe carrinho, busca por categoria, float precision, timezone |
| `77e3c6c` | Senha forte + RPC guard |
| `f1108c4` | `vercel.json` com SPA rewrite (corrigiu 404 em rotas client) |
| `f362fda` | Trata perfil ausente no login |
| `0e82adf` | Registro via trigger (substitui inserts bloqueados por RLS) |

---

## 8. Playbook: Reiniciar o Projeto do Zero

### 8.1 Pré-requisitos
- Node.js 22+, npm 10+
- Git
- Conta Supabase + Vercel
- (Opcional, **recomendado**) Vercel CLI: `npm i -g vercel`

### 8.2 Reanimar o projeto local
```bash
# 1. Clonar
git clone https://github.com/SuaresM/verdemar.git
cd verdemar

# 2. Instalar
npm install

# 3. Criar .env (copiar conteúdo do §3.4)
# O arquivo já vem versionado; se não estiver, copie manualmente.

# 4. Rodar local
npm run dev            # → http://localhost:5173

# 5. Testes
npm test               # 34 specs

# 6. Build de produção
npm run build
npm run preview        # serve dist/ para smoke test
```

### 8.3 Reiniciar o banco Supabase (do zero — DESTRUTIVO)
No SQL Editor do Dashboard Supabase do projeto `vpomchqkkmjjeschanch`:
```sql
-- Em ordem. Apaga tudo e reconstrói.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.increment_supplier_sales(UUID) CASCADE;
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders      CASCADE;
DROP TABLE IF EXISTS public.products    CASCADE;
DROP TABLE IF EXISTS public.suppliers   CASCADE;
DROP TABLE IF EXISTS public.buyers      CASCADE;
DROP TABLE IF EXISTS public.profiles    CASCADE;

-- 1. Rodar supabase-schema.sql
-- 2. Rodar supabase-trigger.sql
-- 3. Criar buckets Storage:
--    - product-images  (Public)
--    - supplier-assets (Public)
-- 4. Restaurar admin (§8.4)
-- 5. Criar contas de teste (§8.5)
```

### 8.4 Restaurar/criar o admin
No SQL Editor, com o usuário já existente no `auth.users`:
```sql
INSERT INTO public.profiles (id, role, full_name, phone)
VALUES (
  '65fe3c92-170b-433c-9c24-31085a5b4305',
  'admin',
  'Juan Suares Moura',
  ''
)
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```
Se o usuário auth não existir, criar em Dashboard → Authentication → Add user com e‑mail `jsuaresmoura@gmail.com` e **copiar o UUID gerado** para o INSERT acima.

### 8.5 Recriar contas de teste
Em Dashboard → Authentication → Add user (auto-confirm):

**Comprador** — `comprador@verdemar.com` / `verdemar123` → copiar UUID → rodar:
```sql
-- <UUID_BUYER> = UUID gerado pelo Auth
INSERT INTO profiles (id, role, full_name, phone)
VALUES ('<UUID_BUYER>', 'buyer', 'Comprador Teste', '11999990001');

INSERT INTO buyers (
  id, company_name, cnpj, email,
  address_street, address_number, address_neighborhood,
  address_city, address_state, address_zip,
  business_hours, contact_phone
) VALUES (
  '<UUID_BUYER>',
  'Restaurante Teste LTDA',
  '12.345.678/0001-00',
  'comprador@verdemar.com',
  'Rua Teste', '100', 'Centro',
  'São Paulo', 'SP', '01000-000',
  'Seg-Sex 09:00-18:00', '11999990001'
);
```

**Fornecedor** — `vendedor@verdemar.com` / `verdemar123` → copiar UUID → rodar:
```sql
-- <UUID_SUPPLIER> = UUID gerado pelo Auth
INSERT INTO profiles (id, role, full_name, phone)
VALUES ('<UUID_SUPPLIER>', 'supplier', 'Fornecedor Teste', '11999990002');

INSERT INTO suppliers (
  id, store_name, description, whatsapp,
  min_order_value, delivery_days,
  delivery_hours_start, delivery_hours_end,
  address_city, address_state, is_active
) VALUES (
  '<UUID_SUPPLIER>',
  'Hortifrúti Verde Mar',
  'Frutas, legumes e verduras direto do produtor',
  '11999990002',
  100.00,
  ARRAY['monday','tuesday','wednesday','thursday','friday','saturday'],
  '06:00', '14:00',
  'São Paulo', 'SP', TRUE
);
```

### 8.6 Reconectar Vercel
Se perder o projeto no Vercel:
```bash
vercel login
vercel link            # escolher repo SuaresM/verdemar
# Definir env vars (opcional — já tem fallback hardcoded):
echo "https://vpomchqkkmjjeschanch.supabase.co" | vercel env add VITE_SUPABASE_URL production
# cole o anon key quando prompted:
vercel env add VITE_SUPABASE_ANON_KEY production
echo "5561995761820" | vercel env add VITE_SUPPORT_WHATSAPP production
# Repetir para preview/development se desejar
vercel --prod          # deploy manual
```

---

## 9. Troubleshooting Rápido

| Sintoma | Causa provável | Ação |
|---------|---------------|------|
| Login não funciona em produção | Service worker servindo bundle antigo | DevTools → Application → Service Workers → Unregister + hard refresh (Ctrl+Shift+R) |
| Login trava / "logs out" imediatamente | Env var VITE_SUPABASE_URL stale no Vercel | Fallback hardcoded já protege; verificar se `src/lib/supabaseClient.ts` está intacto |
| Mobile com zoom preso | Input < 16px OU service worker antigo | Confirmar `src/index.css` tem regra `@media (max-width: 640px)` com `font-size: 16px !important` |
| "Perfil não encontrado" após signup | Trigger `on_auth_user_created` removido/quebrado | Rodar `supabase-trigger.sql` novamente |
| Admin não consegue ver dados | RLS sem policy `is_admin()` | Rodar a seção `ADMIN ROLE SUPPORT` de `supabase-schema.sql` |
| 404 em refresh de rota interna | Falta SPA rewrite | `vercel.json` deve ter `{ "source": "/(.*)", "destination": "/index.html" }` |
| Upload de imagem falha | Bucket não existe ou não é Public | Criar `product-images` e `supplier-assets` como Public |
| Warning Supabase "mutable search_path" | Função sem `SET search_path` | Já corrigido em `update_updated_at`; repetir para novas funções |

---

## 10. Estado Atual (2026-04-19)

### Funcionando ✅
- Login/logout (admin, buyer, supplier) local e em produção.
- Cadastro (buyer + supplier) via trigger.
- Admin bloqueado no signup.
- Dashboard admin (contadores + pedidos recentes).
- Dashboard supplier (stats + pedidos recentes).
- Home buyer (categorias + produtos + fornecedores em destaque).
- Carrinho + checkout WhatsApp.
- RLS testada para todas as roles.
- PWA instalável.
- Onboarding intro.js por role.
- Mobile: inputs sem zoom automático iOS.
- Deploy automático Vercel em push para `main`.

### Pendências / Melhorias sugeridas
- [ ] Atualizar env vars no Dashboard Vercel para apontarem ao projeto correto (cosmético — fallback protege).
- [ ] Remover o default hardcoded em `supabaseClient.ts` depois que envs estiverem corretas no Vercel.
- [ ] Ampliar cobertura de testes além dos 34 atuais.
- [ ] Adicionar reset-password + e-mail de confirmação customizados.
- [ ] Notificação push (via service worker) para suppliers em novos pedidos.
- [ ] Histórico de pedidos com filtro por data/status para admin.
- [ ] CI (GitHub Actions) para rodar `npm run build && npm test` em PRs.

---

## 11. Comandos Úteis de Emergência

```bash
# Ver qual Supabase URL está compilado no bundle de produção:
curl -sS https://<verdemar>.vercel.app/assets/index-*.js | grep -o 'https://[a-z0-9-]*\.supabase\.co' | head -1

# Forçar recompilação e redeploy sem mudar código:
git commit --allow-empty -m "chore: trigger redeploy"
git push

# Testar login com SQL (sem passar pela UI):
-- Supabase SQL Editor
SELECT id, email, raw_user_meta_data FROM auth.users WHERE email = 'comprador@verdemar.com';
SELECT * FROM profiles WHERE id = '<UUID>';

# Limpar service worker local (DevTools Console):
navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
caches.keys().then(ks => ks.forEach(k => caches.delete(k)));

# Resetar onboarding (Console do app):
localStorage.removeItem('verdemar_onboarding_done_buyer');
localStorage.removeItem('verdemar_onboarding_done_supplier');
localStorage.removeItem('verdemar_onboarding_done_admin');
```

---

## 12. Contatos / Autor

- **Owner**: Juan Suares Moura — `jsuaresmoura@gmail.com`
- **Suporte WhatsApp (configurável via `VITE_SUPPORT_WHATSAPP`)**: `+55 61 99576-1820`

---

> **Regra de ouro para continuidade**: antes de rodar qualquer SQL destrutivo (DROP, TRUNCATE, etc.) — **sempre** fazer backup do `auth.users` e das tabelas do schema `public`. O admin UUID `65fe3c92-170b-433c-9c24-31085a5b4305` deve ser preservado em qualquer migração.
