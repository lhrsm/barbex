# PRE-PHASE17B ENVIRONMENT INVENTORY

*Nota: Este inventário documenta exclusivamente os NOMES das variáveis e seus papéis funcionais. Nenhum valor de segredo é registrado ou versionado.*

| Variable Name | Required | Runtime | Purpose |
| :--- | :--- | :--- | :--- |
| `VITE_SUPABASE_URL` / `SUPABASE_URL` | Sim | Client / Server | URL de conexão ao cluster Supabase (API REST & Realtime) |
| `VITE_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY` | Sim | Client | Chave anônima pública (respeita RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Server Only | Chave de administração para RPCs e operações privilegiadas |
| `STRIPE_SECRET_KEY` | Sim | Server Only | Processamento de pagamentos de assinaturas e add-ons SaaS |
| `STRIPE_WEBHOOK_SECRET` | Sim | Server Only | Assinatura para validação de webhooks do Stripe |
| `RESEND_API_KEY` | Sim | Server Only | Envio de e-mails transacionais (convites, resets de senha, alertas) |
| `ZAPI_INSTANCE_ID` | Opcional | Server Only | Identificador da instância Z-API para automações WhatsApp |
| `ZAPI_TOKEN` | Opcional | Server Only | Token de autenticação da API de WhatsApp (Z-API) |
| `VITE_APP_URL` | Sim | Client / Server | URL canônica da aplicação Barbex |
