-- "Volume & Intensità": tabelle di lavoro del coach, per cliente.
-- Il coach crea le tabelle a mano (es. "Trazioni", "Muscle up", "Dip")
-- e in ognuna aggiunge righe: ogni riga ha, per ogni fascia di intensità
-- (10-30, 40-60, 50-70, 60-80, 90-100, TOT), una data e un testo libero.
-- Le tabelle restano sempre attive sul cliente (non legate a una singola scheda).

CREATE TABLE IF NOT EXISTS public.volume_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.volume_table_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.volume_tables(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'VOLUME sett.',
  -- { "band_10_30": "2026-08-31", ..., "total": "2026-08-31" }
  dates JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- { "band_10_30": "4x3 TRAZ 7.5KG ...", ..., "total": "..." }
  cells JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_volume_tables_client ON public.volume_tables (client_id, position);
CREATE INDEX IF NOT EXISTS idx_volume_table_rows_table ON public.volume_table_rows (table_id, created_at DESC);

ALTER TABLE public.volume_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volume_table_rows ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.volume_tables, public.volume_table_rows TO authenticated;

-- Solo admin e coach assegnato al cliente. Il cliente non vede queste tabelle.
CREATE POLICY "Volume tabelle: admin o coach del cliente può vedere"
  ON public.volume_tables FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.coach_manages_client(auth.uid(), client_id));

CREATE POLICY "Volume tabelle: admin o coach del cliente può inserire"
  ON public.volume_tables FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_admin(auth.uid()) OR public.coach_manages_client(auth.uid(), client_id))
    AND created_by = auth.uid()
  );

CREATE POLICY "Volume tabelle: admin o coach del cliente può aggiornare"
  ON public.volume_tables FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.coach_manages_client(auth.uid(), client_id))
  WITH CHECK (public.is_admin(auth.uid()) OR public.coach_manages_client(auth.uid(), client_id));

CREATE POLICY "Volume tabelle: admin o coach del cliente può eliminare"
  ON public.volume_tables FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.coach_manages_client(auth.uid(), client_id));

-- Le righe ereditano i permessi dalla tabella a cui appartengono.
CREATE OR REPLACE FUNCTION public.can_manage_volume_table(user_uuid UUID, target_table UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT user_uuid = auth.uid() AND EXISTS (
    SELECT 1 FROM public.volume_tables t
    WHERE t.id = target_table
      AND (public.is_admin(user_uuid) OR public.coach_manages_client(user_uuid, t.client_id))
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_manage_volume_table(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_volume_table(UUID, UUID) TO authenticated;

CREATE POLICY "Volume righe: chi gestisce la tabella può vedere"
  ON public.volume_table_rows FOR SELECT TO authenticated
  USING (public.can_manage_volume_table(auth.uid(), table_id));

CREATE POLICY "Volume righe: chi gestisce la tabella può inserire"
  ON public.volume_table_rows FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_volume_table(auth.uid(), table_id) AND created_by = auth.uid());

CREATE POLICY "Volume righe: chi gestisce la tabella può aggiornare"
  ON public.volume_table_rows FOR UPDATE TO authenticated
  USING (public.can_manage_volume_table(auth.uid(), table_id))
  WITH CHECK (public.can_manage_volume_table(auth.uid(), table_id));

CREATE POLICY "Volume righe: chi gestisce la tabella può eliminare"
  ON public.volume_table_rows FOR DELETE TO authenticated
  USING (public.can_manage_volume_table(auth.uid(), table_id));

CREATE TRIGGER volume_tables_updated_at
  BEFORE UPDATE ON public.volume_tables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER volume_table_rows_updated_at
  BEFORE UPDATE ON public.volume_table_rows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
