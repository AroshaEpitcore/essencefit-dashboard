/* ============================================================
   16_dtf_orders.sql
   DTF customization orders + per-product printable flag.
   Additive, idempotent. Safe to re-run.
   Run AFTER 10_dtf_printing.sql and the e-commerce schema.
   ============================================================ */

/* ---------- Products: which garments can be DTF-printed ---------- */
IF COL_LENGTH('Products','IsDtfPrintable') IS NULL
  ALTER TABLE Products ADD IsDtfPrintable BIT NOT NULL
        CONSTRAINT DF_Products_IsDtfPrintable DEFAULT 0;
GO

/* ---------- DtfOrders: a customer customization request ---------- */
IF OBJECT_ID('dbo.DtfOrders','U') IS NULL
BEGIN
  CREATE TABLE dbo.DtfOrders (
    Id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_DtfOrders_Id DEFAULT NEWID()
                                            CONSTRAINT PK_DtfOrders PRIMARY KEY,
    Ref           NVARCHAR(20)  NOT NULL,                 -- e.g. DTF-O-1001
    -- customer contact (collected on submit)
    CustomerName  NVARCHAR(200) NOT NULL,
    CustomerPhone NVARCHAR(50)  NOT NULL,
    WhatsApp      NVARCHAR(50)  NULL,
    Email         NVARCHAR(200) NULL,
    Address       NVARCHAR(500) NULL,
    -- chosen garment (real catalog product/variant)
    ProductId     UNIQUEIDENTIFIER NOT NULL,
    VariantId     UNIQUEIDENTIFIER NULL,                  -- size+colour variant; NULL if none chosen
    Qty           INT           NOT NULL CONSTRAINT DF_DtfOrders_Qty DEFAULT 1,
    PrintOptions  NVARCHAR(300) NULL,                     -- comma list e.g. "Front Print, A3 Print"
    CustomerNote  NVARCHAR(MAX) NULL,
    -- pricing (estimate computed from DtfPriceItems + garment price; admin may override)
    GarmentPrice   DECIMAL(10,2) NOT NULL CONSTRAINT DF_DtfOrders_Garment DEFAULT 0,
    PrintCharges   DECIMAL(10,2) NOT NULL CONSTRAINT DF_DtfOrders_Print   DEFAULT 0,
    EstimatedTotal DECIMAL(10,2) NOT NULL CONSTRAINT DF_DtfOrders_Est     DEFAULT 0,
    BreakdownJson  NVARCHAR(MAX) NULL,
    FinalTotal     DECIMAL(10,2) NULL,                    -- admin-set
    AdvanceAmount  DECIMAL(10,2) NULL,                    -- admin-set
    -- lifecycle
    Status        NVARCHAR(20)  NOT NULL CONSTRAINT DF_DtfOrders_Status DEFAULT 'Pending',
                  -- Pending | Confirmed | InProduction | Ready | Completed | Canceled
    StockDeducted BIT           NOT NULL CONSTRAINT DF_DtfOrders_Stock  DEFAULT 0,
    AdminNote     NVARCHAR(MAX) NULL,
    CreatedAt     DATETIME2     NOT NULL CONSTRAINT DF_DtfOrders_Created DEFAULT SYSUTCDATETIME(),
    ConfirmedAt   DATETIME2     NULL
  );
  CREATE INDEX IX_DtfOrders_Status ON dbo.DtfOrders(Status);
END
GO

/* ---------- DtfOrderDesigns: the uploaded artwork files ---------- */
IF OBJECT_ID('dbo.DtfOrderDesigns','U') IS NULL
BEGIN
  CREATE TABLE dbo.DtfOrderDesigns (
    Id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_DtfOrderDesigns_Id DEFAULT NEWID()
                                          CONSTRAINT PK_DtfOrderDesigns PRIMARY KEY,
    DtfOrderId UNIQUEIDENTIFIER NOT NULL,
    Url        NVARCHAR(500) NOT NULL,
    Kind       NVARCHAR(20)  NOT NULL CONSTRAINT DF_DtfOrderDesigns_Kind DEFAULT 'image', -- image | pdf
    SortOrder  INT           NOT NULL CONSTRAINT DF_DtfOrderDesigns_Sort DEFAULT 0
  );
  CREATE INDEX IX_DtfOrderDesigns_OrderId ON dbo.DtfOrderDesigns(DtfOrderId);
END
GO
