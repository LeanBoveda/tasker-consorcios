import { loadWorkspace } from "@/db/task-store";
import { getCurrentIdentity } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function GET() {
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Necesitás iniciar sesión" }, { status: 401 });
  try {
    return Response.json(await loadWorkspace(identity));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo actualizar Tasker" }, { status: 400 });
  }
}
