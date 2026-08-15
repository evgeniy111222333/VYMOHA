"use client";

import { useState } from "react";
import { ArrowUpRight, Check, LoaderCircle, WalletCards } from "lucide-react";
import type { CreditPackage } from "@/src/domain/billing/packages";
import { formatSignals } from "@/src/domain/billing/presentation";

export function BillingPanel({ packages }: { packages: CreditPackage[] }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function checkout(packageId: string) {
    setLoading(packageId); setError("");
    try {
      const response = await fetch("/api/billing/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ packageId }) });
      const result = await response.json() as { data?: { url?: string }; error?: { message?: string } };
      if (!response.ok || !result.data?.url) throw new Error(result.error?.message ?? "Не вдалося відкрити оплату.");
      window.location.assign(result.data.url);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Не вдалося відкрити оплату."); setLoading(null); }
  }

  return <>
    <div className="billing-notice" role="alert" style={{ background: "rgba(163, 230, 53, 0.1)", border: "1px solid rgba(163, 230, 53, 0.3)", color: "var(--night)", padding: "16px", borderRadius: "12px", display: "flex", gap: "14px", alignItems: "flex-start", fontSize: "13px", lineHeight: 1.5 }}>
      <div style={{ padding: "8px", background: "var(--signal)", borderRadius: "8px", color: "var(--night)", display: "flex" }}>
        <WalletCards size={20} />
      </div>
      <div>
        <strong style={{ display: "block", fontSize: "15px", marginBottom: "4px" }}>Оплата через Монобанку</strong>
        Оберіть пакет нижче. Вас перенаправить на сторінку Монобанку з уже введеною сумою.<br/>
        <b style={{color: "#b04a3e"}}>ВАЖЛИВО:</b> не змінюйте коментар до платежу! Завдяки йому Сигнали зарахуються автоматично (за 1 хв).
      </div>
    </div>
    {error && <div className="billing-notice" role="alert"><WalletCards size={18} /><span>{error}</span></div>}
    <div className="credit-pack-grid">{packages.map((pack) => <article key={pack.id} className={pack.popular ? "credit-pack credit-pack--featured" : "credit-pack"}>
      {pack.popular && <span className="credit-pack__label">Оптимально</span>}
      <small>{pack.name}</small><strong>{pack.credits}<i>сиг.</i></strong>
      <p>{pack.description}</p>
      <ul><li><Check size={14} /> {formatSignals(pack.credits)} не згорають</li><li><Check size={14} /> Прозора історія використання</li></ul>
      <button onClick={() => checkout(pack.id)} disabled={Boolean(loading)}>{loading === pack.id ? <LoaderCircle className="spin" size={16} /> : <ArrowUpRight size={16} />} {(pack.amountMinor / 100).toLocaleString("uk-UA")} ₴</button>
    </article>)}</div>
  </>;
}
