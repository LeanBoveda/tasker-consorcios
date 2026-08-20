import { getCurrentIdentity } from "@/lib/current-user";
import { resetOperationalData } from "@/db/task-store";

export const dynamic = "force-dynamic";

export async function DELETE() {
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Necesitás iniciar sesión" }, { status: 401 });
  try {
    return Response.json(await resetOperationalData(identity));
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "No se pudieron limpiar los datos operativos",
    }, { status: 400 });
  }
}
