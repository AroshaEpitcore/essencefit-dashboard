// Pure DTF pricing arithmetic (no DB, no imports) — the single formula behind
// every quote/estimate. Kept import-free so it's unit-testable in isolation
// (the DB-backed name lookups live in dtfPricing.ts, which calls this).
//
//   perPiece = garment + Σ prints + overhead + profit
//   total    = perPiece * qty + orderExtra

export function computeDtfTotals(input: {
  garmentCost: number;
  printAmounts: number[];
  overheadTotal: number;
  profit: number;
  orderExtra: number;
  qty: number;
}): { printSum: number; printCharges: number; perPiece: number; qty: number; total: number } {
  const garmentCost = Math.max(0, Number(input.garmentCost) || 0);
  const overheadTotal = Math.max(0, Number(input.overheadTotal) || 0);
  const profit = Math.max(0, Number(input.profit) || 0);
  const orderExtra = Math.max(0, Number(input.orderExtra) || 0);
  const qty = Math.max(1, Math.floor(Number(input.qty) || 1));

  const printSum = (input.printAmounts || []).reduce((s, a) => s + Math.max(0, Number(a) || 0), 0);
  const printCharges = printSum + overheadTotal + profit;
  const perPiece = garmentCost + printCharges;
  const total = perPiece * qty + orderExtra;
  return { printSum, printCharges, perPiece, qty, total };
}
