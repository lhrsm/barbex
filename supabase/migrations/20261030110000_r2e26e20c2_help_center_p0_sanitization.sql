-- ==============================================================================
-- MIGRATION: 20261030110000_r2e26e20c2_help_center_p0_sanitization.sql
-- FASE: R2E.26E.20C.2 — Saneamento P0 da Central de Ajuda (Z-API e Rotas Canônicas)
-- MODALIDADE: PREPARAÇÃO LOCAL / SEM EXECUÇÃO EM PRODUÇÃO
-- DESCRIÇÃO:
--   1. Padroniza o aviso comercial obrigatório da integração Z-API nos artigos
--      de automação e WhatsApp, esclarecendo que é serviço externo pago à parte.
--   2. Atualiza as rotas canônicas e o fluxo real de cancelamento nos tutoriais
--      do portal do cliente e da agenda (/agendamento/{token}, /{slug}/portal).
--   3. Preserva 100% dos títulos, categorias, ordens, status e profile_target.
--   4. Mantém intactas as políticas RLS e os 58 registros persistidos.
-- ==============================================================================

BEGIN;

DO $$
DECLARE
  v_count integer;
  v_post_reception integer;
  v_post_client integer;
  v_post_total integer;
BEGIN
  -- ----------------------------------------------------------------------------
  -- 1. ASSERÇÕES DE PRÉ-CONDIÇÃO
  -- ----------------------------------------------------------------------------
  SELECT count(*) INTO v_count
  FROM public.tutorials
  WHERE id IN (
    'e2e293be-0df7-4d80-8cf0-b27a7268e33d'::uuid,
    '2e2831f1-a060-4fe0-9eec-40a56096ae08'::uuid,
    '64032882-67d0-4d3a-ba4d-0ee186d8c175'::uuid,
    '1ce9d357-4170-4be6-a50d-c1115faf1676'::uuid,
    '628290d8-6193-463c-8058-16b68f84ee13'::uuid,
    '905468c9-b4eb-4554-9493-e072cc92ec0e'::uuid,
    '7f0f541d-c72c-4aa8-bebb-764a292917b6'::uuid,
    'c334b3ba-0993-449a-a58e-88fb89f7f3d1'::uuid,
    'e8227c4e-15da-4c36-9dee-a044c4236199'::uuid
  );

  IF v_count <> 9 THEN
    RAISE EXCEPTION 'Falha de pré-condição: esperados 9 artigos, encontrados %', v_count;
  END IF;

  -- ----------------------------------------------------------------------------
  -- 2. ATUALIZAÇÃO CIRÚRGICA DOS 6 ARTIGOS DE WHATSAPP / Z-API
  -- ----------------------------------------------------------------------------

  -- 1. Como funcionam as automações
  UPDATE public.tutorials
  SET long_description = '1. No menu Automações, você gerencia as réguas de comunicação do estabelecimento: confirmação de agendamento, lembrete prévio (ex: 2h antes), agradecimento pós-atendimento, cancelamento, reagendamento e aniversário.
2. Cada automação possui um gatilho do ciclo de vida, destinatário definido (cliente ou equipe interna) e modelo de mensagem personalizável.
3. Utilize variáveis dinâmicas seguras como {customer_name}, {barbershop_name}, {service_name}, {date} e {time}.
4. Ative ou desative cada régua individualmente conforme a necessidade operacional da barbearia.
5. O painel de diagnósticos exibe o status de entrega e histórico de eventos processados.
6. O mecanismo antiflood e deduplicação do Barbex impede que mensagens idênticas sejam enviadas em duplicidade.

**Integração externa — WhatsApp (Z-API)**

As automações de mensagens pelo WhatsApp dependem da integração com a Z-API, serviço de terceiros contratado e pago separadamente pelo responsável pela barbearia. A contratação da Z-API não está incluída automaticamente nos planos do Barbex. A disponibilidade das automações depende da configuração e ativação da integração.',
      updated_at = NOW()
  WHERE id = 'e2e293be-0df7-4d80-8cf0-b27a7268e33d'::uuid;

  -- 2. Como usar fluxos conversacionais e botões inteligentes
  UPDATE public.tutorials
  SET long_description = 'O Barbex permite configurar mensagens automáticas contendo botões interativos de ação rápida diretamente na conversa do WhatsApp.

