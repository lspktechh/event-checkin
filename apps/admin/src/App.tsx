import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { AdminOnlyRoute, ProtectedRoute } from "./components/ProtectedRoute";
import { CertificateTemplatesPage } from "./pages/CertificateTemplatesPage";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { EventsPage } from "./pages/EventsPage";
import { EventDetailPage } from "./pages/EventDetailPage";
import { UsersPage } from "./pages/UsersPage";
import { RolesPage } from "./pages/RolesPage";
import { ApkPage } from "./pages/ApkPage";
import { CredenciamentoPage } from "./pages/CredenciamentoPage";
import { CredenciamentoSelectPage } from "./pages/CredenciamentoSelectPage";
import { RaffleNumberPage } from "./pages/RaffleNumberPage";

function FallbackRedirect() {
  const { user, isCredenciamentoOnly } = useAuth();
  if (user && isCredenciamentoOnly) {
    return <Navigate to="/credenciamento" replace />;
  }
  return <Navigate to="/eventos" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          {/* Pública: aberta pelo QR Code da aba Sorteios, sem login. */}
          <Route path="/numero/:eventId" element={<RaffleNumberPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/credenciamento" element={<CredenciamentoSelectPage />} />
            <Route path="/eventos/:eventId/credenciamento" element={<CredenciamentoPage />} />
            {/* Rotas restritas ao painel administrativo (bloqueadas para perfil Credenciamento) */}
            <Route element={<AdminOnlyRoute />}>
              <Route element={<Layout />}>
                <Route path="/eventos" element={<EventsPage />} />
                <Route path="/eventos/:eventId" element={<EventDetailPage />} />
                <Route element={<ProtectedRoute permission="certificates.view" />}>
                  <Route path="/modelos-certificado" element={<CertificateTemplatesPage />} />
                </Route>
                <Route element={<ProtectedRoute permission="users.view" />}>
                  <Route path="/usuarios" element={<UsersPage />} />
                </Route>
                <Route element={<ProtectedRoute permission="roles.view" />}>
                  <Route path="/perfis" element={<RolesPage />} />
                </Route>
                <Route path="/apk" element={<ApkPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<FallbackRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
