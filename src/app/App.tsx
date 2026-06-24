import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import {
  applyDarkMode,
  clearAuthSession,
  getAuthSession,
  getLastActivity,
  getUserSettings,
  markActivity,
} from "./lib/session";
import { apiRequest } from "./lib/api";

export default function App() {
  useEffect(() => {
    applyDarkMode(getUserSettings().darkMode);
    markActivity();

    const onActivity = () => markActivity();
    const events = ["click", "keydown", "mousemove", "scroll", "touchstart"];
    events.forEach((eventName) => {
      window.addEventListener(eventName, onActivity, { passive: true });
    });

    const timer = window.setInterval(async () => {
      const auth = getAuthSession();
      if (!auth?.token) return;

      const settings = getUserSettings();
      const timeoutMs = settings.autoLogoutMinutes * 60 * 1000;
      const idleMs = Date.now() - getLastActivity();

      if (idleMs < timeoutMs) return;

      try {
        await apiRequest("/api/auth/logout", { method: "POST" });
      } catch {

      }

      clearAuthSession();
      window.location.hash = "/";
    }, 5000);

    return () => {
      window.clearInterval(timer);
      events.forEach((eventName) => {
        window.removeEventListener(eventName, onActivity);
      });
    };
  }, []);

  return <RouterProvider router={router} />;
}
