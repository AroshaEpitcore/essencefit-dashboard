/* ============================================================
   seed_test.sql — deterministic fixtures for the automated test DB.
   Applied by test/db/reset.mjs after the schema clone (DB is empty).
   Fixed GUIDs + known credentials so tests are reproducible.

   Known logins:
     Admin user    : admin / admin123          (Role=Admin)
     Staff user    : staff / staff123          (Role=Staff)
     Customer      : test@example.com / 0770000001 / test1234
   ============================================================ */

/* ---------- Admin/staff users ---------- */
INSERT INTO Users (Id, Username, Email, PasswordHash, Role) VALUES
  ('AAAAAAAA-0000-0000-0000-000000000001', 'admin', 'admin@test.local', '$2b$10$QzoAG69dsVzWjtg.bE3Ui.W8wjnf5LKvMiKCAugiLJ8m6pi8IG8ry', 'Admin'),
  ('AAAAAAAA-0000-0000-0000-000000000002', 'staff', 'staff@test.local', '$2b$10$otLoSsYEIpZBQuafvGi3u.byUsmGDgvrXdNQNbnLjc9yDEmDS5pFC', 'Staff');

/* ---------- Registered customer (has PasswordHash → can log in) ---------- */
INSERT INTO Customers (Id, Name, Email, Phone, Address, PasswordHash) VALUES
  ('CCCCCCCC-0000-0000-0000-000000000001', 'Test Customer', 'test@example.com', '0770000001', '123 Test Lane, Colombo', '$2b$10$aLIGW28nmPdcFaQ2AaYLuOK36AAi56pqqNBLv19oi1sOGLbbcOh12');

/* ---------- Lookups ---------- */
INSERT INTO Sizes (Id, Name) VALUES
  ('5A000000-0000-0000-0000-000000000001', 'S'),
  ('5A000000-0000-0000-0000-000000000002', 'M'),
  ('5A000000-0000-0000-0000-000000000003', 'L');

INSERT INTO Colors (Id, Name, Hex) VALUES
  ('C0000000-0000-0000-0000-000000000001', 'Black', '#000000'),
  ('C0000000-0000-0000-0000-000000000002', 'White', '#FFFFFF'),
  ('C0000000-0000-0000-0000-000000000003', 'Red',   '#FF0000');

/* ---------- Category ---------- */
INSERT INTO Categories (Id, Name, Slug, IsActive, SortOrder) VALUES
  ('0CA70000-0000-0000-0000-000000000001', 'Test Apparel', 'test-apparel', 1, 1);

/* ---------- Products ----------
   B...01 normal (size/colour), B...02 select-by-image, B...03 print-on-demand */
INSERT INTO Products (Id, Name, SKU, CategoryId, CostPrice, SellingPrice, Slug, ImageUrl, IsActive, IsFeatured, SelectByImage, PrintOnDemand) VALUES
  ('B0000000-0000-0000-0000-000000000001', 'Test Tee', 'TT-001', '0CA70000-0000-0000-0000-000000000001', 500, 1500, 'test-tee', '/uploads/products/test-tee-black.jpg', 1, 1, 0, 0),
  ('B0000000-0000-0000-0000-000000000002', 'Test Design Tee', 'TD-001', '0CA70000-0000-0000-0000-000000000001', 600, 1800, 'test-design-tee', '/uploads/products/test-design-1.jpg', 1, 0, 1, 0),
  ('B0000000-0000-0000-0000-000000000003', 'Test POD Cap', 'TP-001', '0CA70000-0000-0000-0000-000000000001', 700, 1890, 'test-pod-cap', '/uploads/products/test-pod-cap.jpg', 1, 0, 0, 1);

/* ---------- Variants ----------
   Normal: S/Black=10, M/Black=5, L/Black=0 (out of stock), M/White=8 */
INSERT INTO ProductVariants (Id, ProductId, SizeId, ColorId, Qty) VALUES
  ('D0000000-0000-0000-0000-000000000001', 'B0000000-0000-0000-0000-000000000001', '5A000000-0000-0000-0000-000000000001', 'C0000000-0000-0000-0000-000000000001', 10),
  ('D0000000-0000-0000-0000-000000000002', 'B0000000-0000-0000-0000-000000000001', '5A000000-0000-0000-0000-000000000002', 'C0000000-0000-0000-0000-000000000001', 5),
  ('D0000000-0000-0000-0000-000000000003', 'B0000000-0000-0000-0000-000000000001', '5A000000-0000-0000-0000-000000000003', 'C0000000-0000-0000-0000-000000000001', 0),
  ('D0000000-0000-0000-0000-000000000004', 'B0000000-0000-0000-0000-000000000001', '5A000000-0000-0000-0000-000000000002', 'C0000000-0000-0000-0000-000000000002', 8);

/* Design variants (size/colour NULL) — Design 1 qty 7, Design 2 qty 3 */
INSERT INTO ProductVariants (Id, ProductId, SizeId, ColorId, Qty) VALUES
  ('D0000000-0000-0000-0000-000000000011', 'B0000000-0000-0000-0000-000000000002', NULL, NULL, 7),
  ('D0000000-0000-0000-0000-000000000012', 'B0000000-0000-0000-0000-000000000002', NULL, NULL, 3);

/* POD variants — 0 stock on purpose (made to order) */
INSERT INTO ProductVariants (Id, ProductId, SizeId, ColorId, Qty) VALUES
  ('D0000000-0000-0000-0000-000000000021', 'B0000000-0000-0000-0000-000000000003', '5A000000-0000-0000-0000-000000000001', 'C0000000-0000-0000-0000-000000000001', 0),
  ('D0000000-0000-0000-0000-000000000022', 'B0000000-0000-0000-0000-000000000003', '5A000000-0000-0000-0000-000000000002', 'C0000000-0000-0000-0000-000000000001', 0);

/* ---------- Product images ----------
   Normal: per-colour images. Design: image per design variant (ColorId NULL). */
INSERT INTO ProductImages (Id, ProductId, Url, ColorId, VariantId, SortOrder) VALUES
  ('E0000000-0000-0000-0000-000000000001', 'B0000000-0000-0000-0000-000000000001', '/uploads/products/test-tee-black.jpg', 'C0000000-0000-0000-0000-000000000001', NULL, 0),
  ('E0000000-0000-0000-0000-000000000002', 'B0000000-0000-0000-0000-000000000001', '/uploads/products/test-tee-white.jpg', 'C0000000-0000-0000-0000-000000000002', NULL, 1),
  ('E0000000-0000-0000-0000-000000000011', 'B0000000-0000-0000-0000-000000000002', '/uploads/products/test-design-1.jpg', NULL, 'D0000000-0000-0000-0000-000000000011', 0),
  ('E0000000-0000-0000-0000-000000000012', 'B0000000-0000-0000-0000-000000000002', '/uploads/products/test-design-2.jpg', NULL, 'D0000000-0000-0000-0000-000000000012', 1),
  ('E0000000-0000-0000-0000-000000000021', 'B0000000-0000-0000-0000-000000000003', '/uploads/products/test-pod-cap.jpg', NULL, NULL, 0);
