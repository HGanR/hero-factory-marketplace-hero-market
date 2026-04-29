import { useState, useEffect } from "react";

interface AuthStatus {
  authed: boolean;
  userId: number | null;
  email: string | null;
  username: string | null;
  loading: boolean;
}

/** If Node `/api/auth/me` never returns, do not block AuthGate forever. */
const AUTH_ME_TIMEOUT_MS = 4000;

/**
 * Session cookie (`/api/auth/me`) is authoritative when present.
 * Falls back to the same client signals as `/dashboard` (localStorage user / admin),
 * so AuthGate matches “logged in” on the dashboard when the cookie is missing or lagging.
 * Times out quickly so a hanging serverless route still allows the localStorage path.
 */
export function useAuthStatus(): AuthStatus {
  const [status, setStatus] = useState<AuthStatus>({
    authed: false,
    userId: null,
    email: null,
    username: null,
    loading: true,
  });

  useEffect(() => {
    const checkAuth = async () => {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), AUTH_ME_TIMEOUT_MS);
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
          signal: controller.signal,
        });

        if (response.status === 200) {
          const data = await response.json();
          setStatus({
            authed: true,
            userId: data.userId,
            email: data.email,
            username: data.username,
            loading: false,
          });
          return;
        }
      } catch (error) {
        const isAbort = error instanceof DOMException && error.name === "AbortError";
        if (!isAbort) {
          console.error("Auth status check failed:", error);
        }
      } finally {
        clearTimeout(t);
      }

      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("user");
          const admin = localStorage.getItem("adminLoggedIn") === "true";
          if (raw || admin) {
            let email: string | null = null;
            let username: string | null = null;
            let userId: number | null = null;
            if (raw) {
              const parsed = JSON.parse(raw) as {
                email?: string;
                username?: string;
                id?: number;
              };
              email = typeof parsed.email === "string" ? parsed.email : null;
              username = typeof parsed.username === "string" ? parsed.username : null;
              userId = typeof parsed.id === "number" ? parsed.id : null;
            }
            setStatus({
              authed: true,
              userId,
              email,
              username: admin ? username || "Admin" : username,
              loading: false,
            });
            return;
          }
        } catch {
          // ignore
        }
      }

      setStatus({
        authed: false,
        userId: null,
        email: null,
        username: null,
        loading: false,
      });
    };

    checkAuth();
  }, []);

  return status;
}







