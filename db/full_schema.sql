CREATE TYPE [dbo].[udt_OrderItems] AS TABLE(
	[VariantId] [uniqueidentifier] NOT NULL,
	[Qty] [int] NOT NULL,
	[SellingPrice] [decimal](18, 2) NOT NULL
)
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
/* Resolve a variant to the variant that actually holds its stock:
   - if the variant's product is linked to a blank, the blank's variant
     matching the same Size+Colour;
   - otherwise the variant itself. */
CREATE   FUNCTION dbo.fn_StockVariantId(@VariantId UNIQUEIDENTIFIER)
RETURNS UNIQUEIDENTIFIER AS
BEGIN
  DECLARE @Res UNIQUEIDENTIFIER = @VariantId,
          @Blank UNIQUEIDENTIFIER, @Size UNIQUEIDENTIFIER, @Color UNIQUEIDENTIFIER;
  SELECT @Blank = p.BlankProductId, @Size = v.SizeId, @Color = v.ColorId
  FROM ProductVariants v JOIN Products p ON p.Id = v.ProductId
  WHERE v.Id = @VariantId;
  IF @Blank IS NOT NULL
  BEGIN
    SELECT TOP 1 @Res = b.Id FROM ProductVariants b
    WHERE b.ProductId = @Blank
      AND ISNULL(CONVERT(NVARCHAR(36), b.SizeId), '') = ISNULL(CONVERT(NVARCHAR(36), @Size), '')
      AND ISNULL(CONVERT(NVARCHAR(36), b.ColorId), '') = ISNULL(CONVERT(NVARCHAR(36), @Color), '');
    IF @Res IS NULL SET @Res = @VariantId;
  END
  RETURN @Res;
