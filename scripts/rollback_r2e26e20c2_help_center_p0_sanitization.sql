-- ==============================================================================
-- ROLLBACK SCRIPT: rollback_r2e26e20c2_help_center_p0_sanitization.sql
-- FASE: R2E.26E.20C.2 — Saneamento P0 da Central de Ajuda
-- DESCRIÇÃO: Restaura os 9 artigos ao seu estado exato pré-saneamento (R2E.26E.20B.11).
-- ==============================================================================

BEGIN;

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.tutorials
  WHERE id IN (
    'e8227c4e-15da-4c36-9dee-a044c4236199'::uuid,
    'c334b3ba-0993-449a-a58e-88fb89f7f3d1'::uuid,
    '7f0f541d-c72c-4aa8-bebb-764a292917b6'::uuid,
    '905468c9-b4eb-4554-9493-e072cc92ec0e'::uuid,
    '1ce9d357-4170-4be6-a50d-c1115faf1676'::uuid,
    'e2e293be-0df7-4d80-8cf0-b27a7268e33d'::uuid,
    '628290d8-6193-463c-8058-16b68f84ee13'::uuid,
    '2e2831f1-a060-4fe0-9eec-40a56096ae08'::uuid,
    '64032882-67d0-4d3a-ba4d-0ee186d8c175'::uuid
  );

  IF v_count <> 9 THEN
    RAISE EXCEPTION 'Falha no rollback: esperados 9 artigos, encontrados %', v_count;
  END IF;

  -- Restaura: Como concluir ou cancelar um atendimento
  UPDATE public.tutorials
  SET long_description = 'Objetivo: fechar corretamente o ciclo de um atendimento.

Passo a passo:
1. Abra o agendamento na Agenda.
2. Clique em Concluir para gerar receita, comissão e movimentar caixa.
3. Use Cancelar quando o cliente não comparecer — o horário é liberado.
4. Assinantes cobertos pelo plano não entram no fluxo de caixa.',
      updated_at = NOW()
  WHERE id = 'e8227c4e-15da-4c36-9dee-a044c4236199'::uuid;

  -- Restaura: Como reagendar trocando data, horário e profissional
  UPDATE public.tutorials
  SET long_description = 'O assistente de reagendamento do Barbex permite alterar data, horário e profissional de forma rápida, validando em tempo real os conflitos de grade.

**Passo a passo:**
1. Na **Agenda** ou **Área da Recepção**, localize o agendamento e clique na ação **"Reagendar"**.
2. **Seleção de Profissional:** mantenha o profissional original ou escolha outro membro da equipe habilitado para o serviço.
3. **Seleção de Data:** o calendário destaca apenas os dias em que o barbeiro selecionado possui jornada de trabalho configurada.
4. **Seleção de Horário:** os intervalos livres são recalculados considerando a duração total dos serviços, tempo de intervalo entre atendimentos e eventuais bloqueios manuais.
5. **Revisão e Confirmação:** confira os novos dados na tela de resumo e confirme a alteração.
6. A agenda é atualizada em tempo real para toda a equipe.
7. Se a barbearia mantiver conexão ativa com a Z-API, o cliente recebe uma mensagem automática informando os novos dados do agendamento.

Dica: Clientes também podem reagendar com autonomia através do Portal do Cliente (barbex.shop/{slug}/portal), desde que respeitada a janela de antecedência permitida nas configurações.',
      updated_at = NOW()
  WHERE id = 'c334b3ba-0993-449a-a58e-88fb89f7f3d1'::uuid;

  -- Restaura: Como funciona o portal do cliente e o Clube Barbex
  UPDATE public.tutorials
  SET long_description = 'O Portal do Cliente é a área privativa onde seu cliente gerencia toda a sua experiência com a barbearia sem precisar sobrecarregar a recepção.

**Recursos disponíveis no portal:**
1. Acesso simples e sem senhas em barbex.shop/{slug}/portal informando o número de celular.
2. Visualização do próximo agendamento em destaque com botão de reagendamento ou cancelamento (respeitando a política de antecedência mínima definida pela casa).
3. Linha do tempo ''Sua Jornada'': histórico de visitas anteriores, profissional de preferência e saldo de fidelidade/cashback.
4. Área de Assinantes: carteirinha digital do Clube Barbex, contagem de cortes utilizados no mês e benefícios inclusos.
5. Para clientes sem assinatura, exibe o banner comparativo com as vantagens de se associar ao Clube.
6. Acesso a cupons de desconto disponíveis e botão de gorjeta direta via PIX para o barbeiro.

Nota: Para que o link do portal seja enviado automaticamente após o agendamento via WhatsApp, é necessária a integração ativa com a Z-API.',
      updated_at = NOW()
  WHERE id = '7f0f541d-c72c-4aa8-bebb-764a292917b6'::uuid;

  -- Restaura: Como configurar Z-API
  UPDATE public.tutorials
  SET long_description = '1. Acesse o provedor Z-API (z-api.io), crie sua conta e contrate uma instância dedicada à sua barbearia.
