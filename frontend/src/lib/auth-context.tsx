"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { SessionUser } from "./types";

type AuthStatus = "loading" | "authed" | "guest";

interface AuthContextValue {
  status: AuthStatus;
  user: SessionUser | null;
  refetch: () => Promise<SessionUser | null>;
  login: (email: string, password: string) => Promise<SessionUser>;
  sendMagicCode: (email: string) => Promise<{ expiresIn: number; devCode?: string }>;
  verifyCode: (email: string, code: string, purpose?: "LOGIN" | "2FA") => Promise<SessionUser>;
  logout: () => Promise<void>;
  switchEstablishment: (establishmentId: string) => Promise<SessionUser>;
  impersonate: (establishmentId: string) => Promise<SessionUser>;
  applySession: (user: SessionUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);

  const applySession = useCallback((next: SessionUser) => {
    setUser(next);
    setStatus("authed");
  }, []);

  const refetch = useCallback(async () => {
    try {
      const res = await api.get<{ user: SessionUser }>("/me");
      applySession(res.user);
      return res.user;
    } catch {
      setUser(null);
      setStatus("guest");
      return null;
    }
  }, [applySession]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<{ user: SessionUser }>("/auth/login", { email, password });
      applySession(res.user);
      return res.user;
    },
    [applySession],
  );

  const sendMagicCode = useCallback(async (email: string) => {
    return api.post<{ ok: boolean; expiresIn: number; devCode?: string }>("/auth/magic-link", { email });
  }, []);

  const verifyCode = useCallback(
    async (email: string, code: string, purpose: "LOGIN" | "2FA" = "LOGIN") => {
      const res = await api.post<{ user: SessionUser }>("/auth/verify-code", { email, code, purpose });
      applySession(res.user);
      return res.user;
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // seguimos aunque la cookie ya no exista
    }
    setUser(null);
    setStatus("guest");
  }, []);

  const switchEstablishment = useCallback(
    async (establishmentId: string) => {
      const res = await api.post<{ user: SessionUser }>("/auth/switch-establishment", { establishmentId });
      applySession(res.user);
      return res.user;
    },
    [applySession],
  );

  const impersonate = useCallback(
    async (establishmentId: string) => {
      const res = await api.post<{ user: SessionUser }>(`/admin/impersonate/${establishmentId}`);
      applySession(res.user);
      return res.user;
    },
    [applySession],
  );

  const value = useMemo(
    () => ({ status, user, refetch, login, sendMagicCode, verifyCode, logout, switchEstablishment, impersonate, applySession }),
    [status, user, refetch, login, sendMagicCode, verifyCode, logout, switchEstablishment, impersonate, applySession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}

/** Ruta de inicio según el rol de la sesión. */
export function homeFor(user: SessionUser): string {
  if (user.globalRole === "SUPER_ADMIN") return "/admin";
  if (user.memberships.length > 0) return "/panel";
  return "/cards";
}