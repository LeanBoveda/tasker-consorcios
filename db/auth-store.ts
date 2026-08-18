import { ensureDatabase, getDatabase } from "./database";

const BOOTSTRAP_SALT = "a5ce7dd3e178939670cfabadb77ce002";
const BOOTSTRAP_HASH = "5d7607f8cf4b631c8f49e37fbe77e0bee69f001ee5d3d77c3f46db423757b1ef";
const PASSWORD_ITERATIONS = 100000;
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE_NAME = "tasker_session";

export type SessionIdentity = {
  userId: string;
  username: string;
  email: string;
  displayName: string;
};

type LoginRow = {
  id: string;
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

export async function ensureBootstrapAdmin() {
  await ensureDatabase();
  const db = getDatabase();
  const configured = await db.prepare(
    "SELECT id, password_hash, password_iterations FROM users WHERE username = 'admin'"
  ).first<{ id: string; password_hash: string | null; password_iterations: number }>();
  if (configured?.password_hash && configured.password_iterations <= PASSWORD_ITERATIONS) return;

  const existingAdmin = configured ?? await db.prepare(
    "SELECT id, password_hash FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1"
  ).first<{ id: string; password_hash: string | null }>();
  const now = Date.now();
  if (existingAdmin) {
    await db.prepare(`UPDATE users SET username = 'admin', password_hash = ?,
      password_salt = ?, password_iterations = ?, status = 'active' WHERE id = ?`)
      .bind(BOOTSTRAP_HASH, BOOTSTRAP_SALT, PASSWORD_ITERATIONS, existingAdmin.id).run();
    return;
  }

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
      password_salt, password_iterations, status
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
  await getDatabase().prepare("DELETE FROM sessions WHERE id = ?").bind(await sha256(token)).run();
}

export async function importUsers(currentUserId: string, rows: Array<{
  username?: string; name?: string; password?: string; role?: string;
}>) {
  await ensureBootstrapAdmin();
  const db = getDatabase();
  const admin = await db.prepare("SELECT role FROM users WHERE id = ?").bind(currentUserId).first<{ role: string }>();
  if (admin?.role !== "admin") throw new Error("Solo el administrador puede importar usuarios");
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("El archivo no contiene usuarios");
  if (rows.length > 20) throw new Error("Podés importar hasta 20 usuarios por archivo");

  const statements: D1PreparedStatement[] = [];
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
    const existing = await db.prepare("SELECT id FROM users WHERE lower(username) = ?")
      .bind(username).first<{ id: string }>();
    if (existing) {
      statements.push(db.prepare(`UPDATE users SET name = ?, role = ?, status = 'active',
        password_hash = ?, password_salt = ?, password_iterations = ? WHERE id = ?`)
        .bind(name, role === "admin" || role === "administrador" ? "admin" : "member",
          passwordHash, salt, PASSWORD_ITERATIONS, existing.id));
    } else {
      const now = Date.now();
      statements.push(db.prepare(`INSERT INTO users
        (id, auth_user_id, username, email, name, role, status, password_hash,
          password_salt, password_iterations, created_at, last_seen_at)
        VALUES (?, NULL, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), username, `${crypto.randomUUID()}@tasker.local`, name,
          role === "admin" || role === "administrador" ? "admin" : "member",
          passwordHash, salt, PASSWORD_ITERATIONS, now, now));
    }
  }
  await db.batch(statements);
  await db.prepare("PRAGMA optimize").run();
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(new Uint8Array(digest));
}
