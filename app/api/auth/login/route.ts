import { login, SESSION_COOKIE_NAME } from "@/db/auth-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = await request.json() as { username?: string; password?: string };
    if (!input.username?.trim() || !input.password) throw new Error("Completá usuario y contraseña");
    const session = await login(input.username, input.password);
    const secure = new URL(request.url).protocol === "https:";
    const cookie = [
      `${SESSION_COOKIE_NAME}=${session.token}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${30 * 24 * 60 * 60}`,
      secure ? "Secure" : "",
    ].filter(Boolean).join("; ");
    return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo iniciar sesión" }, { status: 400 });
  }
}
