# BARBEX — PHASE 17C.M6 SECRET & ENVIRONMENT INVENTORY
## SEPARAÇÃO ESTREITA ENTRE VARIÁVEIS PÚBLICAS DO FRONTEND E SECRETS DE EDGE

Este documento categoriza todas as variáveis de ambiente utilizadas no Barbex, estabelecendo a segregação estrita entre o cliente web (Cloudflare) e o backend serverless privilegiado (Supabase Edge).

---

### 1. Variáveis Públicas do Frontend (Cloudflare Web Client)

Estas variáveis são embutidas no build do cliente ou expostas no runtime de entrega estática/SSR. Não possuem privilégios administrativos.

| Variável | Finalidade | Escopo | Requer Proteção contra Exposição |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Endpoint da API Supabase Target | Frontend / Browser | Pública (Acesso via RLS) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave anônima / publicável | Frontend / Browser | Pública (Acesso via RLS) |
| `VITE_APP_URL` | URL canônica do app (`https://barbex.shop`) | Frontend / Browser | Pública |

---

### 2. Secrets do Backend Privilegiado (Supabase Edge Functions Vault)

Estas variáveis residem exclusivamente no cofre criptografado do Supabase e são injetadas sob demanda durante a execução das Edge Functions.

| Nome do Secret | Categoria | Fornecido Automaticamente | Utilizado por |
|---|---|---|---|
| `SUPABASE_URL` | Infraestrutura | SIM | Todas as Edge Functions |
| `SUPABASE_ANON_KEY` | Infraestrutura | SIM | Funções com contexto do usuário |
| `SUPABASE_SERVICE_ROLE_KEY` | Infraestrutura | SIM | `auth-phone`, `team-invitations`, Webhooks |
| `STRIPE_SECRET_KEY` | Integração Pagamentos | NÃO (Custom) | `stripe-checkout`, `stripe-addons` |
| `STRIPE_WEBHOOK_SECRET` | Integração Pagamentos | NÃO (Custom) | `stripe-webhook` |
| `RESEND_API_KEY` | Integração E-mail | NÃO (Custom) | `send-email`, `team-invitations` |
| `RESEND_WEBHOOK_SECRET` | Integração E-mail | NÃO (Custom) | `resend-webhook` |
| `ZAPI_INSTANCE_ID` | Integração WhatsApp | NÃO (Custom) | `zapi-send` |
| `ZAPI_TOKEN` | Integração WhatsApp | NÃO (Custom) | `zapi-send` |
| `ZAPI_CLIENT_TOKEN` | Integração WhatsApp | NÃO (Custom) | `zapi-webhook` |
| `VAPID_PUBLIC_KEY` | Web Push | NÃO (Custom) | `send-push` |
| `VAPID_PRIVATE_KEY` | Web Push | NÃO (Custom) | `send-push` |
| `CRON_SECRET` | Automação Interna | NÃO (Custom) | `cron-worker` |

---

### 3. Remoção de Secrets do Deploy Web (Cloudflare Runtime)

Após a conclusão das ondas de migração M6:

- `SUPABASE_SERVICE_ROLE_KEY`: **ELIMINADA DO DEPLOY WEB (0 Ocorrências)**
- `STRIPE_SECRET_KEY`: **ELIMINADA DO DEPLOY WEB**
- `STRIPE_WEBHOOK_SECRET`: **ELIMINADA DO DEPLOY WEB**
- `RESEND_API_KEY`: **ELIMINADA DO DEPLOY WEB**
- `ZAPI_TOKEN`: **ELIMINADA DO DEPLOY WEB**

O build do Cloudflare passará a ser 100% puro de frontend e CDN, eliminando qualquer vetor de vazamento de credenciais administrativas.
