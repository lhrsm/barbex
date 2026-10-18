# BARBEX — R2E.21B.1
## HOTFIX COMPLEMENTAR DE UX — HEADER E ELEMENTOS FLUTUANTES
### RELATÓRIO DE IMPLEMENTAÇÃO, TESTES, NÃO REGRESSÃO E LISTA DE CANDIDATOS AO DEPLOY

---

### SUMÁRIO EXECUTIVO

- **Etapa:** `R2E.21B.1` — Hotfix Complementar de UX: Header e Elementos Flutuantes
- **Status:** `R2E21_B1_READY_FOR_DEPLOY_REVIEW`
- **Página de Referência:** `https://barbex.shop/lm`
- **Baseline Git:** Commit `8ce48f40` (pós-R2E.20D)
- **Instância Supabase:** `ywdwrstxvsdqiryhieiz` (Barbearia LM: Plano Elite, Voucher Permanente)
- **Isolamento de Segurança e Financeiro:**
  - `supabase/functions/stripe-checkout/index.ts` estritamente preservado intacto.
  - Zero alterações em RPCs (`create_public_appointment`, `get_availability_slots`, etc.), RLS, migrações, triggers ou Edge Functions.
  - **Zero commits, push ou deploys executados nesta etapa**.

---

### 1. ARQUIVOS MODIFICADOS

| Arquivo | Localização / Componente | Natureza da Modificação |
| :--- | :--- | :--- |
| `src/routes/$slug.tsx` | Header Público, PWA e Rodapé | Remoção do Instagram do header; logotipo e nome da barbearia legíveis no mobile (`< sm`); botão "Agendar Agora" com `whitespace-nowrap` e escala proporcional; remoção do CTA flutuante mobile duplicado e do espaçador inferior; incorporação do prompt PWA em seção contextual inline antes do rodapé; controle de ocultação e safe area no `BackToTopButton`. |
| `src/components/public/PortalStickyCta.tsx` | Barra de Conversão Mobile | Desativação segura do CTA flutuante inferior no mobile, eliminando a sobreposição de duas CTAs fixas simultâneas e preservando o header sticky como único ponto de conversão. |
| `src/components/pwa/InstallBarbexAppPrompt.tsx` | Prompt de Instalação PWA | Suporte à prop `hidden` (para modais), suporte ao modo integrado `variant="inline"`, safe area e reposicionamento não intrusivo. |
| `src/hooks/use-pwa-install.ts` | Hook de Ciclo de Vida do PWA | Aumento do tempo de persistência de dispensa (`DISMISS_DAYS`) de 7 para 30 dias para evitar reaparecimento contínuo e intrusivo. |
| `src/components/accessibility/AccessibilityWidget.tsx` | Botão Flutuante de Acessibilidade | Rebaixamento de `z-[60]` para `z-30` com safe area (`bottom-[calc(16px+env(safe-area-inset-bottom,0px))]`), garantindo posicionamento consistente à esquerda (`left-4 md:left-6`) e cedendo prioridade visual a todos os diálogos (`z-50`). |
| `tests/r2e21_b_public_booking_ux_fixes.test.cjs` | Suíte de Testes Automatizados | Atualização completa para cobrir as 5 fases da R2E.21B.1 (16/16 testes aprovados). |

---

### 2. CORREÇÕES REALIZADAS POR FASE

#### FASE 1 — REMOVER INSTAGRAM DO HEADER EM TODOS OS DISPOSITIVOS
- **Problema:** O ícone do Instagram no header competia por espaço com o botão "Agendar Agora" e o menu hambúrguer, gerando aperto visual e risco de quebra de linha em telas pequenas.
- **Solução:** O ícone/link do Instagram foi completamente removido da barra superior do header em todas as resoluções (Mobile, Tablet, Desktop e PWA).
- **Preservação:** O Instagram foi integralmente preservado nas seções de redes sociais, rodapé da página (`#contato`), drawer lateral e configurações administrativas.

#### FASE 2 — REORGANIZAR HEADER
- **Problema:** Em telas móveis (`< sm` / `< 640px`), o nome da barbearia estava oculto via `hidden sm:block`, exibindo apenas o logotipo redondo isolado. Além disso, a altura de 90px ocupava espaço excessivo.
- **Solução:**
  - O nome da barbearia agora é **plenamente visível e legível** em qualquer resolução, com truncamento elástico inteligente (`max-w-[110px] xs:max-w-[160px] sm:max-w-[220px] md:max-w-none`).
  - Em telas a partir de 360px (`xs:`), o subtítulo elegante *"Barbearia Premium"* também é exibido.
  - A altura do header foi otimizada para `h-16 sm:h-20 lg:h-[86px]` em repouso e compactada para `h-14 sm:h-16 lg:h-[72px]` ao rolar a página.
  - O botão "Agendar Agora" possui `whitespace-nowrap`, padding ajustado (`h-9 px-3.5 text-xs sm:h-11 sm:px-6 sm:text-sm`) e não sofre quebra de linha nem distorção.
  - O botão de menu hambúrguer acompanha a altura de 36px (`h-9 w-9`) no mobile, gerando harmonia e alinhamento vertical perfeito.

