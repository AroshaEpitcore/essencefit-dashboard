# EssenceFit Dashboard

Internal business management system for EssenceFit — handles orders, inventory, sales, customers, finance, and dispatch messaging.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.1 (App Router) |
| Language | TypeScript + React 19 |
| Database | Microsoft SQL Server (MSSQL) |
| DB Driver | mssql v11.0.1 |
| Styling | Tailwind CSS 3.4.17 |
| Icons | Lucide React |
| Charts | Recharts 3.2.1 |
| Animations | Framer Motion |
| Notifications | React Hot Toast |
| PDF | pdf-lib + html2pdf.js |
| Auth | Custom (bcryptjs + localStorage) |

---

## Environment Setup

Create a `.env.local` file in the project root:

```env
DB_USER=sa
DB_PASSWORD=your_password
DB_SERVER=YOUR_SERVER\SQLEXPRESS
DB_NAME=InvFin
```

Install dependencies and run:

```bash
npm install
npm run dev
```

App runs at `http://localhost:3000`

---

## Project Structure

```
essencefit-dashboard/
│
├── db/                               # SQL schema files (reference)
│   ├── 00_init.sql
│   ├── 01_users.sql
│   ├── 02_lookups.sql
│   ├── 03_products_variants.sql
│   ├── 04_inventory.sql
│   ├── 05_suppliers_purchases.sql
│   ├── 06_sales_orders.sql
│   ├── 07_expenses_finance.sql
│   ├── 08_reports_views.sql
│   ├── 09_sprocs.sql
│   └── seed.sql
│
├── src/
│   ├── app/
│   │   │
│   │   ├── (auth)/                   # Public auth routes
│   │   │   ├── login/
│   │   │   │   ├── page.tsx
│   │   │   │   └── actions.ts
│   │   │   ├── register/
│   │   │   │   ├── page.tsx
│   │   │   │   └── actions.ts
│   │   │   └── layout.tsx
│   │   │
│   │   ├── (main)/                   # Protected routes (requires login)
│   │   │   ├── layout.tsx            # Auth guard + sidebar + topbar
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx          # KPI cards, charts, low stock
│   │   │   │   └── actions.ts
│   │   │   │
│   │   │   ├── orders/
│   │   │   │   ├── page.tsx          # Create/edit/delete orders
│   │   │   │   ├── actions.ts        # Order CRUD + lookups
│   │   │   │   └── invoiceActions.ts # PDF invoice + WhatsApp message
│   │   │   │
│   │   │   ├── order-logs/
│   │   │   │   ├── page.tsx          # Status change history
│   │   │   │   └── actions.ts
│   │   │   │
│   │   │   ├── dispatch/
│   │   │   │   ├── page.tsx          # Courier handover messages
│   │   │   │   └── actions.ts
│   │   │   │
│   │   │   ├── invoices/
│   │   │   │   └── page.tsx          # Invoice viewer
│   │   │   │
│   │   │   ├── customers/
│   │   │   │   ├── page.tsx          # Customer directory
│   │   │   │   └── actions.ts
│   │   │   │
│   │   │   ├── sales/
│   │   │   │   ├── page.tsx          # Walk-in / counter sales
│   │   │   │   └── actions.ts
│   │   │   │
│   │   │   ├── returns/
│   │   │   │   ├── page.tsx          # Process returns + restock
│   │   │   │   └── actions.ts
│   │   │   │
│   │   │   ├── inventory/
│   │   │   │   ├── page.tsx          # Product/variant catalog
│   │   │   │   └── actions.ts
│   │   │   │
│   │   │   ├── stocks/
│   │   │   │   ├── page.tsx          # Stock levels + adjustments
│   │   │   │   └── actions.ts
│   │   │   │
│   │   │   ├── stock-history/
│   │   │   │   ├── page.tsx          # All stock change records
│   │   │   │   └── actions.ts
│   │   │   │
│   │   │   ├── color-requests/
│   │   │   │   ├── page.tsx          # Customer color requests
│   │   │   │   └── actions.ts
│   │   │   │
│   │   │   ├── suppliers/
│   │   │   │   ├── page.tsx          # Supplier contacts
│   │   │   │   └── actions.ts
│   │   │   │
│   │   │   ├── finance/
│   │   │   │   ├── page.tsx          # Cash handovers + usage
│   │   │   │   └── actions.ts
│   │   │   │
│   │   │   ├── expenses/
│   │   │   │   ├── page.tsx          # Business expenses
│   │   │   │   └── actions.ts
│   │   │   │
│   │   │   ├── reports/
│   │   │   │   ├── page.tsx          # Custom business reports
│   │   │   │   └── actions.ts
│   │   │   │
│   │   │   ├── analysis/
│   │   │   │   ├── page.tsx          # Deep analytics + trends
│   │   │   │   └── actions.ts
│   │   │   │
│   │   │   ├── whatsapp/
│   │   │   │   ├── page.tsx          # WhatsApp message templates
│   │   │   │   └── actions.ts
│   │   │   │
│   │   │   ├── users/                # Admin only
│   │   │   │   ├── page.tsx
│   │   │   │   └── actions.ts
│   │   │   │
│   │   │   ├── settings/             # Admin only
│   │   │   │   ├── page.tsx
│   │   │   │   └── actions.ts
│   │   │   │
│   │   │   └── map/
│   │   │       └── page.tsx
│   │   │
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx           # Navigation sidebar (collapsible)
│   │   │   └── Topbar.tsx            # Top bar with sidebar toggle
│   │   └── ui/
│   │       └── FullScreenLoader.tsx
│   │
│   └── lib/
│       ├── db.ts                     # MSSQL connection pool
│       ├── auth.ts                   # Auth helpers
│       ├── useAuth.ts                # Auth hook (reads localStorage)
│       ├── pdfGenerator.ts           # PDF download utility
│       ├── phoneMask.ts              # Phone number formatting
│       └── hooks/
│           └── usePageLoader.ts
│
├── .env.local                        # DB credentials (never commit)
├── tailwind.config.js
├── tsconfig.json
├── next.config.ts
└── package.json
```

