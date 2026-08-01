import { BarChart3, Building2, Coins, FileArchive, LayoutDashboard, LogOut, Radar, SearchCheck, Settings, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { chatGPTSignOutPath, type ChatGPTUser } from "@/app/chatgpt-auth";
import type { UserAccount } from "@/src/infrastructure/storage/accounts";

const links = [
  { href: "/dashboard", label: "Огляд", icon: LayoutDashboard },
  { href: "/dashboard/tenders", label: "Мої перевірки", icon: SearchCheck },
  { href: "/dashboard/monitoring", label: "Моніторинг", icon: Radar },
  { href: "/dashboard/company", label: "Профіль компанії", icon: Building2 },
  { href: "/dashboard/documents", label: "Документи", icon: FileArchive },
  { href: "/dashboard/analytics", label: "Аналітика", icon: BarChart3 },
  { href: "/dashboard/billing", label: "AI-кредити", icon: Coins },
];

export function DashboardShell({ user, account, children }: { user: ChatGPTUser; account: UserAccount; children: React.ReactNode }) {
  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="dashboard-sidebar__top"><Logo /><span className="dashboard-sidebar__badge">beta</span></div>
        <nav aria-label="Навігація кабінету">{links.map((link) => <a key={link.href} href={link.href}><link.icon size={18} />{link.label}</a>)}{account.role === "admin" && <a href="/dashboard/admin" className="dashboard-admin-link"><ShieldCheck size={18} />Адміністратор</a>}</nav>
        <div className="dashboard-sidebar__bottom"><a href="/dashboard/settings"><Settings size={18} />Налаштування</a><a href={chatGPTSignOutPath("/")}><LogOut size={18} />Вийти</a></div>
      </aside>
      <div className="dashboard-main">
        <header className="dashboard-topbar"><div><span>Робочий простір</span><b>Моя компанія</b></div><div className="dashboard-topbar__right"><a href="/dashboard/billing" className="topbar-balance"><Coins size={14} />{account.creditBalance} cr</a><div className="dashboard-user"><span>{initials(user.displayName)}</span><div><b>{user.displayName}</b><small>{account.role === "admin" ? "Адміністратор" : user.email}</small></div></div></div></header>
        <div className="dashboard-content">{children}</div>
      </div>
    </div>
  );
}

function initials(value: string): string {
  return value.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "В";
}
