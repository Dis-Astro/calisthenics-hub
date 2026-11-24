import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];

// Every role listed here must be accepted by the ProtectedRoute of its target path,
// otherwise ProtectedRoute bounces back to /dashboard and the two redirect forever.
const ROLE_HOME: Partial<Record<UserRole, string>> = {
  admin: "/admin",
  coach: "/coach",
  cliente_coaching: "/coaching",
  cliente_palestra: "/palestra",
  cliente_corso: "/palestra",
  segretaria: "/segretaria",
};

function getRoleHome(role: UserRole | null | undefined): string | null {
  if (!role) return null;
  return ROLE_HOME[role] ?? null;
}

// Dashboard Router - redirects to the appropriate dashboard based on role
const Dashboard = () => {
  const navigate = useNavigate();
  const { profile, loading, signOut } = useAuth();
  const home = getRoleHome(profile?.role);

  useEffect(() => {
    if (loading) return;

    if (!profile) {
      navigate("/login", { replace: true });
      return;
    }

    if (home) navigate(home, { replace: true });
  }, [profile, loading, navigate, home]);

  if (!loading && profile && !home) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-4">
          <h1 className="text-xl font-semibold">Area non ancora disponibile</h1>
          <p className="text-muted-foreground">
            Il tuo account non ha ancora una sezione dedicata nell'app. Contatta l'amministrazione della palestra.
          </p>
          <Button
            variant="outline"
            onClick={async () => {
              await signOut();
              navigate("/login", { replace: true });
            }}
          >
            Esci
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Reindirizzamento...</p>
      </div>
    </div>
  );
};

export default Dashboard;
