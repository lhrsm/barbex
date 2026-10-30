-- ==============================================================================
-- BARBEX — R2E.26E.20D.1: EXPANSÃO DE TUTORIAIS OPERACIONAIS P2
-- MIGRAÇÃO DE BANCO DE DADOS — SUPABASE PRODUCTION
-- ==============================================================================
-- 3 Novos Tutoriais Operacionais Canônicos Homologados:
-- 1. e59a721d-9e0c-4c48-8df1-3f628ab29008: Como configurar a escala semanal e horários de trabalho da equipe
-- 2. e59a721d-9e0c-4c48-8df1-3f628ab29009: Como moderar e responder avaliações de clientes
-- 3. e59a721d-9e0c-4c48-8df1-3f628ab29010: Como identificar e reativar clientes inativos pelo CRM
-- ==============================================================================

-- 1. P2-01: Como configurar a escala semanal e horários de trabalho da equipe
INSERT INTO public.tutorials (
  id,
  title,
  description,
  long_description,
  category_id,
  type,
  level,
  estimated_time,
  icon,
  slug,
  profile_target,
  module_key,
  status,
  related_route,
  "order",
  is_featured
) VALUES (
  'e59a721d-9e0c-4c48-8df1-3f628ab29008',
  'Como configurar a escala semanal e horários de trabalho da equipe',
  'Configurar a jornada regular de atendimento e a grade semanal fixa de trabalho dos profissionais da barbearia, definindo dias ativos e expediente.',
  '## Objetivo
Configurar a jornada regular de atendimento e a grade semanal fixa de trabalho dos profissionais da barbearia, definindo dias ativos, horário de abertura e término de cada expediente.

## Perfis Autorizados
- **Proprietário da Barbearia (`owner`)**
- **Administrador do Tenant (`tenant_admin` / `admin`)**
- **Barbeiro / Profissional (`barber`)** (ajuste do próprio horário de atendimento)

## Pré-requisitos
1. Para a Gestão: acesso ao módulo **Equipe** (`/barbers`).
2. Para o Barbeiro: perfil ativo e vinculado à barbearia no painel profissional.
3. Ter definido o horário geral de funcionamento do estabelecimento em **Configurações** (`/settings`).

---

## Passo a Passo

### Como a Gestão Configura a Escala dos Profissionais:
1. No menu lateral, acesse **Equipe** (`/barbers`).
2. Localize o profissional desejado e clique no botão de edição (**ícone de lápis**).
3. Na seção **Horários de Atendimento (Grade Semanal)**:
   - Para cada dia da semana (de Segunda a Domingo), utilize o botão seletor para marcar o dia como **Ativo** ou **Inativo/Folga regular**.
   - Para os dias ativos, defina o horário de **Início** (ex.: `09:00`) e de **Término** (ex.: `19:00`).
4. Clique em **Salvar Alterações**. A grade de horários é atualizada imediatamente no banco.

### Como o Barbeiro Ajusta Seus Próprios Horários:
1. No painel operacional do profissional, abra as configurações de disponibilidade (**Horários de Atendimento**).
2. Ajuste os dias em que estará disponível na barbearia e os limites de início e fim da sua jornada.
3. Clique em **Salvar**. A alteração aciona a rotina segura `update_barber_working_hours`.

---

## Resultado Esperado
- A grade de disponibilidade do profissional passa a reger o calendário do sistema.
- Na tela de agendamento público do cliente (`/$slug`), os horários para agendar com o profissional respeitarão exclusivamente os dias e intervalos em que ele estiver ativo.

## Diferença Entre Escala Regular e Folga Pontual
- **Escala Regular (Este Tutorial):** Grade padrão semanal fixa de trabalho (ex.: "trabalho de terça a sábado, das 09:00 às 19:00").
- **Folgas Pontuais e Bloqueios:** Tratados no tutorial *"Como bloquear horários e solicitar folgas"* (`b29005`), para ausências médicas, imprevistos ou férias pontuais.

## Limitações do Recurso
- **Grade Semanal Fixa:** O sistema opera com recorrência semanal fixa de 7 dias. Não há suporte nativo para escalas rotativas complexas (como 12x36 ou plantões alternados quinzenais).
- **Feriados Nacionais:** O Barbex não sincroniza feriados automáticos. Em dias de feriado, o gestor deve desativar o dia na escala ou criar um bloqueio no calendário.

## Problemas Frequentes
- **"Horário do barbeiro não aparece para o cliente":** Verifique se o dia da semana está marcado como ativo na grade do profissional e se o estabelecimento também está aberto nessa data em `/settings`.
- **"Conflito com agendamentos já existentes":** Ao encurtar o horário de um dia de atendimento, os agendamentos já marcados previamente continuam registrados. A recepção deve reagendá-los manualmente caso o barbeiro não possa atender.

## Termos de Busca
escala de trabalho, horário de atendimento, expediente, grade semanal, disponibilidade, turno, equipe, horário do barbeiro',
  '05fa32a0-54a1-42a2-bad2-e9f6f56f3fe5',
  'document',
  'basico',
  '4 min',
  'Clock',
  'como-configurar-a-escala-semanal-e-horarios-de-trabalho-da-equipe',
  ARRAY['barber', 'tenant_admin', 'admin', 'owner'],
  'barbers',
  'published',
  '/barbers',
  17,
  false
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  long_description = EXCLUDED.long_description,
  category_id = EXCLUDED.category_id,
  type = EXCLUDED.type,
  level = EXCLUDED.level,
  estimated_time = EXCLUDED.estimated_time,
  icon = EXCLUDED.icon,
  slug = EXCLUDED.slug,
  profile_target = EXCLUDED.profile_target,
  module_key = EXCLUDED.module_key,
  status = EXCLUDED.status,
  related_route = EXCLUDED.related_route,
  "order" = EXCLUDED."order",
  is_featured = EXCLUDED.is_featured,
  updated_at = NOW();


-- 2. P2-02: Como moderar e responder avaliações de clientes
INSERT INTO public.tutorials (
  id,
  title,
  description,
  long_description,
  category_id,
  type,
  level,
  estimated_time,
  icon,
  slug,
  profile_target,
  module_key,
  status,
  related_route,
  "order",
  is_featured
) VALUES (
  'e59a721d-9e0c-4c48-8df1-3f628ab29009',
  'Como moderar e responder avaliações de clientes',
  'Saiba como acompanhar avaliações em tempo real na Recepção, moderar depoimentos para exibição pública e responder feedbacks.',
  '## Objetivo
Capacitar a equipe de Recepção e a Administração a monitorar avaliações em tempo real, aprovar ou rejeitar depoimentos para a página pública da barbearia e responder com rapidez aos clientes.

## Perfis Autorizados
- **Recepção (`reception` / `receptionist`)**
- **Proprietário da Barbearia (`owner`)**
- **Administrador do Tenant (`tenant_admin` / `admin`)**

## Pré-requisitos
1. Acesso autenticado à interface da Recepção (`/reception/reviews`) ou ao painel geral de Avaliações (`/reviews`).
2. Existência de avaliações enviadas por clientes pós-atendimento.

---

## Passo a Passo

### 1. Acompanhamento em Tempo Real:
1. Acesse o menu **Avaliações** na Recepção (`/reception/reviews`).
2. A tela utiliza sincronização em tempo real (Realtime). Novos feedbacks preenchidos por clientes aparecem instantaneamente, sem necessidade de recarregar a página.

### 2. Moderação de Depoimentos:
1. Na aba **Pendentes**, revise o texto deixado pelo cliente e as notas de estrelas atribuídas ao serviço, ao barbeiro e ao estabelecimento.
2. Para exibir o depoimento na vitrine pública da barbearia:
   - Clique em **Aprovar** (`approve`).
   - O status é alterado para "Aprovado" e o depoimento se torna elegível para exibição no portal público.
3. Para impedir a exibição pública de depoimentos inapropriados ou com linguagem ofensiva:
   - Clique em **Rejeitar** (`reject`).
   - O depoimento fica arquivado como rejeitado e jamais será exposto publicamente.
4. Para ocultar temporariamente uma avaliação previamente aprovada:
   - Clique no controle de visibilidade para **Ocultar** (`hide`) ou **Exibir** (`show`).

### 3. Envio de Resposta Oficial:
1. Clique no botão **Responder** no cartão da avaliação.
2. Digite a resposta oficial do estabelecimento com cordialidade e profissionalismo.
3. Clique em **Enviar Resposta**. A resposta é vinculada à avaliação e fica disponível para visualização pelo cliente.

---

## Resultado Esperado
- Depoimentos qualificados e aprovados enriquecem a página pública da barbearia (`/$slug`), gerando prova social para novos clientes.
- Depoimentos rejeitados ficam bloqueados de exibição externa.
- O cliente visualiza a atenção da barbearia através da resposta formal registrada.

## Limitações e Regras de Segurança
- **Imutabilidade de Notas e Textos:** A rotina de segurança (`moderate_appointment_review`) impede terminantemente que qualquer usuário altere as notas de estrelas ou edite as palavras digitadas pelo cliente. A avaliação reflete com fidelidade a opinião original.
- **Autoridade da Recepção:** A Recepção possui autoridade para aprovar, rejeitar, ocultar e responder. A exclusão definitiva (`delete`) de registros é prerrogativa restrita à Gestão em `/reviews`.
- **Rastreabilidade e Auditoria:** O sistema grava automaticamente o usuário responsável (`approved_by`, `rejected_by`, `replied_by`) e o horário exato da ação.

## Problemas Frequentes
- **"Avaliação sem texto (apenas estrelas)":** Clientes podem enviar notas de 1 a 5 estrelas sem digitar depoimento. Essas notas compõem a média geral do estabelecimento, mesmo sem texto para aprovar.
- **"Oscilação na conexão em tempo real":** Se houver oscilação de rede, clique no botão de atualizar da listagem para sincronizar os dados recentes do Supabase.

## Termos de Busca
avaliações, depoimentos, moderação, recepção, reputação, estrelas, notas, feedback de clientes, responder avaliação, prova social',
  'fa046d64-efcd-4235-8616-d04b3c4eaed7',
  'document',
  'basico',
  '3 min',
  'Star',
  'como-moderar-e-responder-avaliacoes-de-clientes',
  ARRAY['reception', 'tenant_admin', 'admin', 'owner'],
  'reception',
  'published',
  '/reception/reviews',
  18,
  false
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  long_description = EXCLUDED.long_description,
  category_id = EXCLUDED.category_id,
  type = EXCLUDED.type,
  level = EXCLUDED.level,
  estimated_time = EXCLUDED.estimated_time,
  icon = EXCLUDED.icon,
  slug = EXCLUDED.slug,
  profile_target = EXCLUDED.profile_target,
  module_key = EXCLUDED.module_key,
  status = EXCLUDED.status,
  related_route = EXCLUDED.related_route,
  "order" = EXCLUDED."order",
  is_featured = EXCLUDED.is_featured,
  updated_at = NOW();


-- 3. P2-03: Como identificar e reativar clientes inativos pelo CRM
INSERT INTO public.tutorials (
  id,
  title,
  description,
  long_description,
  category_id,
  type,
  level,
  estimated_time,
  icon,
  slug,
  profile_target,
  module_key,
  status,
  related_route,
  "order",
  is_featured
) VALUES (
  'e59a721d-9e0c-4c48-8df1-3f628ab29010',
  'Como identificar e reativar clientes inativos pelo CRM',
  'Aprenda a filtrar clientes com mais de 60 dias de ausência, consultar o histórico no CRM e realizar ações manuais de reativação via WhatsApp.',
  '## Objetivo
Utilizar as ferramentas de CRM e os filtros de inatividade da carteira de clientes do Barbex para identificar clientes ausentes há mais de 60 dias e executar ações de contato e reativação.

## Perfis Autorizados
- **Recepção (`reception` / `receptionist`)**
- **Proprietário da Barbearia (`owner`)**
- **Administrador do Tenant (`tenant_admin` / `admin`)**

## Pré-requisitos
1. Acesso autorizado ao módulo de **Clientes** (`/customers`) ou ao **Painel CRM** (`/dashboard/crm`).
2. Clientes cadastrados na base com histórico de atendimentos.

---

## Critérios Canônicos de Inatividade no Barbex
- **Cliente Inativo:** Classificação atribuída pelo sistema a todo cliente cujo último atendimento concluído tenha ocorrido há **mais de 60 dias** (`daysSinceLast > 60`).
- **Clientes em Risco (D30 e D60):** Segmentações preventivas para identificar clientes sem retornar entre 30 e 59 dias (`D30`) ou entre 60 e 89 dias (`D60`), antes que o abandono se torne definitivo.

---

## Passo a Passo

### 1. Filtrando Clientes Inativos na Base:
1. No menu principal, acesse **Clientes** (`/customers`).
2. No topo da página, localize os filtros rápidos e selecione o chip **Inativos**.
3. O sistema listará exclusivamente os clientes com mais de 60 dias de ausência, exibindo nome, telefone, data da última visita e valor total investido na barbearia.

### 2. Análise do Perfil na Ficha CRM:
1. Clique sobre o cliente para abrir a **Ficha CRM** (`CustomerCrmDialog`).
2. Inspecione as métricas do cliente:
   - Barbeiro e serviços mais frequentes.
   - Saldo de **Cashback** e **Créditos** disponíveis.
   - Histórico de avaliações e observações internas de atendimentos anteriores.

### 3. Ação de Reativação Direta pelo WhatsApp:
1. No cartão do cliente ou na ficha CRM, clique no **ícone do WhatsApp** (`wa.me`).
2. O Barbex abre automaticamente o WhatsApp com o número do cliente formatado.
3. Envie uma mensagem acolhedora e personalizada, por exemplo:
   - Informando saudades do cliente.
   - Lembrar se ele possui saldo de cashback ou créditos expirando.
   - Oferecendo link direto de agendamento online com seu profissional habitual.
4. Na aba **Tarefas / Notas** do CRM, registre que o contato de reativação foi realizado para acompanhamento da equipe.

---

## Resultado Esperado
- Redução da taxa de abandono (churn) e resgate de faturamento da barbearia.
- Clientes inativos retornam ao ciclo ativo de atendimento.
- Histórico de relacionamento registrado no CRM para toda a recepção.

## Esclarecimentos Comerciais Obrigatórios
> [!IMPORTANT]
> **Automações de WhatsApp e Z-API:**
> 
> As ações de reativação descritas neste procedimento são **realizadas manualmente** pela Recepção ou Gestão através do link direto de WhatsApp.
> 
> Qualquer automação de envio de mensagens no Barbex depende obrigatoriamente da contratação, configuração e custeio autônomo da ferramenta externa **Z-API**, que é um serviço de terceiros **não incluso nas assinaturas dos planos Barbex**.

## Limitações e Boas Práticas (LGPD)
- **Consentimento:** Contate somente clientes que concordaram em receber comunicações da barbearia.
- **Moderação:** Evite insistências repetitivas para não caracterizar spam e preservar a imagem do estabelecimento.

## Problemas Frequentes
- **"Número de telefone inválido ou sem WhatsApp":** Confirme se o cadastro do cliente possui DDD correto. Se o cliente trocou de telefone, atualize o cadastro no balcão.
- **"Cliente já agendou recentemente, mas consta como inativo":** O cálculo de inatividade é baseado no último atendimento com status *concluído*. Agendamentos futuros ainda não alteram o contador de dias desde a última visita.

## Termos de Busca
crm, clientes inativos, reativar clientes, retenção, clientes ausentes, whatsapp, histórico de visitas, funil de clientes, d30, d60, fidelização',
  '9bd90387-929c-42f0-81fe-70832fef6944',
  'document',
  'intermediario',
  '4 min',
  'Users',
  'como-identificar-e-reativar-clientes-inativos-pelo-crm',
  ARRAY['reception', 'tenant_admin', 'admin', 'owner'],
  'reception',
  'published',
  '/customers',
  19,
  false
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  long_description = EXCLUDED.long_description,
  category_id = EXCLUDED.category_id,
  type = EXCLUDED.type,
  level = EXCLUDED.level,
  estimated_time = EXCLUDED.estimated_time,
  icon = EXCLUDED.icon,
  slug = EXCLUDED.slug,
  profile_target = EXCLUDED.profile_target,
  module_key = EXCLUDED.module_key,
  status = EXCLUDED.status,
  related_route = EXCLUDED.related_route,
  "order" = EXCLUDED."order",
  is_featured = EXCLUDED.is_featured,
  updated_at = NOW();
