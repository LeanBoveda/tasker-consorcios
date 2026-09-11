"use client";

import { DragEvent, FormEvent, useMemo, useRef, useState } from "react";
import type { TaskItem, WorkspaceData } from "@/db/task-store";
import UserImport from "./UserImport";
import ActivityLog from "./ActivityLog";

const columns: Array<{ key: TaskItem["status"]; label: string; tone: string }> = [
  { key: "pending", label: "Pendientes", tone: "slate" },
  { key: "in_progress", label: "En curso", tone: "blue" },
  { key: "review", label: "En revisión", tone: "amber" },
  { key: "done", label: "Finalizadas", tone: "green" },
];
const priorityLabels = { low: "Baja", medium: "Media", high: "Alta" };
const intakeKindLabels = { claim: "Reclamo", request: "Solicitud", order: "Pedido", notice: "Aviso", other: "Otro" };
const intakeStatusLabels = { pending: "Por revisar", accepted: "Confirmado", discarded: "Descartado", error: "Con error" };
type TaskEditDraft = {
  title: string;
  description: string;
  status: TaskItem["status"];
  priority: TaskItem["priority"];
  consortiumId: string;
  assigneeId: string;
  dueDate: string;
};

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
function dateTimeLabel(value: number) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
function fileSizeLabel(value: number | null) {
  if (value === null) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TaskApp({ initialData }: { initialData: WorkspaceData }) {
  const [data, setData] = useState(initialData);
  const [view, setView] = useState<"home" | "mine" | "intake" | "daemon" | "activity">("home");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [buildingFilter, setBuildingFilter] = useState("all");
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskStatus, setNewTaskStatus] = useState<TaskItem["status"]>("pending");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskEditDraft, setTaskEditDraft] = useState<TaskEditDraft | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTargetStatus, setDropTargetStatus] = useState<TaskItem["status"] | null>(null);
  const [trashDropActive, setTrashDropActive] = useState(false);
  const suppressTaskClick = useRef(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [userDraft, setUserDraft] = useState<{ id: string | null; name: string; username: string; role: "admin" | "member"; password: string }>({
    id: null, name: "", username: "", role: "member", password: "",
  });
  const [consortiaOpen, setConsortiaOpen] = useState(false);
  const [consortiumDraft, setConsortiumDraft] = useState<{ id: string | null; name: string; address: string; notes: string }>({
    id: null, name: "", address: "", notes: "",
  });
  const [importOpen, setImportOpen] = useState(false);
  const [intakeTestOpen, setIntakeTestOpen] = useState(false);
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
  const pendingIntake = data.intakeItems.filter((item) => item.status === "pending" || item.status === "error");
  const isTaskView = view === "home" || view === "mine";
  const isAdmin = data.currentUser.role === "admin";
  const isTestWorkspace = data.currentUser.workspaceId === "test";
  const connectedDaemons = data.daemons.filter((daemon) => daemon.status !== "offline" && daemon.status !== "error");
  const pageHeader = view === "activity"
    ? { eyebrow: "HISTORIAL", title: "Actividad del equipo", subtitle: "Quién hizo cada cambio, cuándo y sobre qué registro." }
    : view === "intake"
    ? { eyebrow: "CENTRO DE INGRESOS", title: "Ingresos automáticos", subtitle: "Revisá lo que reciba el demonio antes de incorporarlo al trabajo diario." }
    : view === "daemon"
      ? { eyebrow: "CONEXIONES", title: "Estado del demonio", subtitle: "Controlá la computadora receptora y cada fuente vinculada." }
      : { eyebrow: longDate(), title: `Buenos días, ${firstName}`, subtitle: activeTasks.length ? `Tenés ${activeTasks.length} tareas activas para organizar.` : "Tu tablero está al día." };
  const draggedTask = data.tasks.find((task) => task.id === draggedTaskId) ?? null;
  const canDeleteDraggedTask = Boolean(draggedTask && (isAdmin || draggedTask.creatorId === data.currentUser.id));
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

  function startTaskDrag(event: DragEvent<HTMLButtonElement>, task: TaskItem) {
    if (saving) {
      event.preventDefault();
      return;
    }
    suppressTaskClick.current = true;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/task-id", task.id);
    setDraggedTaskId(task.id);
  }

  function finishTaskDrag() {
    setDraggedTaskId(null);
    setDropTargetStatus(null);
    setTrashDropActive(false);
    window.setTimeout(() => { suppressTaskClick.current = false; }, 0);
  }

  function allowTaskDrop(event: DragEvent<HTMLElement>, status: TaskItem["status"]) {
    if (!draggedTaskId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setTrashDropActive(false);
    if (dropTargetStatus !== status) setDropTargetStatus(status);
  }

  async function dropTask(event: DragEvent<HTMLElement>, status: TaskItem["status"]) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/task-id") || draggedTaskId;
    setDraggedTaskId(null);
    setDropTargetStatus(null);
    setTrashDropActive(false);
    window.setTimeout(() => { suppressTaskClick.current = false; }, 0);
    if (!taskId) return;
    const task = data.tasks.find((item) => item.id === taskId);
    if (!task || task.status === status) return;

    const previousData = data;
    const nextLabel = columns.find((column) => column.key === status)?.label ?? "la nueva columna";
    setSaving(true);
    setNotice(null);
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((item) => item.id === taskId
        ? { ...item, status, updatedAt: Date.now() }
        : item),
    }));
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json() as WorkspaceData & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo mover la tarea");
      setData(payload);
      setNotice(`Tarea movida a ${nextLabel}`);
      window.setTimeout(() => setNotice(null), 3200);
    } catch (error) {
      setData(previousData);
      setNotice(error instanceof Error ? error.message : "No se pudo mover la tarea");
    } finally {
      setSaving(false);
    }
  }

  function allowTrashDrop(event: DragEvent<HTMLDivElement>) {
    if (!canDeleteDraggedTask) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetStatus(null);
    setTrashDropActive(true);
  }

  async function dropTaskInTrash(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/task-id") || draggedTaskId;
    const task = data.tasks.find((item) => item.id === taskId);
    setDraggedTaskId(null);
    setDropTargetStatus(null);
    setTrashDropActive(false);
    window.setTimeout(() => { suppressTaskClick.current = false; }, 0);
    if (!task || (!isAdmin && task.creatorId !== data.currentUser.id)) return;

    const confirmed = window.confirm(`¿Enviar “${task.title}” al tacho?\n\nLa tarea y todos sus comentarios se borrarán definitivamente.`);
    if (!confirmed) return;
    const ok = await mutate(`/api/tasks/${task.id}`, "DELETE", undefined, "Tarea eliminada");
    if (ok && selectedTaskId === task.id) setSelectedTaskId(null);
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
  async function submitIntakeTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const source = String(form.get("source") ?? "whatsapp");
    const ok = await mutate("/api/intake/test", "POST", {
      source,
      sourceAccount: form.get("sourceAccount"),
      senderName: form.get("senderName"),
      senderAddress: form.get("senderAddress"),
      title: form.get("title"),
      body: form.get("body"),
      consortiumId: form.get("consortiumId") || null,
    }, "Ingreso recibido: tarea creada en revisión");
    if (ok) { event.currentTarget.reset(); setIntakeTestOpen(false); setView("intake"); }
  }
  async function reviewIntake(item: WorkspaceData["intakeItems"][number], action: "accept" | "discard") {
    if (action === "discard") {
      const confirmed = window.confirm(`¿Descartar “${item.title}”?\n\nLa tarea automática relacionada se eliminará, pero el ingreso quedará registrado.`);
      if (!confirmed) return;
    }
    await mutate(`/api/intake/${item.id}`, "PATCH", { action }, action === "accept" ? "Ingreso confirmado y tarea enviada a Pendientes" : "Ingreso descartado");
  }
  function openIntakeTask(item: WorkspaceData["intakeItems"][number]) {
    if (!item.taskId) return;
    setView("home");
    setSelectedTaskId(item.taskId);
  }
  async function updateSelected(input: Record<string, unknown>, success = "Tarea actualizada") {
    if (selectedTask) await mutate(`/api/tasks/${selectedTask.id}`, "PATCH", input, success);
  }
  function openTaskEditor(task: TaskItem) {
    setTaskEditDraft({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      consortiumId: task.consortiumId ?? "",
      assigneeId: task.assigneeId ?? "",
      dueDate: task.dueDate ?? "",
    });
  }
  async function submitTaskEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTask || !taskEditDraft) return;
    const ok = await mutate(`/api/tasks/${selectedTask.id}`, "PATCH", {
      title: taskEditDraft.title,
      description: taskEditDraft.description,
      status: taskEditDraft.status,
      priority: taskEditDraft.priority,
      consortiumId: taskEditDraft.consortiumId || null,
      assigneeId: taskEditDraft.assigneeId || null,
      dueDate: taskEditDraft.dueDate || null,
    }, "Tarea actualizada");
    if (ok) setTaskEditDraft(null);
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
          {data.currentUser.role === "admin" && <button className={`nav-item ${view === "intake" ? "active" : ""}`} onClick={() => setView("intake")}><span aria-hidden="true">⇥</span>Ingresos<span className="nav-count">{pendingIntake.length}</span></button>}
          {isAdmin && !isTestWorkspace && <button className={`nav-item ${view === "daemon" ? "active" : ""}`} onClick={() => setView("daemon")}><span aria-hidden="true">◉</span>Demonio<span className={`nav-count ${connectedDaemons.length ? "connected" : ""}`}>{connectedDaemons.length}</span></button>}
          <button className="nav-item" onClick={() => setTeamOpen(true)}><span aria-hidden="true">♙</span>Equipo</button>
          <button className="nav-item" onClick={() => setConsortiaOpen(true)}><span aria-hidden="true">▦</span>Consorcios<span className="nav-count">{data.consorcios.length}</span></button>
          {isAdmin && <button className={`nav-item ${view === "activity" ? "active" : ""}`} onClick={() => setView("activity")}><span aria-hidden="true">◷</span>Actividad</button>}
        </nav>
        <div className="privacy-note"><span aria-hidden="true">◉</span><div><strong>{isTestWorkspace ? "Espacio de prueba" : "Espacio privado"}</strong><small>{isTestWorkspace ? "Separado de la administración real." : "Las tareas son visibles para su creador, asignado y administradores de este espacio."}</small></div></div>
        <div className="sidebar-bottom">
          <button className="team-card" onClick={() => setTeamOpen(true)}><span className="status-dot" /><div><strong>Equipo</strong><span>{data.users.length} integrantes registrados</span></div></button>
          <button className="profile-button" onClick={signOut} title="Cerrar sesión"><span className="avatar avatar-owner">{initials(data.currentUser.name)}</span><span><strong>{data.currentUser.name}</strong><small>@{data.currentUser.username} · {data.currentUser.role === "admin" ? "Administrador" : "Integrante"}</small></span><span className="signout-label">Salir</span></button>
        </div>
      </aside>

      <section className="workspace">
        {isTestWorkspace && <aside className="test-workspace-banner" role="note"><strong>Modo de prueba</strong><span>Usuarios, consorcios, tareas e ingresos independientes. Nada de este espacio modifica los datos de la administración.</span></aside>}
        <header className="topbar">
          <div>
            <p className="eyebrow">{pageHeader.eyebrow}</p>
            <h1>{pageHeader.title}</h1>
            <p className="subtitle">{pageHeader.subtitle}</p>
          </div>
          <div className="topbar-actions">
            {isTaskView && searchOpen && <input className="search-input" autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar tarea o consorcio…" aria-label="Buscar" />}
            {isTaskView && <button className="icon-button" aria-label="Buscar" onClick={() => setSearchOpen((value) => !value)}>⌕</button>}
            <button className="icon-button notification" aria-label="Notificaciones" onClick={() => setNotice("No tenés notificaciones pendientes.")}>♢</button>
            {view === "intake" && data.currentUser.role === "admin"
              ? <button className="primary-button" onClick={() => setIntakeTestOpen(true)}><span aria-hidden="true">＋</span> Simular ingreso</button>
              : view === "daemon"
                ? <button className="secondary-button" onClick={() => window.location.reload()}>↻ Actualizar</button>
                : isTaskView ? <button className="primary-button" onClick={() => openNewTask()}><span aria-hidden="true">＋</span> Nueva tarea</button> : null}
          </div>
        </header>

        {isTaskView ? <>
        <div className="summary-row">
          <article className="summary-card highlighted"><span className="summary-icon">✓</span><div><strong>{activeTasks.length}</strong><span>Tareas activas visibles</span></div><span className="summary-trend">{activeTasks.filter((task) => dueLabel(task.dueDate) === "Hoy").length} para hoy</span></article>
          <article className="summary-card"><span className="summary-icon blue">♙</span><div><strong>{delegated.length}</strong><span>Delegadas al equipo</span></div><span className="summary-trend neutral">{delegated.filter((task) => task.status === "in_progress").length} en curso</span></article>
          <article className="summary-card"><span className="summary-icon green">◉</span><div><strong>{completedThisWeek.length}</strong><span>Finalizadas esta semana</span></div><span className="summary-trend positive">Al día</span></article>
        </div>

        <div className="board-heading">
          <div><h2>{view === "mine" ? "Mis tareas" : "Tablero de tareas"}</h2><p>{visibleTasks.length} tareas visibles · Arrastrá una tarjeta para cambiar su estado o llevarla al tacho. En celular, abrila para realizar estas acciones.</p></div>
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
              <section
                className={`kanban-column ${dropTargetStatus === column.key ? "drop-target" : ""}`}
                key={column.key}
                onDragEnter={(event) => allowTaskDrop(event, column.key)}
                onDragOver={(event) => allowTaskDrop(event, column.key)}
                onDrop={(event) => void dropTask(event, column.key)}
              >
                <div className="column-header"><span className={`column-dot ${column.tone}`} /><h3>{column.label}</h3><span className="column-count">{tasks.length}</span>{draggedTaskId && <span className="drop-indicator">{dropTargetStatus === column.key ? "Soltar aquí" : "Mover aquí"}</span>}</div>
                <div className="task-list">
                  {tasks.map((task) => (
                    <button
                      className={`task-card ${draggedTaskId === task.id ? "dragging" : ""}`}
                      key={task.id}
                      draggable={!saving}
                      onDragStart={(event) => startTaskDrag(event, task)}
                      onDragEnd={finishTaskDrag}
                      onClick={() => { if (!suppressTaskClick.current) setSelectedTaskId(task.id); }}
                      title="Arrastrá para cambiar el estado o hacé clic para abrir"
                      aria-label={`${task.title}. Estado: ${columns.find((item) => item.key === task.status)?.label}. Abrir detalle`}
                    >
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
        {draggedTaskId && canDeleteDraggedTask && (
          <div
            className={`task-trash-drop ${trashDropActive ? "active" : ""}`}
            onDragEnter={allowTrashDrop}
            onDragOver={allowTrashDrop}
            onDrop={(event) => void dropTaskInTrash(event)}
            aria-label="Tacho para eliminar la tarea"
          >
            <span className="trash-icon" aria-hidden="true">🗑</span>
            <div><strong>{trashDropActive ? "Soltá para eliminar" : "Llevar al tacho"}</strong><small>Se pedirá confirmación</small></div>
          </div>
        )}
        </> : view === "intake" ? (
          <div className="intake-view">
            <section className="intake-ready-banner">
              <div className="intake-ready-icon" aria-hidden="true">⇥</div>
              <div>
                <span className="modal-kicker">RECEPTOR PREPARADO</span>
                <h2>Tasker ya puede recibir correo y WhatsApp</h2>
                <p>El demonio enviará cada mensaje por un canal seguro. Tasker evitará duplicados, buscará el consorcio y dejará la tarea en revisión.</p>
              </div>
              <div className="intake-ready-steps" aria-label="Flujo automático">
                <span><strong>1</strong> Recibir</span><span><strong>2</strong> Analizar</span><span><strong>3</strong> Revisar</span>
              </div>
            </section>

            <div className="intake-summary">
              <article><strong>{pendingIntake.length}</strong><span>Esperando revisión</span></article>
              <article><strong>{data.intakeItems.filter((item) => item.status === "accepted").length}</strong><span>Confirmados</span></article>
              <article><strong>{new Set(data.intakeItems.map((item) => `${item.source}:${item.sourceAccount}`)).size}</strong><span>Fuentes detectadas</span></article>
            </div>

            <div className="intake-heading">
              <div><h2>Bandeja del demonio</h2><p>Confirmá los ingresos correctos o descartá el ruido. Las tareas nuevas comienzan en la columna En revisión.</p></div>
              <button className="secondary-button" onClick={() => window.location.reload()}>↻ Actualizar</button>
            </div>

            <div className="intake-list">
              {data.intakeItems.map((item) => (
                <article className={`intake-card ${item.status}`} key={item.id}>
                  <div className="intake-card-source">
                    <span className={`intake-source-icon ${item.source}`} aria-hidden="true">{item.source === "email" ? "✉" : "◉"}</span>
                    <div><strong>{item.source === "email" ? "Correo" : "WhatsApp"}</strong><span>{item.sourceAccount}</span></div>
                  </div>
                  <div className="intake-card-content">
                    <div className="intake-badges">
                      <span className={`intake-status ${item.status}`}>{intakeStatusLabels[item.status]}</span>
                      <span className="intake-kind">{intakeKindLabels[item.kind]}</span>
                      <span className={`priority ${priorityLabels[item.priority].toLowerCase()}`}>{priorityLabels[item.priority]}</span>
                      {item.isTest && <span className="intake-test-badge">Prueba</span>}
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.body || "Sin texto adicional."}</p>
                    <div className="intake-meta">
                      <span>De: <strong>{item.senderName}</strong>{item.senderAddress ? ` · ${item.senderAddress}` : ""}</span>
                      <span>▦ {item.consortiumName || "Sin consorcio"}</span>
                      <span>◷ {dateTimeLabel(item.receivedAt)}</span>
                    </div>
                    {item.attachments.length > 0 && <div className="intake-attachments">{item.attachments.map((attachment, index) => <span key={`${attachment.name}-${index}`}>▱ {attachment.name}{attachment.size !== null ? ` · ${fileSizeLabel(attachment.size)}` : ""}</span>)}</div>}
                    {item.errorDetail && <p className="intake-error-detail">{item.errorDetail}</p>}
                    {item.reviewedAt && <p className="intake-reviewed">Revisado por {item.reviewedByName || "Administrador"} · {dateTimeLabel(item.reviewedAt)}</p>}
                  </div>
                  <div className="intake-card-actions">
                    {item.taskId && <button className="row-button" onClick={() => openIntakeTask(item)}>Abrir tarea</button>}
                    {(item.status === "pending" || item.status === "error") && <button className="row-button confirm" disabled={saving} onClick={() => void reviewIntake(item, "accept")}>Confirmar</button>}
                    {(item.status === "pending" || item.status === "error") && <button className="row-button danger" disabled={saving} onClick={() => void reviewIntake(item, "discard")}>Descartar</button>}
                  </div>
                </article>
              ))}
              {data.intakeItems.length === 0 && <div className="intake-empty"><span aria-hidden="true">⇥</span><h3>El receptor está listo</h3><p>Realizá una simulación para comprobar el circuito antes de conectar el demonio.</p><button className="secondary-button" onClick={() => setIntakeTestOpen(true)}>Simular primer ingreso</button></div>}
            </div>
          </div>
        ) : view === "daemon" ? (
          <div className="daemon-view">
            <section className={`daemon-overview ${connectedDaemons.length ? "online" : "offline"}`}>
              <span className="daemon-overview-icon" aria-hidden="true">{connectedDaemons.length ? "●" : "○"}</span>
              <div>
                <span className="modal-kicker">ESTADO GENERAL</span>
                <h2>{connectedDaemons.length ? "Demonio conectado" : "Esperando la primera conexión"}</h2>
                <p>{connectedDaemons.length
                  ? "La computadora de la administración está informando su estado correctamente."
                  : "Cuando instales y vincules el demonio, su computadora y sus fuentes aparecerán acá."}</p>
              </div>
            </section>

            <div className="daemon-list">
              {data.daemons.map((daemon) => (
                <article className="daemon-card" key={daemon.id}>
                  <div className="daemon-card-head">
                    <div><span className={`daemon-status-dot ${daemon.status}`} /><div><h3>{daemon.name}</h3><p>{daemon.hostName || "Computadora sin identificar"} · versión {daemon.version || "sin informar"}</p></div></div>
                    <span className={`daemon-status-pill ${daemon.status}`}>{daemon.status === "online" ? "Conectado" : daemon.status === "degraded" ? "Con advertencias" : daemon.status === "error" ? "Con error" : "Sin conexión"}</span>
                  </div>
                  <div className="daemon-meta"><span>Última señal: <strong>{dateTimeLabel(daemon.lastHeartbeatAt)}</strong></span><span>Inicio: {dateTimeLabel(daemon.startedAt)}</span></div>
                  {daemon.lastError && <p className="daemon-error">{daemon.lastError}</p>}
                  <div className="daemon-source-list">
                    {daemon.sources.map((source) => (
                      <div className="daemon-source-row" key={source.id}>
                        <span className={`daemon-source-icon ${source.kind}`} aria-hidden="true">{source.kind === "email" ? "✉" : "◉"}</span>
                        <div><strong>{source.displayName || (source.kind === "email" ? "Correo central" : "WhatsApp")}</strong><span>{source.account}</span></div>
                        <div className="daemon-source-times"><span>Revisado {dateTimeLabel(source.lastCheckedAt)}</span>{source.lastMessageAt && <small>Último mensaje {dateTimeLabel(source.lastMessageAt)}</small>}</div>
                        <span className={`daemon-source-status ${source.status}`}>{source.status === "connected" ? "Conectado" : source.status === "degraded" ? "Advertencia" : source.status === "disabled" ? "Desactivado" : "Desconectado"}</span>
                        {source.lastError && <p>{source.lastError}</p>}
                      </div>
                    ))}
                    {daemon.sources.length === 0 && <p className="daemon-empty-sources">El demonio todavía no informó fuentes configuradas.</p>}
                  </div>
                </article>
              ))}
              {data.daemons.length === 0 && (
                <div className="daemon-empty">
                  <span aria-hidden="true">◉</span><h3>El receptor todavía no fue instalado</h3>
                  <p>La primera versión comienza con la casilla central de Gmail. Solo procesará mensajes nuevos desde su activación.</p>
                </div>
              )}
            </div>
          </div>
        ) : view === "activity" && isAdmin ? <ActivityLog users={data.users} /> : null}
      </section>

      {newTaskOpen && (
        <div className="modal-backdrop" onMouseDown={() => setNewTaskOpen(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="new-task-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><span className="modal-kicker">NUEVA TAREA</span><h2 id="new-task-title">¿Qué hay que resolver?</h2></div><button className="close-button" onClick={() => setNewTaskOpen(false)} aria-label="Cerrar">×</button></div>
            <form onSubmit={submitTask}>
              <label>Título<input name="title" required autoFocus maxLength={500} placeholder="Ej. Coordinar visita del ascensorista" /></label>
              <label>Descripción<textarea name="description" rows={3} maxLength={20000} placeholder="Agregá contexto, datos del proveedor o próximos pasos…" /></label>
              <div className="form-grid">
                <label>Consorcio<select name="consortiumId" defaultValue=""><option value="">Sin consorcio</option>{data.consorcios.map((item) => <option value={item.id} key={item.id}>{item.name}{item.address ? ` · ${item.address}` : ""}</option>)}</select></label><label>Fecha límite<input name="dueDate" type="date" /></label>
                <label>Prioridad<select name="priority" defaultValue="medium"><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option></select></label>
                <label>Asignar a<select name="assigneeId" defaultValue=""><option value="">Solo para mí</option>{data.users.map((user) => <option value={user.id} key={user.id}>{user.name}</option>)}</select></label>
              </div>
              <div className="privacy-banner"><span aria-hidden="true">●</span><p><strong>Privacidad automática</strong> Si no asignás a nadie, solo vos y los administradores de este espacio podrán ver esta tarea. Al asignarla, también podrá verla y comentarla la persona elegida.</p></div>
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setNewTaskOpen(false)}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? "Guardando…" : "Crear tarea"}</button></div>
            </form>
          </section>
        </div>
      )}

      {selectedTask && (
        <div className="drawer-backdrop" onMouseDown={() => { setSelectedTaskId(null); setTaskEditDraft(null); }}>
          <aside className="task-drawer" role="dialog" aria-modal="true" aria-labelledby="task-detail-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="drawer-top"><span className={`visibility-pill ${selectedTask.assigneeId ? "shared" : ""}`}>{selectedTask.assigneeId ? "Compartida" : "Privada"}</span><div className="drawer-actions">{(selectedTask.creatorId === data.currentUser.id || isAdmin) && <button className="row-button" onClick={() => openTaskEditor(selectedTask)}>Editar tarea</button>}<button className="close-button" onClick={() => { setSelectedTaskId(null); setTaskEditDraft(null); }} aria-label="Cerrar">×</button></div></div>
            <h2 id="task-detail-title">{selectedTask.title}</h2><p className="drawer-description">{selectedTask.description || "Sin descripción."}</p>
            <div className="detail-grid">
              <label>Estado<select value={selectedTask.status} disabled={saving} onChange={(event) => updateSelected({ status: event.target.value }, "Estado actualizado")}>{columns.map((column) => <option value={column.key} key={column.key}>{column.label}</option>)}</select></label>
              <label>Prioridad<select value={selectedTask.priority} disabled={saving || (selectedTask.creatorId !== data.currentUser.id && !isAdmin)} onChange={(event) => updateSelected({ priority: event.target.value })}><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option></select></label>
              <label>Asignada a<select value={selectedTask.assigneeId ?? ""} disabled={saving || (selectedTask.creatorId !== data.currentUser.id && !isAdmin)} onChange={(event) => updateSelected({ assigneeId: event.target.value || null }, "Asignación actualizada")}><option value="">Solo para mí</option>{data.users.map((user) => <option value={user.id} key={user.id}>{user.name}</option>)}</select></label>
              <label>Consorcio<select value={selectedTask.consortiumId ?? ""} disabled={saving || (selectedTask.creatorId !== data.currentUser.id && !isAdmin)} onChange={(event) => updateSelected({ consortiumId: event.target.value || null }, "Consorcio actualizado")}><option value="">Sin consorcio</option>{data.consorcios.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
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

      {selectedTask && taskEditDraft && (
        <div className="modal-backdrop elevated" onMouseDown={() => setTaskEditDraft(null)}>
          <section className="modal task-edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-task-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><span className="modal-kicker">EDITAR TAREA</span><h2 id="edit-task-title">Actualizar todos los datos</h2></div><button className="close-button" onClick={() => setTaskEditDraft(null)} aria-label="Cerrar">×</button></div>
            <form onSubmit={submitTaskEdit}>
              <label>Título<input required autoFocus maxLength={500} value={taskEditDraft.title} onChange={(event) => setTaskEditDraft({ ...taskEditDraft, title: event.target.value })} /></label>
              <label>Descripción<textarea rows={5} maxLength={20000} value={taskEditDraft.description} onChange={(event) => setTaskEditDraft({ ...taskEditDraft, description: event.target.value })} placeholder="Contexto, datos del proveedor o próximos pasos…" /></label>
              <div className="form-grid">
                <label>Estado<select value={taskEditDraft.status} onChange={(event) => setTaskEditDraft({ ...taskEditDraft, status: event.target.value as TaskItem["status"] })}>{columns.map((column) => <option value={column.key} key={column.key}>{column.label}</option>)}</select></label>
                <label>Prioridad<select value={taskEditDraft.priority} onChange={(event) => setTaskEditDraft({ ...taskEditDraft, priority: event.target.value as TaskItem["priority"] })}><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option></select></label>
                <label>Consorcio<select value={taskEditDraft.consortiumId} onChange={(event) => setTaskEditDraft({ ...taskEditDraft, consortiumId: event.target.value })}><option value="">Sin consorcio</option>{data.consorcios.map((item) => <option value={item.id} key={item.id}>{item.name}{item.address ? ` · ${item.address}` : ""}</option>)}</select></label>
                <label>Asignada a<select value={taskEditDraft.assigneeId} onChange={(event) => setTaskEditDraft({ ...taskEditDraft, assigneeId: event.target.value })}><option value="">Solo para mí</option>{data.users.map((user) => <option value={user.id} key={user.id}>{user.name}</option>)}</select></label>
                <label>Fecha límite<input type="date" value={taskEditDraft.dueDate} onChange={(event) => setTaskEditDraft({ ...taskEditDraft, dueDate: event.target.value })} /></label>
              </div>
              <p className="task-edit-help">Los cambios se guardan juntos y quedan registrados en Actividad.</p>
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setTaskEditDraft(null)}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button></div>
            </form>
          </section>
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

      {intakeTestOpen && (
        <div className="modal-backdrop elevated" onMouseDown={() => setIntakeTestOpen(false)}>
          <section className="modal intake-test-modal" role="dialog" aria-modal="true" aria-labelledby="intake-test-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><span className="modal-kicker">PRUEBA DEL RECEPTOR</span><h2 id="intake-test-title">Simular mensaje del demonio</h2></div><button className="close-button" onClick={() => setIntakeTestOpen(false)} aria-label="Cerrar">×</button></div>
            <div className="test-mode-note intake-test-note"><span aria-hidden="true">●</span><p><strong>Esta prueba sí crea una tarea.</strong> Quedará en En revisión y marcada como simulación para comprobar el flujo completo.</p></div>
            <form onSubmit={submitIntakeTest}>
              <div className="form-grid">
                <label>Origen<select name="source" defaultValue="whatsapp"><option value="whatsapp">WhatsApp</option><option value="email">Correo</option></select></label>
                <label>Cuenta o línea<input name="sourceAccount" required defaultValue="WhatsApp Línea 1" placeholder="Ej. WhatsApp Línea 1" /></label>
                <label>Nombre del remitente<input name="senderName" required defaultValue="Vecino de prueba" /></label>
                <label>Teléfono o email<input name="senderAddress" defaultValue="+54 11 5555-0101" /></label>
              </div>
              <label>Título interpretado<input name="title" required defaultValue="Reclamo por pérdida de agua" /></label>
              <label>Mensaje limpio<textarea name="body" rows={5} required defaultValue="Informan una pérdida de agua en el palier del edificio Núñez 5157. Solicitan revisión urgente." /></label>
              <label>Consorcio conocido<select name="consortiumId" defaultValue=""><option value="">Detectar automáticamente</option>{data.consorcios.map((item) => <option value={item.id} key={item.id}>{item.name}{item.address ? ` · ${item.address}` : ""}</option>)}</select></label>
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setIntakeTestOpen(false)}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? "Procesando…" : "Enviar a Tasker"}</button></div>
            </form>
          </section>
        </div>
      )}

      {importOpen && <UserImport onClose={() => setImportOpen(false)} onImported={(workspace) => { setData(workspace); setNotice("Usuarios importados"); }} />}
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
