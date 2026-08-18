import { importUsers } from "@/db/auth-store";
import { loadWorkspace } from "@/db/task-store";
import { getCurrentIdentity } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Iniciá sesión" }, { status: 401 });
  try {
    const input = await request.json() as { users?: Array<{ username?: string; name?: string; password?: string; role?: string }> };
    await importUsers(identity.userId, input.users ?? []);
    return Response.json(await loadWorkspace(identity));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudieron importar los usuarios" }, { status: 400 });
  }
}
