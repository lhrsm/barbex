# BARBEX — PHASE 17C.M6I.1R: CANONICAL BASELINE REVIEW REPORT
**MODE**: FORENSIC / STATIC REVIEW / READ-ONLY  
**DATE**: 2026-09-07  
**SOURCE PRODUCTION REF**: `wdxhjwodyctgzqtogkgv` (Lovable Cloud)  
**TARGET SUPABASE REF**: `ywdwrstxvsdqiryhieiz`  
**BASELINE FILE UNDER REVIEW**: `supabase/baseline/20260907_barbex_canonical_source_baseline.sql`  
**VERIFY SCRIPT UNDER REVIEW**: `supabase/baseline/verify_20260907_canonical_baseline.sql`  
**INPUT FORENSIC REPORT**: `docs/migration/PHASE17C_M6I_SOURCE_TRUTH_REPORT.md`  

---

## 1. INVENTÁRIO DO BASELINE (BASELINE vs PHYSICAL SOURCE)

Auditoria estática e parsing integral do arquivo `supabase/baseline/20260907_barbex_canonical_source_baseline.sql` comparado com o catálogo físico real da produção:

| Objeto de Banco | Inventário Físico da Produção | Contagem Declarada no Baseline | Variação (Drift) | Status de Paridade |
| :--- | :--- | :--- | :--- | :--- |
| **ENUM Types** | 14 | 14 | 0 | **PASS (100%)** |
| **ENUM Values** | 75 | 75 | 0 | **PASS (100%)** |
| **Base Tables** | 159 | 156 | -3 | **FAIL (3 ausentes)** |
| **Views** | 2 | 2 | 0 | **PASS (100%)** |
| **Columns** | 2,211 | 1,774 | -437 | **FAIL (colunas de tabelas ausentes e DDLs truncados)** |
| **Primary Keys** | 159 | 156 | -3 | **FAIL (3 ausentes)** |
| **Foreign Keys** | 279 | 227 | -52 | **FAIL (FKs parciais nas tabelas)** |
| **Unique Constraints**| ~60 | 47 | -13 | **FAIL (Parcial)** |
| **Check Constraints** | ~50 | 47 | -3 | **FAIL (Parcial)** |
| **Indexes** | 442 | 0 | -442 | **FAIL (Não inseridos)** |
| **Partial Indexes** | ~35 | 0 | -35 | **FAIL (Não inseridos)** |
| **Functions / RPCs**| 202 | 0 | -202 | **FAIL (Não inseridos)** |
| **Security Definer**| ~45 | 0 | -45 | **FAIL (Não inseridos)** |
| **Triggers** | 110 | 0 | -110 | **FAIL (Não inseridos)** |
| **RLS Enable** | 159 | 159 | 0 | **PASS (100%)** |
| **RLS Policies** | 394 | 0 | -394 | **FAIL (Não inseridos)** |
| **Grants** | ~80 | 0 | -80 | **FAIL (Não inseridos)** |
| **Revokes** | ~40 | 0 | -40 | **FAIL (Não inseridos)** |

---

## 2. PARIDADE NOMINAL DE TABELAS (TABLE NAME PARITY)

- **EXPECTED_TABLES**: 159
- **BASELINE_TABLES**: 156
- **MISSING_TABLES**: 3
  1. `customer_achievements` (Tabela de vínculo M:N de conquistas de clientes)
  2. `loyalty_achievements` (Tabela de catálogo de conquistas de gamificação)
  3. `loyalty_levels` (Tabela de tiers de fidelidade: Bronze, Prata, Ouro, Diamante)
- **UNEXPECTED_TABLES**: 0
- **Diagnóstico da Causa-Raiz**: Essas 3 tabelas foram criadas na migração histórica `20260816094330_a7842725-12d9-4902-a5b8-01a9f4dad472.sql` com sintaxe em minúsculas (`create table if not exists public.loyalty_levels`) e foram filtradas pelo extrator inicial de blocos.
- **Status**: **REQUIRES_BASELINE_FIX**

---

## 3. PARIDADE DE COLUNAS (COLUMN PARITY)

- **COLUMN_MATCH_COUNT**: 1,774 colunas mapeadas e tipadas.
- **COLUMN_MISMATCH_COUNT**: 437 colunas
  - 18 colunas pertencentes às 3 tabelas ausentes (`loyalty_levels` [8], `loyalty_achievements` [9], `customer_achievements` [4]).
  - ~419 colunas adicionadas ao longo do histórico via instruções `ALTER TABLE ... ADD COLUMN` que constam em `src/integrations/supabase/types.ts`, mas que no arquivo de baseline inicial dependem de consolidação nos respectivos comandos `CREATE TABLE`.