**Como configurar:**
1. Acesse o menu **Automações** e selecione o modelo de mensagem desejado (ex: Confirmação de Agendamento).
2. Na aba **Interações / Botões**, adicione as opções de resposta:
   • Botão 1: "Confirmar Presença" (ação: atualizar status para confirmado).
   • Botão 2: "Reagendar" (ação: enviar link do assistente de reagendamento).
   • Botão 3: "Cancelar Horário" (ação: cancelar agendamento e liberar horário na agenda).
3. Salve o modelo e certifique-se de que o Webhook do Barbex está devidamente preenchido na sua conta da Z-API.
4. Quando o cliente pressiona um botão no WhatsApp, o webhook processa a resposta instantaneamente e atualiza a agenda sem intervenção humana.

**Integração externa — WhatsApp (Z-API)**

As automações de mensagens pelo WhatsApp dependem da integração com a Z-API, serviço de terceiros contratado e pago separadamente pelo responsável pela barbearia. A contratação da Z-API não está incluída automaticamente nos planos do Barbex. A disponibilidade das automações depende da configuração e ativação da integração.',
      updated_at = NOW()
  WHERE id = '2e2831f1-a060-4fe0-9eec-40a56096ae08'::uuid;

  -- 3. Automações inteligentes de reagendamento e cancelamento
  UPDATE public.tutorials
  SET long_description = 'O Barbex identifica o **ator** da ação e envia a mensagem correta:

- Cliente cancela → confirmação para o cliente + alerta para a equipe.
- Barbeiro/Barbearia cancela → desculpas para o cliente com CTA para reagendar.
- Reagendamento → mostra data antiga e nova (`{{old_date}}` e `{{new_date}}`).

**Como personalizar:**
1. **Automações** → filtre por **Cancelamento** ou **Reagendamento**.
2. Edite os templates conforme ator e destinatário.
3. Use as variáveis disponíveis no editor.

**Integração externa — WhatsApp (Z-API)**

As automações de mensagens pelo WhatsApp dependem da integração com a Z-API, serviço de terceiros contratado e pago separadamente pelo responsável pela barbearia. A contratação da Z-API não está incluída automaticamente nos planos do Barbex. A disponibilidade das automações depende da configuração e ativação da integração.',
      updated_at = NOW()
  WHERE id = '64032882-67d0-4d3a-ba4d-0ee186d8c175'::uuid;

  -- 4. Como testar conexão do WhatsApp
  UPDATE public.tutorials
  SET long_description = '1. No menu Configurações, acesse a aba Integrações → WhatsApp.
2. Certifique-se de que sua instância Z-API está ativa e conectada ao aparelho oficial.
3. Clique no botão "Testar Conexão".
4. O Barbex consultará os servidores da Z-API para checar o status da sessão (Conectado / Desconectado).
5. Insira seu número pessoal com DDD e clique em "Enviar Mensagem de Teste".
6. Se a mensagem não chegar em instantes, verifique:
   • Se o celular da barbearia está com bateria e conectado à internet.
   • Se a mensalidade da instância Z-API está em dia.
   • Se o Instance ID e Token foram colados sem espaços extras.
7. O log de diagnósticos exibirá o código de retorno da Z-API para facilitar o suporte.

**Integração externa — WhatsApp (Z-API)**

As automações de mensagens pelo WhatsApp dependem da integração com a Z-API, serviço de terceiros contratado e pago separadamente pelo responsável pela barbearia. A contratação da Z-API não está incluída automaticamente nos planos do Barbex. A disponibilidade das automações depende da configuração e ativação da integração.',
      updated_at = NOW()
  WHERE id = '1ce9d357-4170-4be6-a50d-c1115faf1676'::uuid;

  -- 5. Como configurar destinatários internos do WhatsApp
  UPDATE public.tutorials
  SET long_description = 'Além de notificar o cliente, o Barbex pode enviar alertas em tempo real para os telefones da sua equipe (gerentes, recepcionistas e barbeiros).

**Como configurar:**
1. Acesse **Configurações** → aba **WhatsApp** → seção **Destinatários Internos**.
2. Clique em **"Adicionar Destinatário"** e informe o nome da pessoa e o telefone com DDD.
3. Selecione quais eventos essa pessoa deve receber (ex: Novo Agendamento, Cancelamento de Última Hora, Check-in de Chegada).
4. Clique em **Salvar**.
5. Realize um disparo de teste para garantir que o número está recebendo alertas normalmente.

