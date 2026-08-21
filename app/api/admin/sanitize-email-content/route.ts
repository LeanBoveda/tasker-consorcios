import { getCurrentIdentity } from "@/lib/current-user";
import { sanitizeImportedEmails } from "@/db/task-store";

export const dynamic = "force-dynamic";

export async function POST() {
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Necesitás iniciar sesión" }, { status: 401 });
  try {
    return Response.json(await sanitizeImportedEmails(identity));
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "No se pudieron limpiar los correos importados",
    }, { status: 400 });
  }
}
