// Edge Function: send-push-notification
// Invia notifiche push via Firebase Cloud Messaging (FCM HTTP v1 API).
// Richiede il secret FIREBASE_SERVICE_ACCOUNT_KEY (JSON del service account Firebase).
// Nessuna chiave privata o credenziale Firebase è presente nell'app mobile.
//
// Autorizzazione: admin -> qualsiasi utente; coach -> solo i clienti assegnati
// (coach_assignments). Tutti gli altri ruoli ricevono 403.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
};

const MAX_RECIPIENTS = 500;
const IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000;

// Cache in-memory per deduplicazione (vale solo per la singola istanza della funzione).
const seenIdempotencyKeys = new Map<string, number>();

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const base64Url = (input: ArrayBuffer | string) => {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function getGoogleAccessToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt - 60 > now) return cachedAccessToken.token;

  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));

  const pem = account.private_key
    .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const unsigned = `${header}.${claims}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${base64Url(signature)}`,
    }),
  });
  if (!response.ok) throw new Error(`OAuth Google non riuscito (${response.status})`);
  const { access_token, expires_in } = await response.json();
  cachedAccessToken = { token: access_token, expiresAt: now + Number(expires_in ?? 3600) };
  return access_token;
}

// FCM accetta solo stringhe nel campo data.
const stringifyData = (data: unknown): Record<string, string> | undefined => {
  if (!data || typeof data !== "object") return undefined;
  return Object.fromEntries(
    Object.entries(data as Record<string, unknown>)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)]),
  );
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Non autorizzato" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) return json({ error: "Sessione non valida" }, 401);

    const { data: callerProfile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const callerRole = callerProfile?.role;
    if (callerRole !== "admin" && callerRole !== "coach") {
      return json({ error: "Solo admin e coach possono inviare notifiche" }, 403);
    }

    const { user_ids, title, body, data } = await req.json();

    if (!Array.isArray(user_ids) || user_ids.length === 0 || !title || !body) {
      return json({ error: "Parametri mancanti: user_ids (array), title e body sono obbligatori." }, 400);
    }
    const targetIds = [...new Set(user_ids.filter((id): id is string => typeof id === "string" && id.length > 0))];
    if (targetIds.length === 0 || targetIds.length > MAX_RECIPIENTS) {
      return json({ error: `user_ids deve contenere da 1 a ${MAX_RECIPIENTS} utenti.` }, 400);
    }

    if (callerRole === "coach") {
      const { data: assignments, error: assignmentError } = await supabaseClient
        .from("coach_assignments")
        .select("client_id")
        .eq("coach_id", user.id)
        .in("client_id", targetIds);
      if (assignmentError) return json({ error: "Verifica clienti non riuscita" }, 500);
      const allowed = new Set((assignments ?? []).map((row) => row.client_id));
      if (targetIds.some((id) => !allowed.has(id))) {
        return json({ error: "Un coach può inviare notifiche solo ai propri clienti" }, 403);
      }
    }

    // Deduplicazione solo dopo l'autorizzazione, con chiave legata al chiamante.
    const idempotencyKey = req.headers.get("idempotency-key");
    if (idempotencyKey) {
      const now = Date.now();
      for (const [key, seenAt] of seenIdempotencyKeys) {
        if (now - seenAt >= IDEMPOTENCY_WINDOW_MS) seenIdempotencyKeys.delete(key);
      }
      const scopedKey = `${user.id}:${idempotencyKey}`;
      if (seenIdempotencyKeys.has(scopedKey)) {
        return json({ message: "Richiesta duplicata ignorata (idempotente)", skipped: true });
      }
      seenIdempotencyKeys.set(scopedKey, now);
    }

    const { data: tokens, error: tokensError } = await supabaseClient
      .from("user_device_tokens")
      .select("id, user_id, token, platform")
      .in("user_id", targetIds)
      .eq("is_active", true);

    if (tokensError) return json({ error: "Lettura token dispositivi non riuscita" }, 500);
    if (!tokens || tokens.length === 0) {
      return json({ message: "Nessun token dispositivo attivo per gli utenti specificati", sent: 0 });
    }

    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountJson) {
      return json({
        error: "Configurazione server incompleta: manca FIREBASE_SERVICE_ACCOUNT_KEY nei secret Supabase.",
        missing_configuration: "FIREBASE_SERVICE_ACCOUNT_KEY",
      }, 503);
    }

    const account = JSON.parse(serviceAccountJson) as ServiceAccount;
    const accessToken = await getGoogleAccessToken(account);
    const endpoint = `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`;
    const payloadData = stringifyData(data);

    const results = await Promise.all(tokens.map(async (device) => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token: device.token,
            notification: { title: String(title), body: String(body) },
            ...(payloadData ? { data: payloadData } : {}),
          },
        }),
      });
      if (response.ok) return { id: device.id, ok: true, invalid: false };
      const errorBody = await response.json().catch(() => ({}));
      const fcmCode = errorBody?.error?.details?.find?.((d: { errorCode?: string }) => d?.errorCode)?.errorCode;
      // Token non più valido (app disinstallata, token ruotato): va disattivato.
      const invalid = response.status === 404 || fcmCode === "UNREGISTERED";
      return { id: device.id, ok: false, invalid };
    }));

    const invalidIds = results.filter((r) => r.invalid).map((r) => r.id);
    if (invalidIds.length > 0) {
      await supabaseClient
        .from("user_device_tokens")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in("id", invalidIds);
    }

    return json({
      sent: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      deactivated_tokens: invalidIds.length,
    });
  } catch (err) {
    console.error("send-push-notification error:", err);
    return json({ error: "Errore interno del server" }, 500);
  }
});
