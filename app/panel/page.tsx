import { redirect } from "next/navigation";
import { loadWorkspace } from "@/db/task-store";
import { getCurrentIdentity } from "@/lib/current-user";
import ReadOnlyBoard from "./ReadOnlyBoard";

export const dynamic = "force-dynamic";

export default async function PanelPage() {
  const identity = await getCurrentIdentity();
  if (!identity) redirect("/login");
  const data = await loadWorkspace(identity);
  return <ReadOnlyBoard initialData={data} />;
}
