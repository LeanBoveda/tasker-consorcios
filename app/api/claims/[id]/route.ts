import { deleteClaim } from "@/db/task-store";
import { getCurrentIdentity } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Necesitás iniciar sesión" }, { status: 401 });
  try {
    const { id } = await context.params;
    return Response.json(await deleteClaim(identity, id));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo eliminar el reclamo" }, { status: 400 });
  }
}
