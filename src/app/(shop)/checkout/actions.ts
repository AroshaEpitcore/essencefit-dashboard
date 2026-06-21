"use server";

import bcrypt from "bcryptjs";
import { getDb, sql } from "@/lib/db";
import { getPublicStoreSettings } from "@/lib/storeSettings";
import { getCurrentCustomer, setSessionCookie } from "@/lib/customerAuth";

const { UniqueIdentifier, NVarChar, Int, Decimal } = sql;

export type CheckoutConfig = {
  deliveryFee: number;
  freeDeliveryOver: number;
  deliveryProvinces: { name: string; fee: number }[];
  storeName: string;
  bank: { bank: string; accountName: string; accountNo: string; branch: string };
};

export async function getCheckoutConfig(): Promise<CheckoutConfig> {
  const s = await getPublicStoreSettings();
  return {
    deliveryFee: s.deliveryFee,
    freeDeliveryOver: s.freeDeliveryOver,
    deliveryProvinces: s.deliveryProvinces,
    storeName: s.storeName,
    bank: s.bank,
  };
}

export type WebOrderItem = { variantId: string; qty: number };

export type WebOrderPayload = {
  customer: string;
  customerPhone: string;
  secondaryPhone?: string;
  address: string;
  province?: string;
  email?: string;
  notes?: string;
  paymentMethod: "COD" | "BankTransfer";
  paymentSlipUrl?: string | null;
  password?: string; // optional — when set, a login account is created at order time
  items: WebOrderItem[];
};

/**
 * Place an order from the storefront. Prices and stock are re-read from the DB
 * (never trusted from the client). Mirrors the admin createOrder transaction:
 * customer upsert + stock reduction + order + items + status log.
 * Sales rows are intentionally NOT created here — admin marks the order Paid first.
 */
