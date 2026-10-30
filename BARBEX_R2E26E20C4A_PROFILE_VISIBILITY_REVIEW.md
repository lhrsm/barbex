# BARBEX — R2E.26E.20C.4A
## REVISÃO FINAL DA MATRIZ DE PERFIS DOS SETE TUTORIAIS P1
### AUDITORIA DE VISIBILIDADE, AUTORIDADE OPERACIONAL, CONCILIAÇÃO DE CONTAGENS E SEGURANÇA RBAC

**Projeto:** Barbex — [barbex.shop](https://barbex.shop)  
**Baseline Git de Produção:** `d39d7ca7`  
**Origem:** `R2E26E20C4_READY_FOR_REVIEW`  
**Banco de Dados:** Supabase Production (`ywdwrstxvsdqiryhieiz`)  
**Modalidade:** **STRICT READ-ONLY / ZERO MUTAÇÕES / ZERO COMMITS / SEM EXECUÇÃO EM PRODUÇÃO**  
**Data da Auditoria:** 30 de Outubro de 2026 — 08:35 BRT  
**Status da Fase:** `R2E26E20C4A_READY_FOR_CUTOVER`

---

### 1. OBJETIVO EXECUTIVO

Esta fase realiza a **revisão técnica, funcional e de governança de segurança definitiva** sobre a matriz de visibilidade dos sete novos tutoriais operacionais P1 preparados na migration:

[`20261030130000_r2e26e20c4_help_center_p1_operational_tutorials.sql`](file:///c:/Antigravity/Barbex/barbex/supabase/migrations/20261030130000_r2e26e20c4_help_center_p1_operational_tutorials.sql)

O escopo compreende:
1. Validar a adequação dos identificadores `profile_target` para cada um dos 7 artigos frente à arquitetura RBAC do Barbex.
2. Esclarecer com rigor a diferença entre **visualizar um tutorial educativo** e **possuir autorização operacional para executar a ação**.
3. Realizar a auditoria técnica aprofundada dos quatro focos críticos:
   - **T02 (Carteirinha QR Code):** Operabilidade real do Barbeiro vs. baixa operacional no balcão.
   - **T05 (Bloqueio de Horários e Folgas):** Pertinência da visualização pela Recepção vs. distinção entre solicitação do profissional e ato de gestão.
   - **T06 (Agendamento em Grupo):** Adequação para o autosserviço do Cliente e coordenação pela Recepção.
   - **T07 (Portfólio Profissional):** Preservação da fronteira entre página pública compartilhável e edição de equipe restrita à gestão.
4. Recalcular e conciliar matematicamente as contagens de artigos visíveis por perfil (camada RLS do PostgreSQL, filtro `safeDb` no frontend e catálogo estático deduplicado).
5. Certificar a blindagem contra vazamento de artigos gerenciais e a preservação do isolamento multi-tenant.
6. Emitir parecer e recomendação formal de **GO** ou **NO-GO** para o cutover controlado em produção (R2E.26E.20C.5).

> [!IMPORTANT]
> Em estrita conformidade com as diretrizes do projeto, esta auditoria operou em **modo puramente analítico e read-only**. Nenhuma mutação foi executada no banco de dados, no código-fonte ou no ambiente de produção.

---

### 2. GATE 0 — PREFLIGHT E CONFORMIDADE DE AMBIENTE

| Parâmetro | Esperado | Verificado | Situação |
| :--- | :--- | :--- | :---: |
| **Branch Git** | `main` | `main` | CONFORME |
| **HEAD Git** | `d39d7ca7` | `d39d7ca7` | CONFORME |
| **Sincronização Remota** | Up to date com `origin/main` | Up to date com `origin/main` | CONFORME |
| **Working Tree (Tracked)** | Clean (sem mutações pendentes) | Clean (sem mutações pendentes) | CONFORME |
| **Ambiente de Dados** | Supabase Production (`ywdwrstxvsdqiryhieiz`) | Conectado via CLI vinculada (`--linked`) | CONFORME |
| **Artigos Ativos no Banco** | 58 artigos persistidos | 58 artigos persistidos | CONFORME |
| **Categorias Canônicas** | 21 categorias ativas | 21 categorias ativas | CONFORME |
| **Migration P1 Preparada** | `20261030130000` | Sintaxe validada, idempotente | CONFORME |
| **Script de Rollback** | `rollback_r2e26e20c4...sql` | Pronto, idempotente, reversível | CONFORME |
| **Suíte de Testes Isolada** | `test_p1_expansion_isolated.cjs` | 131/131 testes aprovados (100%) | CONFORME |

---

### 3. GATE 1 — MATRIZ CANÔNICA DE PERFIS DOS SETE TUTORIAIS P1

A tabela a seguir consolida a auditoria individual de cada tutorial preparado para a expansão P1:

| Artigo | UUID Canônico | Título Canônico | `profile_target` Configurado | Perfis com Acesso | Justificativa Funcional | Permissões Exigidas no Barbex | Distinção: Visualizar Tutorial vs. Autoridade Operacional |
| :---: | :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| **T01** | `e59a721d-9e0c-4c48-8df1-3f628ab29001` | Como cadastrar clientes no balcão | `[reception, tenant_admin, admin]` | Recepção, Dono, Gestores | Cadastro rápido de clientes no balcão via modal de novo agendamento ou comanda. | `clients:create`, `appointments:create` | A visualização ensina o fluxo de inserção de nome/telefone e vínculo a agendamentos. Apenas quem tem acesso à Recepção ou Gestão possui o botão de cadastro no frontend. |
| **T02** | `e59a721d-9e0c-4c48-8df1-3f628ab29002` | Como validar carteirinha e QR Code de assinantes | `[reception, barber, tenant_admin, admin]` | Recepção, Barbeiro, Dono, Gestores | Verificação de assinaturas ativas, saldo de cortes do plano e leitura óptica via câmera/leitor. | Leitura: Pública (`validate_subscription_card`). Baixa: `data.tenant_id === user.id` | **Nuance Crítica:** O Barbeiro pode escanear o QR Code para consultar status e benefícios; contudo, a baixa de serviço no balcão é privativa do estabelecimento (Recepção/Dono). Ver análise detalhada abaixo. |
| **T03** | `e59a721d-9e0c-4c48-8df1-3f628ab29003` | Como convidar usuários e configurar permissões | `[tenant_admin, admin, owner]` | Proprietário, Admin, Sócio | Gestão de colaboradores, convites por e-mail e atribuição de cargos (`owner`, `admin`, `barber`, `reception`). | `users:manage`, `tenants:manage` | **Estritamente Blindado:** Barbeiros e Recepção não visualizam este artigo. Proteção total da estrutura corporativa e governança de acessos. |
| **T04** | `e59a721d-9e0c-4c48-8df1-3f628ab29004` | Como utilizar o Centro de Comando e os indicadores operacionais | `[tenant_admin, admin, owner]` | Proprietário, Admin, Sócio | Interpretação de KPIs executivos: ticket médio, ocupação da cadeira, churn, comissões globais e faturamento. | `analytics:view`, `finances:view` | **Estritamente Blindado:** O Barbeiro vê apenas suas próprias comissões em `/barber-portal`; métricas do estabelecimento permanecem confidenciais. |
| **T05** | `e59a721d-9e0c-4c48-8df1-3f628ab29005` | Como bloquear horários e solicitar folgas | `[barber, reception, tenant_admin, admin]` | Barbeiro, Recepção, Dono, Gestores | Comunicação de ausências do barbeiro e bloqueio de slots na agenda para intervalos ou folgas. | `timeoff:request` (Barbeiro), `settings:manage` (Gestão) | O Barbeiro aprende a verificar conflitos de agenda e pedir alinhamento. A Recepção aprende como folgas impactam a agenda. Apenas o Dono/Admin bloqueia a grade diretamente no sistema. |
| **T06** | `e59a721d-9e0c-4c48-8df1-3f628ab29006` | Como funciona o agendamento em grupo | `[client, customer, reception, tenant_admin, admin]` | Cliente, Recepção, Dono, Gestores | Criação e gestão de horários simultâneos para amigos/padrinhos via link tokenizado e acompanhamento no balcão. | Clientes: token público. Recepção: `appointments:manage` | O Cliente opera no link público tokenizado (reserva, reagendamento, cancelamento com estorno). A Recepção opera na grade multi-profissional da `/reception/agenda`. |
| **T07** | `e59a721d-9e0c-4c48-8df1-3f628ab29007` | Como configurar o portfólio e a página pública profissional | `[barber, tenant_admin, admin]` | Barbeiro, Dono, Gestores | Divulgação da página pública (`/$slug/equipe/$barberId`) com links diretos de agendamento na cadeira do barbeiro. | Consulta: Pública. Edição cadastral: `barbers:manage` (Admin) | O Barbeiro aprende a utilizar seu link de marketing para captação direta de clientes. A edição cadastral de fotos, serviços e chave PIX é restrita ao Dono na rota `/barbers`. |

---

### 4. AUDITORIA APROFUNDADA DOS QUATRO FOCOS CRÍTICOS

#### A. T02 — Validação de Carteirinha de Assinante (`subscription-card.validate.$token.tsx`)

##### 1. Contexto Operacional e Código Analisado
A funcionalidade de validação de assinantes via QR Code baseia-se em duas RPCs do PostgreSQL e uma página frontend dedicada:
- [`validate_subscription_card(token_param uuid)`](file:///c:/Antigravity/Barbex/barbex/supabase/migrations/20261013140000_subscription_cancellation_lifecycle.sql): Função com `SECURITY DEFINER` que recebe o token do QR Code e retorna: status da assinatura (`active`, `past_due`, `canceled`), nome do assinante, plano, saldo de cortes restantes e data de expiração.
- [`consume_subscription_use(subscription_id, service_id, ...)`](file:///c:/Antigravity/Barbex/barbex/supabase/migrations/20261013140000_subscription_cancellation_lifecycle.sql): Função com `SECURITY DEFINER` que desconta 1 uso da franquia de cortes e gera o registro de auditoria em `subscription_uses`.

##### 2. Trava de Segurança no Frontend
Em [`src/routes/subscription-card.validate.$token.tsx`](file:///c:/Antigravity/Barbex/barbex/src/routes/subscription-card.validate.$token.tsx#L96-L102), localizou-se a seguinte cláusula de guarda:
```typescript
const tenantBelongsToUser =
  data?.tenant_id && user?.id && data.tenant_id === user.id;
```
Quando o usuário autenticado na sessão do navegador é um colaborador individual (cujo `user.id` difere do `tenant_id` da barbearia):
- `tenantBelongsToUser` é avaliado como `false`.
- A interface exibe a mensagem de aviso: *"Esta assinatura não pertence à sua barbearia"*.
- O botão interativo **"Validar Atendimento"** (que aciona a mutação `consume_subscription_use`) não é renderizado.

##### 3. Conclusão Funcional e Redação do Tutorial
- **O Barbeiro pode executar o procedimento?**
  - **SIM, para consulta e conferência:** O barbeiro pode escanear o QR Code apresentado pelo cliente no celular para verificar visualmente se a carteirinha está ativa, qual o plano contratado e se o cliente ainda possui cortes disponíveis naquele ciclo.
  - **NÃO, para a baixa de consumo:** A baixa operacional definitiva de desconto de cortes da franquia deve ser executada no balcão da recepção ou pelo proprietário, utilizando o perfil oficial da barbearia (`user.id === tenant_id`).
- **Aderência do Tutorial:** O artigo T02 foi redigido refletindo exatamente essa arquitetura, orientando o barbeiro a conferir a tela e direcionar o registro de baixa para o balcão.

---

#### B. T05 — Bloqueio de Horários e Folgas (`ProfessionalTimeOffDialog.tsx` e `time-off.functions.ts`)

##### 1. Pertinência da Visualização pela Recepção
- A recepção é responsável direta pela operação diária na tela `/reception/agenda`. Quando um profissional se ausenta ou necessita de bloqueio de horário, é a recepção quem precisa:
  1. Identificar visualmente o bloco de indisponibilidade na grade.
  2. Evitar o agendamento de encaixes (*walk-ins*) ou marcações telefônicas naquele período.
  3. Prestar esclarecimentos aos clientes sobre a indisponibilidade temporária do profissional.
- Portanto, a visibilidade deste tutorial pela Recepção é **100% justificada e indispensável para a operação harmoniosa do salão**.

##### 2. Separação entre Solicitação e Ação Administrativa
O tutorial T05 distingue explicitamente dois papéis:
- **Papel do Barbeiro (Solicitante):**
  - Solicita folga ou bloqueio com antecedência.
  - O sistema aciona a função de verificação [`check_time_off_conflicts`](file:///c:/Antigravity/Barbex/barbex/src/lib/time-off.functions.ts) para apontar se já existem agendamentos de clientes marcados naquele intervalo.
  - O barbeiro **não possui autoridade** para cancelar unilateralmente agendamentos já confirmados de clientes sem chancela gerencial.
- **Papel do Proprietário / Administrador (Executor):**
  - Acessa o componente [`ProfessionalTimeOffDialog.tsx`](file:///c:/Antigravity/Barbex/barbex/src/components/ProfessionalTimeOffDialog.tsx) em `/barbers` ou `/reception/agenda`.
  - Possui a permissão RBAC `settings:manage` para efetivar o bloqueio na grade de horários do estabelecimento e, se necessário, autorizar o reagendamento dos clientes impactados.

---

#### C. T06 — Agendamento em Grupo (`agendamentos.grupo.$token.tsx`)

##### 1. Dupla Adequação: Cliente e Recepção
O fluxo de agendamento em grupo do Barbex foi desenhado para atender tanto o autosserviço quanto o balcão:
- **Fluxo do Cliente (Passos 1 a 4):**
  - O organizador do grupo acessa a página pública tokenizada:
    [`/agendamentos/grupo/:token`](file:///c:/Antigravity/Barbex/barbex/src/routes/agendamentos.grupo.$token.tsx)
  - Permite visualizar todos os membros do grupo, serviços escolhidos e horários simultâneos reservados.
  - Permite aos participantes reagendar ou cancelar seus horários individuais via hook [`useCustomerCancellation`](file:///c:/Antigravity/Barbex/barbex/src/hooks/useCustomerCancellation.ts), gerando créditos automáticos no saldo do salão ou solicitando reembolso PIX caso o cancelamento respeite a antecedência mínima regulamentar da barbearia.
- **Fluxo da Recepção (Passo 5):**
  - A equipe de balcão visualiza os agendamentos marcados em grupo diretamente na `/reception/agenda`.
  - O tutorial instrui a recepção sobre como identificar o badge de grupo, coordenar as bancadas de atendimento em paralelo e recepcionar múltiplos clientes com comodidade.

---

#### D. T07 — Portfólio e Página Pública (`$slug.equipe.$barberId.tsx` vs. `/barbers`)

##### 1. Preservação Rigorosa de Fronteiras de Acesso
- **Visualização e Divulgação Pública:**
  - A rota [`/$slug/equipe/$barberId`](file:///c:/Antigravity/Barbex/barbex/src/routes/$slug.equipe.$barberId.tsx) é uma página web aberta e indexável.
  - O barbeiro tem o direito e incentivo comercial para copiar seu link personalizado, compartilhá-lo na bio do Instagram, WhatsApp ou enviar a clientes recorrentes.
  - A página exibe a biografia do profissional, especialidades, galeria de fotos de cortes realizados, chave PIX para gorjetas e um botão de CTA direto para agendamento na sua cadeira.
- **Edição Cadastral Restrita à Gestão:**
  - A alteração de fotos de portfólio, edição de texto da biografia, vinculação de serviços autorizados e configuração da comissão ocorrem exclusivamente no painel restrito `/barbers` através do modal [`EditBarberDialog`](file:///c:/Antigravity/Barbex/barbex/src/components/EditBarberDialog.tsx).
  - Esta área é protegida pela permissão RBAC `barbers:manage`, reservada ao Proprietário e Administradores.
  - O Barbeiro não possui tela autônoma para alterar seu cadastro sem autorização da barbearia.
  - O artigo T07 orienta o barbeiro sobre como enviar suas fotos e dados para o gestor atualizar o perfil, respeitando integralmente o modelo de governança do estabelecimento.

---

### 5. GATE 2 — RECONCILIAÇÃO MATEMÁTICA EXATA DE CONTAGENS POR PERFIL

A tabela a seguir consolida as contagens empíricas e auditadas em cada etapa do pipeline:
1. **PostgreSQL RLS:** Avaliação da política de segurança no banco de dados.
2. **`safeDb`:** Filtro de segurança e perfil executado no frontend ([`tutorials.tsx`](file:///c:/Antigravity/Barbex/barbex/src/routes/tutorials.tsx#L235-L266)).
3. **UI Renderizada:** Resultado final visível após unificação com o catálogo estático e deduplicação semântica.

| Perfil de Usuário | Identificador RBAC (`profiles.role`) | Baseline DB (`safeDb`) | Pós-P1 DB (`safeDb`) | Variação no Banco | Baseline UI Renderizada | Pós-P1 UI Renderizada | Variação na UI | Artigos P1 Efetivamente Adicionados ao Perfil |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Cliente Autenticado** | `client` / `customer` | 3 | 4 | **+1** | 6 | 7 | **+1** | **T06** (Agendamento em Grupo) |
| **Recepção** | `reception` | 12 | 16 | **+4** | 16 | 20 | **+4** | **T01** (Balcão), **T02** (Carteirinha), **T05** (Folgas), **T06** (Grupo) |
| **Barbeiro** | `barber` | 6 | 9 | **+3** | 9 | 12 | **+3** | **T02** (Carteirinha), **T05** (Folgas), **T07** (Portfólio) |
| **Financeiro** | `financial` | 7 | 7 | **+0** | 10 | 10 | **+0** | *(Nenhum — escopo P1 restrito a operações de atendimento e barbearia)* |
| **Proprietário / Admin** | `tenant_admin` / `admin` | 58 | 65 | **+7** | 65 | 72 | **+7** | **T01, T02, T03, T04, T05, T06, T07** (Todos os novos tutoriais) |
| **Super Admin** | `super_admin` | 58 | 65 | **+7** | 77 | 84 | **+7** | **T01, T02, T03, T04, T05, T06, T07** (Todos os novos tutoriais) |
| **Visitante Anônimo** | *(Deslogado / RLS)* | 3 | 4 | **+1** | 6 | 7 | **+1** | **T06** (Consulta pública de agendamento em grupo na rota aberta) |

#### Notas Técnicas sobre a Reconciliação:
1. **Visitante Anônimo na UI:**
   A rota `/tutorials` possui proteção obrigatória de layout (`AuthRequiredModal` / redirect para `/auth?redirect=/tutorials`). Um visitante não autenticado não consegue acessar a interface da Central de Ajuda. Os valores da linha "Visitante Anônimo" representam o retorno da API PostgREST caso consultada diretamente com a chave pública anônima.
2. **Itens do Catálogo Estático:**
   Os itens adicionais na contagem da UI decorrem de artigos estáticos do arquivo `tutorials.catalog.ts` que complementam a experiência do usuário com guias conceituais sem colisão com os artigos persistidos.
3. **Estabilidade do Perfil Financeiro:**
   O perfil Financeiro permanece com exatamente 7 artigos persistidos e 10 tutoriais na UI, demonstrando a cirurgia e precisão da migration P1, que não causou nenhum efeito colateral sobre módulos contábeis.

---

### 6. GATE 3 — AUDITORIA DE SEGURANÇA E ASSERÇÕES RIGOROSAS

| Asserção de Segurança | Verificação Técnica Realizada | Evidência Comprovada | Veredito |
| :--- | :--- | :--- | :---: |
| **1. Blindagem de Tutoriais Gerenciais P1** | Artigos T03 (Permissões) e T04 (Centro de Comando) inspecionados. | `profile_target` configurado unicamente como `ARRAY['tenant_admin', 'admin', 'owner']`. Não contêm `reception`, `barber` nem `client`. | **APROVADO** |
| **2. Preservação dos 7 Artigos Restritos Originais** | Checagem dos UUIDs `d63482d7`, `a3ba57c9`, `2f8df9f3`, `cf8b2ce5`, `d8a7ab64`, `60a1afbb`, `4ec9d577`. | Nenhum dos 7 artigos gerenciais recebeu identificadores operacionais. RLS bloqueia o acesso no banco para não-gestores. | **APROVADO** |
| **3. Padrão Canônico `reception`** | Inspecionados todos os arrays da migration P1. | Utilizado exclusivamente o literal `'reception'`. O literal depreciado `'receptionist'` não foi introduzido. | **APROVADO** |
| **4. Inexistência de Concessão de Privilégios por Documentação** | Análise de impacto das rotas e mutações. | Ler tutoriais não confere nenhuma claim JWT, role ou permissão no Supabase. O backend continua aplicando RLS estrita em todas as tabelas. | **APROVADO** |
| **5. Isolamento Multi-tenant** | Inspeção dos textos e comandos dos tutoriais. | Tutoriais operam como base de conhecimento genérica do SaaS Barbex. Não há menção a UUIDs de barbearias, dados de faturamento ou informações sensíveis de clientes reais. | **APROVADO** |
| **6. Idempotência e Reversibilidade da Migration** | Verificação da cláusula `ON CONFLICT (id) DO NOTHING` e script de rollback. | A migration pode ser executada repetidamente sem falhas. O script de rollback restaura o estado anterior atômica e imediatamente. | **APROVADO** |

---

### 7. GATE 4 — PARECER FINAL E RECOMENDAÇÃO DE CUTOVER

#### Parecer Técnico
A auditoria de visibilidade e governança de perfis concluiu que:
1. A matriz de perfis dos sete novos tutoriais P1 foi desenhada com exatidão cirúrgica, respeitando integralmente as responsabilidades e permissões de cada ator do sistema Barbex.
2. Não foram identificados vazamentos de informações comerciais confidenciais, permissões gerenciais ou dados restritos de outros estabelecimentos.
3. A distinção entre consumo visual educativo e autoridade de execução operacional está garantida tanto pelo código frontend quanto pelas RPCs e políticas RLS de backend.
4. As contagens de tutoriais antes e depois da migration estão reconciliadas e matematicamente comprovadas.

#### Recomendação Executiva
> [!TIP]
> **RECOMENDAÇÃO: GO PARA O CUTOVER CONTROLADO EM PRODUÇÃO (R2E.26E.20C.5)**
> 
> O pacote de artefatos da expansão P1 (`20261030130000_r2e26e20c4_help_center_p1_operational_tutorials.sql`, scripts de validação e rollback) está **tecnicamente homologado e pronto para aplicação em produção**, sujeito unicamente à autorização humana no cutover.

- **Baseline Aprovada:** Commit `d39d7ca7` em branch `main`
- **Próxima Fase:** `BARBEX — R2E.26E.20C.5: CUTOVER CONTROLADO DA EXPANSÃO P1 EM PRODUÇÃO`
- **Status do Gate:** `R2E26E20C4A_READY_FOR_CUTOVER`

