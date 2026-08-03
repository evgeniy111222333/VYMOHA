"use client";

import { useState } from "react";
import { Layers, Package, TrendingDown, ShieldCheck, Calendar, Info, Layers3 } from "lucide-react";
import type { TenderLot } from "@/src/domain/tender/types";

type ProzorroLotViewerProps = {
  lots?: TenderLot[];
  tenderAmount?: number;
  tenderCurrency?: string;
  analysisTier?: "quick" | "deep" | "expert";
};

export function ProzorroLotViewer({ lots, tenderAmount, tenderCurrency = "UAH", analysisTier = "quick" }: ProzorroLotViewerProps) {
  const isMultiLot = Array.isArray(lots) && lots.length > 1;
  const singleLot = Array.isArray(lots) && lots.length === 1 ? lots[0] : null;
  const [selectedLotId, setSelectedLotId] = useState<string>(isMultiLot ? lots[0].id : "");

  const activeLot = isMultiLot ? lots.find((l) => l.id === selectedLotId) || lots[0] : singleLot;
  const isExpert = analysisTier === "expert";

  if (!lots || lots.length === 0) {
    return null;
  }

  // Format currency helper
  const fmt = (num?: number, curr = "UAH") =>
    num ? new Intl.NumberFormat("uk-UA", { style: "currency", currency: curr, maximumFractionDigits: 0 }).format(num) : "—";

  return (
    <div className="prozorro-lot-card">
      <div className="prozorro-lot-card__head">
        <div className="prozorro-lot-card__title">
          <Layers3 size={18} />
          <div>
            <span className="prozorro-lot-card__kicker">
              {isMultiLot ? `Багатолотна закупівля (${lots.length} лоти)` : "Структура закупівлі"}
            </span>
            <h3>{isMultiLot ? "Вибір та параметри лотів" : "Інформація про предмет та лот"}</h3>
          </div>
        </div>
        <span className={`lot-badge-pill ${isMultiLot ? "lot-badge-pill--multi" : "lot-badge-pill--single"}`}>
          {isMultiLot ? `📦 ${lots.length} лоти` : "📦 1 неподільний лот"}
        </span>
      </div>

      {isMultiLot && (
        <div className="lot-selector-pills">
          {lots.map((lot, idx) => {
            const isSelected = lot.id === selectedLotId;
            return (
              <button
                key={lot.id}
                type="button"
                className={`lot-pill-btn ${isSelected ? "lot-pill-btn--active" : ""}`}
                onClick={() => setSelectedLotId(lot.id)}
              >
                <span className="lot-pill-btn__num">Лот #{idx + 1}</span>
                <span className="lot-pill-btn__title">{lot.title}</span>
                <span className="lot-pill-btn__amount">{fmt(lot.amount, lot.currency || tenderCurrency)}</span>
              </button>
            );
          })}
        </div>
      )}

      {activeLot && (
        <div className="lot-detail-grid">
          <div className="lot-detail-item">
            <small>Бюджет лота</small>
            <b>
              {fmt(activeLot.amount, activeLot.currency || tenderCurrency)}{" "}
              <span className="lot-vat-tag">
                {activeLot.vatIncluded === false ? "без ПДВ" : activeLot.vatIncluded === true ? "з ПДВ" : ""}
              </span>
            </b>
          </div>

          <div className="lot-detail-item">
            <small>Мінімальний крок лота</small>
            <b>{fmt(activeLot.minimalStepAmount, activeLot.currency || tenderCurrency)}</b>
          </div>

          <div className="lot-detail-item">
            <small>Забезпечення лота</small>
            <b>{fmt(activeLot.guaranteeAmount, activeLot.guaranteeCurrency || tenderCurrency)}</b>
          </div>

          <div className="lot-detail-item">
            <small>Дата аукціону по лоту</small>
            <b>
              {activeLot.auctionStartDate
                ? new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(activeLot.auctionStartDate))
                : "За графіком Prozorro"}
            </b>
          </div>
        </div>
      )}

      {isExpert && isMultiLot && (
        <div className="expert-lot-insight">
          <Info size={15} />
          <div>
            <b>Експертна порада для багатолотного тендера:</b>
            <p>
              Ви можете подавати цінову пропозицію <b>виключно на обраний Лот #{lots.findIndex((l) => l.id === selectedLotId) + 1}</b> без зобов’язання брати участь у решті лотів. Забезпечення пропозиції та кошторис розраховуються окремо по кожному лоту.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