---

## Database Schema

### Users
Stores login accounts.

```sql
CREATE TABLE Users (
    Id           UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Username     NVARCHAR(100)    NOT NULL UNIQUE,
    Email        NVARCHAR(200)    NOT NULL UNIQUE,
    PasswordHash NVARCHAR(MAX)    NOT NULL,
    Role         NVARCHAR(50)     NOT NULL DEFAULT 'Staff', -- 'Admin' | 'Staff'
    CreatedAt    DATETIME2        NOT NULL DEFAULT GETDATE()
);
```

---

### Categories
Top-level product groupings.

```sql
CREATE TABLE Categories (
    Id   UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(200) NOT NULL
);
```

---

### Sizes

```sql
CREATE TABLE Sizes (
    Id   UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(50) NOT NULL
);
```

---

### Colors

```sql
CREATE TABLE Colors (
    Id   UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(100) NOT NULL
);
```

---

### Products
Belongs to a Category. Has a base cost/selling price that variants can override.

```sql
CREATE TABLE Products (
    Id           UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    CategoryId   UNIQUEIDENTIFIER NOT NULL REFERENCES Categories(Id),
    Name         NVARCHAR(200)    NOT NULL,
    SKU          NVARCHAR(100)    NULL,
    CostPrice    DECIMAL(18,2)    NULL,
    SellingPrice DECIMAL(18,2)    NULL
);
```

---

### ProductVariants
Each variant is a unique Product + Size + Color combination with its own stock quantity. Cost/selling price can override the parent product.

```sql
CREATE TABLE ProductVariants (
    Id           UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ProductId    UNIQUEIDENTIFIER NOT NULL REFERENCES Products(Id),
    SizeId       UNIQUEIDENTIFIER NULL REFERENCES Sizes(Id),
    ColorId      UNIQUEIDENTIFIER NULL REFERENCES Colors(Id),
    Qty          INT              NOT NULL DEFAULT 0,
    CostPrice    DECIMAL(18,2)    NULL,   -- overrides Products.CostPrice if set
    SellingPrice DECIMAL(18,2)    NULL    -- overrides Products.SellingPrice if set
);
```

---

### Customers
Auto-created or updated when an order is placed (upserted by phone number).

```sql
CREATE TABLE Customers (
    Id        UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name      NVARCHAR(200) NOT NULL,
    Phone     NVARCHAR(50)  NULL UNIQUE,
    Address   NVARCHAR(500) NULL,
    CreatedAt DATETIME2     NOT NULL DEFAULT GETDATE()
);
```

---

### Orders
Core order record. Customer info is also stored directly (denormalized) for historical accuracy.

```sql
CREATE TABLE Orders (
    Id                UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    CustomerId        UNIQUEIDENTIFIER NULL REFERENCES Customers(Id),
    Customer          NVARCHAR(200)    NULL,
    CustomerPhone     NVARCHAR(20)     NULL,
    SecondaryPhone    NVARCHAR(20)     NULL,
    Address           NVARCHAR(300)    NULL,
    WaybillId         NVARCHAR(100)    NULL,
    PackagePrintPrice DECIMAL(18,2)    NULL DEFAULT 0,
    PaymentStatus     NVARCHAR(20)     NOT NULL,  -- Pending | Partial | Paid | Completed | Canceled
    OrderDate         DATETIME2        NOT NULL,
    CompletedAt       DATETIME2        NULL,       -- set when status = Paid or Completed
    Subtotal          DECIMAL(18,2)    NOT NULL DEFAULT 0,
    ManualDiscount    DECIMAL(18,2)    NOT NULL DEFAULT 0,
    Discount          DECIMAL(18,2)    NOT NULL DEFAULT 0,  -- includes delivery saving
    DeliveryFee       DECIMAL(18,2)    NOT NULL DEFAULT 0,
    Total             DECIMAL(18,2)    NOT NULL DEFAULT 0
);
```

