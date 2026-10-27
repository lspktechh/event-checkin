import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { CheckIcon, MenuIcon } from "./Icons";
import { Sheet } from "./Sheet";

const NAV_LINKS = [
  { to: "/eventos", label: "Eventos", permission: "events.view" },
  { to: "/modelos-certificado", label: "Modelos de certificado", permission: "certificates.view" },
  { to: "/apk", label: "App do terminal", permission: null },
  { to: "/usuarios", label: "Usuários", permission: "users.view" },
  { to: "/perfis", label: "Perfis", permission: "roles.view" },
];

export function Layout() {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const links = NAV_LINKS.filter((link) => link.permission === null || hasPermission(link.permission));

  // Trocou de página: a folha do menu fecha sozinha.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div>
      <header className="app-header">
        <div className="app-header-main">
          <button
            type="button"
            className="app-menu-btn"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu"
            aria-haspopup="dialog"
          >
            <MenuIcon size={20} />
          </button>
          <Link to="/eventos" className="app-brand">
            LSPK — Credenciamento
          </Link>
          <nav className="app-nav" aria-label="Navegação principal">
            {links.map((link) => {
              const active = location.pathname.startsWith(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`app-nav-link${active ? " active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="row app-header-user">
          {user ? (
            <span className="muted app-user-name">
              {user.name} · {user.role.name}
            </span>
          ) : null}
          <button className="btn btn-secondary btn-sm" onClick={logout}>
            Sair
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">Copol | LSPK Tecnology</footer>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu">
        {user ? (
          <p className="sheet-note">
            {user.name} · {user.role.name}
          </p>
        ) : null}
        <div className="sheet-group">
          {links.map((link) => {
            const active = location.pathname.startsWith(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`sheet-item${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
                {active ? <CheckIcon size={18} /> : null}
              </Link>
            );
          })}
        </div>
        <div className="sheet-group" style={{ marginTop: 16 }}>
          <button type="button" className="sheet-item danger" onClick={logout}>
            Sair
          </button>
        </div>
      </Sheet>
    </div>
  );
}
