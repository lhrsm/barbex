-- ==============================================================================
-- BARBEX — R2E.26C: RECEPTION REVIEW MODERATION
-- PREPARAÇÃO PARA CUTOVER CONTROLADO (MIGRATION OFICIAL)
-- ==============================================================================

-- 1. RPC SEGURA DE MODERAÇÃO DE AVALIAÇÕES PARA RECEPÇÃO E ADMINISTRAÇÃO
-- Permite que donos, administradores, gerentes e recepcionistas do tenant
-- aprovem, rejeitem, ocultem ou exibam avaliações do seu próprio estabelecimento.
-- Impede categoricamente a modificação de notas (ratings) e do texto original do cliente.
CREATE OR REPLACE FUNCTION public.moderate_appointment_review(
  p_review_id uuid,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user uuid := auth.uid();
  v_review public.appointment_reviews%ROWTYPE;
  v_is_authorized boolean := false;
  v_has_text boolean := false;
  v_now timestamptz := clock_timestamp();
  v_new_status text;
  v_show_frontend boolean;
BEGIN
  -- A. Autenticação estrita exigida
  IF v_auth_user IS NULL THEN
    RAISE EXCEPTION 'unauthenticated: access denied';
  END IF;

  -- B. Localiza a avaliação com lock exclusivo para concorrência segura
  SELECT * INTO v_review
  FROM public.appointment_reviews
  WHERE id = p_review_id
  FOR UPDATE;

  IF v_review.id IS NULL THEN
    RAISE EXCEPTION 'review_not_found: review % does not exist', p_review_id;
  END IF;

  -- C. Validação de Autorização Multi-Tenant
  -- O chamador deve ser:
  --   1. Super Administrador da Plataforma
  --   2. Dono da Barbearia (Tenant Owner)
  --   3. Membro ativo da barbearia com papel autorizado (admin, tenant_admin, manager, receptionist, reception)
  IF public.is_super_admin_user() OR public.is_tenant_owner(v_review.tenant_id) THEN
    v_is_authorized := true;
  ELSIF EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = v_review.tenant_id
      AND tm.user_id = v_auth_user
      AND tm.status = 'active'
      AND tm.role IN ('admin', 'tenant_admin', 'manager', 'receptionist', 'reception')
  ) THEN
    v_is_authorized := true;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'unauthorized: caller is not permitted to moderate reviews for tenant %', v_review.tenant_id;
  END IF;

  -- D. Executa exclusivamente a ação autorizada, sem mutação de ratings ou depoimento do cliente
  v_has_text := (v_review.testimonial_text IS NOT NULL AND length(trim(v_review.testimonial_text)) > 0);

  IF p_action = 'approve' THEN
    v_new_status := 'approved';
    v_show_frontend := v_has_text;

    UPDATE public.appointment_reviews
    SET testimonial_status = 'approved',
        show_on_frontend = v_show_frontend,
        approved_at = v_now,
        approved_by = v_auth_user,
        rejected_at = NULL,
        rejected_by = NULL
    WHERE id = p_review_id;

  ELSIF p_action = 'reject' THEN
    v_new_status := 'rejected';
    v_show_frontend := false;

    UPDATE public.appointment_reviews
    SET testimonial_status = 'rejected',
        show_on_frontend = false,
        rejected_at = v_now,
        rejected_by = v_auth_user
    WHERE id = p_review_id;

  ELSIF p_action = 'hide' THEN
    UPDATE public.appointment_reviews
    SET show_on_frontend = false
    WHERE id = p_review_id;
    v_new_status := v_review.testimonial_status;
    v_show_frontend := false;

  ELSIF p_action = 'show' THEN
    v_show_frontend := v_has_text;
    UPDATE public.appointment_reviews
    SET show_on_frontend = v_show_frontend
    WHERE id = p_review_id;
    v_new_status := v_review.testimonial_status;

  ELSE
    RAISE EXCEPTION 'invalid_action: action % is not supported (allowed: approve, reject, hide, show)', p_action;
  END IF;

  RETURN jsonb_build_object(
    'id', p_review_id,
    'action', p_action,
    'status', v_new_status,
    'show_on_frontend', v_show_frontend,
    'moderated_by', v_auth_user,
    'moderated_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.moderate_appointment_review(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderate_appointment_review(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.moderate_appointment_review(uuid, text) IS 'Operação delimitada de moderação de avaliações para recepção e administração (R2E.26C)';


-- 2. RPC SEGURA DE RESPOSTA A AVALIAÇÕES PARA RECEPÇÃO E ADMINISTRAÇÃO
-- Permite responder ao cliente sem alterar as notas ou comentários originais.
CREATE OR REPLACE FUNCTION public.reply_to_appointment_review(
  p_review_id uuid,
  p_reply text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user uuid := auth.uid();
  v_review public.appointment_reviews%ROWTYPE;
  v_is_authorized boolean := false;
  v_now timestamptz := clock_timestamp();
  v_trimmed_reply text;
BEGIN
  IF v_auth_user IS NULL THEN
    RAISE EXCEPTION 'unauthenticated: access denied';
  END IF;

  v_trimmed_reply := trim(coalesce(p_reply, ''));
  IF length(v_trimmed_reply) = 0 THEN
    RAISE EXCEPTION 'invalid_reply: reply text cannot be empty';
  END IF;

  SELECT * INTO v_review
  FROM public.appointment_reviews
  WHERE id = p_review_id
  FOR UPDATE;

  IF v_review.id IS NULL THEN
    RAISE EXCEPTION 'review_not_found: review % does not exist', p_review_id;
  END IF;

  IF public.is_super_admin_user() OR public.is_tenant_owner(v_review.tenant_id) THEN
    v_is_authorized := true;
  ELSIF EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = v_review.tenant_id
      AND tm.user_id = v_auth_user
      AND tm.status = 'active'
      AND tm.role IN ('admin', 'tenant_admin', 'manager', 'receptionist', 'reception')
  ) THEN
    v_is_authorized := true;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'unauthorized: caller is not permitted to reply to reviews for tenant %', v_review.tenant_id;
  END IF;

  UPDATE public.appointment_reviews
  SET reply = v_trimmed_reply,
      reply_at = v_now,
      reply_by = v_auth_user
  WHERE id = p_review_id;

  RETURN jsonb_build_object(
    'id', p_review_id,
    'reply', v_trimmed_reply,
    'reply_by', v_auth_user,
    'reply_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reply_to_appointment_review(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reply_to_appointment_review(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.reply_to_appointment_review(uuid, text) IS 'Resposta oficial a avaliações por colaboradores autorizados do tenant (R2E.26C)';
