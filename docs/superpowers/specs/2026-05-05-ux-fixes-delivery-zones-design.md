# Design: UX Fixes (Approach B) + Sistema de Zonas de Entrega

**Data:** 2026-05-05  
**Status:** Aprovado  
**Objetivo:** Melhorar conversão e retenção de compradores e fornecedores através de correções de primeira experiência e um sistema de zonas de entrega por cidade com dias e horários configuráveis.

---

## 1. Contexto

O sistema Rota Verde é um marketplace B2B de hortifrúti mobile-first. Foram identificados cinco problemas críticos que prejudicam a primeira experiência dos usuários, e uma lacuna funcional importante: fornecedores não conseguem informar quais cidades atendem, em quais dias e horários.

---

## 2. Escopo

### 2A — Correções de Primeira Experiência (Approach B)

#### Fix 1 — `total_sold` / `total_sales` nunca incrementados

**Problema:** A seção "Mais Vendidos" da home sempre exibe os mesmos produtos porque os contadores nunca são atualizados após a criação de pedidos.

**Solução:** Na rota Hono `POST /orders`, após inserir o pedido e os itens, executar:
- `UPDATE products SET total_sold = total_sold + quantity WHERE id IN (item_ids)` — somando a quantidade de cada item
- `UPDATE suppliers SET total_sales = total_sales + order.total_value WHERE id = supplier_id`

Ambas as operações dentro da mesma transação do pedido.

---

#### Fix 2 — Busca exige Enter manual / categoria não dispara busca

**Problema:** Ao vir da home clicando em uma categoria, a tela de busca mostra "Digite algo e pressione Enter" mesmo com a categoria já ativa no parâmetro `?category=`. Além disso, digitar no campo não dispara busca automaticamente.

**Solução:**
- O `useEffect` que lê `searchParams` já busca corretamente, mas a flag `hasSearched` impede a renderização dos resultados — corrigir para setar `hasSearched: true` antes do fetch
- Adicionar debounce de 400ms no campo de texto: quando o usuário para de digitar, a busca dispara automaticamente sem precisar pressionar Enter
- Manter Enter como atalho alternativo

---

#### Fix 3 — Sem reorder no histórico de pedidos

**Problema:** Compradores B2B repetem pedidos semanalmente mas precisam refazer todo o processo manualmente.

**Solução:** Adicionar botão "Repetir pedido" em cada card expandido do `OrderHistory`:
- Lê os itens do pedido histórico
- Faz fetch dos produtos atuais do Supabase (`getProductsBySupplier`) para verificar se cada produto ainda existe e está disponível (`is_available: true`)
- Itens disponíveis são adicionados ao `cartStore` com `addItem()`
- Itens indisponíveis são listados em um toast de aviso
- Navega para `/cart` ao final

---

#### Fix 4 — Fornecedor sem produtos fica invisível

**Problema:** Fornecedor recém-cadastrado aparece na listagem de fornecedores mas seu perfil está vazio, prejudicando a confiança do comprador e a taxa de ativação do fornecedor.

**Solução:** No `Dashboard` do fornecedor, carregar a contagem de produtos via `getProductsBySupplier`. Se `products.length === 0`, exibir banner de alerta amarelo acima das estatísticas:

> "Seu catálogo está vazio. Compradores não encontrarão seus produtos. [Adicionar primeiro produto →]"

O CTA navega para `/supplier/products/new`.

---

#### Fix 5 — `whatsapp_sent` nunca atualiza

**Problema:** O campo `whatsapp_sent` existe na tabela `orders` mas sempre permanece `false`, tornando-o inútil para o fornecedor e o admin saberem se o pedido foi comunicado.

**Solução:** Na tela de sucesso do checkout (`Cart.tsx`), quando o comprador toca em "Enviar pedido no WhatsApp", disparar `PATCH /orders/:id/status-whatsapp` que seta `whatsapp_sent: true`. A chamada é fire-and-forget (não bloqueia a abertura do WhatsApp).

---

### 2B — Sistema de Zonas de Entrega

#### Modelo de Dados

Nova tabela `delivery_zones` no Supabase:

```sql
CREATE TABLE delivery_zones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  city        TEXT NOT NULL,
  state       TEXT NOT NULL,
  days        TEXT[] NOT NULL,         -- ex: ['monday', 'wednesday']
  hours_start TEXT NOT NULL,           -- ex: '06:00'
  hours_end   TEXT NOT NULL,           -- ex: '09:00'
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

-- Leitura pública (compradores precisam ver)
CREATE POLICY "delivery_zones_select" ON delivery_zones
  FOR SELECT USING (true);

-- Escrita apenas pelo próprio fornecedor
CREATE POLICY "delivery_zones_insert" ON delivery_zones
  FOR INSERT WITH CHECK (supplier_id = auth.uid());

CREATE POLICY "delivery_zones_update" ON delivery_zones
  FOR UPDATE USING (supplier_id = auth.uid());

CREATE POLICY "delivery_zones_delete" ON delivery_zones
  FOR DELETE USING (supplier_id = auth.uid());
```

Os campos `delivery_days`, `delivery_hours_start`, `delivery_hours_end` da tabela `suppliers` permanecem como **fallback global** — não são removidos, garantindo compatibilidade com dados existentes.

---

#### Lista de Cidades (Constante Compartilhada)

Arquivo: `src/constants/cities.ts`

