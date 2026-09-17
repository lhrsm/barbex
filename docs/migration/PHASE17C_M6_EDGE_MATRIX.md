# BARBEX — PHASE 17C.M6 EDGE FUNCTION MATRIX
## MATRIZ DE FUNÇÕES SUPABASE EDGE, MODELO DE AUTENTICAÇÃO, CORS & SEGURANÇA

Este documento define a arquitetura canônica das Supabase Edge Functions que substituirão integralmente o backend Nitro/Lovable.

---

### 1. Estrutura de Diretórios Canônica

```text
supabase/functions/
  _shared/
    cors.ts              # Configuração segura de cabeçalhos CORS por origem
    auth.ts              # Validação de JWT, extração de user_id e tenant_id
    supabase-admin.ts    # Instanciação isolada do cliente service_role
    rate-limit.ts        # Rate limiting atômico baseado em PostgreSQL (Sliding Window)
    errors.ts            # Tratamento centralizado e sanitização de DTOs de erro
    validation.ts        # Validação com Zod e normalização de telefones (E.164)
  
  auth-phone/            # Login via telefone para Barbeiros e Clientes
  auth-phone-reset/      # Solicitação e validação de reset de senha por telefone
  team-invitations/      # Criação, reenvio e aceite de convites de equipe
  staff-auth/            # Validação de email e finalização de credenciais de staff
  stripe-checkout/       # Geração de sessões de checkout Stripe
  stripe-addons/         # Gestão de addons, upgrades e cancelamento de assinaturas
  stripe-webhook/        # Processamento idempotente de webhooks do Stripe
  zapi-webhook/          # Recepção de webhooks do Z-API e atualização de mensagens
  zapi-send/             # Disparo de mensagens WhatsApp transacionais
  send-email/            # Disparo de e-mails transacionais via Resend
  send-push/             # Disparo de Web Push Notifications (VAPID)
  cron-worker/           # Processamento assíncrono de jobs em segundo plano
```

---

### 2. Matriz de Endpoints e Políticas de Segurança

| Edge Function | Método | Modelo de Autenticação | CORS Policy | Validação Adicional | Secrets Exigidos |
|---|---|---|---|---|---|
| `auth-phone` | POST | **PUBLIC** | Restrito (`app.barbex.shop`, `localhost`) | Rate limit (5 req/min por IP/Telefone) | `SUPABASE_SERVICE_ROLE_KEY` |
| `auth-phone-reset` | POST | **PUBLIC** | Restrito (`app.barbex.shop`, `localhost`) | Rate limit + Anti-enumeração | `SUPABASE_SERVICE_ROLE_KEY` |
| `team-invitations` | POST | **JWT AUTHENTICATED** | Restrito | Tenant Admin / Super Admin Role | `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` |
| `staff-auth` | POST | **PUBLIC / JWT** | Restrito | Token de Desafio Válido | `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` |
| `stripe-checkout` | POST | **JWT AUTHENTICATED** | Restrito | Tenant Admin Role | `STRIPE_SECRET_KEY` |
| `stripe-addons` | POST | **JWT AUTHENTICATED** | Restrito | Tenant Admin Role | `STRIPE_SECRET_KEY` |
| `stripe-webhook` | POST | **WEBHOOK SIGNATURE** | Nenhum (No CORS) | Assinatura HMAC-SHA256 (`Stripe-Signature`) | `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` |
| `zapi-webhook` | POST | **WEBHOOK CLIENT-TOKEN**| Nenhum (No CORS) | Validação de `Client-Token` + Tenant Match | `ZAPI_CLIENT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` |
| `zapi-send` | POST | **JWT / SERVICE** | Restrito | Permissão de Envio / Tenant Match | `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN` |
| `send-email` | POST | **JWT / SERVICE** | Restrito | Validação de Remetente Autorizado | `RESEND_API_KEY` |
| `send-push` | POST | **JWT / SERVICE** | Restrito | Validação de Assinatura VAPID | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` |
| `cron-worker` | POST | **SERVICE-TO-SERVICE** | Nenhum (No CORS) | Bearer Internal Worker Secret | `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` |

---

### 3. Modelo de Rate Limiting e Sanitização de Erros

#### Rate Limiting Distribuído (Sem perda por Cold Start)
- Implementado via RPC PostgreSQL atômica (`public.check_rate_limit(p_key, p_max_requests, p_window_seconds)`).
- Chave de limite: Hash SHA-256 de IP + Telefone / Endpoint.
- Zero armazenamento de PII nas tabelas temporárias de rate limit.
- Limpeza automática de registros expirados a cada ciclo.

#### Contrato de Resposta e Tratamento de Erros
- Todas as funções retornam DTOs estritamente tipados e sanitizados:
  - Sucesso: `{ success: true, data: T }`
  - Erro: `{ success: false, error: string, code: string }`
- **Proibido retornar:** Stack traces, erros internos de SQLSTATE, objetos internos do Stripe, tokens decodificados ou emails resolvidos no payload de erro.