**Delivery charge reference:**

| Area | Charge |
|---|---|
| Colombo | Rs. 300 |
| Outer Areas | Rs. 350 |
| Eastern / Northern | Rs. 400 |
| 3+ items | FREE |

---

### OrderItems
Line items within an order. Selling price is snapshotted at time of order.

```sql
CREATE TABLE OrderItems (
    Id           UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrderId      UNIQUEIDENTIFIER NOT NULL REFERENCES Orders(Id),
    VariantId    UNIQUEIDENTIFIER NOT NULL REFERENCES ProductVariants(Id),
    Qty          INT              NOT NULL,
    SellingPrice DECIMAL(18,2)    NOT NULL
);
```

---

### OrderStatusLogs
Audit trail for every order status change.

```sql
CREATE TABLE OrderStatusLogs (
    Id        UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrderId   UNIQUEIDENTIFIER NOT NULL REFERENCES Orders(Id),
    OldStatus NVARCHAR(50)     NULL,  -- null on first creation
    NewStatus NVARCHAR(50)     NOT NULL,
    ChangedAt DATETIME2        NOT NULL DEFAULT GETDATE(),
    ChangedBy NVARCHAR(100)    NULL
);
```

---

### Sales
Created when an order reaches `Paid` or `Completed` status. Also used for direct walk-in sales (no order).

```sql
CREATE TABLE Sales (
    Id            UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrderId       UNIQUEIDENTIFIER NULL REFERENCES Orders(Id),
    VariantId     UNIQUEIDENTIFIER NOT NULL REFERENCES ProductVariants(Id),
    Qty           INT              NOT NULL,
    SellingPrice  DECIMAL(18,2)    NOT NULL,
    PaymentMethod NVARCHAR(50)     NOT NULL DEFAULT 'Order',
    PaymentStatus NVARCHAR(20)     NOT NULL,
    SaleDate      DATETIME2        NOT NULL DEFAULT GETDATE()
);
```

---

### SalesReturns
Header record for a return linked to an order.

```sql
CREATE TABLE SalesReturns (
    Id        UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrderId   UNIQUEIDENTIFIER NOT NULL REFERENCES Orders(Id),
    Reason    NVARCHAR(500)    NOT NULL,
    CreatedAt DATETIME2        NOT NULL DEFAULT GETDATE()
);
```

---

### SalesReturnItems
Items in a return. Processing a return restores the variant stock.

```sql
CREATE TABLE SalesReturnItems (
    ReturnId  UNIQUEIDENTIFIER NOT NULL REFERENCES SalesReturns(Id),
    VariantId UNIQUEIDENTIFIER NOT NULL REFERENCES ProductVariants(Id),
    Qty       INT              NOT NULL,
    PRIMARY KEY (ReturnId, VariantId)
);
```

---

### StockHistory
Every stock quantity change is logged here with a reason.

```sql
CREATE TABLE StockHistory (
    Id            UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    VariantId     UNIQUEIDENTIFIER NOT NULL REFERENCES ProductVariants(Id),
    ChangeQty     INT              NOT NULL,  -- positive = added, negative = removed
    Reason        NVARCHAR(200)    NOT NULL,
    PreviousQty   INT              NOT NULL,
    NewQty        INT              NOT NULL,
    PriceAtChange DECIMAL(18,2)   NULL,
    CreatedAt     DATETIME2        NOT NULL DEFAULT GETDATE()
);
```

---

### Suppliers

```sql
CREATE TABLE Suppliers (
    Id        UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name      NVARCHAR(200)  NOT NULL,
    Contact   NVARCHAR(200)  NULL,
    Notes     NVARCHAR(MAX)  NULL,
    CreatedAt DATETIME2      NOT NULL DEFAULT GETDATE()
);
```

---

### Expenses

```sql
CREATE TABLE Expenses (
    Id          UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Category    NVARCHAR(100)  NOT NULL,
    Description NVARCHAR(500)  NULL,
    Amount      DECIMAL(18,2)  NOT NULL,
    ExpenseDate DATETIME2      NOT NULL DEFAULT GETDATE()
);
```

---

### Handovers
Cash handed over from the business to owners/accounts.

```sql
CREATE TABLE Handovers (
    Id           UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    UserId       NVARCHAR(100)  NOT NULL,
    Amount       DECIMAL(18,2)  NOT NULL,
    HandoverDate DATETIME2      NOT NULL DEFAULT GETDATE()
);
```

