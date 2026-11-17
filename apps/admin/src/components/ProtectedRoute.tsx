import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

interface Props {
  /** Se informado, além de exigir sessão válida, exige essa permissão —
   * sem ela, redireciona pra /eventos (ou /credenciamento) em vez de mostrar a tela vazia.
   * A checagem real de verdade é sempre no backend (requirePermission);
   * isso aqui só evita mostrar uma tela que o usuário não tem acesso. */
  permission?: string;
}

export function ProtectedRoute({ permission }: Props) {
  const { user, loading, hasPermission, isCredenciamentoOnly } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (permission && !hasPermission(permission)) {
    return <Navigate to={isCredenciamentoOnly ? "/credenciamento" : "/eventos"} replace />;
  }

  return <Outlet />;
}

/**
 * Bloqueia usuários com acesso exclusivo ao Credenciamento de acessarem qualquer
 * rota administrativa (como /eventos, /usuarios, /perfis, etc.), redirecionando-os
 * imediatamente para /credenciamento.
 */
export function AdminOnlyRoute() {
  const { user, loading, isCredenciamentoOnly } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (isCredenciamentoOnly) {
    return <Navigate to="/credenciamento" replace />;
  }

  return <Outlet />;
}
