-- ==============================================================================
-- BARBEX — PHASE 17C.M6F: Z-API IDEMPOTENCY & EVENT CLAIMING
-- ==============================================================================
-- Creates table public.zapi_processed_events and atomic claim RPC claim_zapi_event
-- Purely additive; zero drops, zero Auth mutations, zero PII, zero secrets.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.zapi_processed_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL,
    tenant_id UUID REFERENCES public.barbershops(id) ON DELETE CASCADE,
    instance_id TEXT,
    event_type TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'zapi',
    status TEXT NOT NULL DEFAULT 'processed',
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_zapi_processed_events_event_id UNIQUE (event_id)
);

-- Index for tenant lookups
CREATE INDEX IF NOT EXISTS idx_zapi_processed_events_tenant_id ON public.zapi_processed_events (tenant_id);
CREATE INDEX IF NOT EXISTS idx_zapi_processed_events_event_id ON public.zapi_processed_events (event_id);

-- Enable RLS
ALTER TABLE public.zapi_processed_events ENABLE ROW LEVEL SECURITY;

-- Revoke public access
REVOKE ALL ON public.zapi_processed_events FROM PUBLIC;
REVOKE ALL ON public.zapi_processed_events FROM anon;
REVOKE ALL ON public.zapi_processed_events FROM authenticated;
GRANT ALL ON public.zapi_processed_events TO service_role;

-- ==============================================================================
-- RPC: claim_zapi_event
-- Atomic idempotency claim for incoming Z-API callbacks
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.claim_zapi_event(
    p_event_id TEXT,
    p_event_type TEXT,
    p_tenant_id UUID DEFAULT NULL,
    p_instance_id TEXT DEFAULT NULL,
    p_source TEXT DEFAULT 'zapi'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_inserted_id UUID;
BEGIN
    IF p_event_id IS NULL OR length(trim(p_event_id)) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_EVENT_ID');
    END IF;

    -- Attempt atomic insert
    INSERT INTO public.zapi_processed_events (
        event_id,
        event_type,
        tenant_id,
        instance_id,
        source,
        status,
        processed_at
    )
    VALUES (
        trim(p_event_id),
        coalesce(trim(p_event_type), 'unknown'),
        p_tenant_id,
        p_instance_id,
        coalesce(trim(p_source), 'zapi'),
        'processed',
        now()
    )
    ON CONFLICT (event_id) DO NOTHING
    RETURNING id INTO v_inserted_id;

    IF v_inserted_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'claimed', true,
            'id', v_inserted_id,
            'event_id', trim(p_event_id)
        );
    ELSE
        RETURN jsonb_build_object(
            'success', true,
            'claimed', false,
            'already_processed', true,
            'event_id', trim(p_event_id)
        );
    END IF;
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- Secure RPC privileges
REVOKE ALL ON FUNCTION public.claim_zapi_event(TEXT, TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_zapi_event(TEXT, TEXT, UUID, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.claim_zapi_event(TEXT, TEXT, UUID, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_zapi_event(TEXT, TEXT, UUID, TEXT, TEXT) TO service_role;
