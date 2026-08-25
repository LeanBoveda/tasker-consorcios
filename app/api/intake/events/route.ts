import { ingestAutomaticItem } from "@/db/task-store";
import { isAuthorizedIntakeRequest } from "@/lib/intake-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAuthorizedIntakeRequest(request)) {
    return Response.json({ error: "Conexión del receptor no autorizada" }, { status: 401 });
  }
  try {
    return Response.json(await ingestAutomaticItem(await request.json()));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo procesar el ingreso" }, { status: 400 });
  }
}