#### FASE 3 — REMOVER CTA FLUTUANTE DUPLICADO NO MOBILE
- **Problema:** No mobile, havia duas CTAs fixas disputando a atenção do cliente: o botão "Agendar Agora" no header fixo e a barra `PortalStickyCta` colada no rodapé.
- **Solução:**
  - O `PortalStickyCta` foi desativado no mobile, retornando `null`.
  - O espaçador vazio `<div className="md:hidden h-[calc(80px+...)]" />` no rodapé foi eliminado.
  - A conversão agora é garantida exclusivamente pelo header sticky compacto no topo, acessível a qualquer momento da rolagem.

#### FASE 4 — CORRIGIR O PROMPT PWA
- **Problema:** O prompt de instalação do app PWA ficava flutuando sobre a tela em posição fixa, cobrindo cards, botões ou textos e competindo com outros elementos flutuantes.
- **Solução:**
  - O prompt foi transformado em uma **seção contextual integrada ao conteúdo da página** (`variant="inline"`), posicionada naturalmente antes do rodapé.
  - Não flutua sobre o viewport, não bloqueia cliques nem interações com cards ou botões.
  - Permite dispensa imediata ("Agora não" ou "X"), gravando a preferência no `localStorage` por **30 dias** (`DISMISS_DAYS = 30`).
  - Recebe `hidden={isBookingOpen || isCartOpen}`, garantindo que não seja renderizado nem interfira durante o agendamento.
  - Preserva integralmente o fluxo de instalação PWA e o guia passo a passo para iOS Safari.

#### FASE 5 — CONTROLES DE ACESSIBILIDADE E VOLTAR AO TOPO
- **Problema:** Ambos os botões flutuantes utilizavam `z-[60]`, fazendo com que ficassem visíveis e clicáveis por cima do diálogo/backdrop do modal de agendamento (`z-50`). Além disso, não respeitavam safe areas no iOS de maneira uniforme.
- **Solução:**
  - **Acessibilidade:** Posicionado no canto inferior **esquerdo** (`left-4 md:left-6`), com `bottom-[calc(16px+env(safe-area-inset-bottom,0px))]`, área de toque generosa (48x48px) e z-index `z-30` (cedendo prioridade a qualquer modal/diálogo `z-50`).
  - **Voltar ao Topo:** Posicionado no canto inferior **direito** (`right-4 md:right-6`), com `bottom-[calc(20px+env(safe-area-inset-bottom,0px))]`, z-index `z-30` e desativação explícita (`hidden={isBookingOpen || isCartOpen}`) quando o modal de agendamento ou carrinho estiver aberto.
  - **Zero Sobreposição:** Um botão no extremo esquerdo e outro no extremo direito, sem qualquer colisão entre si.

---

### 3. COMPARAÇÃO ANTES / DEPOIS (EVIDÊNCIAS DE UX)

| Elemento / Viewport | Antes (R2E.21B) | Depois (R2E.21B.1) |
| :--- | :--- | :--- |
| **Header (Instagram)** | Ícone do Instagram visível ao lado do botão de agendamento. | Ícone removido do header em todos os dispositivos; preservado no rodapé e menu. |
| **Header Mobile (Nome)** | Oculto via `hidden sm:block`. Apenas a logo aparecia. | Logotipo e nome "Barbearia LM" visíveis e legíveis com truncamento responsivo. |
| **Header Mobile (Altura)** | `h-[90px]` fixo em repouso e `h-[76px]` scrolled. | `h-16` (64px) em repouso e `h-14` (56px) scrolled: compacto e leve. |
| **Botão Agendar Agora** | Min-width 130px com risco de compressão em 320px. | `h-9 px-3.5 text-xs whitespace-nowrap`, sem quebra de texto em 320px–1440px. |
| **CTA Flutuante Mobile** | Barra inferior fixa `PortalStickyCta` colidindo com a tela. | Removida no mobile; foco no header sticky único e acessível. |
| **Prompt PWA** | Card flutuante fixo empilhado sobre o rodapé da tela. | Seção contextual elegante integrada ao conteúdo da página (`variant="inline"`). |
| **Dispensa do PWA** | Expiração em 7 dias com risco de reaparecimento intrusivo. | Expiração estendida para 30 dias em `localStorage`. |
| **Acessibilidade vs Modal** | `z-[60]` flutuava sobre o modal de agendamento. | `z-30` e safe area; o modal (`z-50`) cobre a tela com total primazia. |
| **Voltar ao Topo vs Modal** | `z-[60]` visível no canto durante o agendamento. | Ocultado automaticamente via `hidden={isBookingOpen || isCartOpen}` e `z-30`. |

