import { useEffect, useState, type FormEvent } from "react";
import * as api from "../api/client";
import { useAuth } from "../auth/AuthContext";

export function UsersPage() {
  const { user: currentUser, hasPermission } = useAuth();
  const [users, setUsers] = useState<api.UserRecord[] | null>(null);
  const [roles, setRoles] = useState<api.RoleRecord[]>([]);
  const [events, setEvents] = useState<api.EventRecord[]>([]);
  const [permissions, setPermissions] = useState<api.PermissionDef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<api.UserRecord | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  function reload() {
    api
      .listUsers()
      .then(setUsers)
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar usuários"));
    api.listRoles().then(setRoles).catch(() => {});
    api.listEvents().then(setEvents).catch(() => {});
    api
      .listPermissions()
      .then((perms) => setPermissions(perms.filter((p) => p.key !== "audit.view")))
      .catch(() => {});
  }

  useEffect(reload, []);

  async function handleToggleActive(u: api.UserRecord) {
    setError(null);
    setBusyUserId(u.id);
    try {
      await api.toggleUserActive(u.id, !u.isActive);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar usuário");
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleDelete(u: api.UserRecord) {
    if (!confirm(`Excluir o usuário "${u.name}"? Essa ação não pode ser desfeita.`)) return;
    setError(null);
    setBusyUserId(u.id);
    try {
      await api.deleteUser(u.id);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir usuário");
    } finally {
      setBusyUserId(null);
    }
  }

  const canCreate = hasPermission("users.create");
  const canEdit = hasPermission("users.edit");
  const canToggle = hasPermission("users.toggle_active");
  const canDelete = hasPermission("users.delete");

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="spread">
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Usuários</h1>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
            Crie e edite usuários, personalize as permissões de acesso e defina os eventos permitidos.
          </p>
        </div>
        {canCreate ? (
          <button
            className="btn"
            onClick={() => {
              setEditing(null);
              setShowForm((v) => !v);
            }}
          >
            {showForm ? "Cancelar" : "+ Novo usuário"}
          </button>
        ) : null}
      </div>

      {showForm ? (
        <UserForm
          roles={roles}
          events={events}
          permissions={permissions}
          onSaved={() => {
            setShowForm(false);
            reload();
          }}
          onCancel={() => setShowForm(false)}
        />
      ) : null}

      {editing ? (
        <UserForm
          roles={roles}
          events={events}
          permissions={permissions}
          user={editing}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      {!users ? (
        <p className="muted">Carregando...</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil & Permissões</th>
                  <th>Eventos Liberados</th>
                  <th>Status</th>
                  <th>Último login</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isRestrito = u.allowedEventIds.length > 0;
                  const allowedEventsList = isRestrito
                    ? u.allowedEventIds.map((id) => events.find((ev) => ev.id === id)?.name ?? "Evento removido")
                    : [];

                  return (
                    <tr key={u.id}>
                      <td>
                        <span style={{ fontWeight: 600 }}>{u.name}</span>
                        {u.id === currentUser?.id ? <span className="muted"> (você)</span> : null}
                      </td>
                      <td className="muted">{u.email}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span>{u.role.name}</span>
                          {u.useCustomPermissions ? (
                            <span
                              className="badge badge-warning"
                              style={{ fontSize: 11 }}
                              title="Permissões personalizadas ativas"
                            >
                              Personalizado ({u.customPermissions?.length ?? 0})
                            </span>
                          ) : (
                            <span
                              className="badge badge-muted"
                              style={{ fontSize: 11 }}
                              title="Usando permissões padrão do perfil"
                            >
                              Padrão do perfil
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {!isRestrito ? (
                          <span className="badge badge-success" style={{ fontSize: 11 }}>
                            Todos os eventos
                          </span>
                        ) : (
                          <div>
                            <span className="badge badge-info" style={{ fontSize: 11 }}>
                              {u.allowedEventIds.length} {u.allowedEventIds.length === 1 ? "evento" : "eventos"}
                            </span>
                            <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }} title={allowedEventsList.join(", ")}>
                              {allowedEventsList.slice(0, 2).join(", ")}
                              {allowedEventsList.length > 2 ? ` (+${allowedEventsList.length - 2})` : ""}
                            </p>
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${u.isActive ? "badge-success" : "badge-muted"}`}>
                          {u.isActive ? "Ativo" : "Desativado"}
                        </span>
                      </td>
                      <td className="muted">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("pt-BR") : "Nunca"}
                      </td>
                      <td>
                        <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                          {canEdit ? (
                            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(u)}>
                              Editar
                            </button>
                          ) : null}
                          {canToggle ? (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleToggleActive(u)}
                              disabled={busyUserId === u.id || u.id === currentUser?.id}
                              title={u.id === currentUser?.id ? "Você não pode desativar sua própria conta" : undefined}
                            >
                              {u.isActive ? "Desativar" : "Ativar"}
                            </button>
                          ) : null}
                          {canDelete ? (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleDelete(u)}
                              disabled={busyUserId === u.id || u.id === currentUser?.id}
                              title={u.id === currentUser?.id ? "Você não pode excluir sua própria conta" : undefined}
                            >
                              Excluir
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function UserForm({
  roles,
  events,
  permissions,
  user,
  onSaved,
  onCancel,
}: {
  roles: api.RoleRecord[];
  events: api.EventRecord[];
  permissions: api.PermissionDef[];
  user?: api.UserRecord;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(user?.role.id ?? roles[0]?.id ?? "");

  // Inicializa permissões: se o usuário já tem customPermissions salvas, usa elas;
  // senão pega as permissões do perfil selecionado.
  const [useCustomPermissions, setUseCustomPermissions] = useState<boolean>(
    user?.useCustomPermissions ?? false
  );

  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(() => {
    if (user?.useCustomPermissions && user.customPermissions) {
      return new Set(user.customPermissions);
    }
    if (user && user.effectivePermissions && Array.isArray(user.effectivePermissions)) {
      return new Set(user.effectivePermissions);
    }
    const currentRole = roles.find((r) => r.id === (user?.role.id ?? roles[0]?.id));
    if (currentRole?.isSystem) {
      return new Set(permissions.map((p) => p.key));
    }
    return new Set(currentRole?.permissionKeys ?? []);
  });

  // Acesso a eventos: vazio = todos os eventos
  const [allowedEventIds, setAllowedEventIds] = useState<string[]>(user?.allowedEventIds ?? []);
  const [restrito, setRestrito] = useState((user?.allowedEventIds.length ?? 0) > 0);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Troca de perfil
  function handleRoleChange(newRoleId: string) {
    setRoleId(newRoleId);
    const targetRole = roles.find((r) => r.id === newRoleId);
    if (!useCustomPermissions && targetRole) {
      if (targetRole.isSystem) {
        setSelectedPermissions(new Set(permissions.map((p) => p.key)));
      } else {
        setSelectedPermissions(new Set(targetRole.permissionKeys));
      }
    }
  }

  function togglePermission(key: string) {
    setUseCustomPermissions(true);
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function handleSelectAllPermissions() {
    setUseCustomPermissions(true);
    setSelectedPermissions(new Set(permissions.map((p) => p.key)));
  }

  function handleDeselectAllPermissions() {
    setUseCustomPermissions(true);
    setSelectedPermissions(new Set());
  }

  function handleResetToRole() {
    const targetRole = roles.find((r) => r.id === roleId);
    if (targetRole) {
      if (targetRole.isSystem) {
        setSelectedPermissions(new Set(permissions.map((p) => p.key)));
      } else {
        setSelectedPermissions(new Set(targetRole.permissionKeys));
      }
    }
    setUseCustomPermissions(false);
  }

  function handleSelectAllEvents() {
    setAllowedEventIds(events.map((e) => e.id));
  }

  function handleDeselectAllEvents() {
    setAllowedEventIds([]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (restrito && allowedEventIds.length === 0) {
      setError("Escolha ao menos um evento liberado, ou selecione a opção de acesso a todos os eventos.");
      return;
    }

    setSaving(true);
    const eventos = restrito ? allowedEventIds : [];
    const customPerms = useCustomPermissions ? Array.from(selectedPermissions) : [];

    try {
      if (user) {
        await api.updateUser(user.id, {
          name,
          email,
          roleId: roleId || undefined,
          password: password || undefined,
          allowedEventIds: eventos,
          customPermissions: customPerms,
          useCustomPermissions,
        });
      } else {
        if (!roleId) {
          setError("Selecione um perfil.");
          setSaving(false);
          return;
        }
        await api.createUser({
          name,
          email,
          password,
          roleId,
          allowedEventIds: eventos,
          customPermissions: customPerms,
          useCustomPermissions,
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar usuário");
    } finally {
      setSaving(false);
    }
  }

  // Agrupamento de permissões por categoria
  const categories = Array.from(new Set(permissions.map((p) => p.category)));

  return (
    <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 900, margin: "0 auto", width: "100%" }}>
      <div className="spread" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>{user ? `Editar Usuário: ${user.name}` : "Novo Usuário"}</h2>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
            Configure os dados cadastrais, personalize as permissões de acesso e selecione os eventos liberados.
          </p>
        </div>
      </div>

      {/* 1. DADOS DE ACESSO */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)", margin: "0 0 12px" }}>
          1. Dados de Acesso
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          <div className="field">
            <label htmlFor="user-name">Nome completo</label>
            <input
              id="user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Ana Silva"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="user-email">E-mail</label>
            <input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ana.silva@exemplo.com"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="user-password">
              {user ? "Nova senha (deixe em branco para manter)" : "Senha de acesso"}
            </label>
            <input
              id="user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required={!user}
              placeholder={user ? "••••••••" : "Mínimo 8 caracteres"}
            />
          </div>

          <div className="field">
            <label htmlFor="user-role">Perfil base</label>
            <select
              id="user-role"
              value={roleId}
              onChange={(e) => handleRoleChange(e.target.value)}
              required
            >
              <option value="" disabled>
                Selecione um perfil...
              </option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.isSystem ? "(Acesso Completo)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. PERMISSÕES DE ACESSO */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          paddingTop: 16,
          marginBottom: 20,
        }}
      >
        <div className="spread" style={{ marginBottom: 10, flexWrap: "wrap", gap: 10 }}>
          <div>
            <h3 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)", margin: 0 }}>
              2. Permissões de Acesso
            </h3>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>
              Edite e selecione exatamente as ações que este usuário poderá executar no sistema.
            </p>
          </div>

          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            {useCustomPermissions ? (
              <span className="badge badge-warning">
                {selectedPermissions.size} de {permissions.length} permissões ativas
              </span>
            ) : (
              <span className="badge badge-muted">
                Herdando do perfil ({selectedPermissions.size} permissões)
              </span>
            )}
          </div>
        </div>

        <div style={{ background: "var(--surface-alt)", padding: "10px 14px", borderRadius: 6, marginBottom: 12 }}>
          <div className="spread" style={{ flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", fontWeight: 600, fontSize: 13, margin: 0 }}>
              <input
                type="checkbox"
                style={{ width: "auto" }}
                checked={useCustomPermissions}
                onChange={(e) => {
                  if (!e.target.checked) {
                    handleResetToRole();
                  } else {
                    setUseCustomPermissions(true);
                  }
                }}
              />
              Personalizar permissões para este usuário
            </label>

            <div className="row" style={{ gap: 6 }}>
              {useCustomPermissions ? (
                <>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleSelectAllPermissions}>
                    Marcar todas
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleDeselectAllPermissions}>
                    Desmarcar todas
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleResetToRole}>
                    Restaurar do perfil
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setUseCustomPermissions(true)}
                >
                  Editar permissões
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Lista de Permissões */}
        <div
          className="stack"
          style={{
            gap: 14,
            maxHeight: 280,
            overflowY: "auto",
            padding: "8px 12px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "rgba(0,0,0,0.1)",
          }}
        >
          {categories.map((category) => {
            const permsInCategory = permissions.filter((p) => p.category === category);
            const selectedCount = permsInCategory.filter((p) => selectedPermissions.has(p.key)).length;

            return (
              <div key={category} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: 10 }}>
                <div className="spread" style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                    {category}
                  </span>
                  <span className="muted" style={{ fontSize: 11 }}>
                    {selectedCount} de {permsInCategory.length} ativas
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 6 }}>
                  {permsInCategory.map((p) => {
                    const isChecked = selectedPermissions.has(p.key);
                    return (
                      <label
                        key={p.key}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                          cursor: "pointer",
                          margin: 0,
                          padding: "6px 8px",
                          borderRadius: 4,
                          background: isChecked ? "rgba(59, 91, 255, 0.08)" : "transparent",
                          border: isChecked ? "1px solid rgba(59, 91, 255, 0.25)" : "1px solid transparent",
                        }}
                      >
                        <input
                          type="checkbox"
                          style={{ width: "auto", marginTop: 3 }}
                          checked={isChecked}
                          onChange={() => togglePermission(p.key)}
                        />
                        <div>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: isChecked ? 600 : 400 }}>
                            {p.description}
                          </p>
                          <span className="muted" style={{ fontSize: 11 }}>
                            {p.key}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. EVENTOS COM ACESSO LIBERADO */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          paddingTop: 16,
          marginBottom: 20,
        }}
      >
        <div className="spread" style={{ marginBottom: 10, flexWrap: "wrap", gap: 10 }}>
          <div>
            <h3 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)", margin: 0 }}>
              3. Eventos com Acesso Liberado
            </h3>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>
              Selecione os eventos que este usuário poderá acessar com base nas permissões concedidas.
            </p>
          </div>

          <span className={`badge ${!restrito ? "badge-success" : "badge-info"}`}>
            {!restrito ? "Todos os eventos liberados" : `${allowedEventIds.length} evento(s) selecionado(s)`}
          </span>
        </div>

        {/* Escolha do escopo de eventos */}
        <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", fontSize: 13 }}>
            <input
              type="radio"
              name="event_scope"
              checked={!restrito}
              onChange={() => setRestrito(false)}
              style={{ width: "auto" }}
            />
            <span>
              <strong>Todos os eventos</strong> <span className="muted">(sem restrições de evento)</span>
            </span>
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", fontSize: 13 }}>
            <input
              type="radio"
              name="event_scope"
              checked={restrito}
              onChange={() => setRestrito(true)}
              style={{ width: "auto" }}
            />
            <span>
              <strong>Eventos específicos</strong> <span className="muted">(liberar apenas os selecionados)</span>
            </span>
          </label>
        </div>

        {restrito ? (
          <div style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 12, background: "rgba(0,0,0,0.1)" }}>
            <div className="spread" style={{ marginBottom: 10 }}>
              <span className="muted" style={{ fontSize: 12 }}>
                Marque abaixo cada evento que o usuário poderá acessar:
              </span>
              <div className="row" style={{ gap: 6 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleSelectAllEvents}>
                  Selecionar todos
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleDeselectAllEvents}>
                  Limpar seleção
                </button>
              </div>
            </div>

            {events.length === 0 ? (
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                Nenhum evento cadastrado no sistema ainda.
              </p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8, maxHeight: 240, overflowY: "auto" }}>
                {events.map((ev) => {
                  const isChecked = allowedEventIds.includes(ev.id);
                  return (
                    <label
                      key={ev.id}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        cursor: "pointer",
                        margin: 0,
                        padding: "8px 10px",
                        borderRadius: 6,
                        background: isChecked ? "rgba(59, 91, 255, 0.1)" : "var(--surface-alt)",
                        border: isChecked ? "1px solid rgba(59, 91, 255, 0.4)" : "1px solid var(--border)",
                      }}
                    >
                      <input
                        type="checkbox"
                        style={{ width: "auto", marginTop: 3 }}
                        checked={isChecked}
                        onChange={(e) =>
                          setAllowedEventIds((ids) =>
                            e.target.checked ? [...ids, ev.id] : ids.filter((id) => id !== ev.id)
                          )
                        }
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: isChecked ? 600 : 400, color: "var(--text)" }}>
                          {ev.name}
                        </p>
                        <div className="row" style={{ gap: 6, marginTop: 4 }}>
                          <span className="muted" style={{ fontSize: 11 }}>
                            {new Date(ev.startDate).toLocaleDateString("pt-BR")}
                          </span>
                          <span className={`badge ${ev.status === "ACTIVE" ? "badge-success" : "badge-muted"}`} style={{ fontSize: 10, padding: "2px 6px" }}>
                            {ev.status === "ACTIVE" ? "Ativo" : "Encerrado"}
                          </span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {error ? <p className="error-text" style={{ margin: "0 0 16px" }}>{error}</p> : null}

      <div className="row" style={{ gap: 10, justifyContent: "flex-end" }}>
        <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Salvando..." : user ? "Salvar alterações" : "Criar usuário"}
        </button>
      </div>
    </form>
  );
}
