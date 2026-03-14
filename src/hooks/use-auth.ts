// src/hooks/use-auth.ts
import { useEffect } from "react";
import { useAuthStore } from "../stores/auth-store";

export function useAuth() {
  const store = useAuthStore();

  useEffect(() => {
    const cleanup = store.initialize();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return store;
}
