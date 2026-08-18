import { redirect } from "next/navigation";
import TaskApp from "./TaskApp";
import { chatGPTSignInPath } from "./chatgpt-auth";
import { loadWorkspace } from "@/db/task-store";
import { getCurrentIdentity } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function Home() {
  const identity = await getCurrentIdentity();
  if (!identity) redirect(chatGPTSignInPath("/"));
  const data = await loadWorkspace(identity);
  return <TaskApp initialData={data} />;
}
