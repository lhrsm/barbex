-- ==============================================================================
-- MIGRATION: 20261028140000_r2e26e20b_tutorials_sanitization_and_rls.sql
-- FASE: R2E.26E.20B — Saneamento Controlado da Base de Conhecimento Barbex
-- MODALIDADE: PREPARAÇÃO LOCAL / SEM APLICAÇÃO EM PRODUÇÃO
-- DESCRIÇÃO:
--   1. Atualiza profile_target para os 58 artigos da tabela tutorials
--   2. Atualiza textos e disclaimers comerciais dos 14 artigos em revisão
--   3. Endurece a policy RLS para visualização restrita por perfil e clientes públicos
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. ATUALIZAÇÃO DOS METADADOS DE PERFIL (profile_target) E MÓDULOS (module_key)
-- ------------------------------------------------------------------------------
UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'manager', 'receptionist']::text[], module_key = 'subscriptions', updated_at = NOW()
WHERE id = 'a3ba57c9-60a7-4c2d-8a5a-544dde3c0451';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin']::text[], module_key = 'whatsapp', updated_at = NOW()
WHERE id = '905468c9-b4eb-4554-9493-e072cc92ec0e';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin']::text[], module_key = 'settings', updated_at = NOW()
WHERE id = 'fc102b15-773e-4c5d-a093-81e5adfbdc2f';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin']::text[], module_key = 'finances', updated_at = NOW()
WHERE id = 'd41f3d07-4b37-4b97-ba99-a2b8d3e44206';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'receptionist']::text[], module_key = 'calendar', updated_at = NOW()
WHERE id = 'cf240ea1-0dec-4817-8afe-8626c4968e21';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'manager']::text[], module_key = 'loyalty', updated_at = NOW()
WHERE id = 'e16bb3fd-1359-4da2-91cd-cc8a03619e0d';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'manager', 'receptionist']::text[], module_key = 'products', updated_at = NOW()
WHERE id = '60a1afbb-4cdf-4dcb-a9a4-ea95dc134b73';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'financial', 'finance']::text[], module_key = 'finances', updated_at = NOW()
WHERE id = '24ac8596-a0b7-4bc8-8e7b-49977309331b';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin']::text[], module_key = 'settings', updated_at = NOW()
WHERE id = '226261c0-ab96-4320-801d-57a5bcf67c50';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'manager']::text[], module_key = 'support', updated_at = NOW()
WHERE id = '682301b1-34a3-4c8f-b860-b4702a3c1aa6';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'manager']::text[], module_key = 'reviews', updated_at = NOW()
WHERE id = '0a65cc62-5ef4-4f15-b9db-5122b8f90740';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'receptionist', 'barber', 'professional']::text[], module_key = 'calendar', updated_at = NOW()
WHERE id = 'e8227c4e-15da-4c36-9dee-a044c4236199';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin']::text[], module_key = 'whatsapp', updated_at = NOW()
WHERE id = '1ce9d357-4170-4be6-a50d-c1115faf1676';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'financial', 'finance']::text[], module_key = 'finances', updated_at = NOW()
WHERE id = 'a9dfe5d0-c280-47f8-a63f-3dc82781730e';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'financial', 'finance']::text[], module_key = 'finances', updated_at = NOW()
WHERE id = 'e1697c6d-c015-4a9a-a183-11ad0837223f';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'manager', 'receptionist']::text[], module_key = 'subscriptions', updated_at = NOW()
WHERE id = '2f8df9f3-4f4c-4d62-891f-a3e05ad2a2b5';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'manager']::text[], module_key = 'support', updated_at = NOW()
WHERE id = '3420adbe-d44d-45b8-a92a-226c29839762';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin']::text[], module_key = 'settings', updated_at = NOW()
WHERE id = '426fb66b-5034-4476-bcf2-11147b2b5637';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin']::text[], module_key = 'services', updated_at = NOW()
WHERE id = 'c7fc4eec-b64c-404d-8acd-450ff06f01e0';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'manager']::text[], module_key = 'loyalty', updated_at = NOW()
WHERE id = 'b99f5dcd-77f5-437b-b708-f874c25b81f2';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'manager', 'receptionist']::text[], module_key = 'products', updated_at = NOW()
WHERE id = 'b3324233-56e8-49b8-a1ed-1e7acb6fc28e';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin']::text[], module_key = 'whatsapp', updated_at = NOW()
WHERE id = 'e2e293be-0df7-4d80-8cf0-b27a7268e33d';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'manager']::text[], module_key = 'loyalty', updated_at = NOW()
WHERE id = '45e0fa0d-c0ec-4eba-9c96-1643efcdbb45';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'manager', 'receptionist']::text[], module_key = 'products', updated_at = NOW()
WHERE id = '4ec9d577-f0e8-4a9e-ae80-82cd5ff124b7';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'manager', 'receptionist']::text[], module_key = 'subscriptions', updated_at = NOW()
WHERE id = '64f5bafc-7abb-44f1-9836-683dca7ce9d9';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'manager', 'receptionist', 'barber']::text[], module_key = 'settings', updated_at = NOW()
WHERE id = '6a493a70-c0fd-4881-8e2a-66fb29f24d9b';

