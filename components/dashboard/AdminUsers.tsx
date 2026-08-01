"use client";

import { useState } from "react";
import { BadgeCheck, Ban, Coins, LoaderCircle, ShieldCheck } from "lucide-react";
import type { UserAccount } from "@/src/infrastructure/storage/accounts";

export function AdminUsers({ initialUsers }: { initialUsers: UserAccount[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function mutate(userId: string, payload: Record<string, unknown>) {
    setBusy(`${userId}:${payload.action}`); setError("");
    try {
      const response = await fetch("/api/admin/users", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId, ...payload }) });
      const result = await response.json() as { data?: UserAccount[]; error?: { message?: string } };
      if (!response.ok || !result.data) throw new Error(result.error?.message ?? "Дію не виконано.");
      setUsers(result.data);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Дію не виконано."); }
    finally { setBusy(null); }
  }

  return <div className="admin-users">
    {error && <div className="form-error" role="alert">{error}</div>}
    {users.map((user) => <article key={user.userId} className="admin-user-card">
      <div className="admin-user-card__identity">
        <span className={`admin-avatar admin-avatar--${user.role}`}>{user.displayName.slice(0, 2).toUpperCase()}</span>
        <div><b>{user.displayName}</b><small>{user.phone ?? user.email}</small><code>{user.userId.slice(0, 12)}…</code></div>
      </div>
      <div className="admin-user-card__metric"><small>Баланс</small><b><Coins size={15} /> {user.creditBalance}</b></div>
      <div className="admin-user-card__controls">
        <button onClick={() => mutate(user.userId, { action: "role", role: user.role === "admin" ? "user" : "admin" })} disabled={Boolean(busy)}>
          {busy === `${user.userId}:role` ? <LoaderCircle className="spin" size={15} /> : user.role === "admin" ? <BadgeCheck size={15} /> : <ShieldCheck size={15} />}
          {user.role === "admin" ? "Зняти admin" : "Зробити admin"}
        </button>
        <button onClick={() => mutate(user.userId, { action: "credits", credits: 100, note: "Ручне нарахування адміністратором" })} disabled={Boolean(busy)}><Coins size={15} /> +100</button>
        <button className={user.status === "suspended" ? "is-positive" : "is-danger"} onClick={() => mutate(user.userId, { action: "status", status: user.status === "active" ? "suspended" : "active" })} disabled={Boolean(busy)}><Ban size={15} />{user.status === "active" ? "Зупинити" : "Активувати"}</button>
      </div>
    </article>)}
  </div>;
}