**Integração externa — WhatsApp (Z-API)**

As automações de mensagens pelo WhatsApp dependem da integração com a Z-API, serviço de terceiros contratado e pago separadamente pelo responsável pela barbearia. A contratação da Z-API não está incluída automaticamente nos planos do Barbex. A disponibilidade das automações depende da configuração e ativação da integração.',
      updated_at = NOW()
  WHERE id = '628290d8-6193-463c-8058-16b68f84ee13'::uuid;

  -- 6. Como configurar Z-API
  UPDATE public.tutorials
  SET long_description = '1. Acesse o provedor Z-API (z-api.io), crie sua conta e contrate uma instância dedicada à sua barbearia.
2. No painel da Z-API, copie o Instance ID, Token da Instância e Client-Token de Segurança.
3. No painel Barbex, acesse Configurações → Integrações → WhatsApp.
4. Cole as três credenciais nos campos correspondentes e clique em "Salvar Configurações".
5. Escaneie o QR Code exibido na tela utilizando o aplicativo WhatsApp no aparelho oficial da barbearia.
6. Configure a URL de Webhook fornecida pelo Barbex no painel da Z-API para habilitar o recebimento de respostas e botões interativos.
7. Clique no botão "Testar Conexão" para realizar um disparo de validação.

**Integração externa — WhatsApp (Z-API)**

As automações de mensagens pelo WhatsApp dependem da integração com a Z-API, serviço de terceiros contratado e pago separadamente pelo responsável pela barbearia. A contratação da Z-API não está incluída automaticamente nos planos do Barbex. A disponibilidade das automações depende da configuração e ativação da integração.',
      updated_at = NOW()
  WHERE id = '905468c9-b4eb-4554-9493-e072cc92ec0e'::uuid;

  -- ----------------------------------------------------------------------------
  -- 3. ATUALIZAÇÃO CIRÚRGICA DOS 3 ARTIGOS DE ROTAS DE CANCELAMENTO / PORTAL
  -- ----------------------------------------------------------------------------

  -- 7. Como funciona o portal do cliente e o Clube Barbex
  UPDATE public.tutorials
  SET long_description = 'O Portal do Cliente é a área privativa onde seu cliente gerencia toda a sua experiência com a barbearia sem precisar sobrecarregar a recepção.

**Recursos disponíveis no portal:**
1. Acesso no endereço canônico `barbex.shop/{slug}/portal` informando o número de celular com DDD.
2. **Gestão de Agendamentos e Cancelamentos:** Visualização do próximo agendamento com botões diretos para Reagendar ou Cancelar:
   • O cancelamento respeita a política de antecedência mínima definida pela barbearia (cancelamentos fora do prazo são bloqueados automaticamente).
   • Se o agendamento possuir pagamento prévio (PIX ou créditos), o cliente pode optar por converter o valor em créditos imediatos na barbearia ou solicitar estorno via PIX.
   • O cliente também pode gerenciar o agendamento diretamente pelo link seguro com token enviado no comprovante (`barbex.shop/agendamento/{token}`).
3. Linha do tempo ''Sua Jornada'': histórico de atendimentos anteriores, profissional de preferência e saldo acumulado de fidelidade ou cashback.
4. Área de Assinantes: carteirinha digital do Clube Barbex, contagem de cortes utilizados no mês e benefícios inclusos.
5. Para clientes sem assinatura, exibe o banner comparativo com as vantagens de se associar ao Clube.
6. Acesso à Central de Ajuda do Cliente (com tutoriais exclusivos) e vitrine de produtos da barbearia.

**Integração externa — WhatsApp (Z-API)**

As automações de mensagens pelo WhatsApp dependem da integração com a Z-API, serviço de terceiros contratado e pago separadamente pelo responsável pela barbearia. A contratação da Z-API não está incluída automaticamente nos planos do Barbex. A disponibilidade das automações depende da configuração e ativação da integração.',
      updated_at = NOW()
  WHERE id = '7f0f541d-c72c-4aa8-bebb-764a292917b6'::uuid;

  -- 8. Como reagendar trocando data, horário e profissional
  UPDATE public.tutorials
  SET long_description = '1. No menu Agenda ou Recepção, clique sobre o agendamento existente para abrir o modal de detalhes.
