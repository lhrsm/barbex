-- ==============================================================================
-- BARBEX M2: STRUCTURAL SEED ONLY (PLANOS SAAS E SUBPROCESSADORES LGPD)
-- ZERO DADOS DE PRODUÇÃO / ZERO USUÁRIOS / ZERO CLIENTES / ZERO AGENDAMENTOS
-- ==============================================================================

-- 1. Planos SaaS Padronizados do Barbex
INSERT INTO public.plans (id, name, price, interval, features, is_active, created_at, updated_at)
VALUES 
  ('plan_starter', 'Starter', 49.90, 'month', '["Gestão de Agenda", "Até 3 Barbeiros", "Lembretes WhatsApp"]'::jsonb, true, NOW(), NOW()),
  ('plan_pro', 'Pro', 99.90, 'month', '["Gestão Financeira", "Até 10 Barbeiros", "Controle de Comissões", "CRM"]'::jsonb, true, NOW(), NOW()),
  ('plan_enterprise', 'Enterprise', 199.90, 'month', '["Unidades Ilimitadas", "API Integrada", "Multi-tenant", "Relatórios Customizados"]'::jsonb, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. Subprocessadores Oficiais LGPD
INSERT INTO public.subprocessors (id, name, purpose, location, privacy_url, website_url, is_active, created_at)
VALUES 
  ('sub_supabase', 'Supabase, Inc.', 'Hospedagem de Banco de Dados e Autenticação', 'Estados Unidos (AWS)', 'https://supabase.com/privacy', 'https://supabase.com', true, NOW()),
  ('sub_cloudflare', 'Cloudflare, Inc.', 'Distribuição Global (CDN), Edge e DNS', 'Global', 'https://www.cloudflare.com/privacypolicy/', 'https://www.cloudflare.com', true, NOW()),
  ('sub_stripe', 'Stripe Payments', 'Processamento de Pagamentos e Assinaturas', 'Estados Unidos / Global', 'https://stripe.com/privacy', 'https://stripe.com', true, NOW()),
  ('sub_resend', 'Resend, Inc.', 'Envio de E-mails Transacionais', 'Estados Unidos', 'https://resend.com/privacy', 'https://resend.com', true, NOW()),
  ('sub_zapi', 'Z-API', 'Gateway de Mensageria e WhatsApp', 'Brasil', 'https://z-api.io/politica-de-privacidade', 'https://z-api.io', true, NOW()),
  ('sub_sentry', 'Functional Software (Sentry)', 'Monitoramento de Erros e Telemetria', 'Estados Unidos', 'https://sentry.io/privacy/', 'https://sentry.io', true, NOW())
ON CONFLICT (id) DO NOTHING;
