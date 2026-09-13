import { ensureDatabase, getDatabase } from "./database";
import { auditStatement, describeChanges, getAuditActor, type AuditActor } from "./activity-store";

const userRoleLabel = (role: string) => role === "admin" ? "Administrador" : "Usuario";

const BOOTSTRAP_SALT = "a5ce7dd3e178939670cfabadb77ce002";
const BOOTSTRAP_HASH = "5d7607f8cf4b631c8f49e37fbe77e0bee69f001ee5d3d77c3f46db423757b1ef";
const PASSWORD_ITERATIONS = 100000;
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const LOGIN_AUDIT_DEDUPE_MS = 30 * 1000;
export const SESSION_COOKIE_NAME = "tasker_session";

export type SessionIdentity = {
  userId: string;
  username: string;
  email: string;
  displayName: string;
};

type LoginRow = {
  id: string;
  workspaceId: string;
  username: string;
  email: string;
  name: string;
  password_hash: string | null;
  password_salt: string | null;
  password_iterations: number;
  status: string;
};

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string) {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function hashPassword(password: string, saltHex: string, iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    hash: "SHA-256",
    salt: fromHex(saltHex),
    iterations,
  }, key, 256);
  return toHex(new Uint8Array(bits));
}

function randomHex(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return toHex(bytes);
}

