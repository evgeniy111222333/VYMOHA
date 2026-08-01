import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireChatGPTUser("/dashboard");
  return <DashboardShell user={user}>{children}</DashboardShell>;
}