UPDATE public.tutorials
SET profile_target = ARRAY['client', 'customer', 'tenant_admin']::text[], module_key = 'calendar', updated_at = NOW()
WHERE id = '6eef64ad-7c7e-49cf-aef4-028dcb78dc68';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'financial', 'finance']::text[], module_key = 'finances', updated_at = NOW()
WHERE id = '77cb39fc-8eb4-4a22-9308-a3ca18aa2395';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin']::text[], module_key = 'barbers', updated_at = NOW()
WHERE id = 'dbad6386-64ac-4fa9-920f-d5ad1118d6ea';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin']::text[], module_key = 'settings', updated_at = NOW()
WHERE id = 'e13485ca-a742-4ded-9d2b-f5f562e9262d';

UPDATE public.tutorials
SET profile_target = ARRAY['barber', 'professional', 'tenant_admin']::text[], module_key = 'finances', updated_at = NOW()
WHERE id = 'f54cdc13-df05-42c5-894c-3c3b3993f532';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'manager', 'receptionist']::text[], module_key = 'subscriptions', updated_at = NOW()
WHERE id = 'cf8b2ce5-ab17-4801-a114-d6d3976fac5f';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin']::text[], module_key = 'settings', updated_at = NOW()
WHERE id = '8d1aa3cf-1d9a-4bc6-84e8-6b5fda268db2';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'manager']::text[], module_key = 'loyalty', updated_at = NOW()
WHERE id = 'b2242045-e3d5-4f89-9125-5a8cca7e4d32';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'receptionist']::text[], module_key = 'calendar', updated_at = NOW()
WHERE id = 'a10df4f8-3f19-4c0e-b129-1f70608457c6';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'financial', 'finance']::text[], module_key = 'finances', updated_at = NOW()
WHERE id = '00d14c7b-06e1-4203-94aa-8349326e9523';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin']::text[], module_key = 'settings', updated_at = NOW()
WHERE id = 'f8672138-3d17-432d-91d6-14bdd576c334';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'barber', 'professional']::text[], module_key = 'finances', updated_at = NOW()
WHERE id = '25e450b5-ab99-45e8-bf1a-77b8ea121200';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin']::text[], module_key = 'whatsapp', updated_at = NOW()
WHERE id = '628290d8-6193-463c-8058-16b68f84ee13';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'financial']::text[], module_key = 'finances', updated_at = NOW()
WHERE id = '89d0363a-d477-4b84-8cba-54c8af36b6b1';

