"use client";

import { useEffect, useMemo, useState } from "react";
import type { TaskItem, WorkspaceData } from "@/db/task-store";

const columns: Array<{ key: TaskItem["status"]; label: string; tone: string }> = [
  { key: "pending", label: "Pendientes", tone: "slate" },
  { key: "in_progress", label: "En curso", tone: "blue" },
  { key: "review", label: "En revisión", tone: "amber" },
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

function timeLabel(value: Date) {
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(value);
}

export default function ReadOnlyBoard({ initialData }: { initialData: WorkspaceData }) {
  const [data, setData] = useState(initialData);
  const [updatedAt, setUpdatedAt] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const activeTasks = useMemo(() => data.tasks.filter((task) => task.status !== "done"), [data.tasks]);

  async function refresh() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/workspace", { cache: "no-store" });
      if (!response.ok) return;
      setData(await response.json() as WorkspaceData);
      setUpdatedAt(new Date());
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 45000);
    const refreshOnFocus = () => void refresh();
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, []);

  return (
    <main className="readonly-board-page">
      <header className="readonly-board-header">
        <div className="readonly-board-brand"><span className="brand-mark">T</span><div><span>Tasker</span><small>Panel de solo lectura</small></div></div>
        <div className="readonly-board-title"><p>SEGUIMIENTO GENERAL</p><h1>Tareas activas</h1><span>{activeTasks.length} tareas entre pendientes, en curso y en revisión</span></div>
        <div className="readonly-board-controls">
          <span className="readonly-refresh-status">Actualizado {timeLabel(updatedAt)}</span>
          <button className="readonly-refresh-button" type="button" disabled={refreshing} onClick={() => void refresh()}>{refreshing ? "Actualizando…" : "↻ Actualizar"}</button>
          <a className="readonly-return-button" href="/">Volver a Tasker</a>
        </div>
      </header>

      <section className="readonly-kanban" aria-label="Panel de tareas activas de solo lectura">
        {columns.map((column) => {
          const tasks = activeTasks.filter((task) => task.status === column.key);
          return (
            <section className="readonly-column" key={column.key}>
              <div className="readonly-column-header"><span className={`column-dot ${column.tone}`} /><h2>{column.label}</h2><span>{tasks.length}</span></div>
              <div className="readonly-task-list">
                {tasks.map((task) => (
                  <article className="readonly-task-card" key={task.id}>
                    <div className="task-topline"><span className={`priority ${priorityLabels[task.priority].toLowerCase()}`}>{priorityLabels[task.priority]}</span><span className={`visibility-pill ${task.assigneeId ? "shared" : ""}`}>{task.assigneeId ? "Compartida" : "Privada"}</span></div>
                    <h3>{task.title}</h3>
                    <p className="readonly-building"><span aria-hidden="true">▦</span>{task.building || "Sin consorcio asociado"}</p>
                    {task.description && <p className="readonly-description">{task.description}</p>}
                    <footer><span className={`readonly-due ${dueLabel(task.dueDate) === "Hoy" ? "today" : ""}`}>◷ {dueLabel(task.dueDate)}</span><span className="readonly-comments">♧ {task.comments.length}</span><span className="avatar" title={task.assigneeName ?? task.creatorName}>{initials(task.assigneeName ?? task.creatorName)}</span><strong>{task.assigneeName ?? task.creatorName}</strong></footer>
                  </article>
                ))}
                {tasks.length === 0 && <div className="readonly-empty"><span aria-hidden="true">✓</span><p>No hay tareas en este estado.</p></div>}
              </div>
            </section>
          );
        })}
      </section>
      <p className="readonly-board-note">Esta pantalla se actualiza automáticamente y no permite modificar las tareas.</p>
    </main>
  );
}