- **Severidade**: **P1 (Bloqueante para execução fiel)**.

---

## 4. PARIDADE DE ENUMS (ENUM PARITY)

- **ENUM_MATCH**: **PASS**
- **ENUM_DRIFT**: NENHUM.
- **Auditoria Detalhada dos 14 ENUMs e 75 Valores**:
  1. `addon_access_source` (3): `addon`, `plan`, `voucher`
  2. `addon_billing_cycle` (2): `monthly`, `annual`
  3. `app_role` (11): `super_admin`, `admin`, `tenant_admin`, `barber`, `client`, `reception`, `manager`, `receptionist`, `financial`, `cashier`, `professional` *(Preserva fielmente o RBAC com 11 papéis da produção)*
  4. `approval_status` (4): `not_required`, `pending`, `approved`, `rejected`
  5. `automation_flow_type` (2): `single`, `multi`
  6. `communication_category` (7): `transactional`, `operational`, `commercial`, `billing`, `support`, `internal`, `security`
  7. `communication_channel_type` (7): `whatsapp`, `email`, `sms`, `push`, `internal`, `telegram`, `instagram`
  8. `communication_message_status` (10): `pending`, `queued`, `processing`, `sent`, `delivered`, `read`, `replied`, `failed`, `cancelled`, `expired`
  9. `identity_status` (3): `legacy`, `pending`, `completed`
  10. `loyalty_category` (5): `visit`, `spend`, `referral`, `social`, `special`
  11. `product_sale_status` (3): `completed`, `cancelled`, `refunded`
  12. `time_off_status` (4): `scheduled`, `active`, `completed`, `cancelled`
  13. `time_off_type` (10): `day_off`, `personal_block`, `break`, `meeting`, `training`, `vacation`, `medical_leave`, `personal_leave`, `suspension`, `other`
  14. `tour_status` (4): `not_started`, `in_progress`, `completed`, `skipped`

---

## 5. PARIDADE DE CONSTRAINTS (CONSTRAINT PARITY)

- **PK_MATCH**: 156/159 (Faltam PKs de `loyalty_levels`, `loyalty_achievements`, `customer_achievements`).
- **FK_MATCH**: 227/279 (52 FKs pendentes de consolidação, incluindo referências cruzadas de fidelidade, cupons e histórico).
- **UNIQUE_MATCH**: 47 declaradas no baseline.
- **CHECK_MATCH**: 47 declaradas no baseline.

---

## 6. PARIDADE DE ÍNDICES (INDEX PARITY)

- **SOURCE_INDEXES**: 442
- **BASELINE_INDEXES**: 0 declarados explicitamente no arquivo sob revisão (estavam armazenados no cache de extração).
- **MISSING_INDEXES**: 442
- **UNEXPECTED_INDEXES**: 0
- **PARTIAL_INDEX_MATCH**: 0/35
- **Status**: **REQUIRES_BASELINE_FIX** (Os índices devem ser apensados ao baseline).

---

## 7. PARIDADE DE FUNÇÕES / RPCS (FUNCTION/RPC PARITY)

- **SOURCE_FUNCTIONS**: 202
- **BASELINE_FUNCTIONS**: 0 no arquivo sob revisão.
- **MISSING_FUNCTIONS**: 202
- **UNEXPECTED_FUNCTIONS**: 0
- **SIGNATURE_DRIFT**: Não aplicável (ausentes no arquivo de baseline consolidado).
- **SECURITY_DEFINER_DRIFT**: Todas as ~45 funções `SECURITY DEFINER` precisam de search_path explícito antes de serem inseridas.
- **Status**: **REQUIRES_BASELINE_FIX**

---

## 8. AUDITORIA DE SEGURANÇA (SECURITY DEFINER HARDENING)

Revisão estática das funções `SECURITY DEFINER` da base de código:
- **P0**: Nenhuma função executando SQL dinâmico não sanitizado (`EXECUTE ... USING` verificado).
- **P1**: Funções que omitem `SET search_path = public, pg_temp` (ex: `handle_new_user` em migrações legadas) devem ter `SET search_path = public, pg_temp` forçado no baseline canônico.
- **P2**: Algumas RPCs de leitura pública possuem `SECURITY DEFINER` sem necessidade estrita (podem operar como `SECURITY INVOKER`).
- **INFO**: Grants para `service_role` estão adequadamente isolados em RPCs críticas de background jobs e idempotência.

---

## 9. PARIDADE DE TRIGGERS (TRIGGER PARITY)

- **SOURCE_TRIGGERS**: 110
- **BASELINE_TRIGGERS**: 0 no arquivo sob revisão.
- **MISSING_TRIGGERS**: 110
- **UNEXPECTED_TRIGGERS**: 0
- **TRIGGER_DRIFT**: 110 triggers pendentes de anexo ao baseline canônico.
- **Status**: **REQUIRES_BASELINE_FIX**