UPDATE public.tutorials
SET profile_target = ARRAY['receptionist', 'reception', 'tenant_admin', 'admin', 'manager']::text[], module_key = 'calendar', updated_at = NOW()
WHERE id = '1bf403d4-23ec-42db-bc16-2d0ade5372b5';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin']::text[], module_key = 'settings', updated_at = NOW()
WHERE id = '58726102-0ec1-4740-9172-87c6b083ae8e';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'receptionist', 'client']::text[], module_key = 'products', updated_at = NOW()
WHERE id = '09eba6e4-6234-4641-95ce-f3901f655109';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin']::text[], module_key = 'settings', updated_at = NOW()
WHERE id = '3be978de-cd68-4763-8184-e7d6574811d3';

UPDATE public.tutorials
SET profile_target = ARRAY['client', 'customer', 'tenant_admin']::text[], module_key = 'portal', updated_at = NOW()
WHERE id = '7f0f541d-c72c-4aa8-bebb-764a292917b6';

UPDATE public.tutorials
SET profile_target = ARRAY['receptionist', 'reception', 'tenant_admin', 'admin']::text[], module_key = 'calendar', updated_at = NOW()
WHERE id = '9ddeff2f-e151-4d75-b393-d680f4ae9d17';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin']::text[], module_key = 'settings', updated_at = NOW()
WHERE id = '84dc0967-2b34-487c-b61e-c5a9819e96a2';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin']::text[], module_key = 'whatsapp', updated_at = NOW()
WHERE id = '2e2831f1-a060-4fe0-9eec-40a56096ae08';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'financial', 'finance']::text[], module_key = 'finances', updated_at = NOW()
WHERE id = 'e9fb6c24-7f1c-4d74-9838-0b503abcf88b';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin']::text[], module_key = 'whatsapp', updated_at = NOW()
WHERE id = '64032882-67d0-4d3a-ba4d-0ee186d8c175';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'manager']::text[], module_key = 'finances', updated_at = NOW()
WHERE id = 'fd971753-ce48-43a5-8cfb-b4564c97f4df';

UPDATE public.tutorials
SET profile_target = ARRAY['receptionist', 'reception', 'tenant_admin', 'admin']::text[], module_key = 'calendar', updated_at = NOW()
WHERE id = 'c452a442-a0c5-4e8a-b963-7f948eac4f04';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'manager']::text[], module_key = 'loyalty', updated_at = NOW()
WHERE id = 'c46d4879-e831-4f29-9dbc-c6280ff995f8';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'manager', 'receptionist', 'barber']::text[], module_key = 'settings', updated_at = NOW()
WHERE id = 'f1f13775-30d4-4989-99b0-fc94dbad79ff';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'receptionist', 'barber', 'professional']::text[], module_key = 'calendar', updated_at = NOW()
WHERE id = 'c334b3ba-0993-449a-a58e-88fb89f7f3d1';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'receptionist']::text[], module_key = 'calendar', updated_at = NOW()
WHERE id = 'd63482d7-27c9-4dbe-bc79-43dfc194acfe';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin']::text[], module_key = 'settings', updated_at = NOW()
WHERE id = '4ee61ba1-d59e-4d67-8332-a4a74cac5062';

UPDATE public.tutorials
SET profile_target = ARRAY['tenant_admin', 'admin', 'manager', 'receptionist']::text[], module_key = 'finances', updated_at = NOW()
WHERE id = 'd8a7ab64-9080-476f-be29-18829321c61c';

-- ------------------------------------------------------------------------------
-- 2. ATUALIZAÇÃO TEXTUAL DOS 14 CONTEÚDOS COM DISCLAIMER Z-API E ROTAS
-- ------------------------------------------------------------------------------
UPDATE public.tutorials
SET title = 'Como ativar fidelidade tradicional', description = 'Configure meta de atendimentos e recompensa com acompanhamento no portal e aviso via WhatsApp.', long_description = '1. Em Fidelidade, ative o programa tradicional de carimbos/pontos.
2. Defina quantos atendimentos são necessários para gerar a recompensa.
3. Escolha o prêmio: serviço grátis, desconto em reais ou percentual, ou produto da loja.
4. Os pontos são creditados automaticamente a cada atendimento marcado como concluído no sistema.
5. O cliente acompanha seu saldo e progresso diretamente no Portal do Cliente (barbex.shop/{slug}/portal).
6. Se a barbearia possuir integração com WhatsApp (Z-API) ativa, um aviso automático de conclusão de cartão também é disparado no celular do cliente.
7. No momento do pagamento da comanda, a recepção visualiza a recompensa disponível e aplica o benefício.

