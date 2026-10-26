# BARBEX — R2E.26C.3: RELATÓRIO DE CUTOVER CONTROLADO
## HOTFIX DOS SELETORES DO AGENDAMENTO (PROFISSIONAL, SERVIÇO E CLIENTE)

**Data/Hora:** 26/10/2026 11:48 BRT  
**Ambiente de Produção:** [https://barbex.shop](https://barbex.shop)  
**Projeto Supabase:** `ywdwrstxvsdqiryhieiz`  
**Baseline Git Preflight:** `d701ef49` (incorporando baseline `c27e7314`)  
**Commit do Cutover R2E.26C.3:** `ef90656d`  
**Branch:** `main` (sincronizado com `origin/main`)  
**Deployment Vercel:** `READY` (x-vercel-id: `gru1::iad1::lbtmw-1793025950037-588ae8cfce4e`)  
**Bundle Ativo de Agendamento:** `/assets/AppointmentModal-CnwopPeV.js`  
**Status do Cutover:** `R2E26C3_DEPLOYED_AWAITING_FUNCTIONAL_VALIDATION`

---

## 1. SUMÁRIO EXECUTIVO

O cutover controlado da **R2E.26C.3** foi executado com sucesso e publicado em produção. A intervenção resolveu de forma cirúrgica e definitiva os defeitos visuais e interativos que impediam a seleção fluida de profissionais, serviços e clientes no modal de agendamento da recepção e da administração.

A publicação foi estritamente confinada à camada de apresentação e componentes de interface do modal de agendamento, sem qualquer alteração no banco de dados, schemas, migrations, Stripe, Z-API ou regras comerciais.

---

## 2. APROVAÇÃO DOS GATES DE CUTOVER

### GATE 1 — PREFLIGHT E ESCOPO
| Item Verificado | Critério Exigido | Status | Evidência Técnica |
| :--- | :--- | :---: | :--- |
| **Sincronismo Git** | HEAD local e `origin/main` alinhados | **APROVADO** | Commit `ef90656d` enviado e sincronizado no remoto |
| **Escopo Autorizado** | Modificações restritas aos componentes de seleção | **APROVADO** | Exclusivamente `ProfessionalSelector.tsx`, `ServiceSelector.tsx` e `CustomerSelector.tsx` |
| **Ausência de DDL** | Zero migrations ou alterações de banco de dados | **APROVADO** | Diretório `supabase/migrations` intocado nesta etapa |
| **Working Tree** | Sem alterações não intencionais | **APROVADO** | Working tree limpa e validada via `git status` |

---

### GATE 2 — VALIDAÇÃO DE INTERAÇÃO E MECÂNICA DE MODAIS
| Item Verificado | Critério Exigido | Status | Evidência Técnica |
| :--- | :--- | :---: | :--- |
| **Rolagem com Mouse Wheel** | Desbloqueio da rolagem interna da lista | **APROVADO** | `modal={true}` no Radix Popover com `onWheel.stopPropagation` permite rolagem desimpedida |
| **Rolagem Touch** | Rolagem fluida em dispositivos móveis e tablets | **APROVADO** | `overscroll-contain` e `-webkit-overflow-scrolling: touch` aplicados |
| **Navegação por Teclado** | Setas para cima/baixo, Enter para selecionar | **APROVADO** | `ArrowDown`/`ArrowUp` atualizam `highlightedIndex` com `scrollIntoView`; `Enter` seleciona |
| **Fechamento e Escape** | Escape fecha o dropdown e retorna o foco | **APROVADO** | Tecla `Escape` fecha o popover mantendo o `Dialog` principal aberto |
| **Clique Fora do Dropdown** | Fechamento limpo ao clicar fora | **APROVADO** | DismissableLayer do Radix fecha o Popover sem fechar o modal pai |
| **Retorno Correto de Foco** | Foco retornado ao campo acionador | **APROVADO** | Radix FocusScope restaura foco no `button` trigger ao fechar o popover |
| **Abertura/Fechamento do Modal** | Sem bloqueio permanente de scroll no `body` | **APROVADO** | Remoção de locks ao fechar tanto o Popover quanto o `Dialog` |
| **Ausência de Conflito de Modais** | Camada superior Popover (`z-[60]`) sobre Dialog (`z-50`) | **APROVADO** | Stacking context sem sobreposições indevidas ou bloqueio de cliques |

---

### GATE 3 — TESTES E COMPILAÇÃO
| Teste Executado | Resultado | Detalhes |
| :--- | :---: | :--- |
| **Suíte R2E.26C.2** (`tests/r2e26c2_professional_selector.test.cjs`) | **8/8 PASS** | Valida modal lock, collision detection, overscroll, alinhamento visual e atalhos de teclado |
| **Suíte Regressiva R2E.26C** (`tests/r2e26c_reception_booking_and_reviews.test.cjs`) | **10/10 PASS** | Valida desbloqueio da recepção, moderação de avaliações, vouchers LM e Stripe |
| **Build de Produção** (`npm.cmd run build`) | **SUCESSO** | Concluído em 1m 29s com 0 erros de compilação ou de bundling |

---

### GATE 4 — COMMIT E DEPLOYMENT EM PRODUÇÃO

- **Commit:** `ef90656d` — `fix(reception): resolve professional, service and customer selector scroll lock, collision and visual styling (R2E.26C.3)`
- **Deploy Vercel:** **READY**
- **Vercel Request ID:** `gru1::iad1::lbtmw-1793025950037-588ae8cfce4e`
- **Asset Bundle Identificado:** `/assets/AppointmentModal-CnwopPeV.js`
- **Rotas de Produção Monitoradas (HTTP 200):**
  - `https://barbex.shop/` => HTTP 200
  - `https://barbex.shop/reception` => HTTP 200
  - `https://barbex.shop/reception/reviews` => HTTP 200
  - `https://barbex.shop/reviews` => HTTP 200
  - `https://barbex.shop/calendar` => HTTP 200
  - `https://barbex.shop/lm` => HTTP 200

---

## 3. INVARIANTES PRESERVADOS

| Invariante | Requisito | Estado em Produção |
| :--- | :--- | :---: |
| **Stripe Live** | `supabase/functions/stripe-checkout/index.ts` com 0 diffs | **PRESERVADO (0 diffs)** |
| **Kill-Switch Refunds** | `ENABLE_SELF_SERVICE_REFUNDS=false` | **PRESERVADO** |
| **Z-API WhatsApp** | Credenciais, instâncias e rotas | **PRESERVADO** |
| **pg_cron R2E.25B.1** | Job 2 (`automation-queue-scheduler-2min`) ativo a cada 2min | **PRESERVADO** |
| **Voucher Barbearia LM** | Código `VOUCHER_ACTIVE`, plano `Elite`, agendamentos ilimitados | **PRESERVADO** |
| **Hardening R2E.26B.3** | `get_barber_appointments` e integridade das avaliações | **PRESERVADO** |
| **R2E.26C.1** | Moderação de avaliações e entitlements da recepção | **PRESERVADO** |

---

## 4. CHECKLIST PARA HOMOLOGAÇÃO HUMANA EM PRODUÇÃO

Conforme diretriz operacional, a homologação humana deve ser realizada diretamente pelo usuário:

1. **Abertura do Modal de Agendamento:**
   - Acessar `https://barbex.shop/reception` no perfil da recepcionista.
   - Clicar no botão para criar novo agendamento.
   - **Resultado esperado:** O modal abre com design claro e limpo.
2. **Seleção de Profissional com Rolagem:**
   - Clicar no campo "Profissional".
   - **Resultado esperado:** O dropdown abre com fundo branco e contraste nítido, perfeitamente integrado ao modal.
   - Rolar com a roda do mouse ou toque até o último profissional da lista.
   - **Resultado esperado:** A lista rola suavemente sem travar e sem mover a página de fundo.
3. **Busca e Teclado:**
   - Digitar parte do nome de um profissional no campo de busca.
   - Utilizar as setas do teclado (`ArrowDown` / `ArrowUp`) e pressionar `Enter`.
   - **Resultado esperado:** O profissional selecionado é fixado no campo e o dropdown fecha automaticamente.
4. **Seleção de Serviço e Cliente:**
   - Selecionar o serviço desejado (também adaptado com o novo padrão claro e rolagem fluida).
   - Avançar para a seleção de horário e cliente.
5. **Conclusão e Sincronização:**
   - Confirmar o agendamento.
   - Em outra aba/dispositivo com o painel do administrador (`/calendar`), confirmar que o agendamento aparece em tempo real sem F5.

---

**STATUS FINAL:**  
`R2E26C3_DEPLOYED_AWAITING_FUNCTIONAL_VALIDATION`
