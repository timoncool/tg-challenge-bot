import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "@/api/client";

interface AuthState {
  loading: boolean;
  authenticated: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ loading: true, authenticated: false });

  const check = useCallback(async () => {
    try {
      await api.get<{ ok: true }>("/api/auth/me");
      setState({ loading: false, authenticated: true });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setState({ loading: false, authenticated: false });
      } else {
        // network/other — treat as unauthenticated so user can retry login
        setState({ loading: false, authenticated: false });
      }
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const login = useCallback(
    async (secret: string) => {
      await api.post<{ ok: true }>("/api/auth/login", { secret });
      setState({ loading: false, authenticated: true });
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await api.delete<{ ok: true }>("/api/auth/login");
    } finally {
      setState({ loading: false, authenticated: false });
    }
  }, []);

  return { ...state, login, logout, check };
}
