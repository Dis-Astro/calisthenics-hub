import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { PushNotifications, Token, ActionPerformed } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";

const LAST_TOKEN_KEY = "spg:last_fcm_token";

// Only the listeners this service added: removing *all* plugin listeners would also
// drop the tap handler installed by NotificationRouter.
let serviceListeners: PluginListenerHandle[] = [];
let registeredUserId: string | null = null;

export interface PushNotificationServiceState {
  isRegistered: boolean;
  token: string | null;
}

/**
 * Push is opt-in per build: on Android, PushNotifications.register() crashes the app
 * when android/app/google-services.json is missing. Set VITE_PUSH_ENABLED=true only
 * after Firebase is configured for the build.
 */
export const pushNotificationsSupported = () =>
  Capacitor.isNativePlatform() && import.meta.env.VITE_PUSH_ENABLED === "true";

async function removeServiceListeners() {
  const handles = serviceListeners;
  serviceListeners = [];
  await Promise.all(handles.map((handle) => handle.remove().catch(() => undefined)));
}

/**
 * Registra il dispositivo per le notifiche push FCM e associa il token all'utente corrente.
 */
export async function registerPushNotifications(
  userId: string,
  onAction?: (action: ActionPerformed) => void
): Promise<boolean> {
  if (!pushNotificationsSupported() || !userId) return false;
  if (registeredUserId === userId && serviceListeners.length > 0) return true;

  try {
    const permStatus = await PushNotifications.checkPermissions();
    let receivePermission = permStatus.receive;

    if (receivePermission === "prompt" || receivePermission === "prompt-with-rationale") {
      const requested = await PushNotifications.requestPermissions();
      receivePermission = requested.receive;
    }

    if (receivePermission !== "granted") {
      return false;
    }

    await removeServiceListeners();
    registeredUserId = userId;

    // Listeners must exist before register(): the token event can fire immediately.
    serviceListeners.push(
      await PushNotifications.addListener("registration", async (token: Token) => {
        if (!token.value) return;
        localStorage.setItem(`${LAST_TOKEN_KEY}:${userId}`, token.value);
        await saveTokenToBackend(userId, token.value);
      }),
    );

    serviceListeners.push(
      await PushNotifications.addListener("registrationError", (error) => {
        console.warn("Registrazione notifiche push non riuscita:", error?.error);
      }),
    );

    if (onAction) {
      serviceListeners.push(await PushNotifications.addListener("pushNotificationActionPerformed", onAction));
    }

    await PushNotifications.register();
    return true;
  } catch {
    await removeServiceListeners();
    registeredUserId = null;
    return false;
  }
}

/**
 * Salva o aggiorna il token FCM associato all'utente nel backend.
 */
export async function saveTokenToBackend(userId: string, token: string): Promise<boolean> {
  if (!userId || !token) return false;
  try {
    const platform = Capacitor.getPlatform() === "android" ? "android" : "ios";
    const { error } = await supabase.from("user_device_tokens" as any).upsert(
      {
        user_id: userId,
        token: token,
        platform: platform,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,token" }
    );
    return !error;
  } catch {
    return false;
  }
}

/**
 * Scollega il dispositivo dall'utente corrente al logout.
 */
export async function unregisterPushNotifications(userId: string): Promise<void> {
  if (!userId) return;
  const lastToken = localStorage.getItem(`${LAST_TOKEN_KEY}:${userId}`);
  if (lastToken) {
    try {
      await supabase
        .from("user_device_tokens" as any)
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .match({ user_id: userId, token: lastToken });
    } catch {
      // Ignora errori di rete al logout
    }
    localStorage.removeItem(`${LAST_TOKEN_KEY}:${userId}`);
  }

  if (registeredUserId === userId) registeredUserId = null;
  await removeServiceListeners();
}