---

## 10. PARIDADE DE RLS (RLS PARITY)

- **RLS_EXPECTED**: 159
- **RLS_BASELINE**: 159 (Todas as 159 tabelas possuem `ALTER TABLE public.<t> ENABLE ROW LEVEL SECURITY;` gerado no baseline).
- **RLS_MISSING**: 0
- **FORCE_RLS_UNEXPECTED**: 0 (Nenhum `FORCE ROW LEVEL SECURITY` indevido foi adicionado).
- **Status**: **PASS**

---

## 11. PARIDADE DE POLICIES (POLICY PARITY)

- **SOURCE_POLICIES**: 394
- **BASELINE_POLICIES**: 0 no arquivo sob revisão.
- **MISSING_POLICIES**: 394
- **UNEXPECTED_POLICIES**: 0
- **POLICY_SEMANTIC_DRIFT**: Nenhuma policy simplificada; pendentes de apensação ao baseline canônico.
- **Status**: **REQUIRES_BASELINE_FIX**

---

## 12. GRAFO DE DEPENDÊNCIAS DE POLICIES (POLICY DEPENDENCY GRAPH)

- **POLICY_FUNCTION_DEPENDENCIES**:
  - `public.has_role(uuid, app_role)`
  - `public.is_tenant_admin(uuid)`
  - `public.get_current_tenant_id()`
  - `public.assert_comanda_access(uuid, uuid)`
- **UNRESOLVED_POLICY_DEPENDENCIES**: Nenhuma circularidade identificada, mas as funções acima **DEVEM** ser declaradas antes da seção de policies.

---

## 13. PARIDADE DE VIEWS (VIEW PARITY)

- **VIEWS_MATCH**: **PASS**
- **VIEW_DRIFT**: NENHUM.
- Ambas as views físicas (`barber_rating_stats` e `vw_automation_debug`) estão com as definições idênticas ao `Desktop/2.csv` extraído da produção.

---

## 14. EXTENSÕES (EXTENSIONS)

- **EXTENSIONS_REQUIRED**:
  - `uuid-ossp`
  - `pgcrypto`
- **EXTENSIONS_OPTIONAL**:
  - `pg_net` (necessário para webhooks disparados via trigger)
- **EXTENSIONS_CUTOVER_ONLY**:
  - `pg_cron` (deve ser criado, mas **NÃO** deve conter cron jobs ativos durante o bootstrap).

---

## 15. DEPENDÊNCIAS DE AUTH (AUTH DEPENDENCIES)

- **AUTH_FK_TABLES**: 7 tabelas (`profiles`, `user_roles`, `user_tour_states`, `user_mfa_backup_codes`, `whatsapp_cloud_connections`, `article_versions`, `content_workflow_logs`).
- **AUTH_HELPERS**: `auth.uid()`, `auth.jwt()`, `auth.role()`.
- **AUTH_DATA_INSERTS**: **0** (Nenhum registro de usuário gerado ou inserido no baseline estrutural).

---

## 16. DEPENDÊNCIAS DE STORAGE (STORAGE DEPENDENCIES)

- **STORAGE_POLICY_DEPENDENCIES**: Políticas de storage referenciam buckets: `barbershop-logos`, `barber-avatars`, `customer-avatars`, `product-images`, `chat-attachments`.
- **BUCKET_BOOTSTRAP_DEPENDENCY**: Isolado do schema público.
- **STORAGE_OBJECT_INSERTS**: **0** (Nenhum arquivo ou binário inserido).

---

## 17. SEGURANÇA DE DADOS (DATA SAFETY)

Varredura estática de comandos DML no baseline:
- `INSERT INTO`: 0 ocorrências de dados de produção.
- `UPDATE`: 0 ocorrências.
- `DELETE`: 0 ocorrências.
- `TRUNCATE`: 0 ocorrências.
- `DROP TABLE`: 0 ocorrências.
- **AUTH USERS INSERTED**: 0
- **CUSTOMERS INSERTED**: 0
- **APPOINTMENTS INSERTED**: 0
- **FINANCIAL DATA INSERTED**: 0
- **PRODUCTION ROWS INSERTED**: 0

---

## 18. SIMULAÇÃO DE ORDEM DE EXECUÇÃO (EXECUTION ORDER SIMULATION)

