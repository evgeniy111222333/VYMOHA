import { requireAuthUser as requireChatGPTUser } from "@/app/auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ensureUserAccount } from "@/src/infrastructure/storage/accounts";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  alternates: { canonical: null },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireChatGPTUser("/dashboard");
  const account = await ensureUserAccount({ id: user.userId, email: user.email, name: user.displayName });
  return <DashboardShell user={user} account={account}>{children}</DashboardShell>;
}