function equalHex(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function loginAuditStatement(user: LoginRow, now: number) {
  return getDatabase().prepare(`INSERT INTO activity_log
    (id, workspace_id, actor_id, actor_name, actor_username, action, entity_type, entity_id, entity_label, details, created_at)
    SELECT ?, ?, ?, ?, ?, 'session.login', 'session', NULL, 'Inicio de sesión', '[]', ?
    WHERE NOT EXISTS (
      SELECT 1 FROM activity_log
      WHERE workspace_id = ? AND actor_id = ? AND action = 'session.login' AND created_at >= ?
    )`).bind(crypto.randomUUID(), user.workspaceId, user.id, user.name, user.username || "", now,
      user.workspaceId, user.id, now - LOGIN_AUDIT_DEDUPE_MS);
}

export async function ensureBootstrapAdmin() {
  await ensureDatabase();
  const db = getDatabase();
  const bootstrapAdmin = await db.prepare(
    "SELECT id, password_hash, password_iterations FROM users WHERE email = 'admin@tasker.local' AND workspace_id = 'main'"
  ).first<{ id: string; password_hash: string | null; password_iterations: number }>();
  if (bootstrapAdmin?.password_hash && bootstrapAdmin.password_iterations <= PASSWORD_ITERATIONS) return;
  if (bootstrapAdmin) {
    await db.prepare(`UPDATE users SET password_hash = ?, password_salt = ?,
      password_iterations = ?, status = 'active' WHERE id = ?`)
      .bind(BOOTSTRAP_HASH, BOOTSTRAP_SALT, PASSWORD_ITERATIONS, bootstrapAdmin.id).run();
    return;
  }

  const configured = await db.prepare(
    "SELECT id, password_hash, password_iterations FROM users WHERE username = 'admin' AND workspace_id = 'main'"
  ).first<{ id: string; password_hash: string | null; password_iterations: number }>();
  if (configured?.password_hash && configured.password_iterations <= PASSWORD_ITERATIONS) return;

  const now = Date.now();
  if (configured) {
    await db.prepare(`UPDATE users SET password_hash = ?, password_salt = ?,
      password_iterations = ?, status = 'active' WHERE id = ?`)
      .bind(BOOTSTRAP_HASH, BOOTSTRAP_SALT, PASSWORD_ITERATIONS, configured.id).run();
    return;
  }

  const existingAdmin = await db.prepare(
    "SELECT id FROM users WHERE role = 'admin' AND status = 'active' AND workspace_id = 'main' ORDER BY created_at LIMIT 1"
  ).first<{ id: string }>();
  if (existingAdmin) return;

  await db.prepare(`INSERT INTO users
    (id, auth_user_id, username, email, name, role, status, password_hash,
      password_salt, password_iterations, created_at, last_seen_at)
    VALUES (?, NULL, 'admin', 'admin@tasker.local', 'Administrador', 'admin',
      'active', ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), BOOTSTRAP_HASH, BOOTSTRAP_SALT, PASSWORD_ITERATIONS, now, now).run();
}

export async function login(usernameValue: string, password: string) {
  await ensureBootstrapAdmin();
  const username = usernameValue.trim().toLowerCase();
  const db = getDatabase();
  const user = await db.prepare(`SELECT id, username, email, name, password_hash,
      password_salt, password_iterations, status, workspace_id AS workspaceId
    FROM users WHERE lower(username) = ?`)
    .bind(username).first<LoginRow>();

  if (!user || user.status !== "active" || !user.password_hash || !user.password_salt) {
    throw new Error("Usuario o contraseña incorrectos");
  }
  if (user.password_iterations > PASSWORD_ITERATIONS) {
    throw new Error("Este usuario debe volver a cargarse desde el Excel");
  }
  const candidate = await hashPassword(password, user.password_salt, user.password_iterations);
  if (!equalHex(candidate, user.password_hash)) throw new Error("Usuario o contraseña incorrectos");

  const token = randomHex(32);
  const tokenHash = await sha256(token);
  const now = Date.now();
  await getDatabase().batch([
    getDatabase().prepare("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .bind(tokenHash, user.id, now, now + SESSION_DURATION_MS),
    getDatabase().prepare("UPDATE users SET last_seen_at = ? WHERE id = ?").bind(now, user.id),
    loginAuditStatement(user, now),
  ]);
  return { token, expiresAt: now + SESSION_DURATION_MS };
}

export async function validateSession(token: string): Promise<SessionIdentity | null> {
  if (!token) return null;
  await ensureBootstrapAdmin();
  const tokenHash = await sha256(token);
  const row = await getDatabase().prepare(`SELECT u.id AS user_id, u.username,
      u.email, u.name
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.id = ? AND s.expires_at > ? AND u.status = 'active'`)
    .bind(tokenHash, Date.now()).first<{
      user_id: string; username: string; email: string; name: string;
    }>();
  if (!row) return null;
  return { userId: row.user_id, username: row.username, email: row.email, displayName: row.name };
}

export async function logout(token: string) {
  if (!token) return;
  await ensureDatabase();
  const db = getDatabase();
  const hash = await sha256(token);
  const actor = await db.prepare(`SELECT u.id, u.workspace_id AS workspaceId, u.name, u.username
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?`)
    .bind(hash, Date.now()).first<AuditActor>();
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE id = ?").bind(hash),
    ...(actor ? [auditStatement(actor, "session.logout", "session", null, "Cierre de sesión")] : []),
  ]);
}

export async function importUsers(currentUserId: string, rows: Array<{
  username?: string; name?: string; password?: string; role?: string;
}>) {
  await ensureBootstrapAdmin();
  const db = getDatabase();
  const admin = await db.prepare("SELECT role, workspace_id FROM users WHERE id = ? AND status = 'active'").bind(currentUserId).first<{ role: string; workspace_id: string }>();
  if (admin?.role !== "admin") throw new Error("Solo el administrador puede importar usuarios");
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("El archivo no contiene usuarios");
  if (rows.length > 20) throw new Error("Podés importar hasta 20 usuarios por archivo");
  const actor = await getAuditActor(currentUserId);

  const statements: D1PreparedStatement[] = [];
  const admins = await db.prepare("SELECT id FROM users WHERE role = 'admin' AND status = 'active' AND workspace_id = ?")
    .bind(admin.workspace_id).all<{ id: string }>();
  const remainingAdmins = new Set((admins.results ?? []).map((user) => user.id));
  const seen = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const username = String(row.username ?? "").trim().toLowerCase();
    const name = String(row.name ?? "").trim();
    const password = String(row.password ?? "");
    const role = String(row.role ?? "member").trim().toLowerCase();
    if (!username || !name || !password) throw new Error(`Faltan datos en la fila ${index + 2}`);
    if (seen.has(username)) throw new Error(`El usuario "${username}" está repetido`);
    seen.add(username);

    const salt = randomHex(16);
    const passwordHash = await hashPassword(password, salt);
    const existing = await db.prepare("SELECT id, workspace_id, name, role, status FROM users WHERE lower(username) = ?")
      .bind(username).first<{ id: string; workspace_id: string; name: string; role: string; status: string }>();
    if (existing && existing.workspace_id !== admin.workspace_id) {
      throw new Error(`El usuario "${username}" no está disponible. Elegí otro nombre de usuario para este espacio`);
    }
    const isAdmin = role === "admin" || role === "administrador";
    if (existing && !isAdmin) remainingAdmins.delete(existing.id);
    if (isAdmin) remainingAdmins.add(existing?.id ?? username);
    if (existing) {
      statements.push(db.prepare(`UPDATE users SET name = ?, role = ?, status = 'active',
        password_hash = ?, password_salt = ?, password_iterations = ? WHERE id = ?`)
        .bind(name, role === "admin" || role === "administrador" ? "admin" : "member",
          passwordHash, salt, PASSWORD_ITERATIONS, existing.id));
      statements.push(auditStatement(actor, "user.import_updated", "user", existing.id, `${name} (@${username})`, [
        ...describeChanges({ name: existing.name, role: userRoleLabel(existing.role), status: existing.status },
          { name, role: userRoleLabel(isAdmin ? "admin" : "member"), status: "active" },
          { name: "Nombre", role: "Permiso", status: "Estado de la cuenta" }),
        "Contraseña actualizada desde Excel (valor no registrado)",
      ]));
    } else {
      const now = Date.now();
      const userId = crypto.randomUUID();
      statements.push(db.prepare(`INSERT INTO users
        (id, auth_user_id, username, email, name, role, status, password_hash,
          password_salt, password_iterations, created_at, last_seen_at, workspace_id)
        VALUES (?, NULL, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`)
        .bind(userId, username, `${crypto.randomUUID()}@tasker.local`, name,
          role === "admin" || role === "administrador" ? "admin" : "member",
          passwordHash, salt, PASSWORD_ITERATIONS, now, now, admin.workspace_id));
      statements.push(auditStatement(actor, "user.import_created", "user", userId, `${name} (@${username})`,
        [`Permiso: ${userRoleLabel(isAdmin ? "admin" : "member")}`, "Usuario creado desde Excel"]));
    }
  }
  if (!remainingAdmins.size) throw new Error("Debe quedar al menos un administrador en este espacio");
  await db.batch(statements);
  await db.prepare("PRAGMA optimize").run();
}

export async function updateUserProfile(currentUserId: string, targetUserId: string, input: {
  username?: string; name?: string; role?: string; password?: string;
}) {
  await ensureBootstrapAdmin();
  const db = getDatabase();
  const admin = await db.prepare("SELECT role, workspace_id FROM users WHERE id = ? AND status = 'active'")
    .bind(currentUserId).first<{ role: string; workspace_id: string }>();
  if (admin?.role !== "admin") throw new Error("Solo el administrador puede modificar usuarios");

  const target = await db.prepare("SELECT id, role, name, username FROM users WHERE id = ? AND status = 'active' AND workspace_id = ?")
    .bind(targetUserId, admin.workspace_id).first<{ id: string; role: string; name: string; username: string }>();
  if (!target) throw new Error("Usuario no encontrado");

  const username = String(input.username ?? "").trim().toLowerCase();
  const name = String(input.name ?? "").trim();
  const role = input.role === "admin" ? "admin" : "member";
  const password = String(input.password ?? "");
  if (!username || !name) throw new Error("El nombre y el usuario son obligatorios");

  const duplicate = await db.prepare("SELECT id FROM users WHERE lower(username) = ? AND id <> ?")
    .bind(username, targetUserId).first();
  if (duplicate) throw new Error(`El usuario "${username}" ya existe`);

  if (target.role === "admin" && role !== "admin") {
    const admins = await db.prepare("SELECT count(*) AS total FROM users WHERE role = 'admin' AND status = 'active' AND workspace_id = ?")
      .bind(admin.workspace_id).first<{ total: number }>();
    if ((admins?.total ?? 0) <= 1) throw new Error("Debe quedar al menos un administrador");
  }

  const actor = await getAuditActor(currentUserId);
  const changes = describeChanges({ ...target, role: userRoleLabel(target.role) },
    { username, name, role: userRoleLabel(role) }, { username: "Usuario", name: "Nombre", role: "Permiso" });
  if (password) changes.push("Contraseña actualizada (valor no registrado)");
  if (!changes.length) return;
  const statements: D1PreparedStatement[] = [];
  if (password) {
    const salt = randomHex(16);
    const passwordHash = await hashPassword(password, salt);
    statements.push(db.prepare(`UPDATE users SET username = ?, name = ?, role = ?, password_hash = ?,
      password_salt = ?, password_iterations = ? WHERE id = ?`)
      .bind(username, name, role, passwordHash, salt, PASSWORD_ITERATIONS, targetUserId));
  } else {
    statements.push(db.prepare("UPDATE users SET username = ?, name = ?, role = ? WHERE id = ?")
      .bind(username, name, role, targetUserId));
  }
  statements.push(auditStatement(actor, "user.updated", "user", targetUserId, `${name} (@${username})`, changes));
  await db.batch(statements);
}

export async function deleteUserProfile(currentUserId: string, targetUserId: string) {
  await ensureBootstrapAdmin();
  const db = getDatabase();
  const admin = await db.prepare("SELECT role, workspace_id FROM users WHERE id = ? AND status = 'active'")
    .bind(currentUserId).first<{ role: string; workspace_id: string }>();
  if (admin?.role !== "admin") throw new Error("Solo el administrador puede eliminar usuarios");
  if (currentUserId === targetUserId) throw new Error("No podés eliminar tu propio usuario");

  const target = await db.prepare("SELECT id, role, name, username FROM users WHERE id = ? AND status = 'active' AND workspace_id = ?")
    .bind(targetUserId, admin.workspace_id).first<{ id: string; role: string; name: string; username: string }>();
  if (!target) throw new Error("Usuario no encontrado");

  if (target.role === "admin") {
    const admins = await db.prepare("SELECT count(*) AS total FROM users WHERE role = 'admin' AND status = 'active' AND workspace_id = ?")
      .bind(admin.workspace_id).first<{ total: number }>();
    if ((admins?.total ?? 0) <= 1) throw new Error("Debe quedar al menos un administrador");
  }

  await db.batch([
    db.prepare("UPDATE users SET status = 'invited' WHERE id = ?").bind(targetUserId),
    db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(targetUserId),
    auditStatement(await getAuditActor(currentUserId), "user.deleted", "user", targetUserId, `${target.name} (@${target.username})`,
      ["Cuenta desactivada y sesiones cerradas. Se conserva su actividad anterior"]),
  ]);
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(new Uint8Array(digest));
}
