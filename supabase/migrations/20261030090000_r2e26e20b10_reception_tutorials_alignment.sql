-- ==============================================================================
-- MIGRATION: 20261030090000_r2e26e20b10_reception_tutorials_alignment.sql
-- FASE: R2E.26E.20B.10 — Correção Seletiva de Tutoriais da Recepção
-- MODALIDADE: PREPARAÇÃO LOCAL / SEM EXECUÇÃO EM PRODUÇÃO
-- DESCRIÇÃO:
--   1. Anexa seletivamente o identificador 'reception' ao profile_target
--      exclusivamente para os 9 tutoriais operacionais homologados na R2E.26E.20B.9.
--   2. Preserva integralmente todos os perfis existentes nos arrays.
--   3. Mantém inalterados títulos, conteúdos, categorias, ordens e status.
--   4. Mantém estritamente protegidos os 7 artigos gerenciais/fiscais.
--   5. Executa asserções rigorosas de pré e pós-condição (fail-closed).
-- ==============================================================================

BEGIN;

DO $$
DECLARE
  v_pre_count integer;
  v_already_reception integer;
  v_updated_count integer;
  v_post_reception_count integer;
  v_post_client_count integer;
  v_target_ids uuid[] := ARRAY[
    'cf240ea1-0dec-4817-8afe-8626c4968e21'::uuid, -- Como criar um novo agendamento
    'e8227c4e-15da-4c36-9dee-a044c4236199'::uuid, -- Como concluir ou cancelar um atendimento
    'a10df4f8-3f19-4c0e-b129-1f70608457c6'::uuid, -- Como funciona o agendamento de assinantes
    'c334b3ba-0993-449a-a58e-88fb89f7f3d1'::uuid, -- Como reagendar trocando data, horário e profissional
    '64f5bafc-7abb-44f1-9836-683dca7ce9d9'::uuid, -- Como funcionam usos de assinatura
    'b3324233-56e8-49b8-a1ed-1e7acb6fc28e'::uuid, -- Como vender produtos no frontend
    '09eba6e4-6234-4641-95ce-f3901f655109'::uuid, -- Como funciona a loja pública de produtos
    '6a493a70-c0fd-4881-8e2a-66fb29f24d9b'::uuid, -- Como acessar tutoriais e ajuda
    'f1f13775-30d4-4989-99b0-fc94dbad79ff'::uuid  -- Como enviar sugestões de melhoria para o Barbex
  ];
BEGIN
  -- ----------------------------------------------------------------------------
  -- 1. ASSERÇÕES DE PRÉ-CONDIÇÃO
  -- ----------------------------------------------------------------------------
  -- Verificar existência dos 9 artigos
  SELECT count(*) INTO v_pre_count
  FROM public.tutorials
  WHERE id = ANY(v_target_ids);

  IF v_pre_count <> 9 THEN
    RAISE EXCEPTION 'Falha de pré-condição: esperados 9 artigos, encontrados %', v_pre_count;
  END IF;

  -- ----------------------------------------------------------------------------
  -- 2. ATUALIZAÇÃO CIRÚRGICA E IDEMPOTENTE
  -- ----------------------------------------------------------------------------
  -- Acrescenta 'reception' somente quando ausente, preservando todos os demais perfis
  UPDATE public.tutorials
  SET profile_target = array_append(profile_target, 'reception'),
      updated_at = NOW()
  WHERE id = ANY(v_target_ids)
    AND NOT ('reception' = ANY(profile_target));

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- ----------------------------------------------------------------------------
  -- 3. ASSERÇÕES DE PÓS-CONDIÇÃO
  -- ----------------------------------------------------------------------------
  -- Total de artigos com 'reception' deve ser exatamente 12 (3 preexistentes + 9 homologados)
  SELECT count(*) INTO v_post_reception_count
  FROM public.tutorials
  WHERE 'reception' = ANY(profile_target);

  IF v_post_reception_count <> 12 THEN
    RAISE EXCEPTION 'Falha de pós-condição: total de artigos com reception esperado: 12, obtido: %', v_post_reception_count;
  END IF;

  -- Total de artigos com visibilidade para cliente deve permanecer exatamente 3
  SELECT count(*) INTO v_post_client_count
  FROM public.tutorials
  WHERE ('client' = ANY(profile_target) OR 'customer' = ANY(profile_target));

  IF v_post_client_count <> 3 THEN
    RAISE EXCEPTION 'Falha de pós-condição: total de artigos públicos de cliente alterado! Esperado: 3, obtido: %', v_post_client_count;
  END IF;

  -- Verificar que artigos gerenciais NÃO receberam 'reception'
  IF EXISTS (
    SELECT 1 FROM public.tutorials
    WHERE id IN (
      'd63482d7-27c9-4dbe-bc79-43dfc194acfe'::uuid, -- Intervalos
      'a3ba57c9-60a7-4c2d-8a5a-544dde3c0451'::uuid, -- Criar planos
      '2f8df9f3-4f4c-4d62-891f-a3e05ad2a2b5'::uuid, -- Vender assinatura
      'cf8b2ce5-ab17-4801-a114-d6d3976fac5f'::uuid, -- Mudar plano
      'd8a7ab64-9080-476f-be29-18829321c61c'::uuid, -- Cupons
      '60a1afbb-4cdf-4dcb-a9a4-ea95dc134b73'::uuid, -- Cadastrar produtos
      '4ec9d577-f0e8-4a9e-ae80-82cd5ff124b7'::uuid  -- Controlar estoque
    ) AND 'reception' = ANY(profile_target)
  ) THEN
    RAISE EXCEPTION 'Falha de segurança: artigos gerenciais restritos foram violados!';
  END IF;

  RAISE NOTICE 'Migration R2E.26E.20B.10 validada com sucesso: % artigos atualizados.', v_updated_count;
END $$;

COMMIT;

