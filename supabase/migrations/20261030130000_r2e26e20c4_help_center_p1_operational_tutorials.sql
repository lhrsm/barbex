-- ==============================================================================
-- BARBEX — R2E.26E.20C.4: EXPANSÃO CONTROLADA DOS TUTORIAIS OPERACIONAIS (P1)
-- ==============================================================================
-- Migration Version: 20261030130000
-- Descrição: Insere 7 novos tutoriais operacionais homologados na tabela public.tutorials
-- Perfis: Recepção (T01, T02), Proprietário/Admin (T03, T04), Barbeiro (T05, T07), Cliente/Recepção (T06)
--
-- ATENÇÃO: PREPARAÇÃO LOCAL CONTROLADA. NÃO EXECUTAR EM PRODUÇÃO NESTA FASE.
-- ==============================================================================

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
)
VALUES
  -- ----------------------------------------------------------------------------
  -- T01: Recepção — Como cadastrar clientes no balcão
  -- ----------------------------------------------------------------------------
  (
    'e59a721d-9e0c-4c48-8df1-3f628ab29001',
    'Como cadastrar clientes no balcão',
    'Aprenda a consultar clientes no diretório da recepção e a cadastrar novos clientes durante o atendimento no balcão.',
    '**1. Perfil Autorizado:** Recepção (`reception`), Proprietário (`tenant_admin`) e Administrador (`admin`).

**2. Objetivo do Procedimento:** Localizar clientes existentes para contato rápido e cadastrar novos clientes diretamente durante a recepção e o atendimento presencial no balcão da barbearia.

**3. Pré-requisitos:** Estar autenticado com perfil operacional de Recepção ou Administrador e possuir o nome e o número de celular/WhatsApp do cliente com DDD.

**4. Passo a Passo:**
1. **Consulta Rápida no Diretório:** Acesse o menu lateral e clique em **Clientes** (`/reception/customers`). Digite o nome ou o telefone na barra de busca para verificar se o cliente já possui cadastro prévio na barbearia.
2. **Contato Imediato:** Se o cliente já estiver cadastrado, a lista exibirá o nome, telefone, e-mail e um botão de atalho para iniciar uma conversa direta no WhatsApp via web.
3. **Cadastro de Novo Cliente no Balcão:**
   • Para incluir um novo cliente, acerte o horário na **Agenda da Recepção** (`/reception/agenda`) ou clique no botão **Encaixe** (`WalkinModal`).
   • No campo de busca de cliente, digite o nome. Caso nenhum resultado apareça, selecione a opção **Novo Cliente**.
   • Preencha obrigatoriamente o **Nome Completo** e o **Telefone com DDD**. O campo de **E-mail** é opcional, mas recomendável para envio de comprovantes.
   • Selecione o profissional barbeiro, o serviço desejado e o horário.
   • Clique em **Confirmar Agendamento/Encaixe**. O sistema cria automaticamente o registro do cliente na base da barbearia e vincula o atendimento.

**5. Resultado Esperado:** O cliente é registrado com sucesso na base de clientes da barbearia (`customers`), associado ao atendimento na agenda e disponibilizado para consultas futuras no diretório.

**6. Limitações e Regras Aplicáveis:**
• A tela `/reception/customers` funciona como diretório de busca e consulta rápida; a inclusão de um novo cliente é realizada de forma integrada ao fluxo de agendamento ou encaixe na agenda.
• O telefone com DDD é a chave principal de identificação e validação para evitar perfis duplicados do mesmo cliente na barbearia.

**7. Problemas Frequentes e Orientações:**
• *Cliente não encontrado na busca:* Verifique se digitou o DDD correto ou busque por parte do primeiro nome.
• *Número de telefone inválido:* Certifique-se de digitar apenas números ou o formato padrão com DDD (ex: 11999998888).

**8. Módulo e Categoria:** Módulo Recepção / Categoria: Clientes e Relacionamento.

**9. Termos de Busca e Palavras-chave:** balcão, cadastrar cliente, novo cliente, recepção, telefone, whatsapp, encaixe, walk-in, busca clientes.',
    '9bd90387-929c-42f0-81fe-70832fef6944',
    'document',
    'basico',
    '3 min',
    'Users',
    'como-cadastrar-clientes-no-balcao',
    ARRAY['reception', 'tenant_admin', 'admin'],
    'reception',
    'published',
    '/reception/customers',
    10,
    false
  ),

  -- ----------------------------------------------------------------------------
  -- T02: Recepção — Como validar carteirinha e QR Code de assinantes
  -- ----------------------------------------------------------------------------
  (
    'e59a721d-9e0c-4c48-8df1-3f628ab29002',
    'Como validar carteirinha e QR Code de assinantes',
    'Saiba como ler o QR Code da carteirinha digital do Clube Barbex e validar o uso de benefícios do assinante.',
    '**1. Perfil Autorizado:** Recepção (`reception`), Barbeiro (`barber`), Proprietário (`tenant_admin`) e Administrador (`admin`).

**2. Objetivo do Procedimento:** Verificar a autenticidade e a situação cadastral da assinatura do cliente por meio da carteirinha digital e registrar a utilização do serviço contratado no balcão.

**3. Pré-requisitos:** O cliente deve apresentar a carteirinha digital do Clube Barbex na tela do celular (disponível no portal dele), e o operador da barbearia deve estar autenticado no sistema.

**4. Passo a Passo:**
1. **Apresentação do QR Code:** Solicite ao cliente que abra a carteirinha digital no Portal do Cliente (`barbex.shop/{slug}/portal`).
2. **Leitura do QR Code:** Aponte a câmera de um smartphone ou leitor ótico compatível para o QR Code da carteirinha. O dispositivo abrirá o link de validação seguro no formato `barbex.shop/subscription-card/validate/{token}`.
3. **Conferência em Tela:** A tela de validação exibirá imediatamente o resultado processado pelo servidor:
   • **ASSINATURA VÁLIDA (Badge Verde):** A assinatura está ativa e adimplente. A tela exibe o nome do cliente, foto, telefone mascarado, nome do plano, tipo de uso (ilimitado ou contagem mensal) e quantidade de benefícios restantes no ciclo.
   • **ASSINATURA PAUSADA (Badge Azul):** A assinatura foi pausada temporariamente pelo assinante ou pela administração.
   • **CARTÃO INVÁLIDO (Badge Vermelho):** Token revogado, assinatura expirada ou cancelada. O motivo exato é detalhado na tela.
4. **Baixa do Benefício:** Estando a assinatura válida e pertencente à sua barbearia, clique no botão verde **Validar Atendimento**.
5. **Confirmação:** O sistema registra a utilização do benefício (`consume_subscription_use`), deduz o corte do saldo do período e atualiza a data do último atendimento.

**5. Resultado Esperado:** Confirmação visual em tela da validação do corte, atualização instantânea do saldo de benefícios do assinante e registro no histórico de auditoria da barbearia.

**6. Limitações e Regras Aplicáveis:**
• Para clicar em "Validar Atendimento", o operador deve estar logado em uma conta pertencente à mesma barbearia do assinante (bloqueio entre barbearias).
• A leitura do QR Code requer dispositivo com câmera funcional conectado à internet. Caso o leitor de câmera não esteja disponível, o operador pode consultar a situação do assinante diretamente pela busca da Agenda ou do painel de Assinaturas.

**7. Problemas Frequentes e Orientações:**
• *Aviso "Entre como barbearia para validar":* O operador abriu o link sem estar logado no sistema Barbex. Basta fazer login no mesmo navegador e clicar em "Reler cartão".
• *Aviso "Esta assinatura não pertence à sua barbearia":* O cliente assinou o Clube Barbex em outro estabelecimento ou o token é inválido para a sua unidade.
• *Assinatura com saldo esgotado:* Se o plano tiver limite mensal (ex: 4 cortes/mês) e todos já foram consumidos, o sistema informa que o saldo restante é 0. O serviço excedente deverá ser cobrado à parte.

**8. Módulo e Categoria:** Módulo Assinaturas / Categoria: Assinaturas.

**9. Termos de Busca e Palavras-chave:** carteirinha, qr code, validar assinatura, clube barbex, assinante, validar atendimento, benefícios, token cartão.',
    'a19b101e-cd41-4b7c-93a5-c3cc43127113',
    'document',
    'intermediario',
    '4 min',
    'QrCode',
    'como-validar-carteirinha-e-qr-code-de-assinantes',
    ARRAY['reception', 'barber', 'tenant_admin', 'admin'],
    'subscriptions',
    'published',
    '/subscription-card/validate/:token',
    11,
    false
  ),

  -- ----------------------------------------------------------------------------
  -- T03: Proprietário/Admin — Como convidar usuários e configurar permissões
  -- ----------------------------------------------------------------------------
  (
    'e59a721d-9e0c-4c48-8df1-3f628ab29003',
    'Como convidar usuários e configurar permissões',
    'Como convidar novos colaboradores para a barbearia, definir papéis de acesso e gerenciar a matriz de permissões.',
    '**1. Perfil Autorizado:** Proprietário (`tenant_admin`) e Administrador (`admin`). Rota estritamente protegida por controle de acesso gerencial (`users:manage`).

**2. Objetivo do Procedimento:** Convidar novos membros para a equipe da barbearia, atribuir perfis de acesso adequados (Barbeiro, Recepção, Gerente, Financeiro ou Administrador) e gerenciar permissões operacionais.

**3. Pré-requisitos:** Ter privilégios de Proprietário ou Administrador na barbearia e possuir o e-mail do colaborador que receberá o convite.

**4. Passo a Passo:**
1. **Acessar Gestão de Usuários:** No menu do painel de controle, navegue até **Usuários e Equipe** (`/dashboard/usuarios`).
2. **Convidar Novo Colaborador:**
   • Clique no botão **Convidar Usuário** (`AddUserModal`).
   • Digite o nome completo e o e-mail corporativo ou pessoal do colaborador.
   • Selecione o papel inicial correspondente à sua função:
     - **Barbeiro (`barber`):** Acesso à própria agenda, atendimentos e visualização de comissões.
     - **Recepção (`reception`):** Acesso à agenda geral, encaixes, diretório de clientes e check-in.
     - **Financeiro (`financial`):** Acesso a relatórios de caixa, liquidação de comissões e faturamento.
     - **Gerente (`manager`):** Supervisão operacional da loja, equipe e atendimentos.
     - **Administrador (`admin`):** Gestão ampla de configurações e recursos da barbearia.
   • Clique em **Enviar Convite**.
3. **Gestão de Convites Pendentes:**
   • Na aba **Convites**, visualize os convites aguardando aceitação.
   • É possível clicar em **Reenviar** para disparar um novo e-mail ou em **Revogar** para cancelar o acesso antes do cadastro.
4. **Alteração de Papel e Matriz de Permissões:**
   • Na listagem de membros ativos, localize o colaborador e clique em **Alterar Papel** para ajustar seu nível de acesso.
   • Cada transição de cargo é registrada de forma imutável no log de auditoria da barbearia (`team_role_audit_logs`).
   • Consulte a **Matriz de Permissões** para visualizar exatamente quais telas e ações cada cargo pode executar.

**5. Resultado Esperado:** Disparo do e-mail de convite com link seguro de onboarding, vinculação do usuário à barbearia após o aceite e aplicação estrita das políticas RBAC correspondentes.

**6. Limitações e Regras Aplicáveis:**
• Usuários com papéis operacionais (Barbeiro ou Recepção) não possuem acesso à tela `/dashboard/usuarios`.
• Não é permitido escalonar privilégios além da própria barbearia (isolamento multi-tenant estrito).
• O convite possui validade temporária e expira caso não seja aceito no prazo previsto.

**7. Problemas Frequentes e Orientações:**
• *Colaborador não recebeu o e-mail:* Oriente-o a checar a caixa de spam/lixo eletrônico ou utilize a opção "Reenviar Convite" na aba Convites.
• *Erro ao convidar usuário já existente:* Se o e-mail já estiver cadastrado no Barbex, o convite o associará como colaborador desta unidade assim que ele fizer login e aceitar.

**8. Módulo e Categoria:** Módulo Equipe / Categoria: Equipe.

**9. Termos de Busca e Palavras-chave:** convidar usuário, convite equipe, permissões, rbac, papéis, adicionar colaborador, recepção, barbeiro, gerente, trocar cargo.',
    '05fa32a0-54a1-42a2-bad2-e9f6f56f3fe5',
    'document',
    'avancado',
    '5 min',
    'UserPlus',
    'como-convidar-usuarios-e-configurar-permissoes',
    ARRAY['tenant_admin', 'admin', 'owner'],
    'team',
    'published',
    '/dashboard/usuarios',
    12,
    false
  ),

  -- ----------------------------------------------------------------------------
  -- T04: Proprietário/Admin — Como utilizar o Centro de Comando e os indicadores operacionais
  -- ----------------------------------------------------------------------------
  (
    'e59a721d-9e0c-4c48-8df1-3f628ab29004',
    'Como utilizar o Centro de Comando e os indicadores operacionais',
    'Monitore a operação da barbearia em tempo real, acompanhe atrasos, faturamento do dia e alertas operacionais.',
    '**1. Perfil Autorizado:** Proprietário (`tenant_admin`) e Administrador (`admin`).

**2. Objetivo do Procedimento:** Supervisionar a operação em tempo real da barbearia através de um painel unificado, identificando atendimentos em andamento, atrasos de profissionais, previsão de faturamento do dia e pendências de pagamento.

**3. Pré-requisitos:** Estar autenticado como gestor da barbearia com atendimentos registrados no dia.

**4. Passo a Passo:**
1. **Acessar o Centro de Comando:** No menu do painel de controle, clique em **Centro de Comando** (`/dashboard/centro-de-comando`).
2. **Identificar o Status em Tempo Real:** Verifique no cabeçalho o badge pulsante **● Tempo Real Ativo**. Ele indica que o canal WebSocket com o Supabase está sincronizado e qualquer alteração de atendimento refletirá imediatamente na tela sem necessidade de recarregar a página.
3. **Navegação por Data:** Use as setas no seletor de data para alternar entre dias ou clique em **HOJE** para retornar instantaneamente à operação do dia corrente.
4. **Acompanhar os 5 Indicadores Operacionais (KPIs):**
   • **Atendimentos Totais:** Volume total de agendamentos ativos na data e quantidade já concluída.
   • **Em Atendimento:** Número de clientes sentados na cadeira neste momento (`status = in_progress`).
   • **Aguardando:** Clientes com horários confirmados ou agendados que ainda serão atendidos no decorrer do dia.
   • **Entrada em Caixa:** Total financeiro líquido já recebido de atendimentos concluídos na data.
   • **Pendente:** Valor monetário total de atendimentos ativos que ainda não tiveram pagamento registrado (`payment_status != paid`).
5. **Monitorar a Central de Alertas Inteligentes:**
   • **Alerta de Atraso Crítico:** Disparado automaticamente quando um atendimento em andamento ultrapassa o horário de término previsto na grade. O alerta informa o nome do profissional e os minutos de atraso acumulados.
   • **Alerta de Pagamento Pendente:** Identifica atendimentos com status "Concluído" que saíram da cadeira sem baixa financeira.
6. **Ações Rápidas Diretamente no Painel:** Utilize os atalhos superiores para criar um **Novo Agendamento**, lançar um **Encaixe (Walk-in)** ou clicar em qualquer atendimento da grade para ver detalhes e concluir.

**5. Resultado Esperado:** Visão consolidada e instantânea da dinâmica da barbearia no dia, permitindo antecipar gargalos na recepção e assegurar que nenhum atendimento fique sem registro financeiro.

**6. Limitações e Regras Aplicáveis:**
• O Centro de Comando é projetado para gestão operacional diária (foco no dia a dia). Para demonstrativos financeiros consolidados de períodos longos (mês, ano ou DRE), utilize o menu **Financeiro** (`/finances`).
• A atualização automática depende da conexão de internet ativa do dispositivo para sustentar o canal WebSocket. O botão de atualizar manual (`RefreshCw`) pode ser acionado a qualquer momento.

**7. Problemas Frequentes e Orientações:**
• *Badge "Tempo Real" inativo:* Verifique a estabilidade da sua rede de internet ou recarregue a página para restabelecer a conexão com o servidor.
• *Divergência entre previsão e caixa:* Atendimentos pagos antecipadamente (PIX/créditos) são contabilizados conforme o status de pagamento individual do agendamento.

**8. Módulo e Categoria:** Módulo Dashboard / Categoria: Indicadores e Inteligência.

**9. Termos de Busca e Palavras-chave:** centro de comando, indicadores, kpis, tempo real, atraso atendimento, operação diária, monitoramento barbearia, alertas.',
    'c55b3ff3-0fe8-4872-8449-d5700bc0e6b1',
    'document',
    'intermediario',
    '4 min',
    'Activity',
    'como-utilizar-o-centro-de-comando-e-os-indicadores-operacionais',
    ARRAY['tenant_admin', 'admin', 'owner'],
    'dashboard',
    'published',
    '/dashboard/centro-de-comando',
    13,
    false
  ),

  -- ----------------------------------------------------------------------------
  -- T05: Barbeiro — Como bloquear horários e solicitar folgas
  -- ----------------------------------------------------------------------------
  (
    'e59a721d-9e0c-4c48-8df1-3f628ab29005',
    'Como bloquear horários e solicitar folgas',
    'Como registrar bloqueios pessoais, pausas e ausências programadas na grade do profissional sem causar sobreposição de clientes.',
    '**1. Perfil Autorizado:** Barbeiro (`barber`), Recepção (`reception`), Proprietário (`tenant_admin`) e Administrador (`admin`).

**2. Objetivo do Procedimento:** Bloquear horários pontuais ou períodos completos na grade de um barbeiro para acomodar folgas, intervalos de almoço, reuniões ou licenças, impedindo que clientes agendem nesses intervalos.

**3. Pré-requisitos:** Estar autenticado na plataforma e identificar o profissional barbeiro que terá a ausência programada.

**4. Passo a Passo:**
1. **Acessar a Gestão do Profissional:** Na área de **Equipe / Barbeiros** (`/barbers`), localize o card do profissional desejado.
2. **Abrir o Gerenciador de Ausências:** No card do barbeiro, clique no ícone de relógio **Gerenciar folgas e ausências** (`ProfessionalTimeOffDialog`).
3. **Consultar Ausências Cadastradas:** O modal exibirá a listagem de ausências ativas e futuras do profissional com datas, tipos e status.
4. **Cadastrar Novo Bloqueio:**
   • Clique no botão **Adicionar Ausência**.
   • Selecione o **Tipo de Ausência**:
     - *Bloqueio Pessoal (`personal_block`):* Pausas curtas ou compromissos particulares durante o expediente.
     - *Folga (`day_off`):* Dia completo sem atendimento na barbearia.
     - *Intervalo Extra (`break`):* Pausa estendida entre turnos de atendimento.
     - *Reunião (`meeting`) ou Treinamento (`training`):* Eventos internos da equipe.
     - *Férias (`vacation`) ou Licença Médica (`medical_leave`):* Afastamentos de média ou longa duração.
   • Defina a data e horário de **Início** e **Término** (ou marque a opção *Dia Inteiro*).
   • Adicione um título e justificativa interna (opcional).
5. **Verificação Automática de Conflitos:** Ao selecionar o intervalo, o sistema executa automaticamente a checagem (`check_time_off_conflicts`). Se já existirem clientes com horário marcado nesse intervalo, um aviso em amarelo detalhará os agendamentos afetados.
6. **Salvar Ausência:** Clique em **Salvar Ausência**. O sistema registra o bloqueio e fecha imediatamente a disponibilidade desse profissional no agendamento público e na agenda interna.

**5. Resultado Esperado:** O intervalo selecionado é bloqueado na grade da agenda, impedindo novas reservas de clientes e sinalizando visualmente a indisponibilidade do profissional.

**6. Limitações e Regras Aplicáveis:**
• Barbeiros não aprovam unilateralmente ausências ou folgas quando houver clientes já agendados no período sem a devida anuência e remanejamento pela administração da barbearia.
• O bloqueio na grade não cancela magicamente agendamentos pré-existentes: caso existam clientes agendados, a recepção ou o gestor deve antes entrar em contato e reagendá-los ou cancelá-los formalmente.

**7. Problemas Frequentes e Orientações:**
• *Aviso "Data de término anterior à de início":* Verifique se o relógio de término está configurado para um horário posterior ao de início.
• *Cliente tenta agendar no horário bloqueado:* No site público da barbearia, os horários sob bloqueio são removidos automaticamente da grade e nunca são exibidos para escolha.

**8. Módulo e Categoria:** Módulo Agenda / Categoria: Agenda.

**9. Termos de Busca e Palavras-chave:** bloquear horário, folga barbeiro, ausência, intervalo, férias profissional, pausa na agenda, indisponibilidade, grade bloqueada.',
    '428c0ddc-fc67-42be-bc4f-aff6280344f3',
    'document',
    'basico',
    '3 min',
    'Calendar',
    'como-bloquear-horarios-e-solicitar-folgas',
    ARRAY['barber', 'reception', 'tenant_admin', 'admin'],
    'calendar',
    'published',
    '/barbers',
    14,
    false
  ),

  -- ----------------------------------------------------------------------------
  -- T06: Cliente/Recepção — Como funciona o agendamento em grupo
  -- ----------------------------------------------------------------------------
  (
    'e59a721d-9e0c-4c48-8df1-3f628ab29006',
    'Como funciona o agendamento em grupo',
    'Entenda como visualizar, reagendar e cancelar múltiplos serviços ou horários simultâneos através do link seguro de grupo.',
    '**1. Perfil Autorizado:** Cliente (`client`), Recepção (`reception`), Proprietário (`tenant_admin`) e Administrador (`admin`).

**2. Objetivo do Procedimento:** Gerenciar agendamentos que contêm múltiplos serviços em sequência ou atendimentos simultâneos (ex: corte + barba, amigos, pai e filho) através de uma página unificada e protegida por token.

**3. Pré-requisitos:** Ter realizado um agendamento com múltiplos serviços ou horário em grupo, possuindo o link seguro com token enviado na confirmação da reserva.

**4. Passo a Passo:**
1. **Acesso à Página do Agendamento:** O cliente clica no link recebido por WhatsApp ou comprovante no formato `barbex.shop/agendamentos/grupo/{token}`.
2. **Visualização dos Serviços Agendados:** A página exibe a identificação da barbearia, o nome do titular e todos os horários agrupados com data, horário, nome de cada profissional e valor do serviço.
3. **Reagendamento de Horários:**
   • Clique no botão **Reagendar** ao lado do serviço desejado.
   • O assistente inteligente consulta a disponibilidade em tempo real e apresenta as datas e horários livres com o profissional.
   • Selecione a nova data e horário e confirme. A alteração é refletida imediatamente na grade da barbearia.
4. **Cancelamento Parcial ou Total com Opções de Estorno:**
   • Para cancelar um ou mais serviços do grupo, marque as caixas de seleção correspondentes e clique em **Cancelar Selecionados** (ou cancelar o grupo todo).
   • O assistente de cancelamento do cliente (`useCustomerCancellation`) avalia a antecedência mínima da barbearia.
   • Se o agendamento possuir pagamento prévio (PIX ou créditos), o cliente poderá optar entre:
     a) **Converter em Créditos na Barbearia:** O saldo é creditado de forma instantânea para uso em agendamentos futuros.
     b) **Solicitar Reembolso via PIX:** O cliente informa a sua chave PIX para que a barbearia processe o estorno.