```
Regiões Administrativas do DF:
Brasília, Gama, Taguatinga, Brazlândia, Sobradinho, Planaltina, Paranoá,
Núcleo Bandeirante, Ceilândia, Guará, Cruzeiro, Samambaia, Santa Maria,
São Sebastião, Recanto das Emas, Lago Sul, Lago Norte, Riacho Fundo,
Riacho Fundo II, Candangolândia, Águas Claras, Sudoeste/Octogonal,
Varjão, Park Way, Estrutural, Sobradinho II, Jardim Botânico, Itapoã,
Vicente Pires, Fercal

Entorno GO:
Luziânia, Formosa, Planaltina de Goiás, Cidade Ocidental, Novo Gama,
Valparaíso de Goiás, Santo Antônio do Descoberto, Águas Lindas de Goiás,
Cristalina, Alexânia

Entorno MG:
Unaí
```

Cada entrada é um objeto `{ city: string, state: string }` para preencher os dois campos automaticamente.

---

#### Cadastro do Comprador — Alteração

O campo `address_city` no formulário de registro (`Register.tsx`) passa de `<input type="text">` para um `<select>` ou combobox com busca usando a lista de cidades. O campo `address_state` é preenchido automaticamente ao selecionar a cidade (sem interação extra do usuário).

---

#### Painel do Fornecedor — Gerenciamento de Zonas

Em `StoreSettings.tsx`, nova seção "Zonas de Entrega" substituindo os campos globais atuais:

- **Lista de zonas cadastradas:** cards com cidade, estado, dias (abreviados: Seg, Ter...) e horário
- **Botão "Adicionar cidade":** abre bottom sheet com:
  - Combobox de cidade (busca na lista fechada, preenche estado automaticamente)
  - Checkboxes de dias da semana
  - Inputs de horário início e fim
  - Botão "Salvar zona"
- **Editar / Remover:** cada card tem ações inline

Escritas via rotas Hono (padrão do projeto):
- `POST /supplier/delivery-zones` — criar zona
- `PUT /supplier/delivery-zones/:id` — atualizar zona
- `DELETE /supplier/delivery-zones/:id` — remover zona

Leituras direto no Supabase (padrão do projeto para reads):
- `getDeliveryZonesBySupplier(supplierId)` — lista zonas de um fornecedor (RLS permite leitura pública)

---

#### Experiência do Comprador

**Perfil do Fornecedor (`SupplierProfile.tsx`):**

Nova seção "Entrega na sua região":
- Se o comprador tem cidade cadastrada e o fornecedor tem uma zona para essa cidade: exibir badge verde com os dias e horário. Ex: *"Entrega em Taguatinga: Ter, Qui — 06:00 às 09:00"*
- Se o fornecedor tem zonas mas nenhuma para a cidade do comprador: *"Este fornecedor não entrega em [cidade]. Consulte pelo WhatsApp."*
- Se o fornecedor não tem zonas cadastradas: exibir os dias/horários globais do `supplier` como fallback

**Carrinho (`Cart.tsx`):**

Ao renderizar cada seção de fornecedor, verificar se:
1. O buyer tem cidade cadastrada
2. O fornecedor tem zonas cadastradas
3. A cidade do buyer não está entre as zonas

Se todas as condições forem verdadeiras: exibir aviso amarelo acima do botão de checkout:
> "⚠️ Este fornecedor pode não entregar em [cidade]. Confirme antes de finalizar."

O aviso é informativo — não bloqueia o checkout.

---

## 3. Arquivos Impactados

| Arquivo | Mudança |
|---|---|
| `src/constants/cities.ts` | Novo — lista de cidades |
| `src/types/index.ts` | Novo tipo `DeliveryZone` |
| `src/services/supabase.ts` | Funções CRUD de `delivery_zones` |
| `src/pages/public/Register.tsx` | Campo cidade vira combobox |
| `src/pages/supplier/StoreSettings.tsx` | Seção de zonas de entrega |
| `src/pages/buyer/SupplierProfile.tsx` | Seção de entrega na região |
| `src/pages/buyer/OrderHistory.tsx` | Botão reorder |
| `src/pages/buyer/Cart.tsx` | Aviso de cidade + fix whatsapp_sent |
| `src/pages/supplier/Dashboard.tsx` | Banner produto vazio |
| `src/pages/buyer/Search.tsx` | Debounce + fix hasSearched |
| API Hono (server) | Fix total_sold, whatsapp_sent, CRUD zonas |
| Supabase migration | Tabela `delivery_zones` + RLS |

---

## 4. O que está fora do escopo

- Bloqueio de checkout por cidade não atendida (aviso apenas, sem bloqueio)
- Sistema de avaliação de fornecedores
- Catálogo público sem login
- Pagamento por Pix
- Notificações em tempo real de status de pedido

---

## 5. Ordem de implementação sugerida

1. Constante de cidades
2. Migração Supabase (`delivery_zones`)
3. Tipos TypeScript
4. Serviços Supabase + rotas Hono
5. Fix busca (Search.tsx)
6. Fix total_sold (API Hono)
7. Fix whatsapp_sent (Cart.tsx)
8. Reorder (OrderHistory.tsx)
9. Banner fornecedor vazio (Dashboard.tsx)
10. Combobox cidade no cadastro (Register.tsx)
11. Zonas no painel do fornecedor (StoreSettings.tsx)
12. Visualização no perfil do fornecedor (SupplierProfile.tsx)
13. Aviso no carrinho (Cart.tsx)
