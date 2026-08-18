import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, validateSession } from "@/db/auth-store";

export type AuthIdentity = {
  userId: string;
  username: string;
  email: string;
  displayName: string;
};

export async function getCurrentIdentity(): Promise<AuthIdentity | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? "";
  return validateSession(token);
}
