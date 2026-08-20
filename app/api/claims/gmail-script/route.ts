import { env } from "cloudflare:workers";
import { ensureDatabase, getDatabase } from "@/db/database";
import { getCurrentIdentity } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function GET() {
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Necesitás iniciar sesión" }, { status: 401 });
  await ensureDatabase();
  const user = await getDatabase().prepare("SELECT role FROM users WHERE id = ? AND status = 'active'")
    .bind(identity.userId).first<{ role: string }>();
  if (user?.role !== "admin") return Response.json({ error: "Solo el administrador puede conectar Gmail" }, { status: 403 });

  const intakeKey = String(env.EMAIL_INTAKE_KEY ?? "");
  if (!intakeKey) return Response.json({ error: "La conexión de Gmail todavía no está habilitada" }, { status: 503 });

  const script = `const TASKER_URL = "https://tasker-consorcios.cuentagpt050.chatgpt.site/api/claims/email-intake";
const TASKER_KEY = "${intakeKey}";
const TASKER_ADDRESS = "leandroboveda@gmail.com";
const PROCESSED_LABEL = "Tasker-Procesado";

function configurarTasker() {
  GmailApp.getUserLabelByName(PROCESSED_LABEL) || GmailApp.createLabel(PROCESSED_LABEL);
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === "procesarReclamosTasker")
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger("procesarReclamosTasker").timeBased().everyMinutes(1).create();
  procesarReclamosTasker();
}

function procesarReclamosTasker() {
  const label = GmailApp.getUserLabelByName(PROCESSED_LABEL) || GmailApp.createLabel(PROCESSED_LABEL);
  const query = \`to:\${TASKER_ADDRESS} subject:"[RECLAMO]" newer_than:7d -label:\${PROCESSED_LABEL}\`;
  const threads = GmailApp.search(query, 0, 20);
  threads.forEach((thread) => {
    let completed = true;
    thread.getMessages().forEach((message) => {
      if (!/^\\[RECLAMO\\]/i.test(message.getSubject().trim())) return;
      const from = message.getFrom();
      const emailMatch = from.match(/<([^>]+)>/);
      const senderEmail = emailMatch ? emailMatch[1] : from;
      const senderName = emailMatch ? from.replace(/<[^>]+>/, "").replace(/^"|"$/g, "").trim() : from;
      const response = UrlFetchApp.fetch(TASKER_URL, {
        method: "post", contentType: "application/json",
        headers: { "X-Tasker-Intake-Key": TASKER_KEY },
        payload: JSON.stringify({ externalId: message.getId(), senderName, senderEmail,
          subject: message.getSubject(), body: message.getPlainBody(), receivedAt: message.getDate().getTime() }),
        muteHttpExceptions: true,
      });
      if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
        completed = false;
        throw new Error(\`Tasker rechazó el correo: \${response.getContentText()}\`);
      }
    });
    if (completed) thread.addLabel(label);
  });
}`;

  return new Response(script, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