Nota Comercial: O envio de notificações automáticas por WhatsApp depende de contratação externa de instância Z-API configurada pelo estabelecimento. Sem a integração, todas as consultas permanecem 100% disponíveis via portal.', updated_at = NOW()
WHERE id = 'e16bb3fd-1359-4da2-91cd-cc8a03619e0d';

UPDATE public.tutorials
SET title = 'Como configurar Z-API', description = 'Cadastre instância, token e client token da Z-API para disparos automáticos de WhatsApp.', long_description = '1. Acesse o provedor Z-API (z-api.io), crie sua conta e contrate uma instância dedicada à sua barbearia.
2. No painel da Z-API, copie o Instance ID, Token da Instância e Client-Token de Segurança.
3. No painel Barbex, acesse Configurações → Integrações → WhatsApp.
4. Cole as três credenciais nos campos correspondentes e clique em "Salvar Configurações".
5. Escaneie o QR Code exibido na tela utilizando o aplicativo WhatsApp no aparelho oficial da barbearia.
6. Configure a URL de Webhook fornecida pelo Barbex no painel da Z-API para habilitar o recebimento de respostas e botões interativos.
7. Clique no botão "Testar Conexão" para realizar um disparo de validação.

Aviso Comercial e Operacional: O Barbex não oferece integração nativa ou independente com WhatsApp incluída automaticamente nos planos. A plataforma utiliza a Z-API como provedor parceiro externo compatível, cuja contratação, mensalidade e custos de mensagens são contratados diretamente com a Z-API pelo proprietário. Recomendamos utilizar um chip exclusivo para o estabelecimento.', updated_at = NOW()
WHERE id = '905468c9-b4eb-4554-9493-e072cc92ec0e';

UPDATE public.tutorials
SET title = 'Como funcionam as avaliações pós-atendimento', description = 'Colete feedback e avaliações em estrelas com envio automático e moderação no painel.', long_description = 'O Barbex permite coletar feedback detalhado de satisfação de clientes logo após o corte.

**Como funciona:**
1. Ao concluir o atendimento na agenda (status ''completed''), o sistema agenda a solicitação de feedback.
2. Se a integração com WhatsApp (Z-API) estiver ativa, o cliente recebe uma mensagem automática (geralmente após 15 minutos) contendo um link exclusivo com token seguro.
3. Se não houver WhatsApp configurado, o cliente pode avaliar diretamente ao acessar seu histórico no Portal do Cliente (barbex.shop/{slug}/portal).
4. O cliente avalia de 1 a 5 estrelas, indica se recomenda a barbearia e pode redigir um elogio ou crítica construtiva.
5. Se configurado em Cupons, avaliações 5 estrelas podem conceder um voucher de desconto para o próximo agendamento.
6. Avaliações críticas (abaixo de 3 estrelas) geram alerta no painel gerencial para resolução rápida de insatisfação.

**Onde acompanhar:** Menu **Avaliações** (KPIs de NPS, média por profissional e moderação para exibição na página pública).

Nota: Disparos automáticos por WhatsApp requerem assinatura de instância Z-API mantida pelo estabelecimento.', updated_at = NOW()
WHERE id = '0a65cc62-5ef4-4f15-b9db-5122b8f90740';

