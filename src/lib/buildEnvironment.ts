// Build-time validation only. Never return a key in release metadata or errors.
export function validateBuildEnvironment(env: Record<string, string | undefined>) {
  const { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key } = env;
  if (!url || !key) throw new Error("Build bloccata: configurazione Supabase incompleta.");
  let parsed: URL;
  try { parsed = new URL(url); }
  catch { throw new Error("Build bloccata: URL Supabase non valido."); }
  // Cloudflare può fornire solo URL e chiave: l'identificativo si ricava dall'host,
  // e se è dichiarato deve coincidere.
  const project = env.VITE_SUPABASE_PROJECT_ID || parsed.hostname.replace(/\.supabase\.co$/, "");
  if (parsed.protocol !== "https:" || parsed.hostname !== `${project}.supabase.co` || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
    throw new Error("Build bloccata: URL e identificativo Supabase non coerenti.");
  }
  if (env.SPG_EXPECTED_SUPABASE_PROJECT && env.SPG_EXPECTED_SUPABASE_PROJECT !== project) {
    throw new Error("Build bloccata: database diverso dall'ambiente richiesto.");
  }
  if (!key.startsWith("sb_publishable_")) {
    try {
      const payload = JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (payload.role !== "anon" || (payload.ref && payload.ref !== project)) throw new Error();
    } catch {
      throw new Error("Build bloccata: usare esclusivamente una chiave pubblica del progetto selezionato.");
    }
  }
  return { project, backendHost: parsed.hostname };
}
