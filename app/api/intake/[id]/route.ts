import { reviewAutomaticIntake } from "@/db/task-store";
import { getCurrentIdentity } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Necesitás iniciar sesión" }, { status: 401 });
  try {
    const { id } = await context.params;
    const input = await request.json() as { action?: unknown };
    return Response.json(await reviewAutomaticIntake(identity, id, input.action));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo revisar el ingreso" }, { status: 400 });
  }
}
