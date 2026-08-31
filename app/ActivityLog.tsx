"use client";

import { FormEvent, useEffect, useState } from "react";
import type { ActivityItem, ActivityPage } from "@/db/activity-store";
import type { AppUser } from "@/db/task-store";

const actionLabels: Record<string, string> = {
  "session.login": "Inició sesión", "session.logout": "Cerró sesión",
  "task.created": "Creó una tarea", "task.updated": "Modificó una tarea",
  "task.status_changed": "Cambió el estado", "task.assigned": "Cambió la asignación",
  "task.commented": "Agregó un comentario", "task.deleted": "Eliminó una tarea",
  "consortium.created": "Creó un consorcio", "consortium.updated": "Modificó un consorcio",
  "consortium.deleted": "Eliminó un consorcio", "user.import_created": "Creó un usuario desde Excel",
  "user.import_updated": "Actualizó un usuario desde Excel", "user.updated": "Modificó un perfil",
  "user.deleted": "Eliminó un usuario", "intake.simulated": "Simuló un ingreso",
  "intake.received": "Recibió un ingreso automático", "intake.follow_up": "Procesó un seguimiento",
  "intake.accepted": "Confirmó un ingreso", "intake.discarded": "Descartó un ingreso",
  "workspace.cleared": "Limpió los datos operativos",
};
const entityLabels: Record<string, string> = { task: "Tareas", consortium: "Consorcios", user: "Usuarios", intake: "Ingresos", session: "Accesos", workspace: "Limpiezas" };
const emptyFilters = { search: "", actorId: "", entityType: "" };
const dateFormat = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Buenos_Aires" });

export default function ActivityLog({ users }: { users: AppUser[] }) {
  const [draft, setDraft] = useState(emptyFilters);
  const [request, setRequest] = useState({ filters: emptyFilters, cursor: null as string | null, revision: 0 });
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      if (!request.cursor) { setItems([]); setNextCursor(null); }
      try {
        const params = new URLSearchParams(request.filters);
        if (request.cursor) params.set("cursor", request.cursor);
        const response = await fetch(`/api/activity?${params}`, { signal: controller.signal, cache: "no-store" });
        const page = await response.json() as ActivityPage & { error?: string };
        if (!response.ok) throw new Error(page.error || "No se pudo cargar la actividad");
        if (controller.signal.aborted) return;
        setItems((previous) => request.cursor ? [...previous, ...page.items] : page.items);
        setNextCursor(page.nextCursor);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "No se pudo cargar la actividad");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [request]);

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    setRequest((previous) => ({ filters: { ...draft }, cursor: null, revision: previous.revision + 1 }));
  }

  return <section className="activity-view" aria-label="Historial de actividad">
    <div className="activity-info"><strong>Registro desde la activación del historial</strong><p>Solo administradores de este espacio. Los registros se conservan aunque se borren tareas o usuarios. Horarios de Buenos Aires.</p></div>
    <form className="activity-filters" onSubmit={applyFilters}>
      <label>Buscar<input value={draft.search} maxLength={100} onChange={(event) => setDraft({ ...draft, search: event.target.value })} placeholder="Tarea, consorcio o persona…" /></label>
      <label>Persona<select value={draft.actorId} onChange={(event) => setDraft({ ...draft, actorId: event.target.value })}><option value="">Todas las personas</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}<option value="system:daemon">Demonio (automático)</option></select></label>
      <label>Tipo<select value={draft.entityType} onChange={(event) => setDraft({ ...draft, entityType: event.target.value })}><option value="">Todas las acciones</option>{Object.entries(entityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button className="primary-button" type="submit">Filtrar</button>
      <button className="secondary-button" type="button" disabled={loading} onClick={() => setRequest((previous) => ({ ...previous, cursor: null, revision: previous.revision + 1 }))}>↻ Actualizar</button>
    </form>
    <div aria-live="polite" className="activity-feedback">
      {loading ? "Cargando actividad…" : !error ? `${items.length} registros mostrados` : ""}
    </div>
    {error && <div className="activity-error" role="alert"><p>{error}</p><button className="secondary-button" onClick={() => setRequest((previous) => ({ ...previous, revision: previous.revision + 1 }))}>Reintentar</button></div>}
    {!loading && !error && items.length === 0 && <div className="activity-empty"><h2>No hay actividad para mostrar</h2><p>Las nuevas acciones aparecerán acá. Si aplicaste filtros, probá cambiarlos.</p></div>}
    <ol className="activity-list">
      {items.map((item) => <li key={item.id} className="activity-entry">
        <div className={`activity-mark ${item.action.endsWith("deleted") || item.action === "workspace.cleared" ? "destructive" : ""}`} aria-hidden="true">{item.entityType === "session" ? "↗" : item.entityType === "task" ? "✓" : "◷"}</div>
        <div className="activity-content">
          <div className="activity-entry-head"><strong>{item.actorName} <span>@{item.actorUsername}</span></strong><time dateTime={new Date(item.createdAt).toISOString()}>{dateFormat.format(item.createdAt)}</time></div>
          <p className="activity-action">{actionLabels[item.action] || item.action}<span className="activity-category">{entityLabels[item.entityType] || item.entityType}</span></p>
          <p className="activity-target">{item.entityLabel}</p>
          {(item.details.length > 0 || item.entityId) && <details><summary>Ver detalle</summary><ul>{item.details.map((detail, index) => <li key={index}>{detail}</li>)}</ul>{item.entityId && <small className="activity-reference">Referencia: {item.entityId}</small>}</details>}
        </div>
      </li>)}
    </ol>
    {nextCursor && !error && <div className="activity-more"><button className="secondary-button" disabled={loading} onClick={() => setRequest((previous) => ({ ...previous, cursor: nextCursor }))}>{loading ? "Cargando…" : "Cargar registros anteriores"}</button></div>}
  </section>;
}