UPDATE public.tutorials
SET title = 'Como testar conexão do WhatsApp', description = 'Valide a integração com a Z-API antes de ativar as automações de agendamento.', long_description = '1. No menu Configurações, acesse a aba Integrações → WhatsApp.
2. Certifique-se de que sua instância Z-API está ativa e conectada ao aparelho oficial.
3. Clique no botão "Testar Conexão".
4. O Barbex consultará os servidores da Z-API para checar o status da sessão (Conectado / Desconectado).
5. Insira seu número pessoal com DDD e clique em "Enviar Mensagem de Teste".
6. Se a mensagem não chegar em instantes, verifique:
   • Se o celular da barbearia está com bateria e conectado à internet.
   • Se a mensalidade da instância Z-API está em dia.
   • Se o Instance ID e Token foram colados sem espaços extras.
7. O log de diagnósticos exibirá o código de retorno da Z-API para facilitar o suporte.

Atenção: A ferramenta de teste valida a comunicação com sua instância Z-API externa contratada separadamente.', updated_at = NOW()
WHERE id = '1ce9d357-4170-4be6-a50d-c1115faf1676';

UPDATE public.tutorials
SET title = 'Como funcionam as automações', description = 'Confirmação, lembrete, cancelamento, aniversário e régua de comunicação com clientes.', long_description = '1. No menu Automações, você gerencia as réguas de comunicação do estabelecimento: confirmação de agendamento, lembrete prévio (ex: 2h antes), agradecimento pós-atendimento, cancelamento, reagendamento e aniversário.
2. Cada automação possui um gatilho do ciclo de vida, destinatário definido (cliente ou equipe interna) e modelo de mensagem personalizável.
3. Utilize variáveis dinâmicas seguras como {customer_name}, {barbershop_name}, {service_name}, {date} e {time}.
4. Ative ou desative cada régua individualmente conforme a necessidade operacional da barbearia.
5. O painel de diagnósticos exibe o status de entrega e histórico de eventos processados.
6. O mecanismo antiflood e deduplicação do Barbex impede que mensagens idênticas sejam enviadas em duplicidade.

Esclarecimento Comercial: O disparo de automações via WhatsApp não é nativo nem gratuito, dependendo de provedor externo compatível (Z-API), cuja contratação e custos de plano são de responsabilidade do estabelecimento.', updated_at = NOW()
WHERE id = 'e2e293be-0df7-4d80-8cf0-b27a7268e33d';

UPDATE public.tutorials
SET title = 'Como o cliente agenda pelo site público', description = 'Fluxo completo do cliente no portal web: escolha de serviço, barbeiro, data e confirmação.', long_description = 'Objetivo: Conhecer a experiência de autoatendimento do cliente final ao realizar um agendamento online.

**Fluxo Passo a Passo:**
1. O cliente acessa a página pública da barbearia pelo link oficial: barbex.shop/{slug}.
2. Informa seu número de telefone com DDD (autenticação rápida por SMS ou token sem necessidade de senhas complexas).
3. Seleciona um ou mais serviços desejados e o profissional de sua preferência (ou ''Primeiro Disponível'').
4. O calendário exibe os dias e horários livres calculados em tempo real com base na jornada do profissional.
5. Na tela de confirmação, o cliente visualiza o resumo de valores, tempo total e formas de pagamento aceitas.
6. Ao clicar em ''Confirmar Agendamento'', o horário é reservado imediatamente na agenda da barbearia e uma tela de sucesso com QR Code e detalhes é exibida.
7. Caso o estabelecimento possua integração com Z-API ativa, o cliente também recebe uma mensagem de confirmação instantânea no WhatsApp.

Dica: Assinantes do Clube Barbex têm seus créditos e cortes gratuitos identificados automaticamente no fluxo.', updated_at = NOW()
WHERE id = '6eef64ad-7c7e-49cf-aef4-028dcb78dc68';

UPDATE public.tutorials
SET title = 'Como publicar sua página', description = 'Configure seu link público, personalize a aparência e gere QR Codes para divulgação.', long_description = 'Objetivo: Divulgar seu link público e QR Code para receber agendamentos online 24 horas por dia.

