import { env } from "cloudflare:workers";

function sameSecret(received: string, expected: string) {
  if (!received || !expected || received.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < received.length; index += 1) {
    difference |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export function isAuthorizedIntakeRequest(request: Request) {
  const expected = String(env.TASKER_INTAKE_KEY ?? env.EMAIL_INTAKE_KEY ?? "");
  const received = request.headers.get("x-tasker-intake-key") ?? "";
  return sameSecret(received, expected);
}
