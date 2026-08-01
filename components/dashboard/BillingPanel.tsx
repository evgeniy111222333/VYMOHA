"use client";

import { useState } from "react";
import { ArrowUpRight, Check, LoaderCircle, WalletCards } from "lucide-react";
import type { CreditPackage } from "@/src/domain/billing/packages";

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
    {error && <div className="billing-notice" role="alert"><WalletCards size={18} /><span>{error}</span></div>}
    <div className="credit-pack-grid">{packages.map((pack) => <article key={pack.id} className={pack.popular ? "credit-pack credit-pack--featured" : "credit-pack"}>
      {pack.popular && <span className="credit-pack__label">Оптимально</span>}
      <small>{pack.name}</small><strong>{pack.credits}<i>cr</i></strong>
      <p>{pack.description}</p>
      <ul><li><Check size={14} /> Кредити не згорають</li><li><Check size={14} /> Повна історія списань</li></ul>
      <button onClick={() => checkout(pack.id)} disabled={Boolean(loading)}>{loading === pack.id ? <LoaderCircle className="spin" size={16} /> : <ArrowUpRight size={16} />} {(pack.amountMinor / 100).toLocaleString("uk-UA")} ₴</button>
    </article>)}</div>
  </>;
}
