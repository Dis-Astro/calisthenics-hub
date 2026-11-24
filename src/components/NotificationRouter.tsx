import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { setupCourseReminderNavigation } from "@/features/course-booking/courseReminders";
import { registerPushNotifications } from "@/features/push-notifications/pushService";
import { useAuth } from "@/hooks/useAuth";

export default function NotificationRouter() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id;

  // Register the device only with a live session: the token upsert needs RLS auth.
  useEffect(() => {
    if (!userId) return;
    void registerPushNotifications(userId);
  }, [userId]);

  useEffect(() => {
    const cleanupLocal = setupCourseReminderNavigation((sessionId) => {
      navigate(`/palestra?session=${encodeURIComponent(sessionId)}`);
    });

    let pushHandle: { remove: () => Promise<void> } | null = null;
    let pushRemoved = false;

    if (Capacitor.isNativePlatform()) {
      void PushNotifications.addListener("pushNotificationActionPerformed", (notification) => {
        const data = notification.notification?.data;
        const sessionId = data?.sessionId ?? data?.session_id;
        if (typeof sessionId === "string" && sessionId) {
          navigate(`/palestra?session=${encodeURIComponent(sessionId)}`);
        }
      }).then((handle) => {
        if (pushRemoved) {
          void handle.remove();
        } else {
          pushHandle = handle;
        }
      }).catch(() => undefined);
    }

    return () => {
      cleanupLocal();
      pushRemoved = true;
      if (pushHandle) {
        void pushHandle.remove();
      }
    };
  }, [navigate]);

  return null;
}