---

### CashUsage
Cash taken out for expenses or petty cash.

```sql
CREATE TABLE CashUsage (
    Id          UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Description NVARCHAR(300)  NOT NULL,
    Amount      DECIMAL(18,2)  NOT NULL,
    UsageDate   DATETIME2      NOT NULL DEFAULT GETDATE()
);
```

---

### ColorRequests
Customer requests for product colors not currently in stock.

```sql
CREATE TABLE ColorRequests (
    Id           UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    CustomerName NVARCHAR(200)  NULL,
    Phone        NVARCHAR(50)   NOT NULL,
    ProductName  NVARCHAR(200)  NOT NULL,
    ColorName    NVARCHAR(100)  NOT NULL,
    SizeName     NVARCHAR(50)   NULL,
    Notes        NVARCHAR(MAX)  NULL,
    Status       NVARCHAR(20)   NOT NULL DEFAULT 'Pending',
    CreatedAt    DATETIME2      NOT NULL DEFAULT GETDATE()
);
```

---

### Settings
Key-value store for app configuration.

```sql
CREATE TABLE Settings (
    Id        UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    [Key]     NVARCHAR(100)  NOT NULL UNIQUE,
    Value     NVARCHAR(MAX)  NULL,
    UpdatedAt DATETIME2      NOT NULL DEFAULT GETDATE()
);
```

---

### DispatchMessages
Auto-created when an order with a WaybillId is saved. Auto-deleted after 7 days.

```sql
CREATE TABLE DispatchMessages (
    Id            UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrderId       UNIQUEIDENTIFIER NOT NULL REFERENCES Orders(Id),
    WaybillId     NVARCHAR(100)    NOT NULL,
    CustomerName  NVARCHAR(200)    NULL,
    CustomerPhone NVARCHAR(20)     NULL,
    CreatedAt     DATETIME2        NOT NULL DEFAULT GETDATE()
);

CREATE INDEX IX_DispatchMessages_CreatedAt ON DispatchMessages (CreatedAt DESC);
```

---

## Table Relationships

```
Categories
    └── Products  (CategoryId → Categories.Id)
            └── ProductVariants  (ProductId → Products.Id)
                    ├── SizeId   → Sizes.Id
                    ├── ColorId  → Colors.Id
                    ├── OrderItems       (VariantId → ProductVariants.Id)
                    ├── Sales            (VariantId → ProductVariants.Id)
                    ├── StockHistory     (VariantId → ProductVariants.Id)
                    └── SalesReturnItems (VariantId → ProductVariants.Id)

Customers
    └── Orders  (CustomerId → Customers.Id)
            ├── OrderItems        (OrderId → Orders.Id)
            ├── Sales             (OrderId → Orders.Id)
            ├── OrderStatusLogs   (OrderId → Orders.Id)
            ├── DispatchMessages  (OrderId → Orders.Id)
            └── SalesReturns      (OrderId → Orders.Id)
                    └── SalesReturnItems  (ReturnId → SalesReturns.Id)

Standalone (no foreign keys):
    Users
    Expenses
    Handovers
    CashUsage
    ColorRequests
    Settings
    Suppliers
```

---

## Entity Relationship Diagram

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────────┐
│ Categories  │──<  │   Products   │──<  │   ProductVariants    │
└─────────────┘     └──────────────┘     └──────────────────────┘
                                            │       │      │
                              ┌─────────────┘       │      └────────────────┐
                              │                     │                       │
                       ┌──────▼──────┐       ┌──────▼──────┐      ┌────────▼──────┐
                       │ OrderItems  │       │    Sales    │      │ StockHistory  │
                       └──────┬──────┘       └─────────────┘      └───────────────┘
                              │
                       ┌──────▼──────┐     ┌─────────────┐
                       │   Orders   │──>  │  Customers  │
                       └──────┬──────┘     └─────────────┘
                              │
          ┌───────────────────┼──────────────────┬──────────────────┐
          │                   │                  │                  │
   ┌──────▼──────┐   ┌────────▼──────┐  ┌───────▼───────┐  ┌──────▼───────────┐
   │ StatusLogs  │   │ SalesReturns  │  │   Dispatch    │  │                  │
   └─────────────┘   └────────┬──────┘  │   Messages   │  │  (Sales rows)    │
                              │         └───────────────┘  └──────────────────┘
                       ┌──────▼──────┐
                       │ ReturnItems │
                       └─────────────┘

