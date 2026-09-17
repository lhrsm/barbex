# BARBEX — PHASE 17C.M6B SHARED EDGE FOUNDATION
## ARQUITETURA, PADRÕES DE SEGURANÇA E MÓDULOS COMPARTILHADOS

Este documento formaliza a arquitetura da fundação compartilhada criada em `supabase/functions/_shared/` para suportar todas as futuras Supabase Edge Functions da migração.

---

### 1. Módulos Compartilhados Criados

| Módulo | Arquivo | Finalidade Principal |
|---|---|---|
| **Types & DTOs** | `supabase/functions/_shared/types.ts` | Definição de contratos padronizados (`EdgeSuccess<T>`, `EdgeFailure`, `ErrorCode`, `UserContext`) |
| **CORS Handler** | `supabase/functions/_shared/cors.ts` | Controle estrito de origens permitidas (`barbex.shop`, `localhost`), suporte a `OPTIONS` e bloqueio de origens arbitrárias |
| **Crypto & Utilities** | `supabase/functions/_shared/crypto.ts` | Geração nativa Deno Web Crypto de hashes SHA-256, UUIDs de rastreamento (`requestId`) e telemetria de latência |
| **Safe Error Handling** | `supabase/functions/_shared/errors.ts` | Sanitização defensiva de erros, mapeamento de códigos SQLSTATE (`23505` -> `CONFLICT`, `42501` -> `FORBIDDEN`, etc.) sem vazamento de detalhes internos |
| **Standard Response** | `supabase/functions/_shared/response.ts` | Construtores de `Response` HTTP com injeção automática de `x-request-id`, cabeçalhos `no-store` e CORS |
| **Safe Logging** | `supabase/functions/_shared/logging.ts` | Logger estruturado em JSON com redator defensivo recursivo de PII e segredos (senhas, emails, telefones, JWTs, tokens de API) |
| **Safe Environment** | `supabase/functions/_shared/env.ts` | Recuperação estrita de variáveis com falha segura (`503 Service Unavailable`) sem expor nomes/valores em respostas públicas |
| **Phone Normalization** | `supabase/functions/_shared/phone.ts` | Normalizador E.164 canônico brasileiro com 100% de paridade com `src/utils/phone.ts` |
| **Request Validation** | `supabase/functions/_shared/validation.ts` | Validação de métodos HTTP permitidos (`requireMethod`) e parser seguro de payload JSON com proteção contra DoS por tamanho |
| **Supabase Admin** | `supabase/functions/_shared/supabase-admin.ts` | Instanciação de cliente com privilégios `service_role` restrito ao escopo interno do Edge |
| **Auth & Session** | `supabase/functions/_shared/auth.ts` | Extração de Bearer tokens, validação de JWT GoTrue, cliente com escopo do usuário (RLS) e resolução de tenant |
| **Rate Limiting** | `supabase/functions/_shared/rate-limit.ts` | Gerador de chaves de rate limit criptograficamente opacas (SHA-256) preparado para a RPC atômica `check_rate_limit` |

---

### 2. Padrões de Segurança Estabelecidos

1. **CORS Fechado por Padrão:**
   - Origens permitidas: `https://barbex.shop`, `https://www.barbex.shop`, `https://preview.barbex.shop`, `http://localhost:5173`, `http://localhost:3000`.
   - Nenhuma função sensível utiliza `Access-Control-Allow-Origin: *`.
2. **Redação Automática de Logs:**
   - Campos como `password`, `email`, `phone`, `authorization`, `token`, `service_role_key`, `stripe_secret`, `zapi_token` são substituídos por `[REDACTED]`.
   - Valores avulsos em string contendo padrões de email, telefone ou tokens Bearer são mascarados.
3. **Respostas Sanitizadas:**
   - Erros de banco nunca expõem nomes de tabelas, nomes de constraints, IPs de servidores ou stack traces.
4. **Rate Limiting com Privacidade de Dados:**
   - Chaves de limitação usam hashes SHA-256 do identificador: `rl:auth:staff:<sha256(phone)>` ou `rl:auth:customer:<sha256(tenant)>:<sha256(phone)>`. Zero PII armazenada em claro.

---

### 3. Resultados dos Testes de Fundação (`scratch/test_edge_shared_foundation.mjs`)

- **Paridade de Telefone:** 24/24 casos de teste idênticos a `src/utils/phone.ts` (PASS)
- **Validação de CORS:** 6/6 testes de allowlist e bloqueio de domínios maliciosos (PASS)
- **Redação de Logs:** 11/11 testes de mascaramento de chaves e strings sensíveis (PASS)
- **Sanitização de Erros:** 8/8 testes de mapeamento seguro de SQLSTATE e exceptions genéricas (PASS)
- **Total:** **49 Testes Executados — 49 PASSED, 0 FAILED**

---

### 4. Estado Remoto & Produção

- **Target Edge Functions implantadas:** 0 (Nenhum deploy remoto nesta fase)
- **Banco Target alterado:** 0 (Zero escritas ou DDL aplicados)
- **Banco Source alterado:** 0 (Estritamente read-only)
- **Produção:** `barbex.shop` permanece 100% inalterada e operacional
