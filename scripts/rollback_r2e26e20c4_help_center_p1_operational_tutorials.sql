-- ==============================================================================
-- BARBEX — R2E.26E.20C.4: SCRIPT DE ROLLBACK DA EXPANSÃO P1
-- ==============================================================================
-- Descrição: Remove exclusivamente os 7 tutoriais operacionais da fase R2E.26E.20C.4
-- Idempotente e estritamente restrito aos 7 novos UUIDs criados.
-- Preserva integralmente os 58 artigos originais pré-existentes.
-- ==============================================================================

BEGIN;

-- 1. Remoção restrita aos 7 UUIDs criados na R2E.26E.20C.4
DELETE FROM public.tutorials
WHERE id IN (
  'e59a721d-9e0c-4c48-8df1-3f628ab29001', -- T01: Como cadastrar clientes no balcão
  'e59a721d-9e0c-4c48-8df1-3f628ab29002', -- T02: Como validar carteirinha e QR Code de assinantes
  'e59a721d-9e0c-4c48-8df1-3f628ab29003', -- T03: Como convidar usuários e configurar permissões
  'e59a721d-9e0c-4c48-8df1-3f628ab29004', -- T04: Como utilizar o Centro de Comando e os indicadores operacionais
  'e59a721d-9e0c-4c48-8df1-3f628ab29005', -- T05: Como bloquear horários e solicitar folgas
  'e59a721d-9e0c-4c48-8df1-3f628ab29006', -- T06: Como funciona o agendamento em grupo
  'e59a721d-9e0c-4c48-8df1-3f628ab29007'  -- T07: Como configurar o portfólio e a página pública profissional
);

-- 2. Remoção do registro em schema_migrations (caso tenha sido registrado)
DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20261030130000';

COMMIT;

