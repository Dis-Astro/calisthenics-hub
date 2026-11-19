-- Ripristina le autorizzazioni delle tabelle originali senza toccare le tabelle nuove dell’app.
CREATE OR REPLACE FUNCTION public.can_manage_billing(user_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = user_uuid AND role IN ('admin', 'segretaria')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_client_data(viewer_uuid uuid, client_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT
        viewer_uuid = client_uuid -- è il proprio dato
        OR public.is_admin(viewer_uuid) -- è admin
        OR public.coach_manages_client(viewer_uuid, client_uuid); -- è il suo coach
$$;

CREATE OR REPLACE FUNCTION public.coach_manages_client(coach_uuid uuid, client_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.coach_assignments
        WHERE coach_id = coach_uuid AND client_id = client_uuid
    );
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid uuid) RETURNS public.user_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT role FROM public.profiles WHERE user_id = user_uuid LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin(user_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = user_uuid AND role = 'admin'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_coach(user_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = user_uuid AND role = 'coach'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_segretaria(user_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = user_uuid AND role = 'segretaria'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff(user_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = user_uuid AND role IN ('admin', 'coach')
    );
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_manage_billing(user_uuid uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_billing(user_uuid uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.can_view_client_data(viewer_uuid uuid, client_uuid uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_client_data(viewer_uuid uuid, client_uuid uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.coach_manages_client(coach_uuid uuid, client_uuid uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_manages_client(coach_uuid uuid, client_uuid uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(user_uuid uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role(user_uuid uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin(user_uuid uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(user_uuid uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_coach(user_uuid uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_coach(user_uuid uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_segretaria(user_uuid uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_segretaria(user_uuid uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_staff(user_uuid uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(user_uuid uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon;


DROP POLICY IF EXISTS "Appointments: coach proprietario può eliminare" ON public."appointments";
DROP POLICY IF EXISTS "Appointments: coach proprietario può modificare" ON public."appointments";
DROP POLICY IF EXISTS "Appointments: coach/admin può creare" ON public."appointments";
DROP POLICY IF EXISTS "Appointments: nega accesso anonimo" ON public."appointments";
DROP POLICY IF EXISTS "Appointments: solo utenti autenticati possono vedere propri" ON public."appointments";
DROP POLICY IF EXISTS "Documents: proprietario o admin può eliminare" ON public."client_documents";
DROP POLICY IF EXISTS "Documents: staff può inserire" ON public."client_documents";
DROP POLICY IF EXISTS "Documents: visualizza propri o gestiti" ON public."client_documents";
DROP POLICY IF EXISTS "Notes: proprietario può gestire" ON public."client_notes";
DROP POLICY IF EXISTS "Notes: solo proprietario può vedere" ON public."client_notes";
DROP POLICY IF EXISTS "Assignments: solo admin può gestire" ON public."coach_assignments";
DROP POLICY IF EXISTS "Assignments: staff e coinvolti possono vedere" ON public."coach_assignments";
DROP POLICY IF EXISTS "Coach test notes: client can view own" ON public."coach_test_notes";
DROP POLICY IF EXISTS "Coach test notes: staff può gestire" ON public."coach_test_notes";
DROP POLICY IF EXISTS "Coach test notes: staff può vedere" ON public."coach_test_notes";
DROP POLICY IF EXISTS "Participants: staff può gestire" ON public."course_participants";
DROP POLICY IF EXISTS "Participants: visualizza propri o se staff" ON public."course_participants";
DROP POLICY IF EXISTS "Sessions: staff può gestire" ON public."course_sessions";
DROP POLICY IF EXISTS "Sessions: tutti possono vedere" ON public."course_sessions";
DROP POLICY IF EXISTS "Courses: staff può gestire" ON public."courses";
DROP POLICY IF EXISTS "Courses: tutti possono vedere attivi" ON public."courses";
DROP POLICY IF EXISTS "Errors: cliente e coach coinvolto possono vedere" ON public."error_reports";
DROP POLICY IF EXISTS "Errors: cliente può creare" ON public."error_reports";
DROP POLICY IF EXISTS "Errors: coach/admin può aggiornare" ON public."error_reports";
DROP POLICY IF EXISTS "Videos: coach può aggiornare propri" ON public."exercise_videos";
DROP POLICY IF EXISTS "Videos: coach può eliminare propri" ON public."exercise_videos";
DROP POLICY IF EXISTS "Videos: coach può gestire propri" ON public."exercise_videos";
DROP POLICY IF EXISTS "Videos: tutti possono vedere" ON public."exercise_videos";
DROP POLICY IF EXISTS "Exercises: staff può gestire" ON public."exercises";
DROP POLICY IF EXISTS "Exercises: tutti possono vedere" ON public."exercises";
DROP POLICY IF EXISTS "Expenses: nega accesso anonimo" ON public."expenses";
DROP POLICY IF EXISTS "Expenses: solo admin può gestire" ON public."expenses";
DROP POLICY IF EXISTS "Hours: solo admin può gestire" ON public."gym_hours";
DROP POLICY IF EXISTS "Hours: tutti possono vedere" ON public."gym_hours";
DROP POLICY IF EXISTS "Packages: admin può gestire" ON public."lesson_packages";
DROP POLICY IF EXISTS "Packages: staff e proprietario possono vedere" ON public."lesson_packages";
DROP POLICY IF EXISTS "Usage log: admin può gestire" ON public."lesson_usage_log";
DROP POLICY IF EXISTS "Usage log: staff e proprietario possono vedere" ON public."lesson_usage_log";
DROP POLICY IF EXISTS "Plans: solo admin può gestire" ON public."membership_plans";
DROP POLICY IF EXISTS "Plans: tutti possono vedere piani attivi" ON public."membership_plans";
DROP POLICY IF EXISTS "Notifications: proprietario può aggiornare (read)" ON public."notifications";
DROP POLICY IF EXISTS "Notifications: solo proprietario" ON public."notifications";
DROP POLICY IF EXISTS "Notifications: staff può creare per utenti" ON public."notifications";
DROP POLICY IF EXISTS "Payments: admin può gestire" ON public."payments";
DROP POLICY IF EXISTS "Payments: visualizza propri o gestiti" ON public."payments";
DROP POLICY IF EXISTS "Profiles: admin o proprietario può aggiornare" ON public."profiles";
DROP POLICY IF EXISTS "Profiles: admin può inserire" ON public."profiles";
DROP POLICY IF EXISTS "Profiles: chiunque autenticato può vedere" ON public."profiles";
DROP POLICY IF EXISTS "Profiles: solo admin può eliminare" ON public."profiles";
DROP POLICY IF EXISTS "Subscriptions: admin può gestire tutti" ON public."subscriptions";
DROP POLICY IF EXISTS "Subscriptions: nega accesso anonimo" ON public."subscriptions";
DROP POLICY IF EXISTS "Subscriptions: solo utenti autenticati possono vedere" ON public."subscriptions";
DROP POLICY IF EXISTS "Completions: cliente può aggiornare propri" ON public."workout_completions";
DROP POLICY IF EXISTS "Completions: cliente può inserire propri" ON public."workout_completions";
DROP POLICY IF EXISTS "Completions: cliente può vedere propri" ON public."workout_completions";
DROP POLICY IF EXISTS "Completions: staff può aggiornare" ON public."workout_completions";
DROP POLICY IF EXISTS "Completions: staff può eliminare" ON public."workout_completions";
DROP POLICY IF EXISTS "Plan exercises: staff può gestire" ON public."workout_plan_exercises";
DROP POLICY IF EXISTS "Plan exercises: visibili se scheda visibile" ON public."workout_plan_exercises";
DROP POLICY IF EXISTS "Workouts: coach proprietario o admin può eliminare" ON public."workout_plans";
DROP POLICY IF EXISTS "Workouts: coach proprietario o admin può modificare" ON public."workout_plans";
DROP POLICY IF EXISTS "Workouts: coach/admin può creare" ON public."workout_plans";
DROP POLICY IF EXISTS "Workouts: visualizza propri o gestiti" ON public."workout_plans";

ALTER TABLE public."appointments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."client_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."client_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."coach_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."coach_test_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."course_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."course_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."courses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."error_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."exercise_videos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."exercises" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."gym_hours" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lesson_packages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lesson_usage_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."membership_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."workout_completions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."workout_plan_exercises" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."workout_plans" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Appointments: coach proprietario può eliminare" ON public.appointments FOR DELETE TO authenticated USING (((auth.uid() = coach_id) OR public.is_admin(auth.uid())));

CREATE POLICY "Appointments: coach proprietario può modificare" ON public.appointments FOR UPDATE TO authenticated USING (((auth.uid() = coach_id) OR public.is_admin(auth.uid())));

CREATE POLICY "Appointments: coach/admin può creare" ON public.appointments FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Appointments: solo utenti autenticati possono vedere propri" ON public.appointments FOR SELECT TO authenticated USING (((auth.uid() = coach_id) OR (auth.uid() = client_id) OR public.is_admin(auth.uid())));

CREATE POLICY "Assignments: solo admin può gestire" ON public.coach_assignments TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Assignments: staff e coinvolti possono vedere" ON public.coach_assignments FOR SELECT TO authenticated USING ((public.is_staff(auth.uid()) OR (auth.uid() = coach_id) OR (auth.uid() = client_id)));

CREATE POLICY "Coach test notes: client can view own" ON public.coach_test_notes FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.workout_plan_exercises wpe
     JOIN public.workout_plans wp ON ((wp.id = wpe.workout_plan_id)))
  WHERE ((wpe.id = coach_test_notes.workout_plan_exercise_id) AND (wp.client_id = auth.uid())))));

CREATE POLICY "Coach test notes: staff può gestire" ON public.coach_test_notes TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Coach test notes: staff può vedere" ON public.coach_test_notes FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Completions: cliente può aggiornare propri" ON public.workout_completions FOR UPDATE TO authenticated USING ((auth.uid() = client_id));

CREATE POLICY "Completions: cliente può inserire propri" ON public.workout_completions FOR INSERT TO authenticated WITH CHECK ((auth.uid() = client_id));

CREATE POLICY "Completions: cliente può vedere propri" ON public.workout_completions FOR SELECT TO authenticated USING (((auth.uid() = client_id) OR public.is_staff(auth.uid())));

CREATE POLICY "Completions: staff può aggiornare" ON public.workout_completions FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Completions: staff può eliminare" ON public.workout_completions FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Courses: staff può gestire" ON public.courses TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Courses: tutti possono vedere attivi" ON public.courses FOR SELECT TO authenticated USING (((is_active = true) OR public.is_staff(auth.uid())));

CREATE POLICY "Documents: proprietario o admin può eliminare" ON public.client_documents FOR DELETE TO authenticated USING (((auth.uid() = user_id) OR public.is_admin(auth.uid())));

CREATE POLICY "Documents: staff o proprietario può aggiornare" ON public.client_documents FOR UPDATE TO authenticated USING ((public.is_staff(auth.uid()) OR (auth.uid() = user_id))) WITH CHECK ((public.is_staff(auth.uid()) OR (auth.uid() = user_id)));

CREATE POLICY "Documents: staff o proprietario può inserire" ON public.client_documents FOR INSERT TO authenticated WITH CHECK ((public.is_staff(auth.uid()) OR ((auth.uid() = user_id) AND (uploaded_by = auth.uid()))));

CREATE POLICY "Documents: visualizza propri o gestiti" ON public.client_documents FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.is_admin(auth.uid()) OR public.coach_manages_client(auth.uid(), user_id)));

CREATE POLICY "Errors: cliente e coach coinvolto possono vedere" ON public.error_reports FOR SELECT TO authenticated USING (((auth.uid() = client_id) OR (auth.uid() = coach_id) OR public.is_admin(auth.uid())));

CREATE POLICY "Errors: cliente può creare" ON public.error_reports FOR INSERT TO authenticated WITH CHECK ((auth.uid() = client_id));

CREATE POLICY "Errors: coach/admin/cliente può aggiornare" ON public.error_reports FOR UPDATE TO authenticated USING (((auth.uid() = coach_id) OR public.is_admin(auth.uid()) OR (auth.uid() = client_id))) WITH CHECK ((public.is_admin(auth.uid()) OR (auth.uid() = coach_id) OR ((auth.uid() = client_id) AND (client_id = ( SELECT er.client_id
   FROM public.error_reports er
  WHERE (er.id = error_reports.id))) AND (coach_id = ( SELECT er.coach_id
   FROM public.error_reports er
  WHERE (er.id = error_reports.id))))));

CREATE POLICY "Exercises: staff può gestire" ON public.exercises TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Exercises: tutti possono vedere" ON public.exercises FOR SELECT TO authenticated USING (true);

CREATE POLICY "Expenses: solo admin può gestire" ON public.expenses TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Hours: solo admin può gestire" ON public.gym_hours TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Hours: tutti possono vedere" ON public.gym_hours FOR SELECT TO authenticated USING (true);

CREATE POLICY "Notes: proprietario può gestire" ON public.client_notes TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY "Notes: solo proprietario può vedere" ON public.client_notes FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY "Notifications: proprietario può aggiornare (read)" ON public.notifications FOR UPDATE TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY "Notifications: solo proprietario" ON public.notifications FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY "Notifications: staff può creare per utenti" ON public.notifications FOR INSERT TO authenticated WITH CHECK ((public.is_staff(auth.uid()) OR (auth.uid() = user_id)));

CREATE POLICY "Packages: billing può gestire" ON public.lesson_packages TO authenticated USING (public.can_manage_billing(auth.uid())) WITH CHECK (public.can_manage_billing(auth.uid()));

CREATE POLICY "Packages: staff/billing e proprietario possono vedere" ON public.lesson_packages FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.is_staff(auth.uid()) OR public.can_manage_billing(auth.uid())));

CREATE POLICY "Participants: staff può gestire" ON public.course_participants TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Participants: visualizza propri o se staff" ON public.course_participants FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.is_staff(auth.uid())));

CREATE POLICY "Payments: billing può gestire" ON public.payments TO authenticated USING (public.can_manage_billing(auth.uid())) WITH CHECK (public.can_manage_billing(auth.uid()));

CREATE POLICY "Payments: visualizza propri o gestiti" ON public.payments FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.can_manage_billing(auth.uid())));

CREATE POLICY "Plan exercises: staff può gestire" ON public.workout_plan_exercises TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Plan exercises: visibili se scheda visibile" ON public.workout_plan_exercises FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.workout_plans wp
  WHERE ((wp.id = workout_plan_exercises.workout_plan_id) AND ((wp.client_id = auth.uid()) OR (wp.coach_id = auth.uid()) OR public.is_admin(auth.uid()))))));

CREATE POLICY "Plans: solo admin può gestire" ON public.membership_plans TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Plans: tutti possono vedere piani attivi" ON public.membership_plans FOR SELECT TO authenticated USING (((is_active = true) OR public.is_admin(auth.uid())));

CREATE POLICY "Profiles: admin o proprietario può aggiornare" ON public.profiles FOR UPDATE TO authenticated USING (((auth.uid() = user_id) OR public.is_admin(auth.uid()))) WITH CHECK ((public.is_admin(auth.uid()) OR ((auth.uid() = user_id) AND (role = public.get_user_role(auth.uid())))));

CREATE POLICY "Profiles: admin può inserire" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Profiles: solo admin può eliminare" ON public.profiles FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Profiles: visibilità ristretta" ON public.profiles FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.is_admin(auth.uid()) OR public.is_segretaria(auth.uid()) OR public.coach_manages_client(auth.uid(), user_id)));

CREATE POLICY "Sessions: staff può gestire" ON public.course_sessions TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Sessions: tutti possono vedere" ON public.course_sessions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Subscriptions: billing può gestire" ON public.subscriptions TO authenticated USING (public.can_manage_billing(auth.uid())) WITH CHECK (public.can_manage_billing(auth.uid()));

CREATE POLICY "Subscriptions: visualizza propri o gestiti" ON public.subscriptions FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.can_manage_billing(auth.uid()) OR public.coach_manages_client(auth.uid(), user_id)));

CREATE POLICY "Usage log: admin può gestire" ON public.lesson_usage_log TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Usage log: staff e proprietario possono vedere" ON public.lesson_usage_log FOR SELECT TO authenticated USING ((public.is_staff(auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.lesson_packages lp
  WHERE ((lp.id = lesson_usage_log.package_id) AND (lp.user_id = auth.uid()))))));

