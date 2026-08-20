import { env } from "cloudflare:workers";
import {
  completeEmailNotifications,
  getEmailAutomationConfiguration,
  reserveEmailNotifications,
} from "@/db/task-store";

export const dynamic = "force-dynamic";

function sameSecret(received: string, expected: string) {
  if (!received || !expected || received.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < received.length; index += 1) {
    difference |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export async function POST(request: Request) {
  const expectedKey = String(env.EMAIL_INTAKE_KEY ?? "");
  const receivedKey = request.headers.get("x-tasker-intake-key") ?? "";
  if (!sameSecret(receivedKey, expectedKey)) {
    return Response.json({ error: "Conexión de correo no autorizada" }, { status: 401 });
  }
  try {
    const input = await request.json() as { action?: string; sentIds?: unknown; failedIds?: unknown };
    if (input.action === "configuration") return Response.json(await getEmailAutomationConfiguration());
    if (input.action === "reminders") return Response.json(await reserveEmailNotifications());
    if (input.action === "acknowledge") return Response.json(await completeEmailNotifications(input));
    return Response.json({ error: "Acción de automatización desconocida" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo ejecutar la automatización" }, { status: 400 });
  }
}
