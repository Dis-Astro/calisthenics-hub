-- Tabella per i token di notifica push (FCM) dei dispositivi associati agli utenti
-- NOTA: Migrazione preparata, NON applicata autonomamente al database reale di produzione.

CREATE TABLE IF NOT EXISTS public.user_device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_device_token UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_user_device_tokens_user_id ON public.user_device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_device_tokens_active ON public.user_device_tokens(is_active) WHERE is_active = true;

-- RLS: Ogni utente può visualizzare, registrare e disattivare SOLO i propri token.
ALTER TABLE public.user_device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utenti gestiscono i propri device token"
    ON public.user_device_tokens
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Solo il service_role o funzioni server autorizzate possono leggere tutti i token per inviare notifiche
CREATE POLICY "Service role ha accesso completo ai device token"
    ON public.user_device_tokens
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
