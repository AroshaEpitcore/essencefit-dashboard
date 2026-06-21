import { getDb } from "@/lib/db";

/* DTF estimate engine. Single source of truth = the DtfPriceItems table
   (the same prices the admin edits in /dtf → Price Setup). The customer's
   garment price comes from the real catalog product, not the generic
   DtfPriceItems "Garment" blanks. Mirrors the formula in the admin Quote
   Builder: perPiece = garment + prints + overheads + profit;
   total = perPiece * qty + orderExtra. */

export type DtfPrintOption = { Id: string; Name: string; Amount: number };

export type DtfPricingConfig = {
  prints: DtfPrintOption[];
  overheadTotal: number; // packaging + utilities + any other active overhead
  profit: number; // default profit per piece
  orderExtra: number; // flat per-order charge
};

type PriceRow = { Id: string; Category: string; Name: string; Amount: number; IsActive: boolean };

async function getActivePriceItems(): Promise<PriceRow[]> {
  const pool = await getDb();
  const res = await pool
    .request()
    .query(`SELECT Id, Category, Name, Amount, IsActive FROM DtfPriceItems WHERE IsActive = 1 ORDER BY SortOrder, Name`);
  return res.recordset as PriceRow[];
}

function derive(items: PriceRow[]) {
  const prints = items
    .filter((i) => i.Category === "Print")
    .map((i) => ({ Id: i.Id, Name: i.Name, Amount: Number(i.Amount) }));
  const overheadTotal = items
    .filter((i) => i.Category === "Overhead")
    .reduce((s, i) => s + Number(i.Amount), 0);
  const profit = Number(items.find((i) => i.Category === "Profit")?.Amount ?? 0);
  const orderExtra = Number(
    items.find((i) => i.Category === "Charge" && /extra|handling|deliver/i.test(i.Name))?.Amount ?? 0
  );
  return { prints, overheadTotal, profit, orderExtra };
}

/* Config the Customize page sends to the client for instant live estimates.
   The client preview is always re-verified by computeDtfEstimate on submit. */
export async function getDtfPricingConfig(): Promise<DtfPricingConfig> {
  const items = await getActivePriceItems();
  return derive(items);
}

export type DtfEstimate = {
  garmentPrice: number;
  printCharges: number; // per-piece print + overhead + profit add-ons
  perPiece: number;
  qty: number;
  total: number;
  breakdown: {
    garmentPrice: number;
    prints: { name: string; amount: number }[];
    overheadTotal: number;
    profit: number;
    orderExtra: number;
    perPiece: number;
    qty: number;
    total: number;
  };
};

/* Server-authoritative estimate. The garment base is the blank's COST plus a
   DTF profit (per-product override, else the global Profit price item). Print
   rates are looked up by name from the live active price items (never trusts
   client amounts). */
export async function computeDtfEstimate(input: {
  garmentCost: number;
  printNames: string[];
  qty: number;
  profitOverride?: number | null;
}): Promise<DtfEstimate> {
  const items = await getActivePriceItems();
  const { overheadTotal, profit: globalProfit, orderExtra } = derive(items);

  const garmentCost = Math.max(0, Number(input.garmentCost) || 0);
  const profit = input.profitOverride != null ? Math.max(0, Number(input.profitOverride) || 0) : globalProfit;
  const qty = Math.max(1, Math.floor(Number(input.qty) || 1));

  const printRows = items.filter((i) => i.Category === "Print");
  const selected = (input.printNames || [])
    .map((name) => printRows.find((p) => p.Name === name))
    .filter((p): p is PriceRow => !!p)
    .map((p) => ({ name: p.Name, amount: Number(p.Amount) }));

  const printSum = selected.reduce((s, p) => s + p.amount, 0);
  const printCharges = printSum + overheadTotal + profit;
  const perPiece = garmentCost + printCharges;
  const total = perPiece * qty + orderExtra;

  return {
    garmentPrice: garmentCost, // garment base used (cost, not retail)
    printCharges,
    perPiece,
    qty,
    total,
    breakdown: { garmentPrice: garmentCost, prints: selected, overheadTotal, profit, orderExtra, perPiece, qty, total },
  };
}
