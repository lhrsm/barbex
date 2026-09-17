# BARBEX — PHASE 17C M2 BASELINE MANIFEST

## METADATA
- **Data:** 2026-09-03
- **Target Project:** `ywdwrstxvsdqiryhieiz` (`https://ywdwrstxvsdqiryhieiz.supabase.co`)
- **Baseline File:** [`supabase/baseline/20260903_barbex_target_baseline.sql`](file:///c:/Antigravity/Barbex/barbex/supabase/baseline/20260903_barbex_target_baseline.sql)
- **SHA-256 Checksum:** `1a2f7ec728d1fbef220ded814ea1040317752c7c91873569b8440992912d1810`

## INVENTÁRIO DO SCHEMA
- **Extensões:** `uuid-ossp`, `pgcrypto`, `pg_net`, `pg_cron`
- **Tabelas Canônicas Mapeadas:** 38 tabelas estruturais
- **RLS Habilitado:** 100% das tabelas protegidas
- **Funções Críticas:** `is_super_admin`, `has_role`, `claim_next_background_job`, `reconcile_stuck_background_jobs`, `get_scalability_aggregates`, `tg_admin_notify_new_tenant`
- **Phase 17C.2B Incorporada:** Sim (Locked fields, partial index, atomic claim, reconciler)
- **Crons Ativos Inicialmente:** 0 (Agendamento reservado para pós-cutover)
- **Realtime:** Publicação configurada em `appointments` e `notifications`

## CRITÉRIOS DE IMPORTAÇÃO E SEGURANÇA
- **Zero Vazamento de URLs Antigas:** Nenhuma URL hardcoded para `wdx...` ou Lovable.
- **Isolamento de DML:** O baseline contém exclusivamente DDL estrutural. Dados de seed estão isolados em [`supabase/baseline/20260903_barbex_structural_seed.sql`](file:///c:/Antigravity/Barbex/barbex/supabase/baseline/20260903_barbex_structural_seed.sql).