2. No painel da Z-API, copie o Instance ID, Token da Instância e Client-Token de Segurança.
3. No painel Barbex, acesse Configurações → Integrações → WhatsApp.
4. Cole as três credenciais nos campos correspondentes e clique em "Salvar Configurações".
5. Escaneie o QR Code exibido na tela utilizando o aplicativo WhatsApp no aparelho oficial da barbearia.
6. Configure a URL de Webhook fornecida pelo Barbex no painel da Z-API para habilitar o recebimento de respostas e botões interativos.
7. Clique no botão "Testar Conexão" para realizar um disparo de validação.

Aviso Comercial e Operacional: O Barbex não oferece integração nativa ou independente com WhatsApp incluída automaticamente nos planos. A plataforma utiliza a Z-API como provedor parceiro externo compatível, cuja contratação, mensalidade e custos de mensagens são contratados diretamente com a Z-API pelo proprietário. Recomendamos utilizar um chip exclusivo para o estabelecimento.',
      updated_at = NOW()
  WHERE id = '905468c9-b4eb-4554-9493-e072cc92ec0e'::uuid;

  -- Restaura: Como testar conexão do WhatsApp
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

Atenção: A ferramenta de teste valida a comunicação com sua instância Z-API externa contratada separadamente.',
      updated_at = NOW()
  WHERE id = '1ce9d357-4170-4be6-a50d-c1115faf1676'::uuid;

  -- Restaura: Como funcionam as automações
  UPDATE public.tutorials
  SET long_description = '1. No menu Automações, você gerencia as réguas de comunicação do estabelecimento: confirmação de agendamento, lembrete prévio (ex: 2h antes), agradecimento pós-atendimento, cancelamento, reagendamento e aniversário.
2. Cada automação possui um gatilho do ciclo de vida, destinatário definido (cliente ou equipe interna) e modelo de mensagem personalizável.
3. Utilize variáveis dinâmicas seguras como {customer_name}, {barbershop_name}, {service_name}, {date} e {time}.
4. Ative ou desative cada régua individualmente conforme a necessidade operacional da barbearia.
5. O painel de diagnósticos exibe o status de entrega e histórico de eventos processados.
6. O mecanismo antiflood e deduplicação do Barbex impede que mensagens idênticas sejam enviadas em duplicidade.

Esclarecimento Comercial: O disparo de automações via WhatsApp não é nativo nem gratuito, dependendo de provedor externo compatível (Z-API), cuja contratação e custos de plano são de responsabilidade do estabelecimento.',
      updated_at = NOW()
  WHERE id = 'e2e293be-0df7-4d80-8cf0-b27a7268e33d'::uuid;

  -- Restaura: Como configurar destinatários internos do WhatsApp
  UPDATE public.tutorials
  SET long_description = 'Além de notificar o cliente, o Barbex pode enviar alertas em tempo real para os telefones da sua equipe (gerentes, recepcionistas e barbeiros).

**Como configurar:**
1. Acesse **Configurações** → aba **WhatsApp** → seção **Destinatários Internos**.
2. Clique em **"Adicionar Destinatário"** e informe o nome da pessoa e o telefone com DDD.
3. Selecione quais eventos essa pessoa deve receber (ex: Novo Agendamento, Cancelamento de Última Hora, Check-in de Chegada).
4. Clique em **Salvar**.
5. Realize um disparo de teste para garantir que o número está recebendo alertas normalmente.

**Aviso de Integração:** O envio de mensagens para destinatários internos utiliza a conexão da sua instância Z-API configurada. É necessário que a integração esteja conectada e com plano ativo junto ao provedor.',
      updated_at = NOW()
  WHERE id = '628290d8-6193-463c-8058-16b68f84ee13'::uuid;

  -- Restaura: Como usar fluxos conversacionais e botões inteligentes
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

Aviso Técnico e Comercial: Os botões interativos dependem do suporte nativo da Z-API e de sua compatibilidade com os aplicativos WhatsApp oficiais. A Z-API é um serviço de terceiros contratado separadamente pela barbearia.',
      updated_at = NOW()
  WHERE id = '2e2831f1-a060-4fe0-9eec-40a56096ae08'::uuid;

  -- Restaura: Automações inteligentes de reagendamento e cancelamento
  UPDATE public.tutorials
  SET long_description = 'O Barbex identifica o **ator** da ação e envia a mensagem correta:

- Cliente cancela → confirmação para o cliente + alerta para a equipe.
- Barbeiro/Barbearia cancela → desculpas para o cliente com CTA para reagendar.
- Reagendamento → mostra data antiga e nova (`{{old_date}}` e `{{new_date}}`).

**Como personalizar:**
1. **Automações** → filtre por **Cancelamento** ou **Reagendamento**.
2. Edite os 18 templates conforme ator e destinatário.
3. Use as variáveis disponíveis no editor.',
      updated_at = NOW()
  WHERE id = '64032882-67d0-4d3a-ba4d-0ee186d8c175'::uuid;

  RAISE NOTICE 'Rollback R2E.26E.20C.2 executado com sucesso: 9 artigos restaurados ao estado original.';
END $$;

COMMIT;
