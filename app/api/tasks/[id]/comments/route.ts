import { addComment } from "@/db/task-store";
import { getCurrentIdentity } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Necesitás iniciar sesión" }, { status: 401 });
  try {
    const { id } = await context.params;
    const input = await request.json() as { body?: string };
    return Response.json(await addComment(identity, id, input.body ?? ""));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo agregar el comentario" }, { status: 400 });
  }
}
