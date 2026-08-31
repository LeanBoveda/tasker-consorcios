import { ActivityAccessError, listActivity } from "@/db/activity-store";
import { getCurrentIdentity } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await getCurrentIdentity();
  if (!identity) return Response.json({ error: "Necesitás iniciar sesión" }, { status: 401 });
  try {
    const query = new URL(request.url).searchParams;
    return Response.json(await listActivity(identity, {
      actorId: query.get("actorId") || undefined,
      entityType: query.get("entityType") || undefined,
      search: query.get("search") || undefined,
      cursor: query.get("cursor") || undefined,
    }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo cargar la actividad" },
      { status: error instanceof ActivityAccessError ? 403 : 400, headers: { "Cache-Control": "no-store" } });
  }
}
