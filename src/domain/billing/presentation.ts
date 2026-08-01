export const SIGNAL_UNIT = "сигнал";
export const SIGNAL_UNIT_SHORT = "сиг.";

export function formatSignals(value: number, short = false): string {
  if (short) return `${value} ${SIGNAL_UNIT_SHORT}`;
  const mod10 = value % 10;
  const mod100 = value % 100;
  const noun = mod10 === 1 && mod100 !== 11
    ? "сигнал"
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
      ? "сигнали"
      : "сигналів";
  return `${value} ${noun}`;
}
