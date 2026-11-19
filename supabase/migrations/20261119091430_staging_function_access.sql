-- Allinea l'accesso alle funzioni del vecchio staging al backend autenticato.
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_coach(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.coach_manages_client(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_client_data(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_course_session_availability(timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.manage_course_booking(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_coach(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.coach_manages_client(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_client_data(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_course_session_availability(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manage_course_booking(uuid, text) TO authenticated;

-- Le funzioni trigger non sono endpoint RPC dell'applicazione.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.course_day_group(integer) SET search_path = public;

-- Il lookup puo usare le policy SELECT gia presenti sulla tabella padre.
ALTER FUNCTION public.can_manage_volume_table(uuid, uuid) SECURITY INVOKER;