┌───────┐  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ Users │  │ Expenses │  │ Handovers │  │CashUsage │  │Suppliers │  │ Settings │
└───────┘  └──────────┘  └───────────┘  └──────────┘  └──────────┘  └──────────┘
```

---

## Pages & Routes

### Public
| Route | Purpose |
|---|---|
| `/login` | User login |
| `/register` | Create new account |

### Protected (all roles)
| Route | Purpose |
|---|---|
| `/dashboard` | KPI overview — stock value, today's sales, profit, units sold, low stock alerts |
| `/orders` | Full order lifecycle — create, edit, update status, delete, PDF invoice |
| `/order-logs` | Audit log of every order status change |
| `/dispatch` | Courier handover messages — auto-created when order has WaybillId |
| `/invoices` | Invoice viewer |
| `/customers` | Customer list with order history |
| `/sales` | Quick counter sales for walk-in customers (no order created) |
| `/returns` | Process returns — restores stock, links to original order |
| `/inventory` | Full product/variant catalog browser |
| `/stocks` | Manage stock levels, add categories/colors/sizes/products |
| `/stock-history` | Full history of all stock changes with filters |
| `/color-requests` | Log and track customer color requests |
| `/suppliers` | Supplier contact management |
| `/whatsapp` | WhatsApp message template library (stored in localStorage) |
| `/analysis` | Deep analytics — trends, top products, customer rankings |
| `/map` | Delivery area map |

### Admin Only
| Route | Purpose |
|---|---|
| `/finance` | Cash handovers, cash usage, remaining balance |
| `/expenses` | Business expense logging |
| `/reports` | Custom reports — P&L, inventory, dead stock, top colors |
| `/users` | User account management |
| `/settings` | Application configuration |

---

## Key Business Logic

### Order Flow

```
1. Staff creates order
   → selects products/variants
   → enters customer name, phone, address, WaybillId
   → stock is immediately reduced (ProductVariants.Qty -= qty)
   → customer auto-upserted by phone number

2. If PaymentStatus = Paid or Completed
   → Sales rows created

3. Status change logged to OrderStatusLogs

4. If WaybillId is set
   → DispatchMessage auto-created

5. On status update
   → old Sales rows deleted
   → new Sales rows created for new status
   → if Canceled → stock restored
```

### Stock Rules

```
Stock reduces when:
  - Order is created (any status)
  - Direct walk-in sale via /sales
  - Manual adjustment in /stocks (negative)

Stock restores when:
  - Return is processed
  - Order is deleted
  - Manual adjustment in /stocks (positive)
```

### Finance Formula

```
Remaining Cash = Total Sales Revenue - Total Handovers - Total Cash Usage
```

### Profit Formula

```
Gross Profit = Σ (SellingPrice × Qty) - Σ (CostPrice × Qty)
Net Profit   = Gross Profit - Total Discount + DeliveryFee - Expenses
```

### Dispatch Message Auto-Creation

```
Trigger : createOrder() called with WaybillId filled in
Action  : INSERT into DispatchMessages (after transaction commits)
Cleanup : Auto-deleted after 7 days on next page load (lazy delete)
Message format:
  📦✨ Good news!
  Your parcel has been handed over to our courier service 🚚💨

  🆔 Waybill ID: {WaybillId}
  📞 Kindly keep your phone available, as the courier may call to confirm delivery.

  Thank you for shopping with EssenceFit 💙
  ✨ Don't forget to confirm once you've received your order and share your feedback
