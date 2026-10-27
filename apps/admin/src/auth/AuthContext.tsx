import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as api from "../api/client";

interface AuthState {
  user: api.AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** ADMINISTRADOR (permissions === "ALL") sempre retorna true, igual o
   * backend trata isSystem — ver requirePermission() em middleware/auth.ts. */
  hasPermission: (key: string) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Sessão do admin: token JWT persistido em localStorage com expiração de longa duração
 * e renovação automática silenciosa (silent refresh via /auth/me).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<api.AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Escuta 401 global para deslogar imediatamente sem exibir telas quebradas
  useEffect(() => {
    api.setOnUnauthorized(() => {
      setUser(null);
    });
    return () => {
      api.setOnUnauthorized(null);
    };
  }, []);

  // Inicializa sessão e valida/renova silenciosamente com o backend
  useEffect(() => {
    const stored = localStorage.getItem("admin_user");
    const token = api.getToken();

    if (stored && token) {
      try {
        const parsed = JSON.parse(stored);
        const hasValidShape =
          parsed &&
          typeof parsed.role === "object" &&
          parsed.role !== null &&
          typeof parsed.role.name === "string" &&
          (parsed.permissions === "ALL" || Array.isArray(parsed.permissions));

        if (hasValidShape) {
          setUser(parsed);

          // Validação silenciosa e renovação de token no servidor
          api
            .getMe()
            .then((res) => {
              api.setToken(res.token);
              localStorage.setItem("admin_user", JSON.stringify(res.user));
              setUser(res.user);
            })
            .catch((err) => {
              if (err instanceof api.ApiError && err.httpStatus === 401) {
                api.clearToken();
                localStorage.removeItem("admin_user");
                setUser(null);
              }
              // Erros de rede temporários não deslogam o usuário local
            });
        } else {
          api.clearToken();
          localStorage.removeItem("admin_user");
        }
      } catch {
        api.clearToken();
        localStorage.removeItem("admin_user");
      }
    }
    setLoading(false);
  }, []);

  // Quando o usuário volta à aba após horas/dias, renova o token automaticamente
  useEffect(() => {
    function handleVisibilityOrFocus() {
      if (document.visibilityState === "visible" && api.getToken()) {
        api
          .getMe()
          .then((res) => {
            api.setToken(res.token);
            localStorage.setItem("admin_user", JSON.stringify(res.user));
            setUser(res.user);
          })
          .catch((err) => {
            if (err instanceof api.ApiError && err.httpStatus === 401) {
              api.clearToken();
              localStorage.removeItem("admin_user");
              setUser(null);
            }
          });
      }
    }

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    return () => {
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, []);

  async function login(email: string, password: string) {
    const { token, user: loggedUser } = await api.login(email, password);
    api.setToken(token);
    localStorage.setItem("admin_user", JSON.stringify(loggedUser));
    setUser(loggedUser);
  }

  function logout() {
    api.clearToken();
    localStorage.removeItem("admin_user");
    setUser(null);
  }

  function hasPermission(key: string): boolean {
    if (!user) return false;
    if (user.permissions === "ALL") return true;
    return user.permissions.includes(key);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
