import { headers } from "next/headers";
import { getChatGPTUser } from "@/app/chatgpt-auth";

export type AuthIdentity = {
  userId: string;
  email: string;
  displayName: string;
};

export async function getCurrentIdentity(): Promise<AuthIdentity | null> {
  const user = await getChatGPTUser();
  if (user) return { userId: user.userId, email: user.email, displayName: user.displayName };

  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) {
    return { userId: "local-admin", email: "mariano@tasker.local", displayName: "Mariano Gómez" };
  }
  return null;
}
