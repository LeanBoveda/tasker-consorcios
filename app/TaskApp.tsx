"use client";

import { FormEvent, useMemo, useState } from "react";
import type { TaskItem, WorkspaceData } from "@/db/task-store";
import UserImport from "./UserImport";

const columns: Array<{ key: TaskItem["status"]; label: string; tone: string }> = [
  { key: "pending", label: "Pendientes", tone: "slate" },
  { key: "in_progress", label: "En curso", tone: "blue" },
  { key: "review", label: "En revisión", tone: "amber" },
  { key: "done", label: "Finalizadas", tone: "green" },
];
const priorityLabels = { low: "Baja", medium: "Media", high: "Alta" };

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
function dueLabel(value: string | null) {
  if (!value) return "Sin fecha";
  const today = new Date();
  const due = new Date(`${value}T12:00:00`);
  const difference = Math.round((due.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) / 86400000);
  if (difference === 0) return "Hoy";
  if (difference === 1) return "Mañana";
  if (difference === -1) return "Ayer";
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" }).format(due);
}
function longDate() {
  const value = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function TaskApp({ initialData }: { initialData: WorkspaceData }) {
  const [data, setData] = useState(initialData);
  const [view, setView] = useState<"home" | "mine">("home");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [buildingFilter, setBuildingFilter] = useState("all");
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskStatus, setNewTaskStatus] = useState<TaskItem["status"]>("pending");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [teamOpen, setTeamOpen] = useState(false);
  const [userDraft, setUserDraft] = useState<{ id: string | null; name: string; username: string; role: "admin" | "member"; password: string }>({
    id: null, name: "", username: "", role: "member", password: "",
  });
  const [consortiaOpen, setConsortiaOpen] = useState(false);
  const [consortiumDraft, setConsortiumDraft] = useState<{ id: string | null; name: string; address: string; notes: string }>({
    id: null, name: "", address: "", notes: "",
  });
  const [importOpen, setImportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedTask = data.tasks.find((task) => task.id === selectedTaskId) ?? null;
  const firstName = data.currentUser.name.split(" ")[0];
  const activeTasks = data.tasks.filter((task) => task.status !== "done");
  const delegated = data.tasks.filter((task) =>
    task.creatorId === data.currentUser.id && task.assigneeId && task.assigneeId !== data.currentUser.id && task.status !== "done"
  );
  const completedThisWeek = data.tasks.filter((task) =>
    task.status === "done" && task.updatedAt > Date.now() - 7 * 86400000
  );
  const buildings = useMemo(() =>
    Array.from(new Set([...data.consorcios.map((item) => item.name), ...data.tasks.map((task) => task.building)].filter(Boolean))).sort((a, b) => a.localeCompare(b, "es")),
  [data.consorcios, data.tasks]);
  const visibleTasks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    return data.tasks.filter((task) => {
      if (view === "mine" && task.assigneeId !== data.currentUser.id && !(task.creatorId === data.currentUser.id && !task.assigneeId)) return false;
      if (assigneeFilter !== "all" && task.assigneeId !== assigneeFilter) return false;
      if (buildingFilter !== "all" && task.building !== buildingFilter) return false;
      if (query && !`${task.title} ${task.description} ${task.building}`.toLocaleLowerCase("es").includes(query)) return false;
      return true;
    });
  }, [data, view, assigneeFilter, buildingFilter, search]);

  async function mutate(url: string, method: "POST" | "PATCH" | "DELETE", body: unknown, success: string) {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const payload = await response.json() as WorkspaceData & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo guardar el cambio");
      setData(payload);
      setNotice(success);
      window.setTimeout(() => setNotice(null), 3200);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Ocurrió un error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await mutate("/api/tasks", "POST", {
      title: form.get("title"), description: form.get("description"), consortiumId: form.get("consortiumId") || null,
      priority: form.get("priority"), dueDate: form.get("dueDate") || null,
      assigneeId: form.get("assigneeId") || null, status: newTaskStatus,
    }, "Tarea creada");
    if (ok) { event.currentTarget.reset(); setNewTaskOpen(false); }
  }
  async function updateSelected(input: Record<string, unknown>, success = "Tarea actualizada") {
    if (selectedTask) await mutate(`/api/tasks/${selectedTask.id}`, "PATCH", input, success);
  }
  async function deleteSelected() {
    if (!selectedTask) return;
    const confirmed = window.confirm(`¿Eliminar “${selectedTask.title}”?\n\nLa tarea y todos sus comentarios se borrarán definitivamente.`);
    if (!confirmed) return;
    const ok = await mutate(`/api/tasks/${selectedTask.id}`, "DELETE", undefined, "Tarea eliminada");
    if (ok) setSelectedTaskId(null);
  }
  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTask) return;
    const form = new FormData(event.currentTarget);
    const body = String(form.get("comment") ?? "");
    if (!body.trim()) return;
    const ok = await mutate(`/api/tasks/${selectedTask.id}/comments`, "POST", { body }, "Comentario agregado");
    if (ok) event.currentTarget.reset();
  }
  async function submitConsortium(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = consortiumDraft.id ? `/api/consorcios/${consortiumDraft.id}` : "/api/consorcios";
    const method = consortiumDraft.id ? "PATCH" : "POST";
    const success = consortiumDraft.id ? "Consorcio actualizado" : "Consorcio agregado";
    const ok = await mutate(url, method, {
      name: consortiumDraft.name, address: consortiumDraft.address, notes: consortiumDraft.notes,
    }, success);
    if (ok) setConsortiumDraft({ id: null, name: "", address: "", notes: "" });
  }
  async function removeConsortium(id: string, name: string) {
    const confirmed = window.confirm(`¿Eliminar “${name}” del catálogo?\n\nLas tareas existentes conservarán el nombre del consorcio.`);
    if (!confirmed) return;
    const ok = await mutate(`/api/consorcios/${id}`, "DELETE", undefined, "Consorcio eliminado");
    if (ok && consortiumDraft.id === id) setConsortiumDraft({ id: null, name: "", address: "", notes: "" });
  }
  async function submitUserProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userDraft.id) return;
    const ok = await mutate(`/api/users/${userDraft.id}`, "PATCH", {
      name: userDraft.name, username: userDraft.username, role: userDraft.role, password: userDraft.password,
    }, "Perfil actualizado");
    if (ok) setUserDraft({ id: null, name: "", username: "", role: "member", password: "" });
  }
  async function removeUser(id: string, name: string) {
    if (!window.confirm(`¿Eliminar el perfil de ${name}?\n\nYa no podrá iniciar sesión. Sus tareas y comentarios se conservarán.`)) return;
    const ok = await mutate(`/api/users/${id}`, "DELETE", undefined, "Usuario eliminado");
    if (ok && userDraft.id === id) setUserDraft({ id: null, name: "", username: "", role: "member", password: "" });
  }
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  function openNewTask(status: TaskItem["status"] = "pending") {
    setNewTaskStatus(status);
    setNewTaskOpen(true);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">T</span><span>Tasker</span></div>
        <nav aria-label="Navegación principal">
          <p className="nav-label">ESPACIO DE TRABAJO</p>
          <button className={`nav-item ${view === "home" ? "active" : ""}`} onClick={() => setView("home")}><span aria-hidden="true">⌂</span>Inicio</button>
          <button className={`nav-item ${view === "mine" ? "active" : ""}`} onClick={() => setView("mine")}><span aria-hidden="true">✓</span>Mis tareas<span className="nav-count">{activeTasks.length}</span></button>
          <button className="nav-item" onClick={() => setTeamOpen(true)}><span aria-hidden="true">♙</span>Equipo</button>
          <button className="nav-item" onClick={() => setConsortiaOpen(true)}><span aria-hidden="true">▦</span>Consorcios<span className="nav-count">{data.consorcios.length}</span></button>
          <button className="nav-item" onClick={() => setNotice("La actividad queda registrada dentro de cada tarea.")}><span aria-hidden="true">◷</span>Actividad</button>
        </nav>
        <div className="privacy-note"><span aria-hidden="true">◉</span><div><strong>Espacio privado</strong><small>Solo creador y asignado ven cada tarea.</small></div></div>
        <div className="sidebar-bottom">
          <button className="team-card" onClick={() => setTeamOpen(true)}><span className="status-dot" /><div><strong>Equipo</strong><span>{data.users.length} integrantes registrados</span></div></button>
          <button className="profile-button" onClick={signOut} title="Cerrar sesión"><span className="avatar avatar-owner">{initials(data.currentUser.name)}</span><span><strong>{data.currentUser.name}</strong><small>@{data.currentUser.username} · {data.currentUser.role === "admin" ? "Administrador" : "Integrante"}</small></span><span className="signout-label">Salir</span></button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">{longDate()}</p><h1>Buenos días, {firstName}</h1><p className="subtitle">{activeTasks.length ? `Tenés ${activeTasks.length} tareas activas para organizar.` : "Tu tablero está al día."}</p></div>
          <div className="topbar-actions">
            {searchOpen && <input className="search-input" autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar tarea o consorcio…" aria-label="Buscar" />}
            <button className="icon-button" aria-label="Buscar" onClick={() => setSearchOpen((value) => !value)}>⌕</button>
            <button className="icon-button notification" aria-label="Notificaciones" onClick={() => setNotice("No tenés notificaciones pendientes.")}>♢</button>
            <button className="primary-button" onClick={() => openNewTask()}><span aria-hidden="true">＋</span> Nueva tarea</button>
          </div>
        </header>

        <div className="summary-row">
          <article className="summary-card highlighted"><span className="summary-icon">✓</span><div><strong>{activeTasks.length}</strong><span>Tareas activas visibles</span></div><span className="summary-trend">{activeTasks.filter((task) => dueLabel(task.dueDate) === "Hoy").length} para hoy</span></article>
          <article className="summary-card"><span className="summary-icon blue">♙</span><div><strong>{delegated.length}</strong><span>Delegadas al equipo</span></div><span className="summary-trend neutral">{delegated.filter((task) => task.status === "in_progress").length} en curso</span></article>
          <article className="summary-card"><span className="summary-icon green">◉</span><div><strong>{completedThisWeek.length}</strong><span>Finalizadas esta semana</span></div><span className="summary-trend positive">Al día</span></article>
        </div>

        <div className="board-heading">
          <div><h2>{view === "mine" ? "Mis tareas" : "Tablero de tareas"}</h2><p>{visibleTasks.length} tareas visibles · las privadas no se comparten con el resto del equipo.</p></div>
          <div className="board-actions">
            <select className="filter-button" aria-label="Filtrar por persona" value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}><option value="all">Todas las personas</option>{data.users.map((user) => <option value={user.id} key={user.id}>{user.name}</option>)}</select>
            <select className="filter-button" aria-label="Filtrar por consorcio" value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)}><option value="all">Todos los consorcios</option>{buildings.map((building) => <option value={building} key={building}>{building}</option>)}</select>
            <button className="view-button active" aria-label="Vista de tablero">▥</button>
          </div>
        </div>

        <div className="kanban" aria-label="Tablero de tareas por estado">
          {columns.map((column) => {
            const tasks = visibleTasks.filter((task) => task.status === column.key);
            return (
              <section className="kanban-column" key={column.key}>
                <div className="column-header"><span className={`column-dot ${column.tone}`} /><h3>{column.label}</h3><span className="column-count">{tasks.length}</span></div>
                <div className="task-list">
                  {tasks.map((task) => (
                    <button className="task-card" key={task.id} onClick={() => setSelectedTaskId(task.id)}>
                      <div className="task-topline"><span className={`priority ${priorityLabels[task.priority].toLowerCase()}`}>{priorityLabels[task.priority]}</span><span className={`visibility-pill ${task.assigneeId ? "shared" : ""}`}>{task.assigneeId ? "Compartida" : "Privada"}</span></div>
                      <h4>{task.title}</h4><p><span aria-hidden="true">▦</span>{task.building || "Sin consorcio asociado"}</p>
                      <div className="task-footer"><span className={`due ${dueLabel(task.dueDate) === "Hoy" ? "today" : ""}`}>◷ {dueLabel(task.dueDate)}</span><span className="task-meta"><span aria-hidden="true">♧</span> {task.comments.length}</span><span className="avatar" title={task.assigneeName ?? task.creatorName}>{initials(task.assigneeName ?? task.creatorName)}</span></div>
                    </button>
                  ))}
                  {tasks.length === 0 && <p className="empty-column">No hay tareas en este estado.</p>}
                  <button className="add-task" onClick={() => openNewTask(column.key)}><span aria-hidden="true">＋</span> Agregar tarea</button>
                </div>
              </section>
            );
          })}
        </div>
      </section>

      {newTaskOpen && (
        <div className="modal-backdrop" onMouseDown={() => setNewTaskOpen(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="new-task-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><span className="modal-kicker">NUEVA TAREA</span><h2 id="new-task-title">¿Qué hay que resolver?</h2></div><button className="close-button" onClick={() => setNewTaskOpen(false)} aria-label="Cerrar">×</button></div>
            <form onSubmit={submitTask}>
              <label>Título<input name="title" required autoFocus placeholder="Ej. Coordinar visita del ascensorista" /></label>
              <label>Descripción<textarea name="description" rows={3} placeholder="Agregá contexto, datos del proveedor o próximos pasos…" /></label>
              <div className="form-grid">
                <label>Consorcio<select name="consortiumId" defaultValue=""><option value="">Sin consorcio</option>{data.consorcios.map((item) => <option value={item.id} key={item.id}>{item.name}{item.address ? ` · ${item.address}` : ""}</option>)}</select></label><label>Fecha límite<input name="dueDate" type="date" /></label>
                <label>Prioridad<select name="priority" defaultValue="medium"><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option></select></label>
                <label>Asignar a<select name="assigneeId" defaultValue=""><option value="">Solo para mí</option>{data.users.map((user) => <option value={user.id} key={user.id}>{user.name}</option>)}</select></label>
              </div>
              <div className="privacy-banner"><span aria-hidden="true">●</span><p><strong>Privacidad automática</strong> Si no asignás a nadie, solo vos vas a ver esta tarea. Al asignarla, podrán verla y comentarla las dos personas.</p></div>
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setNewTaskOpen(false)}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? "Guardando…" : "Crear tarea"}</button></div>
            </form>
          </section>
        </div>
      )}

      {selectedTask && (
        <div className="drawer-backdrop" onMouseDown={() => setSelectedTaskId(null)}>
          <aside className="task-drawer" role="dialog" aria-modal="true" aria-labelledby="task-detail-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="drawer-top"><span className={`visibility-pill ${selectedTask.assigneeId ? "shared" : ""}`}>{selectedTask.assigneeId ? "Compartida" : "Privada"}</span><button className="close-button" onClick={() => setSelectedTaskId(null)} aria-label="Cerrar">×</button></div>
            <h2 id="task-detail-title">{selectedTask.title}</h2><p className="drawer-description">{selectedTask.description || "Sin descripción."}</p>
            <div className="detail-grid">
              <label>Estado<select value={selectedTask.status} disabled={saving} onChange={(event) => updateSelected({ status: event.target.value }, "Estado actualizado")}>{columns.map((column) => <option value={column.key} key={column.key}>{column.label}</option>)}</select></label>
              <label>Prioridad<select value={selectedTask.priority} disabled={saving || selectedTask.creatorId !== data.currentUser.id} onChange={(event) => updateSelected({ priority: event.target.value })}><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option></select></label>
              <label>Asignada a<select value={selectedTask.assigneeId ?? ""} disabled={saving || selectedTask.creatorId !== data.currentUser.id} onChange={(event) => updateSelected({ assigneeId: event.target.value || null }, "Asignación actualizada")}><option value="">Solo para mí</option>{data.users.map((user) => <option value={user.id} key={user.id}>{user.name}</option>)}</select></label>
              <label>Consorcio<select value={selectedTask.consortiumId ?? ""} disabled={saving || selectedTask.creatorId !== data.currentUser.id} onChange={(event) => updateSelected({ consortiumId: event.target.value || null }, "Consorcio actualizado")}><option value="">Sin consorcio</option>{data.consorcios.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
              <label>Vencimiento<span className="detail-value">{dueLabel(selectedTask.dueDate)}</span></label>
            </div>
            <div className="task-context"><span>▦</span><div><small>CONSORCIO</small><strong>{selectedTask.building || "Sin consorcio asociado"}</strong></div></div>
            <section className="comments-section">
              <div className="comments-title"><h3>Comentarios</h3><span>{selectedTask.comments.length}</span></div>
              <div className="comments-list">
                {selectedTask.comments.map((comment) => <article className="comment" key={comment.id}><span className="avatar">{initials(comment.authorName)}</span><div><p><strong>{comment.authorName}</strong><time>{new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(comment.createdAt)}</time></p><span>{comment.body}</span></div></article>)}
                {selectedTask.comments.length === 0 && <p className="no-comments">Todavía no hay comentarios. Dejá el primero para mantener el seguimiento.</p>}
              </div>
              <form className="comment-form" onSubmit={submitComment}><textarea name="comment" rows={2} placeholder="Escribí una actualización…" /><button className="primary-button" disabled={saving}>Comentar</button></form>
            </section>
            {(selectedTask.creatorId === data.currentUser.id || data.currentUser.role === "admin") && (
              <div className="delete-task-zone">
                <div><strong>¿Es una tarea finalizada o de prueba?</strong><span>Podés eliminarla junto con todos sus comentarios.</span></div>
                <button className="danger-button" disabled={saving} onClick={deleteSelected}>{saving ? "Eliminando…" : "Eliminar tarea"}</button>
              </div>
            )}
          </aside>
        </div>
      )}

      {teamOpen && (
        <div className="modal-backdrop" onMouseDown={() => setTeamOpen(false)}>
          <section className="modal team-modal" role="dialog" aria-modal="true" aria-labelledby="team-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><span className="modal-kicker">EQUIPO</span><h2 id="team-title">Personas de la administración</h2></div><button className="close-button" onClick={() => setTeamOpen(false)} aria-label="Cerrar">×</button></div>
            <div className="team-list">{data.users.map((user) => <article className="team-row" key={user.id}><span className="avatar avatar-owner">{initials(user.name)}</span><div><strong>{user.name}</strong><span>@{user.username}</span></div><div className="team-row-actions"><span className={`member-status ${user.status}`}>{user.role === "admin" ? "Administrador" : "Usuario"}</span>{data.currentUser.role === "admin" && <><button className="row-button" onClick={() => setUserDraft({ id: user.id, name: user.name, username: user.username, role: user.role, password: "" })}>Editar</button>{user.id !== data.currentUser.id && <button className="row-button danger" onClick={() => removeUser(user.id, user.name)}>Eliminar</button>}</>}</div></article>)}</div>
            <p className="team-help">Podés editar o eliminar perfiles desde este panel. Usá el Excel cuando necesites crear o actualizar varios usuarios juntos.</p>
            {data.currentUser.role === "admin" && <div className="modal-actions"><button className="primary-button" onClick={() => setImportOpen(true)}>▦ Importar Excel</button></div>}
          </section>
        </div>
      )}

      {userDraft.id && (
        <div className="modal-backdrop elevated" onMouseDown={() => setUserDraft({ id: null, name: "", username: "", role: "member", password: "" })}>
          <section className="modal compact-modal profile-edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-user-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><span className="modal-kicker">EDITAR PERFIL</span><h2 id="edit-user-title">Datos del usuario</h2></div><button className="close-button" onClick={() => setUserDraft({ id: null, name: "", username: "", role: "member", password: "" })} aria-label="Cerrar">×</button></div>
            <form onSubmit={submitUserProfile}>
              <label>Nombre<input required autoFocus value={userDraft.name} onChange={(event) => setUserDraft((draft) => ({ ...draft, name: event.target.value }))} /></label>
              <label>Usuario<input required value={userDraft.username} onChange={(event) => setUserDraft((draft) => ({ ...draft, username: event.target.value }))} /></label>
              <label>Rol<select value={userDraft.role} onChange={(event) => setUserDraft((draft) => ({ ...draft, role: event.target.value as "admin" | "member" }))}><option value="member">Usuario</option><option value="admin">Administrador</option></select></label>
              <label>Nueva contraseña<input type="text" value={userDraft.password} onChange={(event) => setUserDraft((draft) => ({ ...draft, password: event.target.value }))} placeholder="Dejar vacío para mantener la actual" /></label>
              <p className="profile-edit-help">Si no escribís una contraseña nueva, la contraseña actual no cambia.</p>
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setUserDraft({ id: null, name: "", username: "", role: "member", password: "" })}>Cancelar</button><button className="primary-button" disabled={saving}><span aria-hidden="true">✓</span>{saving ? "Guardando…" : "Guardar cambios"}</button></div>
            </form>
          </section>
        </div>
      )}

      {consortiaOpen && (
        <div className="modal-backdrop" onMouseDown={() => setConsortiaOpen(false)}>
          <section className="modal consortia-modal" role="dialog" aria-modal="true" aria-labelledby="consortia-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><span className="modal-kicker">CATÁLOGO</span><h2 id="consortia-title">Consorcios administrados</h2></div><button className="close-button" onClick={() => setConsortiaOpen(false)} aria-label="Cerrar">×</button></div>
            {data.currentUser.role === "admin" && (
              <form className="consortium-form" onSubmit={submitConsortium}>
                <div className="consortium-form-grid">
                  <label>Nombre<input required value={consortiumDraft.name} onChange={(event) => setConsortiumDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder="Ej. Consorcio Rivadavia 1234" /></label>
                  <label>Dirección<input value={consortiumDraft.address} onChange={(event) => setConsortiumDraft((draft) => ({ ...draft, address: event.target.value }))} placeholder="Ej. Av. Rivadavia 1234" /></label>
                </div>
                <label>Notas<textarea rows={2} value={consortiumDraft.notes} onChange={(event) => setConsortiumDraft((draft) => ({ ...draft, notes: event.target.value }))} placeholder="Datos útiles o referencias internas…" /></label>
                <div className="modal-actions">
                  {consortiumDraft.id && <button type="button" className="secondary-button" onClick={() => setConsortiumDraft({ id: null, name: "", address: "", notes: "" })}>Cancelar edición</button>}
                  <button className="primary-button" disabled={saving}><span aria-hidden="true">{consortiumDraft.id ? "✓" : "＋"}</span>{saving ? "Guardando…" : consortiumDraft.id ? "Guardar cambios" : "Agregar consorcio"}</button>
                </div>
              </form>
            )}
            <div className="consortium-list">
              {data.consorcios.map((item) => (
                <article className="consortium-row" key={item.id}>
                  <span className="consortium-icon" aria-hidden="true">▦</span>
                  <div><strong>{item.name}</strong><span>{item.address || "Sin dirección cargada"}</span>{item.notes && <small>{item.notes}</small>}</div>
                  {data.currentUser.role === "admin" && <div className="consortium-actions"><button className="row-button" onClick={() => setConsortiumDraft({ id: item.id, name: item.name, address: item.address, notes: item.notes })}>Editar</button><button className="row-button danger" onClick={() => removeConsortium(item.id, item.name)}>Eliminar</button></div>}
                </article>
              ))}
              {data.consorcios.length === 0 && <p className="empty-consortia">Todavía no hay consorcios. Agregá el primero para poder seleccionarlo en las tareas.</p>}
            </div>
          </section>
        </div>
      )}

      {importOpen && <UserImport onClose={() => setImportOpen(false)} onImported={(workspace) => { setData(workspace); setNotice("Usuarios importados"); }} />}
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
