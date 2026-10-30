-- ==============================================================================
-- ROLLBACK SCRIPT: rollback_r2e26e20b10_reception_tutorials.sql
-- FASE: R2E.26E.20B.10 — Rollback da Correção Seletiva de Tutoriais da Recepção
-- MODALIDADE: SCRIPT TRANSACIONAL REVERSÍVEL
-- DESCRIÇÃO:
--   1. Remove o identificador 'reception' exclusivamente dos 9 tutoriais atualizados.
--   2. Restaura o estado exato anterior a fase R2E.26E.20B.10.
--   3. Preserva todos os demais identificadores (receptionist, admin, barber, etc).
--   4. Mantém inalterados os 3 artigos originais que já possuíam 'reception'.
-- ==============================================================================

BEGIN;

UPDATE public.tutorials
SET profile_target = array_remove(profile_target, 'reception'),
    updated_at = NOW()
WHERE id IN (
  'cf240ea1-0dec-4817-8afe-8626c4968e21'::uuid,
  'e8227c4e-15da-4c36-9dee-a044c4236199'::uuid,
  'a10df4f8-3f19-4c0e-b129-1f70608457c6'::uuid,
  'c334b3ba-0993-449a-a58e-88fb89f7f3d1'::uuid,
  '64f5bafc-7abb-44f1-9836-683dca7ce9d9'::uuid,
  'b3324233-56e8-49b8-a1ed-1e7acb6fc28e'::uuid,
  '09eba6e4-6234-4641-95ce-f3901f655109'::uuid,
  '6a493a70-c0fd-4881-8e2a-66fb29f24d9b'::uuid,
  'f1f13775-30d4-4989-99b0-fc94dbad79ff'::uuid
) AND 'reception' = ANY(profile_target);

-- Validação pós-rollback: total com reception deve voltar a ser exatamente 3
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.tutorials
  WHERE 'reception' = ANY(profile_target);

  IF v_count <> 3 THEN
    RAISE EXCEPTION 'Falha no rollback: total de artigos com reception esperado: 3, encontrado: %', v_count;
  END IF;

  RAISE NOTICE 'Rollback R2E.26E.20B.10 concluído com sucesso: total com reception restaurado para 3.';
END $$;

COMMIT;