export async function createWebOrder(payload: WebOrderPayload): Promise<{ orderId: string; accountCreated?: boolean }> {
  if (!payload.items?.length) throw new Error("Your cart is empty.");
  if (!payload.customerPhone?.trim()) throw new Error("Phone number is required.");
  if (!payload.address?.trim()) throw new Error("Delivery address is required.");
  if (payload.paymentMethod === "BankTransfer" && !payload.paymentSlipUrl) {
    throw new Error("Please upload your bank transfer slip.");
  }

  // Account required: must be logged in, or supply a password to create one.
  const sessionCustomer = await getCurrentCustomer();
  if (!sessionCustomer && (!payload.password || payload.password.trim().length < 6)) {
    throw new Error("Please choose a password (at least 6 characters) to create your account, or log in.");
  }

  const pool = await getDb();
  const config = await getCheckoutConfig();
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    // 1) Re-read live price + stock for each variant; validate availability.
    const priced: Array<{ variantId: string; qty: number; price: number }> = [];
    let subtotal = 0;

    for (const it of payload.items) {
      if (!it.qty || it.qty < 1) continue;
      const r = await new sql.Request(tx)
        .input("vid", UniqueIdentifier, it.variantId)
        .query(`
          SELECT ISNULL((SELECT z.Qty FROM ProductVariants z WHERE z.Id = dbo.fn_StockVariantId(v.Id)), 0) AS Stock,
                 ISNULL(v.SellingPrice, p.SellingPrice) AS Price,
                 prod.Name AS ProductName
          FROM ProductVariants v
          JOIN Products prod ON prod.Id = v.ProductId
          JOIN Products p ON p.Id = v.ProductId
          WHERE v.Id = @vid AND prod.IsActive = 1
        `);
      const row = r.recordset[0];
      if (!row) throw new Error("An item in your cart is no longer available.");
      if (it.qty > row.Stock) {
        throw new Error(`Only ${row.Stock} left of "${row.ProductName}".`);
      }
      const price = Number(row.Price);
      subtotal += price * it.qty;
      priced.push({ variantId: it.variantId, qty: it.qty, price });
    }

    if (!priced.length) throw new Error("Your cart is empty.");

    // 2) Delivery fee — by chosen province (server-side; falls back to the flat fee)
    const province = payload.province?.trim() || null;
    const provinceFee = province
      ? config.deliveryProvinces.find((p) => p.name.toLowerCase() === province.toLowerCase())?.fee
      : undefined;
    const baseFee = provinceFee != null ? provinceFee : config.deliveryFee;
    const deliveryFee =
      config.freeDeliveryOver > 0 && subtotal >= config.freeDeliveryOver ? 0 : baseFee;
    const total = subtotal + deliveryFee;

    // 3) Upsert customer by phone (auto-creates the customer record / account)
    const phone = payload.customerPhone.trim();
    const name = payload.customer?.trim() || `Customer ${phone}`;
    const address = payload.address.trim();
    const email = payload.email?.trim() || null;
    const wantsAccount = !sessionCustomer; // logged-out checkout always creates an account
    const newHash = wantsAccount ? await bcrypt.hash(payload.password!.trim(), 10) : null;
    let customerId: string;
    let accountReady = false; // set true when the customer can log in

    if (sessionCustomer) {
      // Logged in — link to that account and refresh saved details.
      customerId = sessionCustomer.Id;
      await new sql.Request(tx)
        .input("Id", UniqueIdentifier, customerId)
        .input("Name", NVarChar(200), name)
        .input("Address", NVarChar(500), address)
        .input("Email", NVarChar(200), email)
        .query(`UPDATE Customers SET Name=@Name, Address=@Address, Email=COALESCE(@Email, Email) WHERE Id=@Id`);
      accountReady = true;
    } else {
      const existing = await new sql.Request(tx)
        .input("Phone", NVarChar(50), phone)
        .query(`SELECT TOP 1 Id, PasswordHash FROM Customers WHERE Phone=@Phone`);

      if (existing.recordset.length) {
        customerId = existing.recordset[0].Id;
        const hadAccount = !!existing.recordset[0].PasswordHash;
        // Only set a password if they don't already have an account
        const applyHash = !hadAccount && newHash ? newHash : null;
        await new sql.Request(tx)
          .input("Id", UniqueIdentifier, customerId)
          .input("Name", NVarChar(200), name)
          .input("Address", NVarChar(500), address)
          .input("Email", NVarChar(200), email)
          .input("Hash", NVarChar(200), applyHash)
          .query(`UPDATE Customers SET Name=@Name, Address=@Address,
                  Email=COALESCE(@Email, Email),
                  PasswordHash=COALESCE(@Hash, PasswordHash) WHERE Id=@Id`);
        accountReady = hadAccount || !!applyHash;
      } else {
        customerId = crypto.randomUUID();
        await new sql.Request(tx)
          .input("Id", UniqueIdentifier, customerId)
          .input("Name", NVarChar(200), name)
          .input("Phone", NVarChar(50), phone)
          .input("Address", NVarChar(500), address)
          .input("Email", NVarChar(200), email)
          .input("Hash", NVarChar(200), newHash)
          .query(`INSERT INTO Customers (Id, Name, Phone, Address, Email, PasswordHash)
                  VALUES (@Id, @Name, @Phone, @Address, @Email, @Hash)`);
        accountReady = !!newHash;
      }
    }

    // 4) Insert order header (PaymentStatus Pending; verified later by admin)
    const orderId = crypto.randomUUID();
    const now = new Date();
    await new sql.Request(tx)
      .input("Id", UniqueIdentifier, orderId)
      .input("Customer", NVarChar(200), name)
      .input("CustomerPhone", NVarChar(20), phone)
      .input("SecondaryPhone", NVarChar(20), payload.secondaryPhone?.trim() || null)
      .input("Address", NVarChar(300), address)
      .input("Province", NVarChar(50), province)
      .input("CustomerEmail", NVarChar(200), payload.email?.trim() || null)
      .input("Notes", NVarChar(500), payload.notes?.trim() || null)
      .input("CustomerId", UniqueIdentifier, customerId)
      .input("Source", NVarChar(20), "web")
      .input("PaymentMethod", NVarChar(30), payload.paymentMethod)
      .input("PaymentSlipUrl", NVarChar(500), payload.paymentSlipUrl || null)
      .input("PaymentStatus", NVarChar(20), "Pending")
      .input("OrderDate", sql.DateTime2(7), now)
      .input("Subtotal", Decimal(18, 2), subtotal)
      .input("ManualDiscount", Decimal(18, 2), 0)
      .input("Discount", Decimal(18, 2), 0)
      .input("DeliveryFee", Decimal(18, 2), deliveryFee)
      .input("Total", Decimal(18, 2), total)
      .query(`
        INSERT INTO Orders (Id, Customer, CustomerPhone, SecondaryPhone, Address, Province, CustomerEmail,
          Notes, CustomerId, Source, PaymentMethod, PaymentSlipUrl, PaymentStatus, OrderDate,
          Subtotal, ManualDiscount, Discount, DeliveryFee, Total)
        VALUES (@Id, @Customer, @CustomerPhone, @SecondaryPhone, @Address, @Province, @CustomerEmail,
          @Notes, @CustomerId, @Source, @PaymentMethod, @PaymentSlipUrl, @PaymentStatus, @OrderDate,
          @Subtotal, @ManualDiscount, @Discount, @DeliveryFee, @Total)
      `);

    // 5) Items + stock reduction
    for (const it of priced) {
      await new sql.Request(tx)
        .input("Id", UniqueIdentifier, crypto.randomUUID())
        .input("OrderId", UniqueIdentifier, orderId)
        .input("VariantId", UniqueIdentifier, it.variantId)
        .input("Qty", Int, it.qty)
        .input("SellingPrice", Decimal(18, 2), it.price)
        .query(`INSERT INTO OrderItems (Id, OrderId, VariantId, Qty, SellingPrice)
                VALUES (@Id, @OrderId, @VariantId, @Qty, @SellingPrice)`);

      // Resolve to the blank-aware variant, decrement, and log the sale to StockHistory.
      const vr = await new sql.Request(tx)
        .input("VariantId", UniqueIdentifier, it.variantId)
        .query(`
          SELECT dbo.fn_StockVariantId(@VariantId) AS StockVid,
                 (SELECT z.Qty FROM ProductVariants z WHERE z.Id = dbo.fn_StockVariantId(@VariantId)) AS Qty,
                 ISNULL((SELECT z.SellingPrice FROM ProductVariants z WHERE z.Id = dbo.fn_StockVariantId(@VariantId)), 0) AS SellingPrice
        `);
      const sv = vr.recordset[0];
      const prev = sv?.Qty ?? 0;
      await new sql.Request(tx)
        .input("Vid", UniqueIdentifier, sv.StockVid)
        .input("Qty", Int, it.qty)
        .query(`UPDATE ProductVariants SET Qty = Qty - @Qty WHERE Id = @Vid`);
      await new sql.Request(tx)
        .input("VariantId", UniqueIdentifier, sv.StockVid)
        .input("ChangeQty", Int, -it.qty)
        .input("PreviousQty", Int, prev)
        .input("NewQty", Int, prev - it.qty)
        .input("Price", Decimal(18, 2), sv?.SellingPrice ?? 0)
        .query(`INSERT INTO StockHistory (VariantId, ChangeQty, Reason, PreviousQty, NewQty, PriceAtChange, CreatedAt)
                VALUES (@VariantId, @ChangeQty, 'order-sale', @PreviousQty, @NewQty, @Price, GETDATE())`);
    }

    // 6) Status log
    await new sql.Request(tx)
      .input("Id", UniqueIdentifier, crypto.randomUUID())
      .input("OrderId", UniqueIdentifier, orderId)
      .input("OldStatus", NVarChar(50), null)
      .input("NewStatus", NVarChar(50), "Pending")
      .input("ChangedAt", sql.DateTime2(7), now)
      .query(`INSERT INTO OrderStatusLogs (Id, OrderId, OldStatus, NewStatus, ChangedAt)
              VALUES (@Id, @OrderId, @OldStatus, @NewStatus, @ChangedAt)`);

    await tx.commit();

    // Auto-sign-in when an account was just created (so they land logged in)
    if (accountReady && wantsAccount) {
      try { await setSessionCookie(customerId); } catch { /* non-fatal */ }
    }

    return { orderId, accountCreated: accountReady && wantsAccount };
  } catch (err) {
    try { await tx.rollback(); } catch {}
    throw err;
  }
}
