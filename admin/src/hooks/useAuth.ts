import { createContext, createElement, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { api, ApiError } from "@/api/client";

interface AuthState {
  loading: boolean;
  authenticated: boolean;
}

interface AuthValue extends AuthState {
  login: (secret: string) => Promise<void>;
  logout: () => Promise<void>;
  check: () => Promise<void>;
}

// Auth lives in context, not in each caller's local state: App decides which
// routes to render, LoginPage performs the login. With a plain hook those were
// two independent useState instances, so a successful login never reached the
// router and the panel stayed on /login until a manual page reload.
const AuthContext = createContext<AuthValue | null>(null);

function useAuthState(): AuthValue {
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

  const login = useCallback(async (secret: string) => {
    await api.post<{ ok: true }>("/api/auth/login", { secret });
    setState({ loading: false, authenticated: true });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.delete<{ ok: true }>("/api/auth/login");
    } finally {
      setState({ loading: false, authenticated: false });
    }
  }, []);

  return { ...state, login, logout, check };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return createElement(AuthContext.Provider, { value: useAuthState() }, children);
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