---

### 4. RESULTADO DOS TESTES

1. **Suíte R2E.21B & R2E.21B.1 (Header, PWA, CTAs e Fluxo Público):**
   - Comando: `node tests/r2e21_b_public_booking_ux_fixes.test.cjs`
   - Resultado: **16/16 testes APROVADOS (100% PASS)**
   ```
   [PASS] Test 1: R2E.21B.1 FASE 1: Instagram icon/link removed from the public header
   [PASS] Test 2: R2E.21B.1 FASE 2: Barbershop name is visible and legible on mobile (< sm)
   [PASS] Test 3: R2E.21B.1 FASE 2: Header has compact responsive heights and whitespace-nowrap booking button
   [PASS] Test 4: R2E.21B.1 FASE 3: Duplicate floating mobile CTA is removed in favor of sticky header
   [PASS] Test 5: R2E.21B.1 FASE 4: InstallBarbexAppPrompt is integrated in-page and hidden during modals
   [PASS] Test 6: R2E.21B.1 FASE 5: AccessibilityWidget uses z-30, safe area, and left-side positioning
   [PASS] Test 7: R2E.21B.1 FASE 5: BackToTopButton uses z-30, safe area, and hides during booking/cart modals
   [PASS] Test 8: R2E.21B FASE 2: Step 1 mobile banner is compacted to h-[96px]
   [PASS] Test 9: R2E.21B FASE 2: Step 1 PhoneInput borders and radius are aligned without seams
   [PASS] Test 10: R2E.21B FASE 2: Step 1 benefits list is compacted into a 2-column grid
   [PASS] Test 11: R2E.21B FASE 2: Step 1 provides clear guidance when terms are unaccepted
   [PASS] Test 12: R2E.21B FASE 3: Step 3 renders informative empty state when no barbers available for service/date
   [PASS] Test 13: R2E.21B FASE 4: Step 4 provides clear action to alter date or barber
   [PASS] Test 14: R2E.21B FASE 5: Step 5 validates real PIX configuration before showing PIX option
   [PASS] Test 15: R2E.21B FASE 6: Marketplace categories use w-full instead of w-screen -mx-4
   [PASS] Test 16: R2E.21B FASE 6: Secondary PhoneInput in identify modal has aligned border radiuses
   ```

2. **Suíte Institucional R2E.20D:**
   - Comando: `node tests/r2e20_b_institutional_ui_validation.test.cjs`
   - Resultado: **19/19 testes APROVADOS (100% PASS)**

3. **Suíte Comercial R2E.19.9:**
   - Comando: `npx tsx tests/r2e19_9_commercial_homologation.test.cjs`
   - Resultado: **28/28 testes APROVADOS (100% PASS)**

---

### 5. RESULTADO DO BUILD DE PRODUÇÃO

- Comando: `npm run build`
- Resultado: **Sucesso absoluto** sem erros de compilação ou de empacotamento.

---

### 6. PENDÊNCIAS E ANÁLISE DE RISCO

- **Pendências Técnicas:** Nenhuma. Todos os 5 requisitos da R2E.21B.1 foram implementados e validados.
- **Risco de Quebra:** Nulo. Nenhuma RPC de disponibilidade (`get_availability_slots`) ou de criação de agendamento (`create_public_appointment`) foi tocada. O fluxo de 5 passos do agendamento foi preservado integralmente.
- **Isolamento:** `supabase/functions/stripe-checkout/index.ts` permanece intocado.

---

### 7. LISTA EXATA DOS ARQUIVOS CANDIDATOS AO COMMIT R2E.21C

Os seguintes arquivos compõem o conjunto atômico homologado para commit e deploy na etapa R2E.21C:

1. `src/routes/$slug.tsx`
2. `src/components/public/PortalStickyCta.tsx`
3. `src/components/pwa/InstallBarbexAppPrompt.tsx`
4. `src/components/accessibility/AccessibilityWidget.tsx`
5. `src/hooks/use-pwa-install.ts`
6. `tests/r2e21_b_public_booking_ux_fixes.test.cjs`
7. `BARBEX_R2E21_B_PUBLIC_BOOKING_UX_FIXES_REPORT.md`
8. `BARBEX_R2E21_B1_MOBILE_HEADER_FLOATING_ELEMENTS_REPORT.md`

*(O arquivo local `supabase/functions/stripe-checkout/index.ts` continuará estritamente de fora do commit).*

---

### STATUS FINAL

```
R2E21_B1_READY_FOR_DEPLOY_REVIEW
```
