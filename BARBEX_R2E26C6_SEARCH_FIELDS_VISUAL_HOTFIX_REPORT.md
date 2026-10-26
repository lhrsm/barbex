# BARBEX — R2E.26C.6
# RELATÓRIO DE HOTFIX VISUAL PONTUAL: BUSCAS E BOTÃO NOVO CLIENTE

**Data:** 26 de Outubro de 2026  
**Ambiente:** Produção ([https://barbex.shop/reception](https://barbex.shop/reception))  
**Baseline Git:** `e5bb8261` (R2E.26C.5)  
**Status:** `R2E26C6_READY_FOR_AUTHORIZATION`  
*(Nenhum commit, push ou deploy foi executado sem autorização prévia).*

---

## 1. CAUSA RAIZ IDENTIFICADA

A investigação forense no código-fonte revelou a causa exata dos 3 defeitos visuais relatados:

1. **Campos de busca escuros (`ProfessionalSelector`, `CustomerSelector`, `ServiceSelector`):**
   - Os seletores utilizavam o componente compartilhado `<Input />` (`src/components/ui/input.tsx`).
   - No arquivo `src/components/ui/input.tsx` (linhas 11-17), o componente possui classes globais hardcoded para tema escuro:
     - `bg-[#15171B]`
     - `text-white`
     - `hover:bg-[#151D2C]`
     - `focus-visible:bg-[#151D2C]`
     - `[[data-state=open]_&]:bg-[#151D2C]` e `[[data-state=open]_&]:text-white`
   - Como os menus dropdown abrem via Radix Popover com atributo `data-state="open"`, o seletor CSS `[[data-state=open]_&]:bg-[#151D2C]` possuía especificidade qualificada por atributo superior a classes utilitárias isoladas como `bg-transparent`.
   - Consequentemente, o input interno sempre forçava o fundo azul-marinho/preto `#151D2C` com texto branco.

2. **Botão "Novo cliente" cinza (`CustomerSelector.tsx`):**
   - O botão estava declarado com `variant="outline"` simples (`<Button variant="outline" ...>`).
   - A variante `outline` herda os tokens de borda e fundo da base shadcn, resultando em um botão cinza apagado sem o destaque dourado exigido pela identidade da marca.

3. **Diálogo de cadastro de novo cliente (`AppointmentModal.tsx`):**
   - Utilizava o mesmo `<Input />` escuro e botão de cadastro preto neutro, apresentando inconsistência com o restante do wizard claro.

---

## 2. ARQUIVOS ALTERADOS

| Arquivo | Modificações Realizadas |
| :--- | :--- |
| [ProfessionalSelector.tsx](file:///c:/Antigravity/Barbex/barbex/src/components/calendar/appointment/ProfessionalSelector.tsx) | Substituição do `<Input />` por `<input />` nativo estilizado, removendo a herança de `bg-[#151D2C]`. Fundo claro `bg-zinc-50/80`, texto `text-zinc-900`, placeholder `placeholder:text-zinc-500`, borda `border-zinc-200/80`, foco dourado `focus-within:border-gold/60 focus-within:ring-2 focus-within:ring-gold/30` e botão de limpar com contraste `text-zinc-400 hover:text-zinc-700`. |
| [CustomerSelector.tsx](file:///c:/Antigravity/Barbex/barbex/src/components/calendar/appointment/CustomerSelector.tsx) | **Botão "Novo cliente":** Estilizado em dourado vibrante (`bg-gold text-black font-bold text-xs hover:bg-gold-500 shadow-xs focus-visible:ring-gold/50`).<br>**Campo de busca:** Padronizado com input claro nativo, texto escuro e anel de foco dourado. |
| [ServiceSelector.tsx](file:///c:/Antigravity/Barbex/barbex/src/components/calendar/appointment/ServiceSelector.tsx) | Verificação complementar confirmou o mesmo defeito no seletor de serviços. Aplicada a mesma correção com input nativo claro e foco dourado. |
| [AppointmentModal.tsx](file:///c:/Antigravity/Barbex/barbex/src/components/calendar/AppointmentModal.tsx) | Harmonização do modal interno de "Cadastrar novo cliente" com `DialogContent bg-white text-zinc-900`, inputs claros e botão "Cadastrar cliente" em dourado (`bg-gold text-black hover:bg-gold-500`). |

---

## 3. COMPARATIVO VISUAL ANTES vs DEPOIS

| Elemento | Antes (R2E.26C.5) | Depois (R2E.26C.6) |
| :--- | :--- | :--- |
| **Busca de Profissionais** | Caixa escura `#151D2C`, placeholder apagado e texto branco forçado por `[[data-state=open]_&]`. | Fundo claro `bg-zinc-50/80` (branco ao foco), texto nítido `text-zinc-900`, placeholder legível `text-zinc-500` e anel de foco dourado. |
| **Botão "Novo cliente"** | Botão cinza apagado (`variant="outline"`), pouco convidativo e sem destaque. | Botão dourado destacado (`bg-gold text-black font-bold hover:bg-gold-500 shadow-xs`), ícone `UserPlus` reforçado e cursor pointer. |
| **Busca de Clientes** | Caixa escura herdando `#151D2C` dentro do popover branco. | Input claro, integrado ao container do popover, texto escuro legível e foco dourado. |
| **Busca de Serviços** | Caixa escura idêntica à de profissionais. | Input claro harmonizado, placeholder "Buscar serviço..." legível e anel dourado. |
| **Modal Cadastrar Cliente** | Caixa de diálogo escura com inputs pretos. | Diálogo branco `bg-white text-zinc-900`, inputs com borda suave e botão de salvar em dourado. |

---

## 4. TESTES E VALIDAÇÕES EXECUTADAS

### 4.1. Suíte de Testes Específica R2E.26C.6
Arquivo: [r2e26c6_search_and_new_customer_hotfix.test.cjs](file:///c:/Antigravity/Barbex/barbex/tests/r2e26c6_search_and_new_customer_hotfix.test.cjs)
```text
==============================================================================
BARBEX R2E.26C.6 — SEARCH & NEW CUSTOMER HOTFIX TEST SUITE
==============================================================================
[PASS] TEST-1-PROFESSIONAL-SEARCH-LIGHT-STYLING
[PASS] TEST-2-CUSTOMER-NEW-CLIENT-BUTTON-GOLD
[PASS] TEST-3-CUSTOMER-SEARCH-LIGHT-STYLING
[PASS] TEST-4-SERVICE-SEARCH-LIGHT-STYLING
[PASS] TEST-5-NEW-CUSTOMER-DIALOG-HARMONY
[PASS] TEST-6-NO-REGRESSION-ACTIONS
==============================================================================
TOTAL DE TESTES: 6 | PASSOU: 6 | FALHOU: 0
==============================================================================
```

### 4.2. Testes de Regressão Anteriores
1. `node tests/r2e26c4_wizard_ui_visual_integrity.test.cjs` -> **8/8 PASSOU**
2. `node tests/r2e26c2_professional_selector.test.cjs` -> **8/8 PASSOU**
3. `node tests/r2e26c_reception_booking_and_reviews.test.cjs` -> **10/10 PASSOU**
**Total Acumulado:** 32/32 testes aprovados sem falhas.

### 4.3. Compilação TypeScript e Vite
```bash
npm.cmd run build
```
**Resultado:** `✓ built in 1m 27s` — 0 erros de compilação ou de tipo.

---

## 5. DIFF COMPLETO DAS ALTERAÇÕES

```diff
diff --git a/src/components/calendar/AppointmentModal.tsx b/src/components/calendar/AppointmentModal.tsx
index 28e826f0..4fbab9f5 100644
--- a/src/components/calendar/AppointmentModal.tsx
+++ b/src/components/calendar/AppointmentModal.tsx
@@ -847,14 +847,14 @@ export function AppointmentModal({
           if (!open) setNewCustomer({ name: "", phone: "" });
         }}
       >
-        <DialogContent className="rounded-[24px] border border-gold/20 sm:max-w-[425px]">
+        <DialogContent className="rounded-[24px] border border-gold/20 sm:max-w-[425px] bg-white text-zinc-900 shadow-2xl p-6">
           <DialogHeader>
-            <DialogTitle className="text-lg font-black uppercase tracking-tight italic">Cadastrar novo cliente</DialogTitle>
+            <DialogTitle className="text-lg font-black uppercase tracking-tight text-zinc-900">Cadastrar novo cliente</DialogTitle>
           </DialogHeader>
           <div className="space-y-4 py-2">
-            <div className="space-y-2">
-              <Label htmlFor="new-customer-name" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Nome completo</Label>
-              <Input
+            <div className="space-y-1.5">
+              <Label htmlFor="new-customer-name" className="text-xs font-bold uppercase tracking-wide text-zinc-500">Nome completo</Label>
+              <input
                 id="new-customer-name"
                 placeholder="Nome do cliente"
                 value={newCustomer.name}
@@ -861,10 +861,10 @@ export function AppointmentModal({
                 autoComplete="off"
-                className="h-12 rounded-xl border-zinc-200 focus:ring-gold/30"
-              />
+                className="flex h-11 w-full rounded-xl border border-zinc-200/90 bg-zinc-50/80 px-3.5 py-2 text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition-all"
+              />
             </div>
-            <div className="space-y-2">
-              <Label htmlFor="new-customer-phone" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Telefone</Label>
-              <Input
+            <div className="space-y-1.5">
+              <Label htmlFor="new-customer-phone" className="text-xs font-bold uppercase tracking-wide text-zinc-500">Telefone</Label>
+              <input
                 id="new-customer-phone"
                 placeholder="(00) 00000-0000"
                 value={newCustomer.phone}
@@ -871,13 +871,13 @@ export function AppointmentModal({
                 autoComplete="off"
-                className="h-12 rounded-xl border-zinc-200 focus:ring-gold/30"
-              />
+                className="flex h-11 w-full rounded-xl border border-zinc-200/90 bg-zinc-50/80 px-3.5 py-2 text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition-all"
+              />
             </div>
           </div>
-          <DialogFooter className="gap-2 sm:gap-0">
+          <DialogFooter className="gap-2 sm:gap-2 pt-2">
             <Button
               type="button"
               variant="ghost"
-              className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-red-500"
+              className="text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-900 rounded-xl h-10 px-4"
               onClick={() => {
                 setIsNewCustomerDialogOpen(false);
                 setNewCustomer({ name: "", phone: "" });
@@ -885,7 +885,7 @@ export function AppointmentModal({
               Cancelar
             </Button>
             <Button
-              className="bg-black text-white hover:bg-zinc-800 rounded-xl h-10 px-6 font-black uppercase tracking-widest text-[10px]"
+              className="bg-gold text-black hover:bg-gold-500 rounded-xl h-10 px-6 font-bold uppercase tracking-wider text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
               onClick={handleCreateCustomer}
               disabled={isLoading || !newCustomer.name}
             >

diff --git a/src/components/calendar/appointment/CustomerSelector.tsx b/src/components/calendar/appointment/CustomerSelector.tsx
index 6f94852c..2e82211b 100644
--- a/src/components/calendar/appointment/CustomerSelector.tsx
+++ b/src/components/calendar/appointment/CustomerSelector.tsx
@@ -82,12 +82,10 @@ export function CustomerSelector({ customers, value, onChange, onCreateNew, erro
         </label>
         <Button
           type="button"
-          variant="outline"
-          size="sm"
           onClick={onCreateNew}
-          className="h-8 gap-1.5 rounded-lg text-xs font-semibold"
+          className="h-8 gap-1.5 rounded-xl bg-gold text-black font-bold text-xs hover:bg-gold-500 shadow-xs transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-gold/50 disabled:opacity-50 disabled:cursor-not-allowed"
         >
-          <UserPlus className="h-3.5 w-3.5" />
+          <UserPlus className="h-3.5 w-3.5 stroke-[2.5]" />
           Novo cliente
         </Button>
       </div>
@@ -138,10 +136,11 @@ export function CustomerSelector({ customers, value, onChange, onCreateNew, erro
           collisionPadding={12}
           className="w-[--radix-popover-trigger-width] min-w-[280px] max-w-[calc(100vw-32px)] p-0 bg-white border border-zinc-200/90 rounded-2xl shadow-2xl z-[60] overflow-hidden text-zinc-900"
         >
-          <div className="flex items-center gap-2.5 border-b border-zinc-100 px-3.5 py-2.5 bg-zinc-50/70">
+          <div className="flex items-center gap-2.5 border-b border-zinc-200/80 px-3.5 py-2 bg-zinc-50/80 focus-within:bg-white focus-within:border-gold/60 focus-within:ring-2 focus-within:ring-gold/30 transition-all">
             <Search className="h-4 w-4 shrink-0 text-zinc-400" />
-            <Input
+            <input
               ref={inputRef}
+              type="text"
               value={query}
               onChange={(e) => {
                 setQuery(e.target.value);
@@ -150,7 +149,7 @@ export function CustomerSelector({ customers, value, onChange, onCreateNew, erro
               onKeyDown={handleKeyDown}
               placeholder="Buscar por nome, telefone ou e-mail..."
               aria-label="Buscar cliente"
-              className="h-8 border-0 bg-transparent p-0 text-xs font-medium text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-0 shadow-none"
+              className="h-8 w-full border-0 bg-transparent p-0 text-xs font-semibold text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-0"
             />
             {query && (
               <button
@@ -159,7 +158,7 @@ export function CustomerSelector({ customers, value, onChange, onCreateNew, erro
                   setQuery("");
                   inputRef.current?.focus();
                 }}
-                className="text-zinc-400 hover:text-zinc-600 p-0.5 rounded transition-colors"
+                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-md transition-colors cursor-pointer"
               >
                 <X className="h-3.5 w-3.5" />
               </button>

diff --git a/src/components/calendar/appointment/ProfessionalSelector.tsx b/src/components/calendar/appointment/ProfessionalSelector.tsx
index db2f0ede..25ac0562 100644
--- a/src/components/calendar/appointment/ProfessionalSelector.tsx
+++ b/src/components/calendar/appointment/ProfessionalSelector.tsx
@@ -135,10 +135,11 @@ export function ProfessionalSelector({ barbers, value, onChange, error }: Props)
           className="w-[--radix-popover-trigger-width] min-w-[280px] max-w-[calc(100vw-32px)] p-0 bg-white border border-zinc-200/90 rounded-2xl shadow-2xl z-[60] overflow-hidden text-zinc-900"
         >
           {/* Campo de Busca */}
-          <div className="flex items-center gap-2.5 border-b border-zinc-100 px-3.5 py-2.5 bg-zinc-50/70">
+          <div className="flex items-center gap-2.5 border-b border-zinc-200/80 px-3.5 py-2 bg-zinc-50/80 focus-within:bg-white focus-within:border-gold/60 focus-within:ring-2 focus-within:ring-gold/30 transition-all">
             <Search className="h-4 w-4 shrink-0 text-zinc-400" />
-            <Input
+            <input
               ref={inputRef}
+              type="text"
               value={query}
               onChange={(e) => {
                 setQuery(e.target.value);
@@ -147,7 +148,7 @@ export function ProfessionalSelector({ barbers, value, onChange, error }: Props)
               onKeyDown={handleKeyDown}
               placeholder="Buscar profissional por nome..."
               aria-label="Buscar profissional"
-              className="h-8 border-0 bg-transparent p-0 text-xs font-medium text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-0 shadow-none"
+              className="h-8 w-full border-0 bg-transparent p-0 text-xs font-semibold text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-0"
             />
             {query && (
               <button
@@ -156,7 +157,7 @@ export function ProfessionalSelector({ barbers, value, onChange, error }: Props)
                   setQuery("");
                   inputRef.current?.focus();
                 }}
-                className="text-zinc-400 hover:text-zinc-600 p-0.5 rounded transition-colors"
+                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-md transition-colors cursor-pointer"
               >
                 <X className="h-3.5 w-3.5" />
               </button>

diff --git a/src/components/calendar/appointment/ServiceSelector.tsx b/src/components/calendar/appointment/ServiceSelector.tsx
index b167a94b..0b42e3ff 100644
--- a/src/components/calendar/appointment/ServiceSelector.tsx
+++ b/src/components/calendar/appointment/ServiceSelector.tsx
@@ -133,10 +133,11 @@ export function ServiceSelector({ services, value, onChange, disabled, error, wa
           collisionPadding={12}
           className="w-[--radix-popover-trigger-width] min-w-[280px] max-w-[calc(100vw-32px)] p-0 bg-white border border-zinc-200/90 rounded-2xl shadow-2xl z-[60] overflow-hidden text-zinc-900"
         >
-          <div className="flex items-center gap-2.5 border-b border-zinc-100 px-3.5 py-2.5 bg-zinc-50/70">
+          <div className="flex items-center gap-2.5 border-b border-zinc-200/80 px-3.5 py-2 bg-zinc-50/80 focus-within:bg-white focus-within:border-gold/60 focus-within:ring-2 focus-within:ring-gold/30 transition-all">
             <Search className="h-4 w-4 shrink-0 text-zinc-400" />
-            <Input
+            <input
               ref={inputRef}
+              type="text"
               value={query}
               onChange={(e) => {
                 setQuery(e.target.value);
@@ -145,7 +146,7 @@ export function ServiceSelector({ services, value, onChange, disabled, error, wa
               onKeyDown={handleKeyDown}
               placeholder="Buscar serviço..."
               aria-label="Buscar serviço"
-              className="h-8 border-0 bg-transparent p-0 text-xs font-medium text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-0 shadow-none"
+              className="h-8 w-full border-0 bg-transparent p-0 text-xs font-semibold text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-0"
             />
             {query && (
               <button
@@ -154,7 +155,7 @@ export function ServiceSelector({ services, value, onChange, disabled, error, wa
                   setQuery("");
                   inputRef.current?.focus();
                 }}
-                className="text-zinc-400 hover:text-zinc-600 p-0.5 rounded transition-colors"
+                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-md transition-colors cursor-pointer"
               >
                 <X className="h-3.5 w-3.5" />
               </button>
```

---

## 6. INVARIANTES DE PRODUÇÃO PRESERVADAS

- Regras de agendamento e disponibilidade intactas.
- Zero alterações em banco de dados, migrations, RPCs, RLS, Stripe, Z-API, Vouchers e Cron.
- Não foi executado commit, push ou deploy.

---

## 7. CONCLUSÃO E STATUS FINAL

```
R2E26C6_READY_FOR_AUTHORIZATION
```
*(As correções estão concluídas e validadas localmente. Aguardando autorização para commit, push e cutover).*
