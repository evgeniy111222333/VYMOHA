"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, Building2, Coins, FileArchive, LayoutDashboard, Radar, SearchCheck, ShieldCheck } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Огляд", icon: LayoutDashboard },
  { href: "/dashboard/tenders", label: "Мої перевірки", icon: SearchCheck },
  { href: "/dashboard/monitoring", label: "Моніторинг", icon: Radar },
  { href: "/dashboard/company", label: "Профіль компанії", icon: Building2 },
  { href: "/dashboard/documents", label: "Документи", icon: FileArchive },
  { href: "/dashboard/analytics", label: "Аналітика", icon: BarChart3 },
  { href: "/dashboard/billing", label: "Сигнали", icon: Coins },
];

const adminLinks = [
  { href: "/dashboard/admin", label: "Адміністратор", icon: ShieldCheck },
  { href: "/dashboard/admin/diagnostics", label: "Діагностика", icon: Activity },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/dashboard/admin") return pathname === "/dashboard/admin";
  return pathname.startsWith(href);
}

export function DashboardNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const all = isAdmin ? [...links, ...adminLinks] : links;
  return (
    <nav aria-label="Навігація кабінету">
      {all.map((link) => {
        const active = isActive(pathname, link.href);
        const admin = link.href.startsWith("/dashboard/admin");
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`${active ? "is-active" : ""} ${admin ? "dashboard-admin-link" : ""}`.trim()}
          >
            <link.icon size={18} />{link.label}
          </Link>
        );
      })}
    </nav>
  );
}
