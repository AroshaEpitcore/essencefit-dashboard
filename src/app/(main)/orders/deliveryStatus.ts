// Delivery / fulfillment status — a separate dimension from PaymentStatus.
// PaymentStatus drives sales + stock; delivery status only tracks the physical
// journey and never touches money or inventory.
//
// IMPORTANT: this lives in a plain module, NOT in the "use server" actions file.
// A "use server" file may only export async functions; exporting this const
// array from there throws at runtime ("can only export async functions, found
// object") and takes down every route that imports the actions module.
export const DELIVERY_STATUSES = [
  "Processing",
  "Ready",
  "Handed to courier",
  "Delivered",
  "Returned",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
