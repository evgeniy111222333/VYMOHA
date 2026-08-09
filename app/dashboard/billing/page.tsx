import { Coins, ReceiptText } from "lucide-react";
import { requireAuthUser as requireChatGPTUser } from "@/app/auth";
import { BillingPanel } from "@/components/dashboard/BillingPanel";
import { CREDIT_PACKAGES } from "@/src/domain/billing/packages";
import { formatSignals } from "@/src/domain/billing/presentation";
import { ensureUserAccount } from "@/src/infrastructure/storage/accounts";
import { listCreditLedger } from "@/src/infrastructure/storage/billing";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const user = await requireChatGPTUser("/dashboard/billing");
  const [account, ledger] = await Promise.all([ensureUserAccount({ id: user.userId, email: user.email, name: user.displayName }), listCreditLedger(user.userId, 30)]);
  return <>
    <div className="dashboard-heading billing-heading"><div><span className="section-kicker">Сигнали Вимоги</span><h1>Платіть тільки за глибину.</h1><p>Швидка перевірка завжди безплатна. Сигнали використовуються лише для поглибленого або експертного читання документів.</p></div><div className="balance-orb"><Coins size={20} /><span><small>Баланс</small><b>{formatSignals(account.creditBalance, true)}</b></span></div></div>
    <BillingPanel packages={CREDIT_PACKAGES} />
    <section className="dashboard-card ledger-card"><div className="dashboard-card__heading"><div><ReceiptText size={18} /><h2>Історія сигналів</h2></div><span>{ledger.length} операцій</span></div>
      {ledger.length ? <div className="ledger-list">{ledger.map((entry) => <div key={entry.id}><span className={entry.delta > 0 ? "ledger-delta ledger-delta--plus" : "ledger-delta"}>{entry.delta > 0 ? "+" : ""}{entry.delta}</span><span><b>{ledgerReason(entry.reason)}</b><small>{new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))}</small></span><i>{formatSignals(entry.balanceAfter, true)}</i></div>)}</div> : <div className="empty-state"><Coins size={30} /><h3>Операцій ще немає</h3><p>Після першого поповнення або AI-аналізу тут з’явиться повна історія.</p></div>}
    </section>
  </>;
}

function ledgerReason(reason: string): string {
  return ({ purchase: "Поповнення", analysis_charge: "AI-аналіз", analysis_refund: "Повернення", admin_grant: "Нарахування адміністратором", admin_bootstrap: "Стартовий баланс адміністратора", welcome_bonus: "Вітальний бонус" } as Record<string, string>)[reason] ?? reason;
}
