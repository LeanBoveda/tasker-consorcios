import { createAutomaticIntakeTest } from "@/db/task-store";
import { getCurrentIdentity } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Necesitás iniciar sesión" }, { status: 401 });
  try {
    return Response.json(await createAutomaticIntakeTest(identity, await request.json()));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo simular el ingreso" }, { status: 400 });
  }
}
