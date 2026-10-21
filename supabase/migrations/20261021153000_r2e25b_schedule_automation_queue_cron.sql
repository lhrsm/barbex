-- ==============================================================================
-- BARBEX — R2E.25B: AGENDAMENTO DO WORKER DA FILA DE AUTOMAÇÕES VIA PG_CRON
-- ==============================================================================
-- Objetivo: Restabelecer o processamento periódico (a cada 2 minutos) da tabela
-- public.automation_queue para despachar mensagens com atraso configurado, como a
-- avaliação pós-atendimento (15 minutos após conclusão) e lembretes de agendamento.
--
-- Mecanismo: Chamada HTTP autenticada via pg_net para a Edge Function run-automations-cron,
-- utilizando o segredo 'cron_worker_secret' armazenado de forma segura no Supabase Vault.
-- ==============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Desagenda versões anteriores se existirem
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'automation-queue-scheduler-2min') THEN
      PERFORM cron.unschedule('automation-queue-scheduler-2min');
    END IF;

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'run-automations-every-5-minutes') THEN
      PERFORM cron.unschedule('run-automations-every-5-minutes');
    END IF;

    -- Agenda o polling da fila a cada 2 minutos
    PERFORM cron.schedule(
      'automation-queue-scheduler-2min',
      '*/2 * * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://ywdwrstxvsdqiryhieiz.supabase.co/functions/v1/run-automations-cron',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_worker_secret' LIMIT 1)
        ),
        body := '{}'::jsonb
      );
      $cron$
    );
    RAISE NOTICE 'Cron job automation-queue-scheduler-2min agendado com sucesso.';
  ELSE
    RAISE WARNING 'Extensão pg_cron não encontrada no banco de dados.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao agendar automation-queue-scheduler-2min: %', SQLERRM;
END $$;
