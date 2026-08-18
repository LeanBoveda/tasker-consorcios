import { deleteTask, updateTask } from "@/db/task-store";
import { getCurrentIdentity } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Necesitás iniciar sesión" }, { status: 401 });
  try {
    const { id } = await context.params;
    return Response.json(await updateTask(identity, id, await request.json()));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo actualizar la tarea" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Necesitás iniciar sesión" }, { status: 401 });
  try {
    const { id } = await context.params;
    return Response.json(await deleteTask(identity, id));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo eliminar la tarea" }, { status: 400 });
  }
}