2. Localize e clique no botão ''Reagendar Horário''.
3. O assistente de reagendamento será aberto mantendo o cliente e os serviços já contratados.
4. Se desejar trocar de profissional, selecione o novo barbeiro na lista — a grade horária será atualizada instantaneamente.
5. Selecione a nova data no calendário e escolha um dos horários disponíveis calculados com base no tempo total dos serviços.
6. O sistema executa checagens automáticas para impedir sobreposições e conflitos com outros atendimentos ou intervalos da equipe.
7. Clique em ''Confirmar Reagendamento'' para salvar a alteração.
8. A agenda será atualizada na hora e, caso a barbearia possua Z-API ativa, uma mensagem automática com o novo horário será enviada ao cliente.

**Canais de Autoatendimento do Cliente:**
• O cliente pode reagendar ou cancelar com autonomia através do Portal do Cliente (`barbex.shop/{slug}/portal`) ou pelo link direto do agendamento (`barbex.shop/agendamento/{token}`).
• Reagendamentos respeitam a política de antecedência mínima configurada pela administração da barbearia.

**Integração externa — WhatsApp (Z-API)**

As automações de mensagens pelo WhatsApp dependem da integração com a Z-API, serviço de terceiros contratado e pago separadamente pelo responsável pela barbearia. A contratação da Z-API não está incluída automaticamente nos planos do Barbex. A disponibilidade das automações depende da configuração e ativação da integração.',
      updated_at = NOW()
  WHERE id = 'c334b3ba-0993-449a-a58e-88fb89f7f3d1'::uuid;

  -- 9. Como concluir ou cancelar um atendimento
  UPDATE public.tutorials
  SET long_description = '1. No painel operacional (/calendar ou /reception/agenda), clique no card do agendamento para abrir os detalhes.
2. **Concluir Atendimento:** Clique em ''Concluir Atendimento'' ao finalizar o serviço na cadeira. A RPC segura registrará a produção e calculará a comissão do barbeiro imediatamente.
3. **Cancelar Atendimento:** 
   • Se o cliente avisar que não virá, clique em ''Cancelar Horário''. O status mudará para Cancelado e o horário na grade será liberado instantaneamente.
   • Se o cliente não comparecer sem aviso prévio, selecione a opção ''Não Compareceu'' (No-Show) para registrar no histórico de assiduidade do cliente.
   • Caso o agendamento possua pagamento antecipado registrado, a tela financeira exibirá a opção de estorno ou conversão em crédito para a barbearia.
4. Atendimentos concluídos alimentam o fluxo de caixa, as comissões pendentes de liquidação e o histórico de fidelidade do cliente.',
      updated_at = NOW()
  WHERE id = 'e8227c4e-15da-4c36-9dee-a044c4236199'::uuid;

  -- ----------------------------------------------------------------------------
  -- 4. ASSERÇÕES DE PÓS-CONDIÇÃO
  -- ----------------------------------------------------------------------------
  -- Total de artigos na tabela permanece exatamente 58
  SELECT count(*) INTO v_post_total FROM public.tutorials;
  IF v_post_total <> 58 THEN
    RAISE EXCEPTION 'Falha de pós-condição: total de artigos alterado! Esperado: 58, obtido: %', v_post_total;
  END IF;

  -- Total com permissão de recepção permanece exatamente 12
  SELECT count(*) INTO v_post_reception FROM public.tutorials WHERE 'reception' = ANY(profile_target);
  IF v_post_reception <> 12 THEN
    RAISE EXCEPTION 'Falha de pós-condição: contagem de recepção alterada! Esperado: 12, obtido: %', v_post_reception;
  END IF;

  -- Total com permissão de cliente permanece exatamente 3
  SELECT count(*) INTO v_post_client FROM public.tutorials WHERE ('client' = ANY(profile_target) OR 'customer' = ANY(profile_target));
  IF v_post_client <> 3 THEN
    RAISE EXCEPTION 'Falha de pós-condição: contagem de cliente alterada! Esperado: 3, obtido: %', v_post_client;
  END IF;

  RAISE NOTICE 'Migration R2E.26E.20C.2 validada com sucesso.';
END $$;

COMMIT;