**Passo a passo de publicação:**
1. Acesse o menu **Configurações** → aba **Estabelecimento**.
2. Defina o **Slug** exclusivo da sua barbearia (ex: ''navalha-de-ouro''), que formará a URL: barbex.shop/navalha-de-ouro.
3. Preencha a descrição, endereço, telefone de contato e envie o logotipo em alta resolução.
4. Clique no botão **"Ver Página Pública"** no canto superior do painel para validar a aparência antes de divulgar.
5. Baixe o **QR Code Oficial** gerado pelo sistema para imprimir e exibir em cartões de visita, balcão da recepção e espelhos das bancadas.
6. Adicione o link na bio do Instagram, perfil do Google Meu Negócio e mensagem de saudação do WhatsApp Business.

Observação: A página pública é responsiva e adaptada para celulares, dispensando instalação de aplicativos pelos clientes.', updated_at = NOW()
WHERE id = '8d1aa3cf-1d9a-4bc6-84e8-6b5fda268db2';

UPDATE public.tutorials
SET title = 'Como configurar destinatários internos do WhatsApp', description = 'Receba alertas automáticos de novos agendamentos e cancelamentos no WhatsApp da equipe.', long_description = 'Além de notificar o cliente, o Barbex pode enviar alertas em tempo real para os telefones da sua equipe (gerentes, recepcionistas e barbeiros).

**Como configurar:**
1. Acesse **Configurações** → aba **WhatsApp** → seção **Destinatários Internos**.
2. Clique em **"Adicionar Destinatário"** e informe o nome da pessoa e o telefone com DDD.
3. Selecione quais eventos essa pessoa deve receber (ex: Novo Agendamento, Cancelamento de Última Hora, Check-in de Chegada).
4. Clique em **Salvar**.
5. Realize um disparo de teste para garantir que o número está recebendo alertas normalmente.

**Aviso de Integração:** O envio de mensagens para destinatários internos utiliza a conexão da sua instância Z-API configurada. É necessário que a integração esteja conectada e com plano ativo junto ao provedor.', updated_at = NOW()
WHERE id = '628290d8-6193-463c-8058-16b68f84ee13';

UPDATE public.tutorials
SET title = 'Como funciona a loja pública de produtos', description = 'Venda pomadas, tônicos e produtos direto pelo site da barbearia com pagamento PIX.', long_description = 'A vitrine virtual do Barbex permite vender produtos de cuidados masculinos (pomadas, óleos, tônicos, camisetas) diretamente pelo site da barbearia.

**Fluxo de compra do cliente:**
1. O cliente acessa o site da sua barbearia em barbex.shop/{slug} e clica na seção **Produtos**.
2. Seleciona os itens desejados e visualiza o carrinho de compras.
3. Informa o número de telefone para identificação rápida e registro do pedido.
4. Conclui o pagamento via PIX (QR Code gerado na hora com sua chave) ou opta por pagar na retirada presencial.
5. O pedido é registrado no painel de Produtos e Estoque com status pendente de separação.

**Requisitos operacionais:**
• Cadastre os produtos com preço de venda e saldo em estoque no menu **Produtos**.
• Certifique-se de que o módulo **Loja / Produtos** está habilitado em Configurações de Módulos.
• Se a barbearia possuir Z-API ativa, o cliente recebe o comprovante do pedido no WhatsApp.', updated_at = NOW()
WHERE id = '09eba6e4-6234-4641-95ce-f3901f655109';

UPDATE public.tutorials
SET title = 'Como funciona o portal do cliente e o Clube Barbex', description = 'Área exclusiva para clientes consultarem agendamentos, planos de assinatura e fidelidade.', long_description = 'O Portal do Cliente é a área privativa onde seu cliente gerencia toda a sua experiência com a barbearia sem precisar sobrecarregar a recepção.