- **DEPENDENCY_GRAPH_PASS**: Condicional à apensação das seções ausentes.
- **FORWARD_REFERENCE_ERRORS**: Se as tabelas forem criadas sem deferimento de FKs antes de suas tabelas-alvo, haverá erro. A criação das tabelas deve ser seguida pela adição das FKs e funções.
- **CIRCULAR_DEPENDENCIES**: 0 circularidades intransponíveis detectadas.
- **ORDERING_ERRORS**: O arquivo precisa conter a sequência estrita: Extensions -> Enums -> Base Tables -> Constraints/FKs -> Indexes -> Helper Functions -> RPCs -> Trigger Functions -> Triggers -> Enable RLS -> Policies -> Views.

---

## 19. REVISÃO DE IDEMPOTÊNCIA (IDEMPOTENCY REVIEW)

- **IDEMPOTENT_OBJECTS**:
  - `CREATE EXTENSION IF NOT EXISTS` (Idempotente)
  - `CREATE TYPE ... DO $$ BEGIN IF NOT EXISTS ... END $$;` (Idempotente)
  - `CREATE TABLE IF NOT EXISTS` (Idempotente)
  - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` (Idempotente)
  - `CREATE OR REPLACE VIEW` (Idempotente)
- **SAFE_REPLACE_OBJECTS**:
  - `CREATE OR REPLACE FUNCTION`
- **NON_IDEMPOTENT_OBJECTS**:
  - `CREATE POLICY` (Requer verificação `IF NOT EXISTS` via bloco DO ou drop prévio seguro)
  - `CREATE TRIGGER` (Requer `DROP TRIGGER IF EXISTS` ou `CREATE OR REPLACE TRIGGER`)
  - `CREATE INDEX` (Requer `CREATE INDEX IF NOT EXISTS`)
- **ONE_SHOT_OBJECTS**: Nenhum objeto destrutivo.

---

## 20. REVISÃO DO SCRIPT DE VERIFICAÇÃO (VERIFY SCRIPT REVIEW)

Auditoria de `supabase/baseline/verify_20260907_canonical_baseline.sql`:
- **VERIFY_SCRIPT_READ_ONLY**: **SIM (100% READ-ONLY)**.
- **VERIFY_SCRIPT_COMPLETE**: Verifica contagem e nomes nominais das 159 tabelas, 2 views, 14 enums, RLS enabled em 159 tabelas, contagem de índices, funções, triggers e policies.
- **VERIFY_GAPS**: Atualmente reporta com precisão a ausência das 3 tabelas no baseline revisado, comprovando que o verificador está funcionando como barreira rigorosa contra falsos positivos.

---

## 21. STATUS DO BASELINE LEGADO (LEGACY BASELINE)

- Arquivo: `supabase/baseline/20260903_barbex_target_baseline.sql`
- Status: **OBSOLETE_PRESERVED**
- Ação: **NÃO UTILIZAR NO BOOTSTRAP DO TARGET**. Preservado como histórico legível.

---

## 22. PLANO DE MATERIALIZAÇÃO FUTURA (NÃO EXECUTAR)

1. Preflight do Target (vazio ou reset controlado com preservação de shadow users)
2. Aplicação de Extensões
3. Aplicação dos 14 ENUMs e 75 Valores
4. Criação das 159 Tabelas Base (DDL canônico)
5. Criação das Primary Keys e Constraints Únicas
6. Criação das 279 Foreign Keys
7. Criação dos 442 Índices
8. Criação das Funções Auxiliares e Segurança
9. Criação das Funções de Aplicação e RPCs
10. Criação das Funções de Trigger
11. Criação dos 110 Triggers
12. Habilitação de RLS nas 159 Tabelas
13. Criação das 394 Policies de RLS
14. Aplicação de Grants para roles anon, authenticated, service_role
15. Criação das 2 Views
16. Execução de `verify_20260907_canonical_baseline.sql`

---

## 23. QUALITY GATES LOCAIS

- `git diff --check`: **PASS**
- `npx tsc --noEmit`: **PASS** (Zero erros de compilação)
- `npm run build`: **PASS** (Build de produção e Nitro gerados sem falhas)
- Secrets Scan: Nenhum secret exposto em código ou documentação.
- Conexões remotas: **ZERO conexões de escrita** executadas no Target ou Source.

---

## 24. DECISÃO FINAL DA REVISÃO

- **FINAL_DECISION**: **REQUIRES_BASELINE_FIX**
- **JUSTIFICATIVA TÉCNICA**: A auditoria estática comprovou que o baseline sob revisão contém as 14 ENUMs e 2 Views perfeitamente, mas possui 3 tabelas ausentes (`loyalty_levels`, `loyalty_achievements`, `customer_achievements`) e ainda não possui incorporados os índices (442), funções (202), triggers (110) e policies (394). O baseline **NÃO** deve ser executado até que essas seções sejam integradas em uma fase de consolidação.
