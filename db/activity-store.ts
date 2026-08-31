import type { AuthIdentity } from "@/lib/current-user";
import { ensureDatabase, getDatabase } from "./database";

export type AuditActor = { id: string; workspaceId: string; name: string; username: string };
export type ActivityItem = {
  id: string; actorId: string; actorName: string; actorUsername: string;
  action: string; entityType: string; entityId: string | null; entityLabel: string;
  details: string[]; createdAt: number;
};
export type ActivityPage = { items: ActivityItem[]; nextCursor: string | null };
export class ActivityAccessError extends Error {}

export async function getAuditActor(userId: string): Promise<AuditActor> {
  const actor = await getDatabase().prepare(`SELECT id, workspace_id AS workspaceId, name, username
    FROM users WHERE id = ? AND status = 'active'`).bind(userId).first<AuditActor>();
  if (!actor) throw new Error("Usuario no autorizado");
  return actor;
}

// Only explicit, non-secret descriptions belong here. Never pass request bodies,
// password hashes, session tokens, integration keys or whole user records.
export function auditStatement(actor: AuditActor, action: string, entityType: string,
  entityId: string | null, entityLabel: string, details: string[] = []) {
  return getDatabase().prepare(`INSERT INTO activity_log
    (id, workspace_id, actor_id, actor_name, actor_username, action, entity_type, entity_id, entity_label, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      crypto.randomUUID(), actor.workspaceId, actor.id, actor.name, actor.username || "",
      action, entityType, entityId, entityLabel.slice(0, 500),
      JSON.stringify(details.slice(0, 20).map((line) => line.slice(0, 1200))), Date.now(),
    );
}

export function auditText(value: unknown): string {
  const text = String(value ?? "").trim();
  return text ? text.length > 500 ? `${text.slice(0, 500)}…` : text : "Sin valor";
}

export function describeChanges(before: Record<string, unknown>, after: Record<string, unknown>, labels: Record<string, string>) {
  return Object.entries(labels).filter(([key]) => String(before[key] ?? "") !== String(after[key] ?? ""))
    .map(([key, label]) => `${label}: ${auditText(before[key])} → ${auditText(after[key])}`);
}

export async function listActivity(identity: AuthIdentity, options: {
  actorId?: string; entityType?: string; search?: string; cursor?: string; limit?: number;
} = {}): Promise<ActivityPage> {
  await ensureDatabase();
  const db = getDatabase();
  const user = await db.prepare("SELECT role, workspace_id FROM users WHERE id = ? AND status = 'active'")
    .bind(identity.userId).first<{ role: string; workspace_id: string }>();
  if (user?.role !== "admin") throw new ActivityAccessError("Solo los administradores pueden consultar la actividad");
  const clauses = ["workspace_id = ?"];
  const values: Array<string | number> = [user.workspace_id];
  if (options.actorId) { clauses.push("actor_id = ?"); values.push(options.actorId.slice(0, 200)); }
  if (options.entityType) {
    if (!["task", "user", "consortium", "intake", "session", "workspace"].includes(options.entityType)) throw new Error("Tipo de actividad inválido");
    clauses.push("entity_type = ?"); values.push(options.entityType);
  }
  const search = (options.search ?? "").trim().slice(0, 100);
  if (search) {
    clauses.push("(entity_label LIKE ? ESCAPE '\\' OR actor_name LIKE ? ESCAPE '\\' OR actor_username LIKE ? ESCAPE '\\')");
    const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    values.push(pattern, pattern, pattern);
  }
  if (options.cursor) {
    const match = /^(\d+)\|([a-f0-9-]{36})$/.exec(options.cursor);
    if (!match || !Number.isSafeInteger(Number(match[1]))) throw new Error("Página de actividad inválida");
    clauses.push("(created_at < ? OR (created_at = ? AND id < ?))");
    values.push(Number(match[1]), Number(match[1]), match[2]);
  }
  const limit = Number.isFinite(options.limit) ? Math.max(1, Math.min(100, Math.floor(options.limit!))) : 50;
  const result = await db.prepare(`SELECT id, actor_id AS actorId, actor_name AS actorName,
    actor_username AS actorUsername, action, entity_type AS entityType, entity_id AS entityId,
    entity_label AS entityLabel, details, created_at AS createdAt FROM activity_log
    WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC, id DESC LIMIT ?`)
    .bind(...values, limit + 1).all<Omit<ActivityItem, "details"> & { details: string }>();
  const rows = result.results ?? [];
  const items = rows.slice(0, limit).map((row) => {
    let details: string[] = [];
    try {
      const parsed = JSON.parse(row.details);
      if (Array.isArray(parsed)) details = parsed.filter((value): value is string => typeof value === "string");
    } catch { /* Historical rows remain readable even if their details are invalid. */ }
    return { ...row, details };
  });
  const last = items.at(-1);
  return { items, nextCursor: rows.length > limit && last ? `${last.createdAt}|${last.id}` : null };
}