**Recursos disponíveis no portal:**
1. Acesso simples e sem senhas em barbex.shop/{slug}/portal informando o número de celular.
2. Visualização do próximo agendamento em destaque com botão de reagendamento ou cancelamento (respeitando a política de antecedência mínima definida pela casa).
3. Linha do tempo ''Sua Jornada'': histórico de visitas anteriores, profissional de preferência e saldo de fidelidade/cashback.
4. Área de Assinantes: carteirinha digital do Clube Barbex, contagem de cortes utilizados no mês e benefícios inclusos.
5. Para clientes sem assinatura, exibe o banner comparativo com as vantagens de se associar ao Clube.
6. Acesso a cupons de desconto disponíveis e botão de gorjeta direta via PIX para o barbeiro.

Nota: Para que o link do portal seja enviado automaticamente após o agendamento via WhatsApp, é necessária a integração ativa com a Z-API.', updated_at = NOW()
WHERE id = '7f0f541d-c72c-4aa8-bebb-764a292917b6';

UPDATE public.tutorials
SET title = 'Como usar fluxos conversacionais e botões inteligentes', description = 'Habilite botões de confirmação, cancelamento e reagendamento nas mensagens de WhatsApp.', long_description = 'O Barbex permite configurar mensagens automáticas contendo botões interativos de ação rápida diretamente na conversa do WhatsApp.

**Como configurar:**
1. Acesse o menu **Automações** e selecione o modelo de mensagem desejado (ex: Confirmação de Agendamento).
2. Na aba **Interações / Botões**, adicione as opções de resposta:
   • Botão 1: "Confirmar Presença" (ação: atualizar status para confirmado).
   • Botão 2: "Reagendar" (ação: enviar link do assistente de reagendamento).
   • Botão 3: "Cancelar Horário" (ação: cancelar agendamento e liberar horário na agenda).
3. Salve o modelo e certifique-se de que o Webhook do Barbex está devidamente preenchido na sua conta da Z-API.
4. Quando o cliente pressiona um botão no WhatsApp, o webhook processa a resposta instantaneamente e atualiza a agenda sem intervenção humana.

Aviso Técnico e Comercial: Os botões interativos dependem do suporte nativo da Z-API e de sua compatibilidade com os aplicativos WhatsApp oficiais. A Z-API é um serviço de terceiros contratado separadamente pela barbearia.', updated_at = NOW()
WHERE id = '2e2831f1-a060-4fe0-9eec-40a56096ae08';

UPDATE public.tutorials
SET title = 'Como usar o Check-in por QR Code', description = 'Confirmação de chegada rápida pelo celular do cliente na entrada da barbearia.', long_description = 'O Check-in por QR Code agiliza o fluxo de recepção, permitindo que o cliente confirme sua presença física no estabelecimento de forma autônoma.

**Passo a passo de configuração:**
1. No menu **Configurações**, abra a aba **Check-in QR**.
2. Baixe o display de mesa ou pôster gerado com o QR Code exclusivo da sua barbearia (rota barbex.shop/{slug}/checkin).
3. Imprima em boa resolução e posicione no balcão de entrada ou recepção.

**Como funciona na prática:**
1. O cliente chega ao estabelecimento e aponta a câmera do celular para o QR Code.
2. Na tela rápida, digita seu número de WhatsApp cadastrado.
3. O sistema localiza o agendamento do cliente para o dia e atualiza o status automaticamente para **"Confirmado / Aguardando"**.
4. O profissional e a recepção visualizam imediatamente o alerta visual na Agenda, sabendo que o cliente já está na sala de espera.

Dica: A recepção também pode efetuar o check-in manualmente a qualquer momento clicando no botão **"Check-in"** na Agenda da Recepção (/reception/agenda).', updated_at = NOW()
WHERE id = '9ddeff2f-e151-4d75-b393-d680f4ae9d17';

UPDATE public.tutorials
SET title = 'Como atender clientes sem agendamento (Walk-in)', description = 'Encaixe clientes avulsos na fila de espera operacional da recepção e agenda.', long_description = 'O fluxo Walk-in foi projetado para encaixar com agilidade clientes que chegam à barbearia sem agendamento prévio, organizando a ordem de chegada na fila de espera.