5. **Gestão pela Recepção:** A equipe da recepção também pode gerenciar o grupo pela agenda operacional (`/reception/agenda`), remanejando profissionais ou alterando status em lote.

**5. Resultado Esperado:** Todos os serviços do pacote/grupo devidamente coordenados na agenda da barbearia, permitindo ao cliente total transparência e autosserviço sem necessidade de chamadas telefônicas.

**6. Limitações e Regras Aplicáveis:**
• O cancelamento de serviços está sujeito à política de tolerância de horário e antecedência mínima configurada pela barbearia.
• O link com token é pessoal e intransferível; quem possui o link pode gerenciar os horários daquele grupo específico.

**7. Problemas Frequentes e Orientações:**
• *Mensagem "Link expirado ou inválido":* Verifique se o link copiado está completo ou solicite à recepção o reenvio da confirmação com o link atualizado.
• *Tentativa de cancelamento fora do prazo:* Quando o horário limite de antecedência é ultrapassado, o botão de cancelamento online é desativado e o cliente é orientado a entrar em contato com a barbearia.

**8. Módulo e Categoria:** Módulo Agenda / Categoria: Agenda.

**9. Termos de Busca e Palavras-chave:** agendamento em grupo, múltiplos serviços, pacote corte e barba, token agendamento, reagendar grupo, cancelar agendamento, estorno pix, crédito barbearia.',
    '428c0ddc-fc67-42be-bc4f-aff6280344f3',
    'document',
    'basico',
    '4 min',
    'Users',
    'como-funciona-o-agendamento-em-grupo',
    ARRAY['client', 'customer', 'reception', 'tenant_admin', 'admin'],
    'appointments',
    'published',
    '/agendamentos/grupo/:token',
    15,
    false
  ),

  -- ----------------------------------------------------------------------------
  -- T07: Barbeiro — Como configurar o portfólio e a página pública profissional
  -- ----------------------------------------------------------------------------
  (
    'e59a721d-9e0c-4c48-8df1-3f628ab29007',
    'Como configurar o portfólio e a página pública profissional',
    'Como funciona a página pública do profissional na web e como a administração da barbearia configura serviços, foto e chave PIX de gorjetas.',
    '**1. Perfil Autorizado:** Barbeiro (`barber`), Proprietário (`tenant_admin`) e Administrador (`admin`).

**2. Objetivo do Procedimento:** Apresentar a página pública profissional do barbeiro na internet (`/$slug/equipe/$barberId`) para atração de novos clientes e detalhar como a administração da barbearia configura a foto de perfil, serviços executados e chave PIX para gorjetas.

**3. Pré-requisitos:** O profissional deve estar cadastrado como barbeiro ativo na barbearia e a página pública do estabelecimento deve estar configurada.

**4. Passo a Passo:**
1. **Página Pública do Barbeiro (`/$slug/equipe/$barberId`):**
   • Todo profissional ativo possui um endereço web exclusivo no formato: `barbex.shop/{slug-da-barbearia}/equipe/{id-do-profissional}`.
   • A página exibe publicamente: foto de perfil em alta resolução, biografia, especialidades, média de avaliações com estrelas, depoimentos reais de clientes e a lista dos serviços que o profissional executa com preços e duração.
   • Possui um botão de chamada para ação direta: **Agendar com este profissional**, que abre o fluxo de reserva já com o barbeiro pré-selecionado.
2. **Divulgação pelo Barbeiro:** O profissional pode copiar o link da sua página pública e divulgá-lo em suas redes sociais (Instagram, WhatsApp, cartões virtuais) para captar agendamentos diretos para a sua cadeira.
3. **Configuração e Edição do Perfil (Competência Administrativa):**
   • Em conformidade com as regras de governança da barbearia, a edição dos dados contratuais e do portfólio é realizada pelo Proprietário ou Administrador no painel em **Equipe / Barbeiros** (`/barbers`).
   • No card do profissional, o gestor clica em **Editar** (`isEditDialogOpen`) e pode:
     - Fazer upload da **Foto de Perfil** do barbeiro.
     - Vincular quais **Serviços** o profissional está habilitado a prestar.
     - Ativar a **Gorjeta Digital via PIX** inserindo a chave PIX do barbeiro e o QR Code.
     - Configurar a grade de horários de trabalho semanal.
4. **Atualização de Avaliações e Depoimentos:** Avaliações enviadas por clientes após a conclusão de atendimentos são vinculadas ao barbeiro. Quando aprovadas pela moderação, aparecem automaticamente em destaque na página pública do profissional.

**5. Resultado Esperado:** Página profissional atraente, indexável para mecanismos de busca, funcionando como portfólio online oficial do barbeiro com integração direta à agenda do Barbex.

**6. Limitações e Regras Aplicáveis:**
• A página pública é acessível a qualquer cliente e visitante na web; no entanto, a alteração de foto, serviços autorizados, percentuais e dados cadastrais é centralizada no painel administrativo (`/barbers`) para manter o alinhamento contratual da barbearia.
• Barbeiros inativados na gestão da equipe têm suas páginas públicas desativadas automaticamente, retornando aviso amigável de profissional indisponível.

**7. Problemas Frequentes e Orientações:**
• *Serviço não aparece no perfil do profissional:* O gestor deve acessar `/barbers` -> Editar Barbeiro e marcar o serviço na lista de especialidades executadas.
• *Foto não carrega ou está desatualizada:* Solicite ao administrador o envio de uma imagem quadrada e nítida no formulário de edição do profissional.

**8. Módulo e Categoria:** Módulo Equipe / Categoria: Equipe.

**9. Termos de Busca e Palavras-chave:** página do barbeiro, portfólio profissional, equipe barbearia, link agendamento, foto perfil barbeiro, gorjeta pix, avaliações do profissional, divulgação instagram.',
    '05fa32a0-54a1-42a2-bad2-e9f6f56f3fe5',
    'document',
    'basico',
    '3 min',
    'Scissors',
    'como-configurar-o-portfolio-e-a-pagina-publica-profissional',
    ARRAY['barber', 'tenant_admin', 'admin'],
    'barbers',
    'published',
    '/:slug/equipe/:barberId',
    16,
    false
  )

ON CONFLICT (id) DO UPDATE SET
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