```

---

## Server Actions Reference

### orders/actions.ts
| Function | Description |
|---|---|
| `getCategories()` | All categories |
| `getProductsByCategory(categoryId)` | Products in a category |
| `getSizesByProduct(productId)` | Available sizes for a product |
| `getColorsByProductAndSize(productId, sizeId)` | Available colors |
| `getVariant(productId, sizeId, colorId)` | Get variant + stock + price |
| `getVariantStockByProductAndSize(productId, sizeId)` | Stock map by color |
| `getRecentOrders(limit, range)` | Orders with date range filter |
| `getOrderDetails(orderId)` | Header + line items for one order |
| `createOrder(payload)` | Full order creation with transaction |
| `updateOrder(orderId, payload)` | Edit order items + header |
| `updateOrderStatus(orderId, status)` | Change status, update sales rows |
| `deleteOrder(orderId)` | Delete order + restore stock |

### orders/invoiceActions.ts
| Function | Description |
|---|---|
| `generateInvoicePDF(orderId)` | Returns formatted invoice data for PDF |
| `getWhatsAppMessage(orderId)` | Returns formatted WhatsApp invoice message |

### dispatch/actions.ts
| Function | Description |
|---|---|
| `createDispatchMessage(orderId, waybillId, name, phone)` | Save dispatch record |
| `getDispatchMessages()` | Fetch all — auto-deletes records older than 7 days |
| `deleteDispatchMessage(id)` | Manual delete |

### customers/actions.ts
| Function | Description |
|---|---|
| `getCustomers()` | All customers with order count + total spend |
| `getCustomerById(id)` | Single customer |
| `getCustomerOrders(customerId)` | All orders for a customer |
| `upsertCustomer(name, phone, address)` | Create or update by phone |
| `updateCustomer(id, ...)` | Update customer details |
| `deleteCustomer(id)` | Delete customer |

### sales/actions.ts
| Function | Description |
|---|---|
| `getLookups()` | Categories + products + variants |
| `getProductsByCategory(categoryId)` | Products list |
| `getSizes(productId)` | Sizes for product |
| `getVariantsByProductAndSize(productId, sizeId)` | Variants with stock |
| `sellStock(variantId, qty, price, method)` | Direct sale + reduce stock |

### returns/actions.ts
| Function | Description |
|---|---|
| `createSalesReturn(orderId, reason, items)` | Create return + restore stock |
| `getRecentReturns()` | Recent return records |

### stocks/actions.ts
| Function | Description |
|---|---|
| `getStockItems(filters)` | All variants with stock |
| `quickStock(variantId, qty, reason)` | Adjust stock quantity |
| `transferStock(fromVariantId, toVariantId, qty)` | Move stock between variants |
| `updateVariantPrices(variantId, costPrice, sellingPrice)` | Update pricing |
| `addCategory / updateCategory / deleteCategory` | Category CRUD |
| `addColor / updateColor / deleteColor` | Color CRUD |
| `addSize / updateSize / deleteSize` | Size CRUD |

### stock-history/actions.ts
| Function | Description |
|---|---|
| `getStockHistory(filters)` | Full stock history with category/product/size/color joins |

### finance/actions.ts
| Function | Description |
|---|---|
| `getFinanceSummary()` | Total sales, handovers, cash usage, remaining balance |
| `getProductProfit()` | Profit breakdown by product |
| `recordHandover(userId, amount)` | Log cash handover |
| `recordCashUsage(description, amount)` | Log cash usage |

### expenses/actions.ts
| Function | Description |
|---|---|
| `getExpenses(from, to)` | Filtered expense list |
| `addExpense(category, description, amount, date)` | Create expense |
| `updateExpense(id, ...)` | Edit expense |
| `deleteExpense(id)` | Delete expense |

### reports/actions.ts
| Function | Description |
|---|---|
| `runInventoryReport(filters)` | Stock value by category/product |
| `runSalesReport(from, to, filters)` | Sales summary |
| `runExpensesReport(from, to)` | Expense breakdown |
| `runPnLReport(from, to)` | Profit & loss statement |
| `runDeadStockReport()` | Variants with zero stock |
| `runTopColorsReport(from, to)` | Best selling colors |

### analysis/actions.ts
| Function | Description |
|---|---|
| `getTopColors()` | Colors ranked by qty sold |
| `getTopSizes()` | Sizes ranked by qty sold |
| `getTopProducts()` | Products ranked by revenue |
| `getTopCategories()` | Categories ranked by revenue |
| `getRestockAlerts()` | Variants with Qty < 10 |
| `getMonthlySalesTrend()` | Monthly revenue over time |
| `getDailySalesTrend()` | Daily revenue for current month |
| `getSalesByDayOfWeek()` | Revenue by day (Mon–Sun) |
| `getRevenueVsExpenses()` | Monthly revenue vs expenses |
| `getCustomerLeaderboard()` | Top 20 customers by spend |
| `getOrderStatusBreakdown()` | Count by payment status |
| `getAovTrend()` | Average order value over time |

### color-requests/actions.ts
| Function | Description |
|---|---|
| `getColorRequests(status)` | All color requests, filterable |
| `createColorRequest(...)` | New request |
| `updateColorRequestStatus(id, status)` | Mark pending/done/canceled |
| `deleteColorRequest(id)` | Delete |

### suppliers/actions.ts
| Function | Description |
|---|---|
| `getSuppliers()` | All suppliers |
| `createSupplier(name, contact, notes)` | Add supplier |
| `updateSupplier(id, ...)` | Edit supplier |
| `deleteSupplier(id)` | Delete supplier |

### users/actions.ts
| Function | Description |
|---|---|
| `getUsers()` | All users |
| `addUser(username, email, password, role)` | Create user |
| `updateUser(id, ...)` | Edit user |
| `deleteUser(id)` | Delete user |

### settings/actions.ts
| Function | Description |
|---|---|
| `getSettings()` | All settings as key-value pairs |
| `getSetting(key)` | Single setting by key |
| `saveSetting(key, value)` | Upsert a setting |
| `deleteSetting(key)` | Remove a setting |

---

## Authentication

- Stored in `localStorage` as key `authUser` (JSON object)
- Shape: `{ Id, Username, Email, Role }`
- Roles: `Admin` | `Staff`
- Auth guard in `(main)/layout.tsx` — redirects to `/login` if not authenticated
- Admin-only routes: `/finance`, `/expenses`, `/reports`, `/users`, `/settings`
- Passwords hashed with `bcryptjs`

---

## WhatsApp Message Templates

Stored in browser `localStorage` under key `whatsapp_messages`. Defaults loaded on first visit:

| ID | Title | Category |
|---|---|---|
| 1 | Welcome Message with Size Chart | Product Info |
| 2 | Size & Color Inquiry | Product Info |
| 3 | Order Details Request | Order Confirmation |
| 4 | Terms & Conditions (Eastern/Northern) | Custom |
| 5 | Product Price List | Product Info |
| 6 | Order Follow Up | Follow Up |
| 7 | Review Request | Follow Up |
| 8 | Bank Details | Payment Reminder |
| 9 | WhatsApp Channel Invite | Custom |
| 10 | Delivery & Product Info | Product Info |
| 11 | 3 Qty Price List (Free Delivery) | Product Info |
| student-offer | Student Special Offer | Custom |

---

## Full Database Setup (Fresh Install)

```sql
CREATE TABLE Categories (Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(), Name NVARCHAR(200) NOT NULL);
CREATE TABLE Sizes      (Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(), Name NVARCHAR(50)  NOT NULL);
CREATE TABLE Colors     (Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(), Name NVARCHAR(100) NOT NULL);

