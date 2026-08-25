"use client";

import { DragEvent, FormEvent, useMemo, useRef, useState } from "react";
import type { MailSettings, TaskItem, WorkspaceData } from "@/db/task-store";
import UserImport from "./UserImport";

const columns: Array<{ key: TaskItem["status"]; label: string; tone: string }> = [
  { key: "pending", label: "Pendientes", tone: "slate" },
  { key: "in_progress", label: "En curso", tone: "blue" },
  { key: "review", label: "En revisión", tone: "amber" },
  { key: "done", label: "Finalizadas", tone: "green" },
];
const priorityLabels = { low: "Baja", medium: "Media", high: "Alta" };
const claimCategoryLabels = {
  ascensor: "Ascensor", agua: "Agua", gas: "Gas", electricidad: "Electricidad", seguridad: "Seguridad",
  limpieza: "Limpieza", convivencia: "Convivencia", administracion: "Administración", mantenimiento: "Mantenimiento", otro: "Otro",
};
const claimStatusLabels = { new: "Nuevo", assigned: "Asignado", in_progress: "En gestión", waiting: "Esperando", resolved: "Resuelto", closed: "Cerrado" };
const intakeKindLabels = { claim: "Reclamo", request: "Solicitud", order: "Pedido", notice: "Aviso", other: "Otro" };
const intakeStatusLabels = { pending: "Por revisar", accepted: "Confirmado", discarded: "Descartado", error: "Con error" };

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
  const [view, setView] = useState<"home" | "mine" | "intake" | "claims" | "mail">("home");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [buildingFilter, setBuildingFilter] = useState("all");
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskStatus, setNewTaskStatus] = useState<TaskItem["status"]>("pending");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
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
  const [emailTestOpen, setEmailTestOpen] = useState(false);
  const [gmailScript, setGmailScript] = useState<string | null>(null);
  const [mailDraft, setMailDraft] = useState<MailSettings | null>(initialData.mailSettings);
  const [newRecipient, setNewRecipient] = useState("");
  const [newAcceptedPattern, setNewAcceptedPattern] = useState("");
  const [newIgnoredPattern, setNewIgnoredPattern] = useState("");
  const [newBlockedSender, setNewBlockedSender] = useState("");
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
  const activeClaims = data.claims.filter((claim) => claim.status !== "resolved" && claim.status !== "closed");
  const pendingIntake = data.intakeItems.filter((item) => item.status === "pending" || item.status === "error");
  const isTaskView = view === "home" || view === "mine";
  const isAdmin = data.currentUser.role === "admin";
  const draggedTask = data.tasks.find((task) => task.id === draggedTaskId) ?? null;
  const canDeleteDraggedTask = Boolean(draggedTask && (isAdmin || draggedTask.creatorId === data.currentUser.id));
  const usersWithEmail = data.users.filter((user) => /^\S+@\S+\.\S+$/.test(user.email) && !user.email.endsWith("@tasker.local"));
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
  async function submitEmailTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await mutate("/api/claims/email-test", "POST", {
      senderName: form.get("senderName"), senderEmail: form.get("senderEmail"),
      subject: form.get("subject"), body: form.get("body"), consortiumId: form.get("consortiumId") || null,
    }, "Correo procesado: reclamo y tarea creados");
    if (ok) { setEmailTestOpen(false); setView("claims"); }
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
  async function copyGmailConnection() {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/claims/gmail-script", { cache: "no-store" });
      const script = await response.text();
      if (!response.ok) {
        const payload = JSON.parse(script) as { error?: string };
        throw new Error(payload.error || "No se pudo preparar la conexión");
      }
      setGmailScript(script);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo preparar la conexión");
    } finally {
      setSaving(false);
    }
  }
  async function copyVisibleGmailScript() {
    if (!gmailScript) return;
    const textarea = document.getElementById("gmail-connection-code") as HTMLTextAreaElement | null;
    textarea?.focus();
    textarea?.select();
    let copied = false;
    try {
      if (navigator.clipboard && document.hasFocus()) {
        await navigator.clipboard.writeText(gmailScript);
        copied = true;
      }
    } catch {
      copied = false;
    }
    if (!copied) {
      try { copied = document.execCommand("copy"); } catch { copied = false; }
    }
    setNotice(copied ? "Código copiado. Pegalo en Google Apps Script." : "El código quedó seleccionado. Presioná Ctrl+C para copiarlo.");
  }
  async function saveMailSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mailDraft) return;
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/mail/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mailDraft),
      });
      const payload = await response.json() as WorkspaceData & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo guardar la configuración");
      setData(payload);
      setMailDraft(payload.mailSettings);
      setNotice("Configuración de correo guardada");
      window.setTimeout(() => setNotice(null), 3200);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo guardar la configuración");
    } finally {
      setSaving(false);
    }
  }
  function toggleRecipient(emailValue: string) {
    if (!mailDraft) return;
    const email = emailValue.trim().toLocaleLowerCase("es");
    if (!email) return;
    setMailDraft({
      ...mailDraft,
      reminderRecipients: mailDraft.reminderRecipients.includes(email)
        ? mailDraft.reminderRecipients.filter((item) => item !== email)
        : [...mailDraft.reminderRecipients, email],
    });
  }
  function addRecipient() {
    if (!mailDraft || !newRecipient.trim()) return;
    const email = newRecipient.trim().toLocaleLowerCase("es");
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setNotice("Ingresá un correo válido");
      return;
    }
    if (!mailDraft.reminderRecipients.includes(email)) {
      setMailDraft({ ...mailDraft, reminderRecipients: [...mailDraft.reminderRecipients, email] });
    }
    setNewRecipient("");
  }
  function addMailRule(
    field: "acceptedPatterns" | "ignoredSubjectPatterns" | "blockedSenders",
    value: string,
    clear: (next: string) => void,
  ) {
    if (!mailDraft || !value.trim()) return;
    const normalized = field === "blockedSenders"
      ? value.trim().toLocaleLowerCase("es")
      : value.trim().toLocaleUpperCase("es");
    if (!mailDraft[field].includes(normalized)) {
      setMailDraft({ ...mailDraft, [field]: [...mailDraft[field], normalized] });
    }
    clear("");
  }
  function removeMailRule(field: "acceptedPatterns" | "ignoredSubjectPatterns" | "blockedSenders", value: string) {
    if (!mailDraft) return;
    setMailDraft({ ...mailDraft, [field]: mailDraft[field].filter((item) => item !== value) });
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
  async function removeClaim(claim: WorkspaceData["claims"][number]) {
    const linkedTaskNote = claim.taskId ? " y la tarea relacionada" : "";
    const confirmed = window.confirm(`¿Eliminar el reclamo “${claim.subject}”?\n\nSe borrará el reclamo${linkedTaskNote} definitivamente.`);
    if (!confirmed) return;
    await mutate(`/api/claims/${claim.id}`, "DELETE", undefined, "Reclamo eliminado");
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
          <button className={`nav-item ${view === "claims" ? "active" : ""}`} onClick={() => setView("claims")}><span aria-hidden="true">✉</span>Reclamos<span className="nav-count">{activeClaims.length}</span></button>
          {data.currentUser.role === "admin" && <button className={`nav-item ${view === "mail" ? "active" : ""}`} onClick={() => setView("mail")}><span aria-hidden="true">⚙</span>Configuración correo</button>}
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
          <div>
            <p className="eyebrow">{view === "intake" ? "CENTRO DE INGRESOS" : view === "claims" ? "BANDEJA DE ENTRADA" : view === "mail" ? "AUTOMATIZACIÓN" : longDate()}</p>
            <h1>{view === "intake" ? "Ingresos automáticos" : view === "claims" ? "Reclamos recibidos" : view === "mail" ? "Correo y recordatorios" : `Buenos días, ${firstName}`}</h1>
            <p className="subtitle">{view === "intake" ? "Revisá lo que reciba el futuro demonio antes de incorporarlo al trabajo diario." : view === "claims" ? "Cada correo válido se convierte en un reclamo y una tarea." : view === "mail" ? "Elegí qué casilla se consulta y quién recibe cada aviso." : activeTasks.length ? `Tenés ${activeTasks.length} tareas activas para organizar.` : "Tu tablero está al día."}</p>
          </div>
          <div className="topbar-actions">
            {isTaskView && searchOpen && <input className="search-input" autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar tarea o consorcio…" aria-label="Buscar" />}
            {isTaskView && <button className="icon-button" aria-label="Buscar" onClick={() => setSearchOpen((value) => !value)}>⌕</button>}
            <button className="icon-button notification" aria-label="Notificaciones" onClick={() => setNotice("No tenés notificaciones pendientes.")}>♢</button>
            {view === "intake" && data.currentUser.role === "admin"
              ? <button className="primary-button" onClick={() => setIntakeTestOpen(true)}><span aria-hidden="true">＋</span> Simular ingreso</button>
              : view === "claims" && data.currentUser.role === "admin"
              ? <button className="primary-button" onClick={() => window.location.reload()}><span aria-hidden="true">↻</span> Actualizar</button>
              : view === "mail" ? <button className="primary-button" disabled={saving} onClick={copyGmailConnection}><span aria-hidden="true">⧉</span> Ver código Gmail</button>
              : <button className="primary-button" onClick={() => openNewTask()}><span aria-hidden="true">＋</span> Nueva tarea</button>}
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

            <div className="claims-summary intake-summary">
              <article><strong>{pendingIntake.length}</strong><span>Esperando revisión</span></article>
              <article><strong>{data.intakeItems.filter((item) => item.status === "accepted").length}</strong><span>Confirmados</span></article>
              <article><strong>{new Set(data.intakeItems.map((item) => `${item.source}:${item.sourceAccount}`)).size}</strong><span>Fuentes detectadas</span></article>
            </div>

            <div className="claims-heading intake-heading">
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
                      <span className="claim-category">{intakeKindLabels[item.kind]}</span>
                      <span className={`priority ${priorityLabels[item.priority].toLowerCase()}`}>{priorityLabels[item.priority]}</span>
                      {item.isTest && <span className="claim-test">Prueba</span>}
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
              {data.intakeItems.length === 0 && <div className="claims-empty intake-empty"><span aria-hidden="true">⇥</span><h3>El receptor está listo</h3><p>Realizá una simulación para comprobar el circuito antes de conectar el demonio.</p><button className="secondary-button" onClick={() => setIntakeTestOpen(true)}>Simular primer ingreso</button></div>}
            </div>
          </div>
        ) : view === "claims" ? (
          <div className="claims-view">
            <section className="email-test-banner">
              <div className="email-test-icon" aria-hidden="true">✉</div>
              <div><span className="modal-kicker">GMAIL REAL</span><h2>{data.mailSettings?.inboxAddress ?? "Casilla configurada"}</h2><p>Se procesan los correos cuyo asunto contiene alguno de estos patrones: <strong>{data.mailSettings?.acceptedPatterns.join(", ") || "RECLAMO"}</strong>.</p><div className="gmail-test-example"><span>Asunto de ejemplo</span><code>AV. SAN JUAN · {data.mailSettings?.acceptedPatterns[0] ?? "RECLAMO"} urgente</code></div></div>
              {data.currentUser.role === "admin" && <div className="email-test-banner-actions"><button className="primary-button" onClick={() => setView("mail")}>Configurar correo</button><button className="secondary-button" onClick={() => window.location.reload()}>↻ Actualizar bandeja</button><button className="secondary-button" onClick={() => setEmailTestOpen(true)}>Prueba simulada</button></div>}
            </section>
            <div className="claims-summary">
              <article><strong>{data.claims.length}</strong><span>Correos procesados</span></article>
              <article><strong>{activeClaims.length}</strong><span>Reclamos activos</span></article>
              <article><strong>{data.claims.filter((claim) => claim.priority === "high").length}</strong><span>Prioridad alta</span></article>
            </div>
            <div className="claims-heading"><div><h2>Bandeja de reclamos</h2><p>Los elementos marcados como prueba no provienen todavía de una casilla real.</p></div></div>
            <div className="claims-list">
              {data.claims.map((claim) => (
                <article className="claim-card" key={claim.id}>
                  <div className="claim-card-main">
                    <div className="claim-badges"><span className={`priority ${priorityLabels[claim.priority].toLowerCase()}`}>{priorityLabels[claim.priority]}</span><span className="claim-channel">✉ Email</span><span className={claim.isTest ? "claim-test" : "claim-live"}>{claim.isTest ? "Prueba" : "Gmail real"}</span></div>
                    <h3>{claim.subject}</h3>
                    <p className="claim-preview">{claim.body}</p>
                    <div className="claim-meta"><span>De: <strong>{claim.senderName}</strong> · {claim.senderEmail}</span><span>▦ {claim.consortiumName || "Sin consorcio"}</span><span>◷ {dateTimeLabel(claim.createdAt)}</span></div>
                  </div>
                  <div className="claim-card-side"><span className="claim-category">{claimCategoryLabels[claim.category]}</span><span className={`claim-status ${claim.status}`}>{claimStatusLabels[claim.status]}</span>{claim.taskId && <button className="row-button" onClick={() => { setView("home"); setSelectedTaskId(claim.taskId); }}>Abrir tarea</button>}{data.currentUser.role === "admin" && <button className="row-button danger" disabled={saving} onClick={() => void removeClaim(claim)}>Eliminar</button>}</div>
                </article>
              ))}
              {data.claims.length === 0 && <div className="claims-empty"><span aria-hidden="true">✉</span><h3>Esperando el primer reclamo</h3><p>Enviá un correo con el asunto <strong>[RECLAMO] Tu asunto</strong> y luego actualizá esta bandeja.</p>{data.currentUser.role === "admin" && <button className="secondary-button" onClick={() => setEmailTestOpen(true)}>Usar simulación</button>}</div>}
            </div>
          </div>
        ) : mailDraft ? (
          <form className="mail-settings-view" onSubmit={saveMailSettings}>
            <section className="settings-card settings-card-intake">
              <div className="settings-card-heading">
                <div><span className="settings-icon" aria-hidden="true">✉</span><div><span className="modal-kicker">RECEPCIÓN</span><h2>Casilla de reclamos</h2><p>Tasker revisa la bandeja y toma los asuntos que contienen alguna regla aceptada.</p></div></div>
                <label className="switch-label"><input type="checkbox" checked={mailDraft.intakeEnabled} onChange={(event) => setMailDraft({ ...mailDraft, intakeEnabled: event.target.checked })} /><span>Lectura automática</span></label>
              </div>
              <div className="settings-form-grid">
                <label>Casilla que se debe leer<input type="email" required value={mailDraft.inboxAddress} onChange={(event) => setMailDraft({ ...mailDraft, inboxAddress: event.target.value })} placeholder="administracion@gmail.com" /></label>
                <label>Buscar correos de los últimos<select value={mailDraft.lookbackDays} onChange={(event) => setMailDraft({ ...mailDraft, lookbackDays: Number(event.target.value) })}><option value={1}>1 día</option><option value={3}>3 días</option><option value={7}>7 días</option><option value={14}>14 días</option><option value={30}>30 días</option></select></label>
                <label>Contenido mínimo<select value={mailDraft.minimumBodyLength} onChange={(event) => setMailDraft({ ...mailDraft, minimumBodyLength: Number(event.target.value) })}><option value={0}>Sin mínimo</option><option value={5}>5 caracteres</option><option value={10}>10 caracteres</option><option value={20}>20 caracteres</option><option value={50}>50 caracteres</option></select></label>
                <div className={`connection-status ${mailDraft.lastSyncStatus}`}><span className={`status-dot ${!mailDraft.intakeEnabled ? "paused" : mailDraft.lastSyncStatus === "error" ? "error" : ""}`} /><div><strong>{!mailDraft.intakeEnabled ? "Recepción pausada" : mailDraft.lastSyncStatus === "error" ? "Error de sincronización" : mailDraft.lastSyncAt ? "Gmail conectado" : "Esperando conexión"}</strong><small>{mailDraft.lastSyncAt ? `${dateTimeLabel(mailDraft.lastSyncAt)} · ${mailDraft.lastSyncDetail || "Sin correos nuevos"}` : "Ejecutá configurarTasker en Gmail."}</small></div></div>
              </div>
              <div className="mail-rules-grid">
                <div className="mail-rule-card">
                  <div><h3>Patrones aceptados</h3><p>El asunto puede contener estos textos en cualquier posición.</p></div>
                  <div className="rule-chips">{mailDraft.acceptedPatterns.map((pattern) => <span className="accepted" key={pattern}>{pattern}<button type="button" disabled={mailDraft.acceptedPatterns.length === 1} aria-label={`Quitar ${pattern}`} onClick={() => removeMailRule("acceptedPatterns", pattern)}>×</button></span>)}</div>
                  <div className="rule-input"><input value={newAcceptedPattern} onChange={(event) => setNewAcceptedPattern(event.target.value)} placeholder="Ej. CONSULTA" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addMailRule("acceptedPatterns", newAcceptedPattern, setNewAcceptedPattern); } }} /><button type="button" onClick={() => addMailRule("acceptedPatterns", newAcceptedPattern, setNewAcceptedPattern)}>Agregar</button></div>
                </div>
                <div className="mail-rule-card">
                  <div><h3>Asuntos ignorados</h3><p>No se crearán tareas cuando el asunto empiece así.</p></div>
                  <div className="rule-chips">{mailDraft.ignoredSubjectPatterns.map((pattern) => <span className="ignored" key={pattern}>{pattern}<button type="button" aria-label={`Quitar ${pattern}`} onClick={() => removeMailRule("ignoredSubjectPatterns", pattern)}>×</button></span>)}</div>
                  <div className="rule-input"><input value={newIgnoredPattern} onChange={(event) => setNewIgnoredPattern(event.target.value)} placeholder="Ej. NEWSLETTER" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addMailRule("ignoredSubjectPatterns", newIgnoredPattern, setNewIgnoredPattern); } }} /><button type="button" onClick={() => addMailRule("ignoredSubjectPatterns", newIgnoredPattern, setNewIgnoredPattern)}>Agregar</button></div>
                </div>
                <div className="mail-rule-card">
                  <div><h3>Remitentes bloqueados</h3><p>Podés bloquear una dirección, dominio o fragmento.</p></div>
                  <div className="rule-chips">{mailDraft.blockedSenders.map((pattern) => <span className="blocked" key={pattern}>{pattern}<button type="button" aria-label={`Quitar ${pattern}`} onClick={() => removeMailRule("blockedSenders", pattern)}>×</button></span>)}</div>
                  <div className="rule-input"><input value={newBlockedSender} onChange={(event) => setNewBlockedSender(event.target.value)} placeholder="Ej. newsletter@" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addMailRule("blockedSenders", newBlockedSender, setNewBlockedSender); } }} /><button type="button" onClick={() => addMailRule("blockedSenders", newBlockedSender, setNewBlockedSender)}>Agregar</button></div>
                </div>
              </div>
              <div className="settings-note"><span aria-hidden="true">i</span><p>Las notificaciones automáticas de portales también pueden crear reclamos. Solo se descartan respuestas de ausencia, rebotes y las reglas que configures arriba. Si cambiás de cuenta, guardá y volvé a usar <strong>Ver código Gmail</strong> desde la nueva casilla.</p></div>
            </section>

            <section className="settings-card">
              <div className="settings-card-heading">
                <div><span className="settings-icon reminder" aria-hidden="true">◷</span><div><span className="modal-kicker">AVISOS</span><h2>Recordatorios por email</h2><p>Los mensajes salen desde la cuenta de Gmail que autorizó la conexión.</p></div></div>
                <label className="switch-label"><input type="checkbox" checked={mailDraft.remindersEnabled} onChange={(event) => setMailDraft({ ...mailDraft, remindersEnabled: event.target.checked })} /><span>Enviar recordatorios</span></label>
              </div>

              <div className="reminder-options">
                <label className="check-card"><input type="checkbox" checked={mailDraft.notifyUrgent} onChange={(event) => setMailDraft({ ...mailDraft, notifyUrgent: event.target.checked })} /><span><strong>Reclamos urgentes</strong><small>Aviso inmediato por prioridad alta.</small></span></label>
                <label className="check-card"><input type="checkbox" checked={mailDraft.notifyDueToday} onChange={(event) => setMailDraft({ ...mailDraft, notifyDueToday: event.target.checked })} /><span><strong>Tareas para hoy</strong><small>Un aviso el día del vencimiento.</small></span></label>
                <label className="check-card"><input type="checkbox" checked={mailDraft.notifyOverdue} onChange={(event) => setMailDraft({ ...mailDraft, notifyOverdue: event.target.checked })} /><span><strong>Tareas vencidas</strong><small>Recordatorio diario mientras sigan abiertas.</small></span></label>
                <label className="check-card"><input type="checkbox" checked={mailDraft.dailySummary} onChange={(event) => setMailDraft({ ...mailDraft, dailySummary: event.target.checked })} /><span><strong>Resumen diario</strong><small>Totales de tareas y reclamos pendientes.</small></span></label>
              </div>

              <div className="reminder-time-row"><label>Hora de los avisos diarios<select value={mailDraft.reminderHour} onChange={(event) => setMailDraft({ ...mailDraft, reminderHour: Number(event.target.value) })}>{Array.from({ length: 15 }, (_, index) => index + 7).map((hour) => <option value={hour} key={hour}>{String(hour).padStart(2, "0")}:00</option>)}</select></label><span>Zona horaria: Buenos Aires</span></div>

              <div className="recipient-section">
                <div className="recipient-heading"><div><h3>Destinatarios</h3><p>Elegí personas del equipo o agregá cualquier otra dirección.</p></div><span>{mailDraft.reminderRecipients.length} seleccionados</span></div>
                <div className="team-recipient-grid">
                  {usersWithEmail.map((user) => {
                    const selected = mailDraft.reminderRecipients.includes(user.email.toLocaleLowerCase("es"));
                    return <button type="button" className={`recipient-person ${selected ? "selected" : ""}`} key={user.id} onClick={() => toggleRecipient(user.email)}><span className="avatar">{initials(user.name)}</span><span><strong>{user.name}</strong><small>{user.email}</small></span><span className="recipient-check">{selected ? "✓" : "+"}</span></button>;
                  })}
                  {usersWithEmail.length === 0 && <p className="no-team-emails">Los usuarios actuales no tienen un email real cargado. Podés agregar las direcciones manualmente debajo.</p>}
                </div>
                <div className="recipient-chips">{mailDraft.reminderRecipients.map((email) => <span key={email}>{email}<button type="button" aria-label={`Quitar ${email}`} onClick={() => toggleRecipient(email)}>×</button></span>)}</div>
                <div className="add-recipient"><input type="email" value={newRecipient} onChange={(event) => setNewRecipient(event.target.value)} placeholder="otro@email.com" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addRecipient(); } }} /><button type="button" className="secondary-button" onClick={addRecipient}>Agregar destinatario</button></div>
              </div>
            </section>

            <section className="settings-card mail-log-card">
              <div className="settings-card-heading compact"><div><span className="settings-icon log" aria-hidden="true">≡</span><div><span className="modal-kicker">CONTROL</span><h2>Últimos correos evaluados</h2><p>Podés comprobar cuáles ingresaron y por qué se rechazó cada mensaje.</p></div></div><button type="button" className="secondary-button" onClick={() => window.location.reload()}>↻ Actualizar</button></div>
              <div className="mail-event-list">
                {data.mailEvents.map((event) => <article className="mail-event-row" key={event.id}><span className={`mail-event-status ${event.status}`}>{event.status === "accepted" ? "Aceptado" : "Rechazado"}</span><div><strong>{event.subject || "Sin asunto"}</strong><span>{event.senderEmail || "Remitente desconocido"}</span></div><p>{event.reason}</p><time>{dateTimeLabel(event.createdAt)}</time></article>)}
                {data.mailEvents.length === 0 && <p className="empty-mail-events">Todavía no hay correos evaluados con las nuevas reglas.</p>}
              </div>
            </section>

            <div className="settings-actions"><p>Los recordatorios usan asuntos con <strong>[TASKER]</strong>, por lo que nunca se convertirán en reclamos nuevos.</p><div><button type="button" className="secondary-button" disabled={saving} onClick={copyGmailConnection}>Ver código Gmail</button><button className="primary-button" disabled={saving}>{saving ? "Guardando…" : "Guardar configuración"}</button></div></div>
          </form>
        ) : null}
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
              <div className="privacy-banner"><span aria-hidden="true">●</span><p><strong>Privacidad automática</strong> Si no asignás a nadie, solo vos y los administradores podrán ver esta tarea. Al asignarla, también podrá verla y comentarla la persona elegida.</p></div>
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

      {emailTestOpen && (
        <div className="modal-backdrop" onMouseDown={() => setEmailTestOpen(false)}>
          <section className="modal email-test-modal" role="dialog" aria-modal="true" aria-labelledby="email-test-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><span className="modal-kicker">CORREO DE PRUEBA</span><h2 id="email-test-title">Simular un reclamo recibido</h2></div><button className="close-button" onClick={() => setEmailTestOpen(false)} aria-label="Cerrar">×</button></div>
            <div className="test-mode-note"><span aria-hidden="true">●</span><p><strong>No envía ni recibe emails reales.</strong> Sirve para validar cómo quedarán el reclamo y la tarea antes de conectar una casilla.</p></div>
            <form onSubmit={submitEmailTest}>
              <div className="form-grid">
                <label>Nombre del remitente<input name="senderName" required autoFocus defaultValue="María López" /></label>
                <label>Correo del remitente<input name="senderEmail" type="email" required defaultValue="maria@example.com" /></label>
              </div>
              <label>Consorcio<select name="consortiumId" defaultValue=""><option value="">Sin identificar</option>{data.consorcios.map((item) => <option value={item.id} key={item.id}>{item.name}{item.address ? ` · ${item.address}` : ""}</option>)}</select></label>
              <label>Asunto<input name="subject" required defaultValue="Ascensor detenido - urgente" /></label>
              <label>Mensaje<textarea name="body" rows={5} required defaultValue="El ascensor no funciona desde esta mañana. Hay una persona mayor que no puede bajar." /></label>
              <p className="classification-help">Para esta prueba se buscan palabras como “ascensor”, “agua”, “gas”, “expensas” y “urgente”. Más adelante podemos reemplazar estas reglas por el análisis de una IA.</p>
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setEmailTestOpen(false)}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? "Procesando…" : "Procesar correo"}</button></div>
            </form>
          </section>
        </div>
      )}

      {gmailScript && (
        <div className="modal-backdrop elevated" onMouseDown={() => setGmailScript(null)}>
          <section className="modal gmail-script-modal" role="dialog" aria-modal="true" aria-labelledby="gmail-script-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><span className="modal-kicker">CONEXIÓN CON GMAIL</span><h2 id="gmail-script-title">Código para Google Apps Script</h2></div><button className="close-button" onClick={() => setGmailScript(null)} aria-label="Cerrar">×</button></div>
            <div className="gmail-script-steps"><span>1</span><p>Abrí <a href="https://script.new" target="_blank" rel="noreferrer">Google Apps Script</a> con la cuenta que recibirá los reclamos.</p><span>2</span><p>Borrá el código anterior y pegá este bloque completo.</p><span>3</span><p>Guardá y ejecutá la función <strong>configurarTasker</strong>.</p><span>4</span><p>La primera ejecución volverá a revisar los últimos <strong>{data.mailSettings?.lookbackDays ?? 30} días</strong>. Cada conversación creará una sola tarea y sus respuestas se agregarán como comentarios.</p></div>
            <textarea id="gmail-connection-code" className="gmail-script-code" readOnly spellCheck={false} value={gmailScript} onFocus={(event) => event.currentTarget.select()} aria-label="Código de conexión con Gmail" />
            <p className="gmail-script-help">Si el navegador no permite copiar automáticamente, hacé clic dentro del código y presioná <strong>Ctrl+A</strong> y después <strong>Ctrl+C</strong>.</p>
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setGmailScript(null)}>Cerrar</button><button type="button" className="primary-button" onClick={copyVisibleGmailScript}><span aria-hidden="true">⧉</span> Seleccionar y copiar</button></div>
          </section>
        </div>
      )}

      {importOpen && <UserImport onClose={() => setImportOpen(false)} onImported={(workspace) => { setData(workspace); setNotice("Usuarios importados"); }} />}
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
