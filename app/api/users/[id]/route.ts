import { deleteUserProfile, updateUserProfile } from "@/db/auth-store";
import { loadWorkspace } from "@/db/task-store";
import { getCurrentIdentity } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Iniciá sesión" }, { status: 401 });
  try {
    const { id } = await context.params;
    await updateUserProfile(identity.userId, id, await request.json());
    return Response.json(await loadWorkspace(identity));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo actualizar el usuario" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Iniciá sesión" }, { status: 401 });
  try {
    const { id } = await context.params;
    await deleteUserProfile(identity.userId, id);
    return Response.json(await loadWorkspace(identity));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo eliminar el usuario" }, { status: 400 });
  }
}
