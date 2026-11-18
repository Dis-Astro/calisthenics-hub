import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Table2 } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import CoachLayout from "@/components/coach/CoachLayout";
import VolumeIntensityTable from "@/components/admin/VolumeIntensityTable";
import PageLoader from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type ClientState =
  | { kind: "loading" }
  | { kind: "ready"; id: string; name: string }
  | { kind: "error"; message: string };

const ClientVolumePage = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user, isAdmin } = useAuth();
  const [client, setClient] = useState<ClientState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const Layout = isAdmin ? AdminLayout : CoachLayout;
  const backTo = isAdmin && userId ? `/admin/utenti/${userId}` : "/coach/clienti";

  useEffect(() => {
    let cancelled = false;
    setClient({ kind: "loading" });

    const loadClient = async () => {
      try {
        if (!userId || !user?.id) throw new Error("Cliente non disponibile.");
        if (!isAdmin) {
          const { data: assigned, error } = await supabase.rpc("coach_manages_client", {
            coach_uuid: user.id,
            client_uuid: userId,
          });
          if (error) throw new Error("Impossibile verificare l'accesso al cliente.");
          if (!assigned) throw new Error("Non sei assegnato a questo cliente.");
        }
        const { data, error } = await supabase.from("profiles")
          .select("first_name, last_name").eq("user_id", userId).single();
        if (error || !data) throw new Error("Impossibile caricare il cliente.");
        if (!cancelled) setClient({ kind: "ready", id: userId, name: `${data.first_name} ${data.last_name}` });
      } catch (error) {
        if (!cancelled) setClient({ kind: "error", message: error instanceof Error ? error.message : "Errore di caricamento." });
      }
    };

    void loadClient();
    return () => { cancelled = true; };
  }, [userId, user?.id, isAdmin, attempt]);

  return (
    <Layout title="VOLUME & INTENSITÀ" icon={<Table2 className="w-6 h-6" />}>
      <div className="space-y-6">
        <Button variant="ghost" className="gap-2" asChild>
          <Link to={backTo}><ArrowLeft className="w-4 h-4" />{isAdmin ? "Torna al cliente" : "I miei clienti"}</Link>
        </Button>
        {client.kind === "loading" && <PageLoader message="Caricamento cliente…" />}
        {client.kind === "error" && (
          <div role="alert" className="space-y-3 rounded-md border p-4">
            <p>{client.message}</p>
            <Button variant="outline" onClick={() => setAttempt(value => value + 1)}>Riprova</Button>
          </div>
        )}
        {client.kind === "ready" && client.id === userId && (
          <>
            <div>
              <h2 className="font-display text-2xl tracking-wider">{client.name}</h2>
              <p className="text-sm text-muted-foreground">Tabelle di lavoro quotidiano con storico e salvataggio automatico.</p>
            </div>
            <VolumeIntensityTable key={userId} clientId={userId} />
          </>
        )}
      </div>
    </Layout>
  );
};

export default ClientVolumePage;
