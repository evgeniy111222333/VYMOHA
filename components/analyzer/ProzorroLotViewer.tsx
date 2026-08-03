"use client";

import { useState } from "react";
import { Layers3, Info, CheckCircle2 } from "lucide-react";
import type { TenderLot } from "@/src/domain/tender/types";

type ProzorroLotViewerProps = {
  lots?: TenderLot[];
  tenderAmount?: number;
  tenderCurrency?: string;
  analysisTier?: "quick" | "deep" | "expert";
};

function cleanLotName(title: string, index: number): string {
  const cleaned = title
    .replace(/^лот\s*№?\s*\d+\s*[-:_]?\s*/gi, "")
    .replace(/^\d{8}-\d\s*[-:_]?\s*/gi, "")
    .replace(/^прокат вантажних транспортних засобів із водієм для перевезення товарів\s*\(?/gi, "")
    .replace(/\)?\s*$/gi, "")
    .trim();
  return cleaned || `Лот #${index + 1}`;
}

export function ProzorroLotViewer({ lots, tenderAmount, tenderCurrency = "UAH", analysisTier = "quick" }: ProzorroLotViewerProps) {
  if (!lots || lots.length <= 1) {
    return null; // Don't clutter single-lot tenders with extra cards!
  }

  const [selectedLotId, setSelectedLotId] = useState<string>(lots[0].id);
  const activeIndex = lots.findIndex((l) => l.id === selectedLotId);
  const activeLot = lots[activeIndex] || lots[0];
  const isExpert = analysisTier === "expert";

  const fmt = (num?: number, curr = "UAH") =>
    num ? new Intl.NumberFormat("uk-UA", { style: "currency", currency: curr, maximumFractionDigits: 0 }).format(num) : "—";

  return (
    <div className="prozorro-lot-strip">
      <div className="prozorro-lot-strip__head">
        <div className="prozorro-lot-strip__title">
          <Layers3 size={16} />
          <span>Багатолотна закупівля — <b>{lots.length} лоти</b></span>
        </div>
        <small className="prozorro-lot-strip__hint">Оберіть лот для перегляду специфічних параметрів:</small>
      </div>

      <div className="lot-tab-bar">
        {lots.map((lot, idx) => {
          const isSelected = lot.id === selectedLotId;
          const shortName = cleanLotName(lot.title, idx);
          return (
            <button
              key={lot.id}
              type="button"
              className={`lot-tab-item ${isSelected ? "lot-tab-item--active" : ""}`}
              onClick={() => setSelectedLotId(lot.id)}
            >
              <span className="lot-tab-item__badge">Лот #{idx + 1}</span>
              <span className="lot-tab-item__name">{shortName}</span>
              <span className="lot-tab-item__val">{fmt(lot.amount, lot.currency || tenderCurrency)}</span>
            </button>
          );
        })}
      </div>

      {activeLot && (
        <div className="active-lot-box">
          <div className="active-lot-box__header">
            <b>Лот #{activeIndex + 1}: {activeLot.title}</b>
          </div>

          <div className="active-lot-box__stats">
            <div>
              <small>Бюджет лота</small>
              <b>
                {fmt(activeLot.amount, activeLot.currency || tenderCurrency)}{" "}
                <span className="lot-vat-tag">
                  {activeLot.vatIncluded === false ? "без ПДВ" : activeLot.vatIncluded === true ? "з ПДВ" : ""}
                </span>
              </b>
            </div>
            <div>
              <small>Крок пониження</small>
              <b>{fmt(activeLot.minimalStepAmount, activeLot.currency || tenderCurrency)}</b>
            </div>
            <div>
              <small>Забезпечення</small>
              <b>{fmt(activeLot.guaranteeAmount, activeLot.guaranteeCurrency || tenderCurrency)}</b>
            </div>
            <div>
              <small>Дата аукціону</small>
              <b>
                {activeLot.auctionStartDate
                  ? new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(activeLot.auctionStartDate))
                  : "За графіком Prozorro"}
              </b>
            </div>
          </div>
        </div>
      )}

      {isExpert && (
        <div className="expert-lot-tip">
          <Info size={13} />
          <span>
            <b>Експертна порада:</b> У цій багатолотній закупівлі ви можете подавати цінову пропозицію <b>виключно на Лот #{activeIndex + 1}</b> без зобов’язання брати участь у решті {lots.length - 1} лотах.
          </span>
        </div>
      )}
    </div>
  );
}