CREATE TABLE Users (
    Id           UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Username     NVARCHAR(100) NOT NULL UNIQUE,
    Email        NVARCHAR(200) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(MAX) NOT NULL,
    Role         NVARCHAR(50)  NOT NULL DEFAULT 'Staff',
    CreatedAt    DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE TABLE Products (
    Id           UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    CategoryId   UNIQUEIDENTIFIER NOT NULL REFERENCES Categories(Id),
    Name         NVARCHAR(200)    NOT NULL,
    SKU          NVARCHAR(100)    NULL,
    CostPrice    DECIMAL(18,2)    NULL,
    SellingPrice DECIMAL(18,2)    NULL
);

CREATE TABLE ProductVariants (
    Id           UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ProductId    UNIQUEIDENTIFIER NOT NULL REFERENCES Products(Id),
    SizeId       UNIQUEIDENTIFIER NULL REFERENCES Sizes(Id),
    ColorId      UNIQUEIDENTIFIER NULL REFERENCES Colors(Id),
    Qty          INT              NOT NULL DEFAULT 0,
    CostPrice    DECIMAL(18,2)    NULL,
    SellingPrice DECIMAL(18,2)    NULL
);

CREATE TABLE Customers (
    Id        UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name      NVARCHAR(200) NOT NULL,
    Phone     NVARCHAR(50)  NULL UNIQUE,
    Address   NVARCHAR(500) NULL,
    CreatedAt DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE TABLE Orders (
    Id                UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    CustomerId        UNIQUEIDENTIFIER NULL REFERENCES Customers(Id),
    Customer          NVARCHAR(200)    NULL,
    CustomerPhone     NVARCHAR(20)     NULL,
    SecondaryPhone    NVARCHAR(20)     NULL,
    Address           NVARCHAR(300)    NULL,
    WaybillId         NVARCHAR(100)    NULL,
    PackagePrintPrice DECIMAL(18,2)    NULL DEFAULT 0,
    PaymentStatus     NVARCHAR(20)     NOT NULL,
    OrderDate         DATETIME2        NOT NULL,
    CompletedAt       DATETIME2        NULL,
    Subtotal          DECIMAL(18,2)    NOT NULL DEFAULT 0,
    ManualDiscount    DECIMAL(18,2)    NOT NULL DEFAULT 0,
    Discount          DECIMAL(18,2)    NOT NULL DEFAULT 0,
    DeliveryFee       DECIMAL(18,2)    NOT NULL DEFAULT 0,
    Total             DECIMAL(18,2)    NOT NULL DEFAULT 0
);

CREATE TABLE OrderItems (
    Id           UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrderId      UNIQUEIDENTIFIER NOT NULL REFERENCES Orders(Id),
    VariantId    UNIQUEIDENTIFIER NOT NULL REFERENCES ProductVariants(Id),
    Qty          INT              NOT NULL,
    SellingPrice DECIMAL(18,2)    NOT NULL
);

CREATE TABLE OrderStatusLogs (
    Id        UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrderId   UNIQUEIDENTIFIER NOT NULL REFERENCES Orders(Id),
    OldStatus NVARCHAR(50)     NULL,
    NewStatus NVARCHAR(50)     NOT NULL,
    ChangedAt DATETIME2        NOT NULL DEFAULT GETDATE(),
    ChangedBy NVARCHAR(100)    NULL
);

CREATE TABLE Sales (
    Id            UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrderId       UNIQUEIDENTIFIER NULL REFERENCES Orders(Id),
    VariantId     UNIQUEIDENTIFIER NOT NULL REFERENCES ProductVariants(Id),
    Qty           INT              NOT NULL,
    SellingPrice  DECIMAL(18,2)    NOT NULL,
    PaymentMethod NVARCHAR(50)     NOT NULL DEFAULT 'Order',
    PaymentStatus NVARCHAR(20)     NOT NULL,
    SaleDate      DATETIME2        NOT NULL DEFAULT GETDATE()
);

CREATE TABLE SalesReturns (
    Id        UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrderId   UNIQUEIDENTIFIER NOT NULL REFERENCES Orders(Id),
    Reason    NVARCHAR(500)    NOT NULL,
    CreatedAt DATETIME2        NOT NULL DEFAULT GETDATE()
);

CREATE TABLE SalesReturnItems (
    ReturnId  UNIQUEIDENTIFIER NOT NULL REFERENCES SalesReturns(Id),
    VariantId UNIQUEIDENTIFIER NOT NULL REFERENCES ProductVariants(Id),
    Qty       INT              NOT NULL,
    PRIMARY KEY (ReturnId, VariantId)
);

CREATE TABLE StockHistory (
    Id            UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    VariantId     UNIQUEIDENTIFIER NOT NULL REFERENCES ProductVariants(Id),
    ChangeQty     INT              NOT NULL,
    Reason        NVARCHAR(200)    NOT NULL,
    PreviousQty   INT              NOT NULL,
    NewQty        INT              NOT NULL,
    PriceAtChange DECIMAL(18,2)    NULL,
    CreatedAt     DATETIME2        NOT NULL DEFAULT GETDATE()
);

CREATE TABLE Handovers (
    Id           UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    UserId       NVARCHAR(100)  NOT NULL,
    Amount       DECIMAL(18,2)  NOT NULL,
    HandoverDate DATETIME2      NOT NULL DEFAULT GETDATE()
);

CREATE TABLE CashUsage (
    Id          UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Description NVARCHAR(300)  NOT NULL,
    Amount      DECIMAL(18,2)  NOT NULL,
    UsageDate   DATETIME2      NOT NULL DEFAULT GETDATE()
);

CREATE TABLE Expenses (
    Id          UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Category    NVARCHAR(100)  NOT NULL,
    Description NVARCHAR(500)  NULL,
    Amount      DECIMAL(18,2)  NOT NULL,
    ExpenseDate DATETIME2      NOT NULL DEFAULT GETDATE()
);

CREATE TABLE Suppliers (
    Id        UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name      NVARCHAR(200)  NOT NULL,
    Contact   NVARCHAR(200)  NULL,
    Notes     NVARCHAR(MAX)  NULL,
    CreatedAt DATETIME2      NOT NULL DEFAULT GETDATE()
);

CREATE TABLE ColorRequests (
    Id           UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    CustomerName NVARCHAR(200)  NULL,
    Phone        NVARCHAR(50)   NOT NULL,
    ProductName  NVARCHAR(200)  NOT NULL,
    ColorName    NVARCHAR(100)  NOT NULL,
    SizeName     NVARCHAR(50)   NULL,
    Notes        NVARCHAR(MAX)  NULL,
    Status       NVARCHAR(20)   NOT NULL DEFAULT 'Pending',
    CreatedAt    DATETIME2      NOT NULL DEFAULT GETDATE()
);

CREATE TABLE Settings (
    Id        UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    [Key]     NVARCHAR(100)  NOT NULL UNIQUE,
    Value     NVARCHAR(MAX)  NULL,
    UpdatedAt DATETIME2      NOT NULL DEFAULT GETDATE()
);

CREATE TABLE DispatchMessages (
    Id            UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    OrderId       UNIQUEIDENTIFIER NOT NULL REFERENCES Orders(Id),
    WaybillId     NVARCHAR(100)    NOT NULL,
    CustomerName  NVARCHAR(200)    NULL,
    CustomerPhone NVARCHAR(20)     NULL,
    CreatedAt     DATETIME2        NOT NULL DEFAULT GETDATE()
);

CREATE INDEX IX_DispatchMessages_CreatedAt ON DispatchMessages (CreatedAt DESC);
```

---

## Notes

- All IDs are `UNIQUEIDENTIFIER` generated with `crypto.randomUUID()` in Node.js
- All order operations use SQL transactions with automatic rollback on any error
- Stock is validated before reduction — throws if insufficient
- Customer phone number is the unique key for deduplication (upsert by phone)
- WhatsApp templates live in browser `localStorage` — not in the database
- Dispatch messages auto-expire after 7 days via lazy deletion on page load
- Admin-only pages are enforced client-side via auth guard redirect