CREATE POLICY "Videos: coach può aggiornare propri" ON public.exercise_videos FOR UPDATE TO authenticated USING (((coach_id = auth.uid()) OR public.is_admin(auth.uid())));

CREATE POLICY "Videos: coach può eliminare propri" ON public.exercise_videos FOR DELETE TO authenticated USING (((coach_id = auth.uid()) OR public.is_admin(auth.uid())));

CREATE POLICY "Videos: coach può gestire propri" ON public.exercise_videos FOR INSERT TO authenticated WITH CHECK ((public.is_coach(auth.uid()) AND (coach_id = auth.uid())));

CREATE POLICY "Videos: tutti possono vedere" ON public.exercise_videos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Workouts: coach assegnato o admin può creare" ON public.workout_plans FOR INSERT TO authenticated WITH CHECK ((public.is_admin(auth.uid()) OR (public.is_staff(auth.uid()) AND (auth.uid() = coach_id) AND public.coach_manages_client(auth.uid(), client_id))));

CREATE POLICY "Workouts: coach proprietario o admin può eliminare" ON public.workout_plans FOR DELETE TO authenticated USING (((auth.uid() = coach_id) OR public.is_admin(auth.uid())));

CREATE POLICY "Workouts: coach proprietario o admin può modificare" ON public.workout_plans FOR UPDATE TO authenticated USING (((auth.uid() = coach_id) OR public.is_admin(auth.uid())));

CREATE POLICY "Workouts: visualizza propri o gestiti" ON public.workout_plans FOR SELECT TO authenticated USING (((auth.uid() = client_id) OR (auth.uid() = coach_id) OR public.is_admin(auth.uid())));