END
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Orders](
	[Id] [uniqueidentifier] NOT NULL,
	[Customer] [nvarchar](200) NULL,
	[PaymentStatus] [nvarchar](20) NOT NULL,
	[OrderDate] [datetime2](7) NOT NULL,
	[Subtotal] [decimal](18, 2) NULL,
	[Discount] [decimal](18, 2) NULL,
	[DeliveryFee] [decimal](18, 2) NULL,
	[Total] [decimal](18, 2) NULL,
	[CustomerId] [uniqueidentifier] NULL,
	[CustomerPhone] [nvarchar](20) NULL,
	[Address] [nvarchar](300) NULL,
	[ManualDiscount] [decimal](18, 2) NULL,
	[CompletedAt] [datetime2](7) NULL,
	[SecondaryPhone] [nvarchar](20) NULL,
	[WaybillId] [nvarchar](100) NULL,
	[PackagePrintPrice] [decimal](18, 2) NULL,
	[Notes] [nvarchar](500) NULL,
	[Source] [nvarchar](20) NULL,
	[CustomerEmail] [nvarchar](200) NULL,
	[PaymentMethod] [nvarchar](30) NULL,
	[PaymentSlipUrl] [nvarchar](500) NULL,
	[PaymentVerified] [bit] NOT NULL,
	[Province] [nvarchar](50) NULL,
	[StockDeducted] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[OrderItems](
	[Id] [uniqueidentifier] NOT NULL,
	[OrderId] [uniqueidentifier] NOT NULL,
	[VariantId] [uniqueidentifier] NOT NULL,
	[Qty] [int] NOT NULL,
	[SellingPrice] [decimal](18, 2) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE VIEW dbo.v_RecentOrders AS
SELECT
  o.Id,
  o.Customer,
  o.PaymentStatus,
  o.OrderDate,
  SUM(oi.Qty * oi.SellingPrice) AS Total,
  COUNT(oi.Id) AS LineCount
FROM dbo.Orders o
LEFT JOIN dbo.OrderItems oi ON oi.OrderId = o.Id
GROUP BY o.Id, o.Customer, o.PaymentStatus, o.OrderDate;

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Products](
	[Id] [uniqueidentifier] NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[SKU] [nvarchar](100) NOT NULL,
	[CategoryId] [uniqueidentifier] NOT NULL,
	[CostPrice] [decimal](18, 2) NOT NULL,
	[SellingPrice] [decimal](18, 2) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[Slug] [nvarchar](250) NULL,
	[Description] [nvarchar](max) NULL,
	[ImageUrl] [nvarchar](500) NULL,
	[CompareAtPrice] [decimal](18, 2) NULL,
	[IsActive] [bit] NOT NULL,
	[IsFeatured] [bit] NOT NULL,
	[SortOrder] [int] NOT NULL,
	[IsNewArrival] [bit] NOT NULL,
	[IsDtfPrintable] [bit] NOT NULL,
	[BlankProductId] [uniqueidentifier] NULL,
	[DtfProfit] [decimal](10, 2) NULL,
	[PrintOnDemand] [bit] NOT NULL,
	[SizeChartUrl] [nvarchar](500) NULL,
	[SelectByImage] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[SKU] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ProductVariants](
	[Id] [uniqueidentifier] NOT NULL,
	[ProductId] [uniqueidentifier] NOT NULL,
	[SizeId] [uniqueidentifier] NULL,
	[ColorId] [uniqueidentifier] NULL,
	[Qty] [int] NOT NULL,
	[SellingPrice] [decimal](18, 2) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[CostPrice] [decimal](18, 2) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE VIEW dbo.v_ProductProfit AS
SELECT
    p.Id AS ProductId,
    p.Name AS ProductName,
    SUM(oi.Qty) AS TotalSoldQty,
    SUM(oi.Qty * oi.SellingPrice) AS TotalRevenue,
    SUM(oi.Qty * p.CostPrice) AS TotalCost,
    SUM(oi.Qty * oi.SellingPrice) - SUM(oi.Qty * p.CostPrice) AS Profit
FROM dbo.OrderItems oi
INNER JOIN dbo.ProductVariants v ON v.Id = oi.VariantId
INNER JOIN dbo.Products p ON p.Id = v.ProductId
INNER JOIN dbo.Orders o ON o.Id = oi.OrderId
GROUP BY p.Id, p.Name;

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Sales](
	[Id] [uniqueidentifier] NOT NULL,
	[VariantId] [uniqueidentifier] NOT NULL,
	[Qty] [int] NOT NULL,
	[SellingPrice] [decimal](18, 2) NOT NULL,
	[PaymentMethod] [nvarchar](50) NOT NULL,
	[PaymentStatus] [nvarchar](20) NOT NULL,
	[SaleDate] [datetime2](7) NOT NULL,
	[OrderId] [uniqueidentifier] NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Handovers](
	[Id] [uniqueidentifier] NOT NULL,
	[UserId] [uniqueidentifier] NOT NULL,
	[Amount] [decimal](18, 2) NOT NULL,
	[HandoverDate] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CashUsage](
	[Id] [uniqueidentifier] NOT NULL,
	[Description] [nvarchar](200) NOT NULL,
	[Amount] [decimal](18, 2) NOT NULL,
	[UsageDate] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- Finance summary view
CREATE   VIEW v_FinanceSummary AS
SELECT 
    ISNULL(SUM(S.Qty * S.SellingPrice),0) AS TotalSales,
    (SELECT ISNULL(SUM(H.Amount),0) FROM Handovers H) AS HandedOver,
    (SELECT ISNULL(SUM(C.Amount),0) FROM CashUsage C) AS CashUsed,
    (ISNULL(SUM(S.Qty * S.SellingPrice),0) 
      - (SELECT ISNULL(SUM(H.Amount),0) FROM Handovers H)
      - (SELECT ISNULL(SUM(C.Amount),0) FROM CashUsage C)
    ) AS Remaining
FROM Sales S;

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PurchaseReturns](
	[Id] [uniqueidentifier] NOT NULL,
	[SupplierId] [uniqueidentifier] NOT NULL,
	[Reason] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Sizes](
	[Id] [uniqueidentifier] NOT NULL,
	[Name] [nvarchar](50) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Settings](
	[Id] [uniqueidentifier] NOT NULL,
	[Key] [nvarchar](100) NOT NULL,
	[Value] [nvarchar](max) NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[Key] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SalesReturns](
	[Id] [uniqueidentifier] NOT NULL,
	[OrderId] [uniqueidentifier] NULL,
	[Reason] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Users](
	[Id] [uniqueidentifier] NOT NULL,
	[Username] [nvarchar](100) NOT NULL,
	[Email] [nvarchar](200) NOT NULL,
	[PasswordHash] [nvarchar](200) NOT NULL,
	[Role] [nvarchar](20) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[Username] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
UNIQUE NONCLUSTERED 
(
	[Email] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Suppliers](
	[Id] [uniqueidentifier] NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Contact] [nvarchar](200) NULL,
	[Notes] [nvarchar](max) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Customers](
	[Id] [uniqueidentifier] NOT NULL,
	[Name] [nvarchar](200) NOT NULL,
	[Phone] [nvarchar](50) NULL,
	[Address] [nvarchar](500) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[Email] [nvarchar](200) NULL,
	[PasswordHash] [nvarchar](200) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Colors](
	[Id] [uniqueidentifier] NOT NULL,
	[Name] [nvarchar](50) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[Hex] [nvarchar](20) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ColorRequests](
	[Id] [uniqueidentifier] NOT NULL,
	[CustomerName] [nvarchar](200) NULL,
	[Phone] [nvarchar](50) NOT NULL,
	[ProductName] [nvarchar](200) NOT NULL,
	[ColorName] [nvarchar](100) NOT NULL,
	[SizeName] [nvarchar](50) NULL,
	[Notes] [nvarchar](max) NULL,
	[Status] [nvarchar](20) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Categories](
	[Id] [uniqueidentifier] NOT NULL,
	[Name] [nvarchar](100) NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[Slug] [nvarchar](150) NULL,
	[ImageUrl] [nvarchar](500) NULL,
	[Description] [nvarchar](500) NULL,
	[IsActive] [bit] NOT NULL,
	[SortOrder] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Expenses](
	[Id] [uniqueidentifier] NOT NULL,
	[Category] [nvarchar](100) NOT NULL,
	[Description] [nvarchar](500) NULL,
	[Amount] [decimal](18, 2) NOT NULL,
	[ExpenseDate] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DtfTemplates](
	[Id] [uniqueidentifier] NOT NULL,
	[Title] [nvarchar](150) NOT NULL,
	[Content] [nvarchar](max) NOT NULL,
	[Category] [nvarchar](50) NOT NULL,
	[Language] [nvarchar](20) NOT NULL,
	[SortOrder] [int] NOT NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DtfQuotes](
	[Id] [uniqueidentifier] NOT NULL,
	[QuoteRef] [nvarchar](20) NOT NULL,
	[CustomerName] [nvarchar](150) NULL,
	[CustomerPhone] [nvarchar](30) NULL,
	[GarmentName] [nvarchar](100) NOT NULL,
	[PrintNames] [nvarchar](300) NULL,
	[Quantity] [int] NOT NULL,
	[GarmentCost] [decimal](10, 2) NOT NULL,
	[PrintCost] [decimal](10, 2) NOT NULL,
	[Packaging] [decimal](10, 2) NOT NULL,
	[Utilities] [decimal](10, 2) NOT NULL,
	[Profit] [decimal](10, 2) NOT NULL,
	[UnitPrice] [decimal](10, 2) NOT NULL,
	[Total] [decimal](10, 2) NOT NULL,
	[Notes] [nvarchar](500) NULL,
	[BreakdownJson] [nvarchar](max) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[Extra] [decimal](10, 2) NOT NULL,
	[FinalTotal] [decimal](10, 2) NOT NULL,
	[AdvancePct] [decimal](5, 2) NOT NULL,
	[AdvanceAmount] [decimal](10, 2) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DtfPriceItems](
	[Id] [uniqueidentifier] NOT NULL,
	[Category] [nvarchar](20) NOT NULL,
	[Name] [nvarchar](100) NOT NULL,
	[Amount] [decimal](10, 2) NOT NULL,
	[Unit] [nvarchar](30) NULL,
	[SortOrder] [int] NOT NULL,
	[IsActive] [bit] NOT NULL,
	[UpdatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DtfOrders](
	[Id] [uniqueidentifier] NOT NULL,
	[Ref] [nvarchar](20) NOT NULL,
	[CustomerName] [nvarchar](200) NOT NULL,
	[CustomerPhone] [nvarchar](50) NOT NULL,
	[WhatsApp] [nvarchar](50) NULL,
	[Email] [nvarchar](200) NULL,
	[Address] [nvarchar](500) NULL,
	[ProductId] [uniqueidentifier] NOT NULL,
	[VariantId] [uniqueidentifier] NULL,
	[Qty] [int] NOT NULL,
	[PrintOptions] [nvarchar](300) NULL,
	[CustomerNote] [nvarchar](max) NULL,
	[GarmentPrice] [decimal](10, 2) NOT NULL,
	[PrintCharges] [decimal](10, 2) NOT NULL,
	[EstimatedTotal] [decimal](10, 2) NOT NULL,
	[BreakdownJson] [nvarchar](max) NULL,
	[FinalTotal] [decimal](10, 2) NULL,
	[AdvanceAmount] [decimal](10, 2) NULL,
	[Status] [nvarchar](20) NOT NULL,
	[StockDeducted] [bit] NOT NULL,
	[AdminNote] [nvarchar](max) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[ConfirmedAt] [datetime2](7) NULL,
	[CustomerId] [uniqueidentifier] NULL,
 CONSTRAINT [PK_DtfOrders] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DtfOrderDesigns](
	[Id] [uniqueidentifier] NOT NULL,
	[DtfOrderId] [uniqueidentifier] NOT NULL,
	[Url] [nvarchar](500) NOT NULL,
	[Kind] [nvarchar](20) NOT NULL,
	[SortOrder] [int] NOT NULL,
 CONSTRAINT [PK_DtfOrderDesigns] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ProductImages](
	[Id] [uniqueidentifier] NOT NULL,
	[ProductId] [uniqueidentifier] NOT NULL,
	[Url] [nvarchar](500) NOT NULL,
	[SortOrder] [int] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[ColorId] [uniqueidentifier] NULL,
	[VariantId] [uniqueidentifier] NULL,
 CONSTRAINT [PK_ProductImages] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[SalesReturnItems](
	[Id] [uniqueidentifier] NOT NULL,
	[ReturnId] [uniqueidentifier] NOT NULL,
	[VariantId] [uniqueidentifier] NOT NULL,
	[Qty] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PurchaseReturnItems](
	[Id] [uniqueidentifier] NOT NULL,
	[ReturnId] [uniqueidentifier] NOT NULL,
	[VariantId] [uniqueidentifier] NOT NULL,
	[Qty] [int] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DispatchMessages](
	[Id] [uniqueidentifier] NOT NULL,
	[OrderId] [uniqueidentifier] NOT NULL,
	[WaybillId] [nvarchar](100) NOT NULL,
	[CustomerName] [nvarchar](200) NULL,
	[CustomerPhone] [nvarchar](20) NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[OrderStatusLogs](
	[Id] [uniqueidentifier] NOT NULL,
	[OrderId] [uniqueidentifier] NOT NULL,
	[OldStatus] [nvarchar](50) NULL,
	[NewStatus] [nvarchar](50) NOT NULL,
	[ChangedAt] [datetime2](7) NOT NULL,
	[ChangedBy] [nvarchar](100) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Purchases](
	[Id] [uniqueidentifier] NOT NULL,
	[SupplierId] [uniqueidentifier] NOT NULL,
	[VariantId] [uniqueidentifier] NOT NULL,
	[Qty] [int] NOT NULL,
	[CostPrice] [decimal](18, 2) NOT NULL,
	[PaymentStatus] [nvarchar](20) NOT NULL,
	[PurchaseDate] [datetime2](7) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[StockHistory](
	[Id] [uniqueidentifier] NOT NULL,
	[VariantId] [uniqueidentifier] NOT NULL,
	[ChangeQty] [int] NOT NULL,
	[Reason] [nvarchar](100) NOT NULL,
	[UserId] [uniqueidentifier] NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[PreviousQty] [int] NULL,
	[NewQty] [int] NULL,
	[PriceAtChange] [decimal](18, 2) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

GO
SET ANSI_PADDING ON

GO
CREATE UNIQUE NONCLUSTERED INDEX [UX_Customers_Phone] ON [dbo].[Customers]
(
	[Phone] ASC
)
WHERE ([Phone] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
CREATE NONCLUSTERED INDEX [IX_DtfOrders_CustomerId] ON [dbo].[DtfOrders]
(
	[CustomerId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON

GO
CREATE NONCLUSTERED INDEX [IX_DtfOrders_Status] ON [dbo].[DtfOrders]
(
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
CREATE NONCLUSTERED INDEX [IX_DtfOrderDesigns_OrderId] ON [dbo].[DtfOrderDesigns]
(
	[DtfOrderId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
CREATE NONCLUSTERED INDEX [IX_ProductImages_Product_Color] ON [dbo].[ProductImages]
(
	[ProductId] ASC,
	[ColorId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
CREATE NONCLUSTERED INDEX [IX_ProductImages_ProductId] ON [dbo].[ProductImages]
(
	[ProductId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
CREATE NONCLUSTERED INDEX [IX_ProductImages_VariantId] ON [dbo].[ProductImages]
(
	[VariantId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
CREATE NONCLUSTERED INDEX [IX_Orders_CustomerId] ON [dbo].[Orders]
(
	[CustomerId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
CREATE NONCLUSTERED INDEX [IX_DispatchMessages_CreatedAt] ON [dbo].[DispatchMessages]
(
	[CreatedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
CREATE NONCLUSTERED INDEX [IX_OrderStatusLogs_ChangedAt] ON [dbo].[OrderStatusLogs]
(
	[ChangedAt] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON

GO
CREATE NONCLUSTERED INDEX [IX_OrderStatusLogs_NewStatus] ON [dbo].[OrderStatusLogs]
(
	[NewStatus] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
CREATE NONCLUSTERED INDEX [IX_OrderStatusLogs_OrderId] ON [dbo].[OrderStatusLogs]
(
	[OrderId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
CREATE NONCLUSTERED INDEX [IX_Sales_OrderId] ON [dbo].[Sales]
(
	[OrderId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
ALTER TABLE [dbo].[PurchaseReturns] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[PurchaseReturns] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Sizes] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[Sizes] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Settings] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[Settings] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[SalesReturns] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[SalesReturns] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ('Staff') FOR [Role]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Suppliers] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[Suppliers] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Customers] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[Customers] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Colors] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[Colors] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[ColorRequests] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[ColorRequests] ADD  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[ColorRequests] ADD  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Categories] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[Categories] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Categories] ADD  CONSTRAINT [DF_Categories_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Categories] ADD  CONSTRAINT [DF_Categories_SortOrder]  DEFAULT ((0)) FOR [SortOrder]
GO
ALTER TABLE [dbo].[CashUsage] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[CashUsage] ADD  DEFAULT (sysutcdatetime()) FOR [UsageDate]
GO
ALTER TABLE [dbo].[Expenses] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[Expenses] ADD  DEFAULT (sysutcdatetime()) FOR [ExpenseDate]
GO
ALTER TABLE [dbo].[DtfTemplates] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[DtfTemplates] ADD  DEFAULT ('General') FOR [Category]
GO
ALTER TABLE [dbo].[DtfTemplates] ADD  DEFAULT ('Sinhala') FOR [Language]
GO
ALTER TABLE [dbo].[DtfTemplates] ADD  DEFAULT ((0)) FOR [SortOrder]
GO
ALTER TABLE [dbo].[DtfTemplates] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[DtfTemplates] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[DtfTemplates] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[DtfQuotes] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[DtfQuotes] ADD  DEFAULT ((1)) FOR [Quantity]
GO
ALTER TABLE [dbo].[DtfQuotes] ADD  DEFAULT ((0)) FOR [GarmentCost]
GO
ALTER TABLE [dbo].[DtfQuotes] ADD  DEFAULT ((0)) FOR [PrintCost]
GO
ALTER TABLE [dbo].[DtfQuotes] ADD  DEFAULT ((0)) FOR [Packaging]
GO
ALTER TABLE [dbo].[DtfQuotes] ADD  DEFAULT ((0)) FOR [Utilities]
GO
ALTER TABLE [dbo].[DtfQuotes] ADD  DEFAULT ((0)) FOR [Profit]
GO
ALTER TABLE [dbo].[DtfQuotes] ADD  DEFAULT ((0)) FOR [UnitPrice]
GO
ALTER TABLE [dbo].[DtfQuotes] ADD  DEFAULT ((0)) FOR [Total]
GO
ALTER TABLE [dbo].[DtfQuotes] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[DtfQuotes] ADD  DEFAULT ((0)) FOR [Extra]
GO
ALTER TABLE [dbo].[DtfQuotes] ADD  DEFAULT ((0)) FOR [FinalTotal]
GO
ALTER TABLE [dbo].[DtfQuotes] ADD  DEFAULT ((0)) FOR [AdvancePct]
GO
ALTER TABLE [dbo].[DtfQuotes] ADD  DEFAULT ((0)) FOR [AdvanceAmount]
GO
ALTER TABLE [dbo].[DtfPriceItems] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[DtfPriceItems] ADD  DEFAULT ((0)) FOR [Amount]
GO
ALTER TABLE [dbo].[DtfPriceItems] ADD  DEFAULT ((0)) FOR [SortOrder]
GO
ALTER TABLE [dbo].[DtfPriceItems] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[DtfPriceItems] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO
ALTER TABLE [dbo].[DtfOrders] ADD  CONSTRAINT [DF_DtfOrders_Id]  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[DtfOrders] ADD  CONSTRAINT [DF_DtfOrders_Qty]  DEFAULT ((1)) FOR [Qty]
GO
ALTER TABLE [dbo].[DtfOrders] ADD  CONSTRAINT [DF_DtfOrders_Garment]  DEFAULT ((0)) FOR [GarmentPrice]
GO
ALTER TABLE [dbo].[DtfOrders] ADD  CONSTRAINT [DF_DtfOrders_Print]  DEFAULT ((0)) FOR [PrintCharges]
GO
ALTER TABLE [dbo].[DtfOrders] ADD  CONSTRAINT [DF_DtfOrders_Est]  DEFAULT ((0)) FOR [EstimatedTotal]
GO
ALTER TABLE [dbo].[DtfOrders] ADD  CONSTRAINT [DF_DtfOrders_Status]  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[DtfOrders] ADD  CONSTRAINT [DF_DtfOrders_Stock]  DEFAULT ((0)) FOR [StockDeducted]
GO
ALTER TABLE [dbo].[DtfOrders] ADD  CONSTRAINT [DF_DtfOrders_Created]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[DtfOrderDesigns] ADD  CONSTRAINT [DF_DtfOrderDesigns_Id]  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[DtfOrderDesigns] ADD  CONSTRAINT [DF_DtfOrderDesigns_Kind]  DEFAULT ('image') FOR [Kind]
GO
ALTER TABLE [dbo].[DtfOrderDesigns] ADD  CONSTRAINT [DF_DtfOrderDesigns_Sort]  DEFAULT ((0)) FOR [SortOrder]
GO
ALTER TABLE [dbo].[ProductImages] ADD  CONSTRAINT [DF_ProductImages_Id]  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[ProductImages] ADD  CONSTRAINT [DF_ProductImages_SortOrder]  DEFAULT ((0)) FOR [SortOrder]
GO
ALTER TABLE [dbo].[ProductImages] ADD  CONSTRAINT [DF_ProductImages_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Orders] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[Orders] ADD  DEFAULT (sysutcdatetime()) FOR [OrderDate]
GO
ALTER TABLE [dbo].[Orders] ADD  DEFAULT ((0)) FOR [ManualDiscount]
GO
ALTER TABLE [dbo].[Orders] ADD  CONSTRAINT [DF_Orders_PaymentVerified]  DEFAULT ((0)) FOR [PaymentVerified]
GO
ALTER TABLE [dbo].[Orders] ADD  CONSTRAINT [DF_Orders_StockDeducted]  DEFAULT ((1)) FOR [StockDeducted]
GO
ALTER TABLE [dbo].[Products] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[Products] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Products] ADD  CONSTRAINT [DF_Products_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[Products] ADD  CONSTRAINT [DF_Products_IsFeatured]  DEFAULT ((0)) FOR [IsFeatured]
GO
ALTER TABLE [dbo].[Products] ADD  CONSTRAINT [DF_Products_SortOrder]  DEFAULT ((0)) FOR [SortOrder]
GO
ALTER TABLE [dbo].[Products] ADD  CONSTRAINT [DF_Products_IsNewArrival]  DEFAULT ((0)) FOR [IsNewArrival]
GO
ALTER TABLE [dbo].[Products] ADD  CONSTRAINT [DF_Products_IsDtfPrintable]  DEFAULT ((0)) FOR [IsDtfPrintable]
GO
ALTER TABLE [dbo].[Products] ADD  CONSTRAINT [DF_Products_PrintOnDemand]  DEFAULT ((0)) FOR [PrintOnDemand]
GO
ALTER TABLE [dbo].[Products] ADD  CONSTRAINT [DF_Products_SelectByImage]  DEFAULT ((0)) FOR [SelectByImage]
GO
ALTER TABLE [dbo].[Handovers] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[Handovers] ADD  DEFAULT (sysutcdatetime()) FOR [HandoverDate]
GO
ALTER TABLE [dbo].[SalesReturnItems] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[PurchaseReturnItems] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[ProductVariants] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[ProductVariants] ADD  DEFAULT ((0)) FOR [Qty]
GO
ALTER TABLE [dbo].[ProductVariants] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[DispatchMessages] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[DispatchMessages] ADD  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[OrderStatusLogs] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[OrderStatusLogs] ADD  DEFAULT (getdate()) FOR [ChangedAt]
GO
ALTER TABLE [dbo].[OrderItems] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[Sales] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[Sales] ADD  DEFAULT ('cash') FOR [PaymentMethod]
GO
ALTER TABLE [dbo].[Sales] ADD  DEFAULT ('Paid') FOR [PaymentStatus]
GO
ALTER TABLE [dbo].[Sales] ADD  DEFAULT (sysutcdatetime()) FOR [SaleDate]
GO
ALTER TABLE [dbo].[Purchases] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[Purchases] ADD  DEFAULT (sysutcdatetime()) FOR [PurchaseDate]
GO
ALTER TABLE [dbo].[StockHistory] ADD  DEFAULT (newid()) FOR [Id]
GO
ALTER TABLE [dbo].[StockHistory] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Orders]  WITH CHECK ADD  CONSTRAINT [FK_Orders_Customers] FOREIGN KEY([CustomerId])
REFERENCES [dbo].[Customers] ([Id])
GO
ALTER TABLE [dbo].[Orders] CHECK CONSTRAINT [FK_Orders_Customers]
GO
ALTER TABLE [dbo].[Products]  WITH CHECK ADD  CONSTRAINT [FK_Products_Category] FOREIGN KEY([CategoryId])
REFERENCES [dbo].[Categories] ([Id])
GO
ALTER TABLE [dbo].[Products] CHECK CONSTRAINT [FK_Products_Category]
GO
ALTER TABLE [dbo].[Handovers]  WITH CHECK ADD  CONSTRAINT [FK_Handovers_User] FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[Handovers] CHECK CONSTRAINT [FK_Handovers_User]
GO
ALTER TABLE [dbo].[SalesReturnItems]  WITH CHECK ADD FOREIGN KEY([ReturnId])
REFERENCES [dbo].[SalesReturns] ([Id])
GO
ALTER TABLE [dbo].[PurchaseReturnItems]  WITH CHECK ADD FOREIGN KEY([ReturnId])
REFERENCES [dbo].[PurchaseReturns] ([Id])
GO
ALTER TABLE [dbo].[ProductVariants]  WITH CHECK ADD  CONSTRAINT [FK_Variants_Color] FOREIGN KEY([ColorId])
REFERENCES [dbo].[Colors] ([Id])
GO
ALTER TABLE [dbo].[ProductVariants] CHECK CONSTRAINT [FK_Variants_Color]
GO
ALTER TABLE [dbo].[ProductVariants]  WITH CHECK ADD  CONSTRAINT [FK_Variants_Product] FOREIGN KEY([ProductId])
REFERENCES [dbo].[Products] ([Id])
GO
ALTER TABLE [dbo].[ProductVariants] CHECK CONSTRAINT [FK_Variants_Product]
GO
ALTER TABLE [dbo].[ProductVariants]  WITH CHECK ADD  CONSTRAINT [FK_Variants_Size] FOREIGN KEY([SizeId])
REFERENCES [dbo].[Sizes] ([Id])
GO
ALTER TABLE [dbo].[ProductVariants] CHECK CONSTRAINT [FK_Variants_Size]
GO
ALTER TABLE [dbo].[DispatchMessages]  WITH CHECK ADD FOREIGN KEY([OrderId])
REFERENCES [dbo].[Orders] ([Id])
GO
ALTER TABLE [dbo].[OrderStatusLogs]  WITH CHECK ADD  CONSTRAINT [FK_OrderStatusLogs_Orders] FOREIGN KEY([OrderId])
REFERENCES [dbo].[Orders] ([Id])
GO
ALTER TABLE [dbo].[OrderStatusLogs] CHECK CONSTRAINT [FK_OrderStatusLogs_Orders]
GO
ALTER TABLE [dbo].[OrderItems]  WITH CHECK ADD  CONSTRAINT [FK_OrderItems_Order] FOREIGN KEY([OrderId])
REFERENCES [dbo].[Orders] ([Id])
GO
ALTER TABLE [dbo].[OrderItems] CHECK CONSTRAINT [FK_OrderItems_Order]
GO
ALTER TABLE [dbo].[OrderItems]  WITH CHECK ADD  CONSTRAINT [FK_OrderItems_Variant] FOREIGN KEY([VariantId])
REFERENCES [dbo].[ProductVariants] ([Id])
GO
ALTER TABLE [dbo].[OrderItems] CHECK CONSTRAINT [FK_OrderItems_Variant]
GO
ALTER TABLE [dbo].[Sales]  WITH CHECK ADD  CONSTRAINT [FK_Sales_Orders_OrderId] FOREIGN KEY([OrderId])
REFERENCES [dbo].[Orders] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[Sales] CHECK CONSTRAINT [FK_Sales_Orders_OrderId]
GO
ALTER TABLE [dbo].[Sales]  WITH CHECK ADD  CONSTRAINT [FK_Sales_Variant] FOREIGN KEY([VariantId])
REFERENCES [dbo].[ProductVariants] ([Id])
GO
ALTER TABLE [dbo].[Sales] CHECK CONSTRAINT [FK_Sales_Variant]
GO
ALTER TABLE [dbo].[Purchases]  WITH CHECK ADD  CONSTRAINT [FK_Purchases_Supplier] FOREIGN KEY([SupplierId])
REFERENCES [dbo].[Suppliers] ([Id])
GO
ALTER TABLE [dbo].[Purchases] CHECK CONSTRAINT [FK_Purchases_Supplier]
GO
ALTER TABLE [dbo].[Purchases]  WITH CHECK ADD  CONSTRAINT [FK_Purchases_Variant] FOREIGN KEY([VariantId])
REFERENCES [dbo].[ProductVariants] ([Id])
GO
ALTER TABLE [dbo].[Purchases] CHECK CONSTRAINT [FK_Purchases_Variant]
GO
ALTER TABLE [dbo].[StockHistory]  WITH CHECK ADD  CONSTRAINT [FK_StockHistory_User] FOREIGN KEY([UserId])
REFERENCES [dbo].[Users] ([Id])
GO
ALTER TABLE [dbo].[StockHistory] CHECK CONSTRAINT [FK_StockHistory_User]
GO
ALTER TABLE [dbo].[StockHistory]  WITH CHECK ADD  CONSTRAINT [FK_StockHistory_Variant] FOREIGN KEY([VariantId])
REFERENCES [dbo].[ProductVariants] ([Id])
GO
ALTER TABLE [dbo].[StockHistory] CHECK CONSTRAINT [FK_StockHistory_Variant]
GO
ALTER TABLE [dbo].[Sales]  WITH CHECK ADD CHECK  (([Qty]>(0)))
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- Register user
CREATE   PROCEDURE sp_register_user
    @Username NVARCHAR(50),
    @Email NVARCHAR(100),
    @PasswordHash NVARCHAR(255),
    @Role NVARCHAR(20)
AS
BEGIN
    IF EXISTS (SELECT 1 FROM Users WHERE Username = @Username OR Email = @Email)
    BEGIN
        RAISERROR('User already exists', 16, 1);
        RETURN;
    END

    INSERT INTO Users (Username, Email, PasswordHash, Role)
    VALUES (@Username, @Email, @PasswordHash, @Role);
END;

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- Login user
CREATE   PROCEDURE sp_login_user
    @Username NVARCHAR(50),
    @PasswordHash NVARCHAR(255)
AS
BEGIN
    SELECT Id, Username, Email, Role
    FROM Users
    WHERE Username = @Username AND PasswordHash = @PasswordHash;
END;

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE dbo.sp_create_order
  @CustomerId     UNIQUEIDENTIFIER = NULL,
  @Customer       NVARCHAR(200) = NULL,
  @Phone          NVARCHAR(50)  = NULL,         -- kept for future if you need
  @Address        NVARCHAR(500) = NULL,         -- kept for future if you need
  @PaymentStatus  NVARCHAR(20),
  @OrderDate      DATETIME2(7),
  @Subtotal       DECIMAL(18,2),
  @Discount       DECIMAL(18,2),
  @DeliveryFee    DECIMAL(18,2),
  @Total          DECIMAL(18,2),
  @Note           NVARCHAR(1000) = NULL,        -- accepted but NOT stored (Orders has no Note)
  @Items          dbo.udt_OrderItems READONLY
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @OrderId UNIQUEIDENTIFIER = NEWID();

  BEGIN TRY
    BEGIN TRAN;

    /* Orders has: Id, Customer, PaymentStatus, OrderDate, Subtotal, Discount, DeliveryFee, Total, CustomerId
       -> No Note column, so we omit it. */
    INSERT INTO Orders
      (Id, CustomerId, Customer, PaymentStatus, OrderDate, Subtotal, Discount, DeliveryFee, Total)
    VALUES
      (@OrderId, @CustomerId, @Customer, @PaymentStatus, @OrderDate, @Subtotal, @Discount, @DeliveryFee, @Total);

    /* Insert items for this order */
    INSERT INTO OrderItems (OrderId, VariantId, Qty, SellingPrice)
    SELECT @OrderId, VariantId, Qty, SellingPrice
    FROM @Items;

    /* Reduce stock */
    UPDATE V
      SET V.Qty = V.Qty - I.Qty
    FROM ProductVariants V
    JOIN @Items I ON I.VariantId = V.Id;

    /* Record sales (Sales likely has: VariantId, Qty, SellingPrice, SaleDate) – no OrderId */
    INSERT INTO Sales (VariantId, Qty, SellingPrice, SaleDate)
    SELECT VariantId, Qty, SellingPrice, @OrderDate
    FROM @Items;

    COMMIT TRAN;

    /* Return OrderId for the app */
    SELECT @OrderId AS OrderId;
  END TRY
  BEGIN CATCH
    IF (XACT_STATE()) <> 0 ROLLBACK TRAN;

    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    DECLARE @ErrSev INT = ERROR_SEVERITY();
    DECLARE @ErrState INT = ERROR_STATE();

    RAISERROR(@ErrMsg, @ErrSev, @ErrState);
    RETURN;
  END CATCH
END

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE sp_adjust_stock
    @VariantId UNIQUEIDENTIFIER,
    @ChangeQty INT,
    @Reason NVARCHAR(100),
    @UserId UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE ProductVariants
    SET Qty = Qty + @ChangeQty
    WHERE Id = @VariantId;

    INSERT INTO StockHistory (VariantId, ChangeQty, Reason, UserId)
    VALUES (@VariantId, @ChangeQty, @Reason, @UserId);
END;

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE sp_get_dashboard_kpis
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Today DATE = CAST(GETUTCDATE() AS DATE);
    DECLARE @MonthStart DATE = DATEFROMPARTS(YEAR(@Today), MONTH(@Today), 1);

    SELECT
        -- Inventory
        (SELECT SUM(pv.Qty) FROM ProductVariants pv) AS TotalStock,
        (SELECT COUNT(*) FROM Products) AS TotalProducts,
        (SELECT COUNT(*) FROM ProductVariants) AS TotalVariants,

        -- Units sold
        (SELECT SUM(s.Qty) 
         FROM Sales s 
         WHERE CAST(s.SaleDate AS DATE) = @Today) AS UnitsSoldToday,

        (SELECT SUM(s.Qty) 
         FROM Sales s 
         WHERE s.SaleDate >= @MonthStart) AS UnitsSoldMonth,

        -- Sales amounts
        (SELECT SUM(s.Qty * s.SellingPrice) 
         FROM Sales s 
         WHERE CAST(s.SaleDate AS DATE) = @Today) AS TodaysSales,

        (SELECT SUM(s.Qty * s.SellingPrice) 
         FROM Sales s 
         WHERE s.SaleDate >= @MonthStart) AS ThisMonthSales,

        -- Profit (Sales - COGS)
        (SELECT SUM(s.Qty * (s.SellingPrice - p.CostPrice))
         FROM Sales s
         JOIN ProductVariants pv ON s.VariantId = pv.Id
         JOIN Products p ON pv.ProductId = p.Id
         WHERE s.SaleDate >= @MonthStart) AS ThisMonthProfit,

        -- Expenses
        (SELECT SUM(e.Amount) 
         FROM Expenses e 
         WHERE e.ExpenseDate >= @MonthStart) AS ThisMonthExpenses,

        -- All-time totals
        (SELECT SUM(s.Qty * s.SellingPrice) 
         FROM Sales s) AS AllTimeSales,

        (SELECT SUM(s.Qty * (s.SellingPrice - p.CostPrice))
         FROM Sales s
         JOIN ProductVariants pv ON s.VariantId = pv.Id
         JOIN Products p ON pv.ProductId = p.Id) AS AllTimeProfit;
END;

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE sp_create_sale
    @VariantId UNIQUEIDENTIFIER,
    @Qty INT,
    @SellingPrice DECIMAL(18,2),
    @PaymentMethod NVARCHAR(50),
    @PaymentStatus NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CurrentQty INT;

    -- Get current stock
    SELECT @CurrentQty = Qty 
    FROM ProductVariants 
    WHERE Id = @VariantId;

    -- Check stock
    IF (@CurrentQty IS NULL)
    BEGIN
        RAISERROR('Variant not found.', 16, 1);
        RETURN;
    END;

    IF (@CurrentQty < @Qty)
    BEGIN
        RAISERROR('Not enough stock available.', 16, 1);
        RETURN;
    END;

    -- Insert sale record
    INSERT INTO Sales (VariantId, Qty, SellingPrice, PaymentMethod, PaymentStatus, SaleDate)
    VALUES (@VariantId, @Qty, @SellingPrice, @PaymentMethod, @PaymentStatus, SYSUTCDATETIME());

    -- Decrease stock
    UPDATE ProductVariants
    SET Qty = Qty - @Qty
    WHERE Id = @VariantId;

    -- Log stock change
    INSERT INTO StockHistory (VariantId, ChangeQty, Reason, UserId, CreatedAt)
    VALUES (@VariantId, -@Qty, 'sale', NULL, SYSUTCDATETIME());
END;

GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE sp_create_purchase
    @SupplierId UNIQUEIDENTIFIER,
    @VariantId UNIQUEIDENTIFIER,
    @Qty INT,
    @CostPrice DECIMAL(18,2),
    @PaymentStatus NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    -- Insert purchase record
    INSERT INTO Purchases (SupplierId, VariantId, Qty, CostPrice, PaymentStatus)
    VALUES (@SupplierId, @VariantId, @Qty, @CostPrice, @PaymentStatus);

    -- Increase stock
    EXEC sp_adjust_stock @VariantId, @Qty, 'purchase', NULL;
END;

GO
