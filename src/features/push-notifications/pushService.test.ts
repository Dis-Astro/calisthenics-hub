import { beforeEach, describe, expect, it, vi } from "vitest";

const pushMocks = vi.hoisted(() => ({
  checkPermissions: vi.fn(async () => ({ receive: "granted" })),
  requestPermissions: vi.fn(async () => ({ receive: "granted" })),
  register: vi.fn(async () => undefined),
  removeAllListeners: vi.fn(async () => undefined),
  removeHandle: vi.fn(async () => undefined),
  addListener: vi.fn((event: string, callback: any) => {
    (pushMocks as any)[`cb_${event}`] = callback;
    return Promise.resolve({ remove: pushMocks.removeHandle });
  }),
  upsert: vi.fn(async () => ({ error: null })),
  update: vi.fn(() => ({ match: vi.fn(async () => ({ error: null })) })),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => "android",
  },
}));

vi.mock("@capacitor/push-notifications", () => ({
  PushNotifications: {
    checkPermissions: pushMocks.checkPermissions,
    requestPermissions: pushMocks.requestPermissions,
    register: pushMocks.register,
    removeAllListeners: pushMocks.removeAllListeners,
    addListener: pushMocks.addListener,
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: pushMocks.upsert,
      update: pushMocks.update,
    })),
  },
}));

describe("Push notification service (FCM)", () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.stubEnv("VITE_PUSH_ENABLED", "true");
    const { unregisterPushNotifications } = await import("./pushService");
    await unregisterPushNotifications("user-1");
    vi.clearAllMocks();
  });

  it("does nothing when push is not enabled for the build", async () => {
    vi.stubEnv("VITE_PUSH_ENABLED", "");
    const { registerPushNotifications } = await import("./pushService");
    expect(await registerPushNotifications("user-1")).toBe(false);
    expect(pushMocks.register).not.toHaveBeenCalled();
  });

  it("attaches the token listener before calling register", async () => {
    const order: string[] = [];
    pushMocks.addListener.mockImplementationOnce((event: string, callback: any) => {
      order.push(`listen:${event}`);
      (pushMocks as any)[`cb_${event}`] = callback;
      return Promise.resolve({ remove: pushMocks.removeHandle });
    });
    pushMocks.register.mockImplementationOnce(async () => { order.push("register"); });
    const { registerPushNotifications } = await import("./pushService");
    await registerPushNotifications("user-1");
    expect(order).toEqual(["listen:registration", "register"]);
  });

  it("registers push notifications and saves FCM token to backend", async () => {
    const { registerPushNotifications } = await import("./pushService");
    const registered = await registerPushNotifications("user-1");
    expect(registered).toBe(true);
    expect(pushMocks.register).toHaveBeenCalled();

    // Simula evento di registrazione token da FCM
    const onReg = (pushMocks as any)["cb_registration"];
    expect(onReg).toBeDefined();
    await onReg({ value: "fcm-token-xyz" });

    expect(pushMocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        token: "fcm-token-xyz",
        platform: "android",
        is_active: true,
      }),
      { onConflict: "user_id,token" }
    );
  });

  it("handles denied permissions gracefully", async () => {
    pushMocks.checkPermissions.mockResolvedValueOnce({ receive: "denied" });
    pushMocks.requestPermissions.mockResolvedValueOnce({ receive: "denied" });

    const { registerPushNotifications } = await import("./pushService");
    const result = await registerPushNotifications("user-1");
    expect(result).toBe(false);
    expect(pushMocks.register).not.toHaveBeenCalled();
  });

  it("unregisters token and cleans up listeners on logout", async () => {
    const { registerPushNotifications, unregisterPushNotifications } = await import("./pushService");
    await registerPushNotifications("user-1");
    const onReg = (pushMocks as any)["cb_registration"];
    await onReg({ value: "fcm-token-123" });

    await unregisterPushNotifications("user-1");
    expect(pushMocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_active: false })
    );
    // Only this service's listeners are removed, never NotificationRouter's tap handler.
    expect(pushMocks.removeHandle).toHaveBeenCalled();
    expect(pushMocks.removeAllListeners).not.toHaveBeenCalled();
  });
});
