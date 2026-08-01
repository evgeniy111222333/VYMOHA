import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ensureUserAccount } from "@/src/infrastructure/storage/accounts";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireChatGPTUser("/dashboard");
  const account = await ensureUserAccount({ id: user.userId, email: user.email, name: user.displayName });
  return <DashboardShell user={user} account={account}>{children}</DashboardShell>;
}