**Como registrar um atendimento Walk-in:**
1. Na **Agenda Geral** (/calendar) ou na **Recepção** (/reception), clique no botão **"Walk-in"** (ou acesse /reception/waiting-list).
2. Digite o nome do cliente e opcionalmente o WhatsApp (se informado, o histórico anterior é vinculado).
3. Selecione os serviços solicitados.
4. Escolha um profissional específico ou selecione a opção **"Qualquer Barbeiro Disponível"** para alocação inteligente.
5. Clique em **"Adicionar à Fila"**. O atendimento entrará na fila operacional com status ''Aguardando''.
6. Quando a cadeira for liberada, clique no atendimento para iniciar o serviço ou abrir a **Comanda Digital**.
7. Ao término, a conclusão gera o lançamento financeiro e a comissão devida ao barbeiro que executou o corte.

Observações: Atendimentos Walk-in não disparam lembretes prévios. Se houver integração com Z-API ativa, podem receber mensagem de agradecimento ou pesquisa após a conclusão.', updated_at = NOW()
WHERE id = 'c452a442-a0c5-4e8a-b963-7f948eac4f04';

UPDATE public.tutorials
SET title = 'Como reagendar trocando data, horário e profissional', description = 'Assistente de reagendamento com checagem automática de grade, conflitos e intervalos.', long_description = 'O assistente de reagendamento do Barbex permite alterar data, horário e profissional de forma rápida, validando em tempo real os conflitos de grade.

**Passo a passo:**
1. Na **Agenda** ou **Área da Recepção**, localize o agendamento e clique na ação **"Reagendar"**.
2. **Seleção de Profissional:** mantenha o profissional original ou escolha outro membro da equipe habilitado para o serviço.
3. **Seleção de Data:** o calendário destaca apenas os dias em que o barbeiro selecionado possui jornada de trabalho configurada.
4. **Seleção de Horário:** os intervalos livres são recalculados considerando a duração total dos serviços, tempo de intervalo entre atendimentos e eventuais bloqueios manuais.
5. **Revisão e Confirmação:** confira os novos dados na tela de resumo e confirme a alteração.
6. A agenda é atualizada em tempo real para toda a equipe.
7. Se a barbearia mantiver conexão ativa com a Z-API, o cliente recebe uma mensagem automática informando os novos dados do agendamento.

Dica: Clientes também podem reagendar com autonomia através do Portal do Cliente (barbex.shop/{slug}/portal), desde que respeitada a janela de antecedência permitida nas configurações.', updated_at = NOW()
WHERE id = 'c334b3ba-0993-449a-a58e-88fb89f7f3d1';

-- ------------------------------------------------------------------------------
-- 3. POLÍTICAS DE RLS ENDURECIDAS (ROLE-BASED TUTORIAL ACCESS)
-- ------------------------------------------------------------------------------

-- Remover policy pública irrestrita
DROP POLICY IF EXISTS "Everyone can view tutorials" ON public.tutorials;

-- Criar policy com controle estrito por perfil e leitura pública para tutoriais de clientes
CREATE POLICY "Role-based tutorial access" ON public.tutorials
FOR SELECT USING (
  -- Super Admin possui leitura irrestrita
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
  )
  OR
  -- Tutoriais voltados para clientes podem ser lidos publicamente no portal/agendamento
  ('client' = ANY(profile_target) OR 'customer' = ANY(profile_target))
  OR
  -- Usuários autenticados visualizam tutoriais destinados ao seu perfil ou universais
  (
    auth.role() = 'authenticated' AND (
      profile_target IS NULL 
      OR cardinality(profile_target) = 0
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() 
          AND (
            profiles.role = ANY(profile_target) 
            OR profiles.role IN ('admin', 'tenant_admin')
          )
      )
    )
  )
);

COMMIT;
