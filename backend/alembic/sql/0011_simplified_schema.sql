-- Agentra DMS simplified schema (2026-11-14 business simplification, handoff D1-D11).
-- Immutable DDL snapshot for Alembic revision 0011. Transaction owned by Alembic.
-- Drops the whole dms schema and rebuilds the simplified model, so an empty database
-- (0001 -> 0011) and production (0010 -> 0011) end with the same schema. Data is NOT
-- migrated: production is reseeded (D4). Rollback is the pre-migration Neon backup.
--
-- Model: three document kinds (STOCK_RECEIPT PN, STOCK_ISSUE PX, PAYMENT_RECEIPT PT),
-- three states (DRAFT -> POSTED -> CANCELLED). Current balances are two columns,
-- agency.debt and product.stock, changed only inside posting/cancel operations.
DROP SCHEMA IF EXISTS dms CASCADE;
CREATE SCHEMA dms;
SET LOCAL search_path TO dms, public;
SELECT set_config('dms.request_id', 'alembic-0011-simplified-schema', true);

-- Unconstrained NUMERIC domains reject invalid precision BEFORE typmod rounding.
CREATE DOMAIN money_vnd AS numeric CHECK (
  VALUE <> 'NaN'::numeric AND abs(VALUE) < 1000000000000000000 AND VALUE = trunc(VALUE)
);
CREATE DOMAIN quantity_value AS numeric CHECK (
  VALUE <> 'NaN'::numeric AND abs(VALUE) < 1000000000000000 AND VALUE = round(VALUE, 3)
);
CREATE DOMAIN price_rate AS numeric CHECK (
  VALUE <> 'NaN'::numeric AND VALUE > 0 AND VALUE < 1000 AND VALUE = round(VALUE, 6)
);

-- Business clock. The API never sets dms.clock; the seed sets it per operation so
-- timestamps and audit rows carry the real business time of historical documents.
CREATE FUNCTION app_now() RETURNS timestamptz LANGUAGE sql VOLATILE AS $$
  SELECT coalesce(nullif(current_setting('dms.clock', true), '')::timestamptz, clock_timestamp())
$$;
CREATE FUNCTION business_today() RETURNS date LANGUAGE sql VOLATILE AS $$
  SELECT (dms.app_now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
$$;
-- Balance columns change only inside these audited posting/cancel operations.
CREATE FUNCTION posting_context() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('dms.function_code', true), '') IN (
    'stock.receipt.post', 'stock.issue.post', 'cash.receipt.post',
    'documents.cancel', 'documents.correct', 'payments.online')
$$;

CREATE TABLE user_group (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (btrim(code) <> ''),
  name text NOT NULL UNIQUE CHECK (btrim(name) <> ''),
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE app_function (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (btrim(code) <> ''),
  name text NOT NULL CHECK (btrim(name) <> ''),
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE app_user (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "fullName" text NOT NULL CHECK (btrim("fullName") <> ''),
  email text NOT NULL CHECK (email = btrim(email) AND position('@' IN email) > 1),
  "passwordHash" text NOT NULL CHECK (btrim("passwordHash") <> ''),
  "groupId" integer NOT NULL REFERENCES user_group(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'LOCKED')),
  "authVersion" integer NOT NULL DEFAULT 1 CHECK ("authVersion" > 0),
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX uq_app_user_email_ci ON app_user (lower(email));
CREATE INDEX ix_app_user_group ON app_user ("groupId", id);

CREATE TABLE group_permission (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "groupId" integer NOT NULL REFERENCES user_group(id) ON DELETE RESTRICT,
  "functionId" integer NOT NULL REFERENCES app_function(id) ON DELETE RESTRICT,
  "isAllowed" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE ("groupId", "functionId")
);
CREATE INDEX ix_group_permission_function ON group_permission ("functionId");

CREATE TABLE auth_token (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "userId" bigint NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
  purpose text NOT NULL CHECK (purpose IN ('REFRESH', 'PASSWORD_RESET')),
  "tokenDigest" bytea NOT NULL UNIQUE CHECK (octet_length("tokenDigest") = 32),
  "expiresAt" timestamptz NOT NULL,
  "revokedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "authVersion" integer NOT NULL,
  "sessionId" uuid,
  CHECK ("expiresAt" > "createdAt"),
  CONSTRAINT ck_auth_token_version CHECK ("authVersion" > 0),
  CONSTRAINT ck_auth_token_session_shape CHECK ((purpose = 'REFRESH') = ("sessionId" IS NOT NULL))
);
CREATE INDEX ix_auth_token_user ON auth_token ("userId", purpose);
CREATE INDEX ix_auth_token_expiry ON auth_token ("expiresAt") WHERE "revokedAt" IS NULL;
CREATE INDEX ix_auth_token_session ON auth_token ("userId", "sessionId");
CREATE UNIQUE INDEX uq_auth_token_live_session ON auth_token ("sessionId")
  WHERE purpose = 'REFRESH' AND "revokedAt" IS NULL;

CREATE TABLE business_rule (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  "maxAgenciesPerWard" integer NOT NULL DEFAULT 4,
  "sellingPriceRate" price_rate NOT NULL DEFAULT 1.02,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "business_rule_maxAgenciesPerWard_check" CHECK ("maxAgenciesPerWard" > 0)
);

-- Read-only HCMC 2025 catalogue (Nghị quyết 1685/NQ-UBTVQH15), copied unchanged from 0010.
CREATE TABLE ward (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (code ~ '^[0-9]{5}$'),
  name text NOT NULL UNIQUE CHECK (btrim(name) <> ''),
  kind text NOT NULL CHECK (kind IN ('WARD', 'COMMUNE', 'SPECIAL_ZONE')),
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO ward (code, name, kind) VALUES
  ('25747', 'Phường Thủ Dầu Một', 'WARD'),
  ('25750', 'Phường Phú Lợi', 'WARD'),
  ('25760', 'Phường Bình Dương', 'WARD'),
  ('25768', 'Phường Phú An', 'WARD'),
  ('25771', 'Phường Chánh Hiệp', 'WARD'),
  ('25777', 'Xã Dầu Tiếng', 'COMMUNE'),
  ('25780', 'Xã Minh Thạnh', 'COMMUNE'),
  ('25792', 'Xã Long Hòa', 'COMMUNE'),
  ('25807', 'Xã Thanh An', 'COMMUNE'),
  ('25813', 'Phường Bến Cát', 'WARD'),
  ('25819', 'Xã Trừ Văn Thố', 'COMMUNE'),
  ('25822', 'Xã Bàu Bàng', 'COMMUNE'),
  ('25837', 'Phường Chánh Phú Hòa', 'WARD'),
  ('25840', 'Phường Long Nguyên', 'WARD'),
  ('25843', 'Phường Tây Nam', 'WARD'),
  ('25846', 'Phường Thới Hòa', 'WARD'),
  ('25849', 'Phường Hòa Lợi', 'WARD'),
  ('25858', 'Xã Phú Giáo', 'COMMUNE'),
  ('25864', 'Xã Phước Thành', 'COMMUNE'),
  ('25867', 'Xã An Long', 'COMMUNE'),
  ('25882', 'Xã Phước Hòa', 'COMMUNE'),
  ('25888', 'Phường Tân Uyên', 'WARD'),
  ('25891', 'Phường Tân Khánh', 'WARD'),
  ('25906', 'Xã Bắc Tân Uyên', 'COMMUNE'),
  ('25909', 'Xã Thường Tân', 'COMMUNE'),
  ('25912', 'Phường Vĩnh Tân', 'WARD'),
  ('25915', 'Phường Bình Cơ', 'WARD'),
  ('25920', 'Phường Tân Hiệp', 'WARD'),
  ('25942', 'Phường Dĩ An', 'WARD'),
  ('25945', 'Phường Tân Đông Hiệp', 'WARD'),
  ('25951', 'Phường Đông Hòa', 'WARD'),
  ('25966', 'Phường Lái Thiêu', 'WARD'),
  ('25969', 'Phường Thuận Giao', 'WARD'),
  ('25975', 'Phường An Phú', 'WARD'),
  ('25978', 'Phường Thuận An', 'WARD'),
  ('25987', 'Phường Bình Hòa', 'WARD'),
  ('26506', 'Phường Vũng Tàu', 'WARD'),
  ('26526', 'Phường Tam Thắng', 'WARD'),
  ('26536', 'Phường Rạch Dừa', 'WARD'),
  ('26542', 'Phường Phước Thắng', 'WARD'),
  ('26545', 'Xã Long Sơn', 'COMMUNE'),
  ('26560', 'Phường Bà Rịa', 'WARD'),
  ('26566', 'Phường Long Hương', 'WARD'),
  ('26572', 'Phường Tam Long', 'WARD'),
  ('26575', 'Xã Ngãi Giao', 'COMMUNE'),
  ('26584', 'Xã Xuân Sơn', 'COMMUNE'),
  ('26590', 'Xã Bình Giã', 'COMMUNE'),
  ('26596', 'Xã Châu Đức', 'COMMUNE'),
  ('26608', 'Xã Kim Long', 'COMMUNE'),
  ('26617', 'Xã Nghĩa Thành', 'COMMUNE'),
  ('26620', 'Xã Hồ Tràm', 'COMMUNE'),
  ('26632', 'Xã Xuyên Mộc', 'COMMUNE'),
  ('26638', 'Xã Bàu Lâm', 'COMMUNE'),
  ('26641', 'Xã Hòa Hội', 'COMMUNE'),
  ('26647', 'Xã Hòa Hiệp', 'COMMUNE'),
  ('26656', 'Xã Bình Châu', 'COMMUNE'),
  ('26659', 'Xã Long Điền', 'COMMUNE'),
  ('26662', 'Xã Long Hải', 'COMMUNE'),
  ('26680', 'Xã Đất Đỏ', 'COMMUNE'),
  ('26686', 'Xã Phước Hải', 'COMMUNE'),
  ('26704', 'Phường Phú Mỹ', 'WARD'),
  ('26710', 'Phường Tân Hải', 'WARD'),
  ('26713', 'Phường Tân Phước', 'WARD'),
  ('26725', 'Phường Tân Thành', 'WARD'),
  ('26728', 'Xã Châu Pha', 'COMMUNE'),
  ('26732', 'Đặc khu Côn Đảo', 'SPECIAL_ZONE'),
  ('26737', 'Phường Tân Định', 'WARD'),
  ('26740', 'Phường Sài Gòn', 'WARD'),
  ('26743', 'Phường Bến Thành', 'WARD'),
  ('26758', 'Phường Cầu Ông Lãnh', 'WARD'),
  ('26767', 'Phường An Phú Đông', 'WARD'),
  ('26773', 'Phường Thới An', 'WARD'),
  ('26782', 'Phường Tân Thới Hiệp', 'WARD'),
  ('26785', 'Phường Trung Mỹ Tây', 'WARD'),
  ('26791', 'Phường Đông Hưng Thuận', 'WARD'),
  ('26800', 'Phường Linh Xuân', 'WARD'),
  ('26803', 'Phường Tam Bình', 'WARD'),
  ('26809', 'Phường Hiệp Bình', 'WARD'),
  ('26824', 'Phường Thủ Đức', 'WARD'),
  ('26833', 'Phường Long Bình', 'WARD'),
  ('26842', 'Phường Tăng Nhơn Phú', 'WARD'),
  ('26848', 'Phường Phước Long', 'WARD'),
  ('26857', 'Phường Long Phước', 'WARD'),
  ('26860', 'Phường Long Trường', 'WARD'),
  ('26876', 'Phường An Nhơn', 'WARD'),
  ('26878', 'Phường An Hội Đông', 'WARD'),
  ('26882', 'Phường An Hội Tây', 'WARD'),
  ('26884', 'Phường Gò Vấp', 'WARD'),
  ('26890', 'Phường Hạnh Thông', 'WARD'),
  ('26898', 'Phường Thông Tây Hội', 'WARD'),
  ('26905', 'Phường Bình Lợi Trung', 'WARD'),
  ('26911', 'Phường Bình Quới', 'WARD'),
  ('26929', 'Phường Bình Thạnh', 'WARD'),
  ('26944', 'Phường Gia Định', 'WARD'),
  ('26956', 'Phường Thạnh Mỹ Tây', 'WARD'),
  ('26968', 'Phường Tân Sơn Nhất', 'WARD'),
  ('26977', 'Phường Tân Sơn Hòa', 'WARD'),
  ('26983', 'Phường Bảy Hiền', 'WARD'),
  ('26995', 'Phường Tân Hòa', 'WARD'),
  ('27004', 'Phường Tân Bình', 'WARD'),
  ('27007', 'Phường Tân Sơn', 'WARD'),
  ('27013', 'Phường Tây Thạnh', 'WARD'),
  ('27019', 'Phường Tân Sơn Nhì', 'WARD'),
  ('27022', 'Phường Phú Thọ Hòa', 'WARD'),
  ('27028', 'Phường Phú Thạnh', 'WARD'),
  ('27031', 'Phường Tân Phú', 'WARD'),
  ('27043', 'Phường Đức Nhuận', 'WARD'),
  ('27058', 'Phường Cầu Kiệu', 'WARD'),
  ('27073', 'Phường Phú Nhuận', 'WARD'),
  ('27094', 'Phường An Khánh', 'WARD'),
  ('27097', 'Phường Bình Trưng', 'WARD'),
  ('27112', 'Phường Cát Lái', 'WARD'),
  ('27139', 'Phường Xuân Hòa', 'WARD'),
  ('27142', 'Phường Nhiêu Lộc', 'WARD'),
  ('27154', 'Phường Bàn Cờ', 'WARD'),
  ('27163', 'Phường Hòa Hưng', 'WARD'),
  ('27169', 'Phường Diên Hồng', 'WARD'),
  ('27190', 'Phường Vườn Lài', 'WARD'),
  ('27211', 'Phường Hòa Bình', 'WARD'),
  ('27226', 'Phường Phú Thọ', 'WARD'),
  ('27232', 'Phường Bình Thới', 'WARD'),
  ('27238', 'Phường Minh Phụng', 'WARD'),
  ('27259', 'Phường Xóm Chiếu', 'WARD'),
  ('27265', 'Phường Khánh Hội', 'WARD'),
  ('27286', 'Phường Vĩnh Hội', 'WARD'),
  ('27301', 'Phường Chợ Quán', 'WARD'),
  ('27316', 'Phường An Đông', 'WARD'),
  ('27343', 'Phường Chợ Lớn', 'WARD'),
  ('27349', 'Phường Phú Lâm', 'WARD'),
  ('27364', 'Phường Bình Phú', 'WARD'),
  ('27367', 'Phường Bình Tây', 'WARD'),
  ('27373', 'Phường Bình Tiên', 'WARD'),
  ('27418', 'Phường Chánh Hưng', 'WARD'),
  ('27424', 'Phường Bình Đông', 'WARD'),
  ('27427', 'Phường Phú Định', 'WARD'),
  ('27439', 'Phường Bình Hưng Hòa', 'WARD'),
  ('27442', 'Phường Bình Tân', 'WARD'),
  ('27448', 'Phường Bình Trị Đông', 'WARD'),
  ('27457', 'Phường Tân Tạo', 'WARD'),
  ('27460', 'Phường An Lạc', 'WARD'),
  ('27475', 'Phường Tân Hưng', 'WARD'),
  ('27478', 'Phường Tân Thuận', 'WARD'),
  ('27484', 'Phường Phú Thuận', 'WARD'),
  ('27487', 'Phường Tân Mỹ', 'WARD'),
  ('27496', 'Xã Tân An Hội', 'COMMUNE'),
  ('27508', 'Xã An Nhơn Tây', 'COMMUNE'),
  ('27511', 'Xã Nhuận Đức', 'COMMUNE'),
  ('27526', 'Xã Thái Mỹ', 'COMMUNE'),
  ('27541', 'Xã Phú Hòa Đông', 'COMMUNE'),
  ('27544', 'Xã Bình Mỹ', 'COMMUNE'),
  ('27553', 'Xã Củ Chi', 'COMMUNE'),
  ('27559', 'Xã Hóc Môn', 'COMMUNE'),
  ('27568', 'Xã Đông Thạnh', 'COMMUNE'),
  ('27577', 'Xã Xuân Thới Sơn', 'COMMUNE'),
  ('27592', 'Xã Bà Điểm', 'COMMUNE'),
  ('27595', 'Xã Tân Nhựt', 'COMMUNE'),
  ('27601', 'Xã Vĩnh Lộc', 'COMMUNE'),
  ('27604', 'Xã Tân Vĩnh Lộc', 'COMMUNE'),
  ('27610', 'Xã Bình Lợi', 'COMMUNE'),
  ('27619', 'Xã Bình Hưng', 'COMMUNE'),
  ('27628', 'Xã Hưng Long', 'COMMUNE'),
  ('27637', 'Xã Bình Chánh', 'COMMUNE'),
  ('27655', 'Xã Nhà Bè', 'COMMUNE'),
  ('27658', 'Xã Hiệp Phước', 'COMMUNE'),
  ('27664', 'Xã Cần Giờ', 'COMMUNE'),
  ('27667', 'Xã Bình Khánh', 'COMMUNE'),
  ('27673', 'Xã An Thới Đông', 'COMMUNE'),
  ('27676', 'Xã Thạnh An', 'COMMUNE');
DO $$ BEGIN
  IF (SELECT count(*) FROM dms.ward) <> 168 OR (SELECT count(*) FROM dms.ward WHERE kind = 'WARD') <> 113
    OR (SELECT count(*) FROM dms.ward WHERE kind = 'COMMUNE') <> 54 OR (SELECT count(*) FROM dms.ward WHERE kind = 'SPECIAL_ZONE') <> 1 THEN
    RAISE EXCEPTION 'Ward catalogue must contain 168 units (113/54/1)';
  END IF;
END $$;

CREATE TABLE agency_type (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (btrim(code) <> ''),
  name text NOT NULL UNIQUE CHECK (btrim(name) <> ''),
  "maxDebt" money_vnd NOT NULL CHECK ("maxDebt" >= 0),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE unit (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (btrim(code) <> ''),
  name text NOT NULL UNIQUE CHECK (btrim(name) <> ''),
  "allowsFraction" boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- debt may go negative only through a late verified online payment (prepayment, 3.3).
CREATE TABLE agency (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text GENERATED ALWAYS AS ('DL-' || id::text) STORED UNIQUE,
  name text NOT NULL CHECK (btrim(name) <> ''),
  "typeId" integer NOT NULL REFERENCES agency_type(id) ON DELETE RESTRICT,
  "wardId" integer NOT NULL REFERENCES ward(id) ON DELETE RESTRICT,
  phone text CHECK (phone IS NULL OR btrim(phone) <> ''),
  address text,
  email text CHECK (email IS NULL OR (email = btrim(email) AND position('@' IN email) > 1)),
  "acceptedDate" date NOT NULL,
  debt money_vnd NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'TERMINATED')),
  "terminatedAt" timestamptz,
  "terminationReason" text,
  "createdBy" bigint REFERENCES app_user(id) ON DELETE RESTRICT,
  "updatedBy" bigint REFERENCES app_user(id) ON DELETE RESTRICT,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((status = 'TERMINATED') = ("terminatedAt" IS NOT NULL)),
  CHECK (status <> 'TERMINATED' OR btrim(coalesce("terminationReason", '')) <> '')
);
CREATE INDEX ix_agency_ward_active ON agency ("wardId", id) WHERE status = 'ACTIVE';
CREATE INDEX ix_agency_ward ON agency ("wardId", id);
CREATE INDEX ix_agency_type ON agency ("typeId", id);
CREATE INDEX ix_agency_name_prefix ON agency (lower(name) text_pattern_ops);
CREATE INDEX ix_agency_phone ON agency (phone) WHERE phone IS NOT NULL;
CREATE INDEX ix_agency_debt ON agency (debt, id);

CREATE TABLE product (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text GENERATED ALWAYS AS ('MH-' || id::text) STORED UNIQUE,
  name text NOT NULL CHECK (btrim(name) <> ''),
  "unitId" integer NOT NULL REFERENCES unit(id) ON DELETE RESTRICT,
  stock quantity_value NOT NULL DEFAULT 0,
  "lastPurchasePrice" money_vnd,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_product_stock_nonnegative CHECK (stock >= 0),
  CONSTRAINT ck_product_purchase_price_positive CHECK ("lastPurchasePrice" IS NULL OR "lastPurchasePrice" > 0)
);
CREATE INDEX ix_product_unit ON product ("unitId");
CREATE INDEX ix_product_name_prefix ON product (lower(name) text_pattern_ops);

CREATE TABLE document (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('STOCK_RECEIPT', 'STOCK_ISSUE', 'PAYMENT_RECEIPT')),
  code text GENERATED ALWAYS AS (
    CASE kind WHEN 'STOCK_RECEIPT' THEN 'PN-' WHEN 'STOCK_ISSUE' THEN 'PX-' ELSE 'PT-' END || id::text
  ) STORED UNIQUE,
  "agencyId" bigint REFERENCES agency(id) ON DELETE RESTRICT,
  "receiptType" text CHECK ("receiptType" IN ('CASH', 'BANK_TRANSFER', 'ONLINE')),
  "businessDate" date NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'POSTED', 'CANCELLED')),
  "totalAmount" money_vnd NOT NULL DEFAULT 0 CHECK ("totalAmount" >= 0),
  "sellingPriceRate" price_rate,
  note text,
  "replacesDocumentId" bigint UNIQUE REFERENCES document(id) ON DELETE RESTRICT,
  "createdBy" bigint REFERENCES app_user(id) ON DELETE RESTRICT,
  "postedBy" bigint REFERENCES app_user(id) ON DELETE RESTRICT,
  "postedAt" timestamptz,
  "cancelledBy" bigint REFERENCES app_user(id) ON DELETE RESTRICT,
  "cancelledAt" timestamptz,
  "cancelReason" text,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_document_agency_shape CHECK ((kind = 'STOCK_RECEIPT') = ("agencyId" IS NULL)),
  CONSTRAINT ck_document_receipt_type CHECK ((kind = 'PAYMENT_RECEIPT') = ("receiptType" IS NOT NULL)),
  CONSTRAINT ck_document_rate_shape CHECK ("sellingPriceRate" IS NULL OR kind = 'STOCK_ISSUE'),
  -- postedBy is NULL only for system postings (verified online payment IPN).
  CONSTRAINT ck_document_posted_shape CHECK ((status = 'DRAFT') = ("postedAt" IS NULL)
    AND ("postedBy" IS NULL OR "postedAt" IS NOT NULL)),
  CONSTRAINT ck_document_cancel_shape CHECK ((status = 'CANCELLED') = ("cancelledAt" IS NOT NULL)
    AND (status <> 'CANCELLED' OR ("cancelledBy" IS NOT NULL AND btrim(coalesce("cancelReason", '')) <> ''))),
  CONSTRAINT ck_document_not_self_replacing CHECK ("replacesDocumentId" IS DISTINCT FROM id)
);
CREATE INDEX ix_document_kind_date ON document (kind, "businessDate", id);
CREATE INDEX ix_document_agency_date ON document ("agencyId", "businessDate", id) WHERE "agencyId" IS NOT NULL;
CREATE INDEX ix_document_posted_date ON document ("businessDate", kind) WHERE status = 'POSTED';
CREATE INDEX ix_document_drafts ON document (kind, id) WHERE status = 'DRAFT';

-- Lines belong directly to their document; only drafts may change their lines.
CREATE TABLE document_line (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "documentId" bigint NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  "lineNo" integer NOT NULL CHECK ("lineNo" > 0),
  "productId" bigint NOT NULL REFERENCES product(id) ON DELETE RESTRICT,
  "unitId" integer NOT NULL REFERENCES unit(id) ON DELETE RESTRICT,
  "productName" text NOT NULL CHECK (btrim("productName") <> ''),
  "unitName" text NOT NULL CHECK (btrim("unitName") <> ''),
  quantity quantity_value NOT NULL CHECK (quantity > 0),
  "unitPrice" money_vnd NOT NULL CHECK ("unitPrice" >= 0),
  "lineAmount" money_vnd GENERATED ALWAYS AS (round(quantity * "unitPrice", 0)) STORED,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE ("documentId", "lineNo"),
  UNIQUE ("documentId", "productId")
);
CREATE INDEX ix_document_line_product ON document_line ("productId", "documentId");
CREATE INDEX ix_document_line_unit ON document_line ("unitId");

CREATE TABLE online_payment (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "agencyId" bigint NOT NULL REFERENCES agency(id) ON DELETE RESTRICT,
  provider text NOT NULL CHECK (btrim(provider) <> ''),
  "merchantReference" text NOT NULL UNIQUE CHECK (btrim("merchantReference") <> ''),
  "idempotencyKey" uuid NOT NULL UNIQUE,
  "providerTransactionId" text,
  amount money_vnd NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'EXPIRED')),
  "expiresAt" timestamptz NOT NULL,
  "paymentTime" timestamptz,
  "receiptDocumentId" bigint UNIQUE REFERENCES document(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  "createdBy" bigint REFERENCES app_user(id) ON DELETE RESTRICT,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (provider, "providerTransactionId"),
  CHECK ("expiresAt" > "createdAt"),
  CHECK ((status = 'SUCCESS') = ("receiptDocumentId" IS NOT NULL)),
  CHECK (status <> 'SUCCESS' OR ("paymentTime" IS NOT NULL AND "providerTransactionId" IS NOT NULL))
);
CREATE INDEX ix_online_payment_agency ON online_payment ("agencyId", id);
CREATE INDEX ix_online_payment_pending ON online_payment ("expiresAt", id) WHERE status = 'PENDING';

CREATE TABLE payment_event (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "paymentId" bigint NOT NULL REFERENCES online_payment(id) ON DELETE RESTRICT,
  "eventKey" text NOT NULL CHECK (btrim("eventKey") <> ''),
  "providerStatus" text NOT NULL,
  "verifiedPayload" jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof("verifiedPayload") = 'object'),
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE ("paymentId", "eventKey")
);

CREATE TABLE audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "actorId" bigint REFERENCES app_user(id) ON DELETE RESTRICT,
  "actorType" text NOT NULL CHECK ("actorType" IN ('USER', 'SYSTEM')),
  "functionCode" text NOT NULL REFERENCES app_function(code) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  "entityName" text NOT NULL,
  "entityKey" text NOT NULL,
  "oldData" jsonb,
  "newData" jsonb,
  "requestId" text,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (("actorType" = 'USER') = ("actorId" IS NOT NULL))
);
CREATE INDEX ix_audit_log_time ON audit_log ("createdAt", id);
CREATE INDEX ix_audit_log_actor ON audit_log ("actorId", "createdAt");
CREATE INDEX ix_audit_log_entity ON audit_log ("entityName", "entityKey", id);

-- ---------------------------------------------------------------- routines ----

CREATE FUNCTION stamp_row() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW."createdAt" := dms.app_now();
    NEW."updatedAt" := NEW."createdAt";
  ELSE
    NEW."createdAt" := OLD."createdAt";
    NEW."updatedAt" := greatest(OLD."updatedAt", dms.app_now());
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION deny_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '23514';
END $$;

CREATE FUNCTION audit_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  old_data jsonb;
  new_data jsonb;
  actor bigint := nullif(current_setting('dms.actor_id', true), '')::bigint;
  function_code text := coalesce(nullif(current_setting('dms.function_code', true), ''), TG_ARGV[0]);
BEGIN
  -- Never copy password/token hashes into audit snapshots.
  IF TG_OP <> 'INSERT' THEN old_data := to_jsonb(OLD) - ARRAY['passwordHash', 'tokenDigest']; END IF;
  IF TG_OP <> 'DELETE' THEN new_data := to_jsonb(NEW) - ARRAY['passwordHash', 'tokenDigest']; END IF;
  INSERT INTO dms.audit_log ("actorId", "actorType", "functionCode", action,
    "entityName", "entityKey", "oldData", "newData", "requestId")
  VALUES (actor, CASE WHEN actor IS NULL THEN 'SYSTEM' ELSE 'USER' END, function_code, TG_OP,
    TG_TABLE_NAME, coalesce(new_data ->> 'id', old_data ->> 'id'), old_data, new_data,
    nullif(current_setting('dms.request_id', true), ''));
  RETURN NULL;
END $$;

CREATE FUNCTION guard_auth_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW."passwordHash", NEW."groupId", NEW.status) IS DISTINCT FROM (OLD."passwordHash", OLD."groupId", OLD.status) THEN
    NEW."authVersion" := OLD."authVersion" + 1;
  ELSIF NEW."authVersion" < OLD."authVersion" THEN
    RAISE EXCEPTION 'Auth version cannot go backwards' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION guard_auth_token() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW."userId", NEW.purpose, NEW."tokenDigest", NEW."sessionId", NEW."authVersion", NEW."expiresAt")
    IS DISTINCT FROM
    (OLD."userId", OLD.purpose, OLD."tokenDigest", OLD."sessionId", OLD."authVersion", OLD."expiresAt")
  THEN
    RAISE EXCEPTION 'Token identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD."revokedAt" IS NOT NULL AND NEW."revokedAt" IS DISTINCT FROM OLD."revokedAt" THEN
    RAISE EXCEPTION 'Token revocation is irreversible' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

-- QĐ1 ward capacity, type debt limit, terminal status and protected debt column.
CREATE FUNCTION guard_agency() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  max_count integer;
  allowed_debt numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'ACTIVE' THEN
      RAISE EXCEPTION 'New agency must start ACTIVE' USING ERRCODE = '23514';
    END IF;
    IF NEW.debt <> 0 THEN
      RAISE EXCEPTION 'New agency starts without debt' USING ERRCODE = '23514', CONSTRAINT = 'ck_agency_debt_protected';
    END IF;
  ELSE
    IF OLD.status = 'TERMINATED' AND NEW.status <> OLD.status THEN
      RAISE EXCEPTION 'Terminated agency cannot be reopened' USING ERRCODE = '23514';
    END IF;
    IF NEW.debt IS DISTINCT FROM OLD.debt AND NOT dms.posting_context() THEN
      RAISE EXCEPTION 'Agency debt changes only through document posting'
        USING ERRCODE = '23514', CONSTRAINT = 'ck_agency_debt_protected';
    END IF;
  END IF;
  IF TG_OP = 'INSERT' OR NEW."typeId" <> OLD."typeId" THEN
    SELECT "maxDebt" INTO STRICT allowed_debt FROM dms.agency_type
      WHERE id = NEW."typeId" AND status = 'ACTIVE' FOR SHARE;
    IF NEW.debt > allowed_debt THEN
      RAISE EXCEPTION 'Debt exceeds new agency type limit' USING ERRCODE = '23514',
        CONSTRAINT = 'ck_agency_type_debt_limit';
    END IF;
  END IF;
  -- QĐ3 at the database for ordinary issue posting (corrections are checked by the service).
  IF TG_OP = 'UPDATE' AND NEW.debt > OLD.debt
    AND current_setting('dms.function_code', true) = 'stock.issue.post'
    AND NEW.debt > (SELECT "maxDebt" FROM dms.agency_type WHERE id = NEW."typeId") THEN
    RAISE EXCEPTION 'Debt limit exceeded' USING ERRCODE = '23514', CONSTRAINT = 'ck_agency_debt_limit';
  END IF;
  IF NEW.status = 'ACTIVE' AND (TG_OP = 'INSERT' OR NEW."wardId" <> OLD."wardId") THEN
    -- Serialize capacity checks, including moves between wards, with rule changes.
    SELECT "maxAgenciesPerWard" INTO STRICT max_count FROM dms.business_rule WHERE id FOR UPDATE;
    IF (SELECT count(*) FROM dms.agency WHERE "wardId" = NEW."wardId"
      AND status = 'ACTIVE' AND id <> NEW.id) >= max_count THEN
      RAISE EXCEPTION 'Ward agency capacity exceeded' USING ERRCODE = '23514',
        CONSTRAINT = 'ck_agency_ward_capacity';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION guard_agency_history_date() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM dms.document WHERE "agencyId" = NEW.id AND "businessDate" < NEW."acceptedDate") THEN
    RAISE EXCEPTION 'Accepted date is after recorded history'
      USING ERRCODE = '23514', CONSTRAINT = 'ck_agency_history_date';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION guard_rules() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Business rules cannot be deleted' USING ERRCODE = '23514'; END IF;
  IF TG_TABLE_NAME = 'business_rule' THEN
    IF EXISTS (SELECT 1 FROM dms.agency WHERE status = 'ACTIVE' GROUP BY "wardId"
      HAVING count(*) > NEW."maxAgenciesPerWard") THEN
      RAISE EXCEPTION 'New ward limit is below existing active count' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."maxDebt" < OLD."maxDebt" THEN
    PERFORM 1 FROM dms.agency WHERE "typeId" = NEW.id ORDER BY id FOR UPDATE;
    IF EXISTS (SELECT 1 FROM dms.agency WHERE "typeId" = NEW.id AND debt > NEW."maxDebt") THEN
      RAISE EXCEPTION 'New debt limit is below existing debt' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Recorded unit/product meaning is immutable once a document line uses it.
CREATE FUNCTION guard_recorded_unit_policy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."allowsFraction" IS DISTINCT FROM OLD."allowsFraction"
    AND EXISTS (SELECT 1 FROM dms.document_line WHERE "unitId" = OLD.id) THEN
    RAISE EXCEPTION 'Recorded unit fraction policy is immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'ck_unit_recorded_fraction_policy';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION guard_product() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.stock <> 0 OR NEW."lastPurchasePrice" IS NOT NULL THEN
      RAISE EXCEPTION 'New product starts without stock or price'
        USING ERRCODE = '23514', CONSTRAINT = 'ck_product_balance_protected';
    END IF;
    RETURN NEW;
  END IF;
  IF (NEW.stock, NEW."lastPurchasePrice") IS DISTINCT FROM (OLD.stock, OLD."lastPurchasePrice")
    AND NOT dms.posting_context() THEN
    RAISE EXCEPTION 'Stock and purchase price change only through document posting'
      USING ERRCODE = '23514', CONSTRAINT = 'ck_product_balance_protected';
  END IF;
  IF NEW."unitId" <> OLD."unitId" AND EXISTS (SELECT 1 FROM dms.document_line WHERE "productId" = OLD.id) THEN
    RAISE EXCEPTION 'Recorded product unit cannot change'
      USING ERRCODE = '23514', CONSTRAINT = 'ck_product_recorded_unit_policy';
  END IF;
  RETURN NEW;
END $$;

-- First use serializes with unit/product policy updates.
CREATE FUNCTION lock_line_policy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM dms.unit WHERE id = NEW."unitId" FOR SHARE;
  PERFORM 1 FROM dms.product WHERE id = NEW."productId" FOR SHARE;
  -- Re-read the locked rows: a concurrent unit/policy change committed while waiting wins.
  IF NEW."unitId" IS DISTINCT FROM (SELECT "unitId" FROM dms.product WHERE id = NEW."productId") THEN
    RAISE EXCEPTION 'Line unit must be the current product unit'
      USING ERRCODE = '23514', CONSTRAINT = 'ck_document_line_unit';
  END IF;
  IF NEW.quantity <> trunc(NEW.quantity)
    AND NOT (SELECT "allowsFraction" FROM dms.unit WHERE id = NEW."unitId") THEN
    RAISE EXCEPTION 'Unit does not allow fractional quantities'
      USING ERRCODE = '23514', CONSTRAINT = 'ck_document_line_fraction';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION guard_eligible_owner_deletion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'product' THEN
    IF OLD.stock <> 0 OR OLD."lastPurchasePrice" IS NOT NULL
      OR EXISTS (SELECT 1 FROM dms.document_line WHERE "productId" = OLD.id) THEN
      RAISE EXCEPTION 'Product has recorded usage' USING ERRCODE = '23514', CONSTRAINT = 'ck_owner_eligible_deletion';
    END IF;
  ELSIF OLD.debt <> 0
    OR EXISTS (SELECT 1 FROM dms.document WHERE "agencyId" = OLD.id)
    OR EXISTS (SELECT 1 FROM dms.online_payment WHERE "agencyId" = OLD.id) THEN
    RAISE EXCEPTION 'Agency has recorded usage' USING ERRCODE = '23514', CONSTRAINT = 'ck_owner_eligible_deletion';
  END IF;
  RETURN OLD;
END $$;

-- Document state machine: DRAFT -> POSTED -> CANCELLED; posted content is immutable.
CREATE FUNCTION guard_document() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  line_total numeric;
  line_count integer;
  replaced dms.document%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'DRAFT' THEN
      RAISE EXCEPTION 'Only drafts can be deleted' USING ERRCODE = '23514', CONSTRAINT = 'ck_document_state';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'DRAFT' THEN
      RAISE EXCEPTION 'Documents start as DRAFT' USING ERRCODE = '23514', CONSTRAINT = 'ck_document_state';
    END IF;
    IF NEW."replacesDocumentId" IS NOT NULL THEN
      SELECT * INTO replaced FROM dms.document WHERE id = NEW."replacesDocumentId";
      IF NOT FOUND OR replaced.kind <> NEW.kind OR replaced."agencyId" IS DISTINCT FROM NEW."agencyId"
        OR replaced.status = 'DRAFT' THEN
        RAISE EXCEPTION 'Replacement must match a posted document of the same kind and agency'
          USING ERRCODE = '23514', CONSTRAINT = 'ck_document_replacement';
      END IF;
    END IF;
  ELSE
    IF (NEW.id, NEW.kind, NEW."replacesDocumentId", NEW."createdBy")
      IS DISTINCT FROM (OLD.id, OLD.kind, OLD."replacesDocumentId", OLD."createdBy") THEN
      RAISE EXCEPTION 'Document identity is immutable' USING ERRCODE = '23514', CONSTRAINT = 'ck_document_state';
    END IF;
    IF OLD.status = 'CANCELLED' THEN
      RAISE EXCEPTION 'Cancelled documents are immutable' USING ERRCODE = '23514', CONSTRAINT = 'ck_document_state';
    END IF;
    IF OLD.status = 'POSTED' THEN
      IF NEW.status <> 'CANCELLED' OR (NEW."agencyId", NEW."receiptType", NEW."businessDate", NEW."totalAmount",
        NEW."sellingPriceRate", NEW.note, NEW."postedBy", NEW."postedAt")
        IS DISTINCT FROM (OLD."agencyId", OLD."receiptType", OLD."businessDate", OLD."totalAmount",
        OLD."sellingPriceRate", OLD.note, OLD."postedBy", OLD."postedAt") THEN
        RAISE EXCEPTION 'Posted documents only accept cancellation' USING ERRCODE = '23514', CONSTRAINT = 'ck_document_state';
      END IF;
      RETURN NEW;
    END IF;
    -- OLD.status = 'DRAFT'
    IF NEW.status = 'CANCELLED' THEN
      RAISE EXCEPTION 'Drafts are deleted, not cancelled' USING ERRCODE = '23514', CONSTRAINT = 'ck_document_state';
    END IF;
    IF NEW.status = 'POSTED' THEN
      IF NEW.kind = 'PAYMENT_RECEIPT' THEN
        IF NEW."totalAmount" <= 0 THEN
          RAISE EXCEPTION 'Payment amount must be positive' USING ERRCODE = '23514', CONSTRAINT = 'ck_document_total';
        END IF;
        IF EXISTS (SELECT 1 FROM dms.document_line WHERE "documentId" = NEW.id) THEN
          RAISE EXCEPTION 'Payment receipts have no lines' USING ERRCODE = '23514', CONSTRAINT = 'ck_document_total';
        END IF;
      ELSE
        SELECT count(*), coalesce(sum("lineAmount"), 0) INTO line_count, line_total
          FROM dms.document_line WHERE "documentId" = NEW.id;
        IF line_count = 0 OR line_total <> NEW."totalAmount" THEN
          RAISE EXCEPTION 'Posted goods document needs lines matching its total'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_document_total';
        END IF;
      END IF;
    END IF;
  END IF;
  IF NEW."businessDate" > dms.business_today() THEN
    RAISE EXCEPTION 'Business date cannot be in the future' USING ERRCODE = '23514', CONSTRAINT = 'ck_document_business_date';
  END IF;
  IF NEW."agencyId" IS NOT NULL AND (TG_OP = 'INSERT'
    OR (NEW."agencyId", NEW."businessDate") IS DISTINCT FROM (OLD."agencyId", OLD."businessDate")) THEN
    -- Serialize with a concurrent acceptance-date change; the check below re-reads it.
    PERFORM 1 FROM dms.agency WHERE id = NEW."agencyId" FOR SHARE;
  END IF;
  IF NEW."agencyId" IS NOT NULL AND EXISTS (SELECT 1 FROM dms.agency WHERE id = NEW."agencyId"
    AND "acceptedDate" > NEW."businessDate") THEN
    RAISE EXCEPTION 'Business date precedes agency acceptance' USING ERRCODE = '23514', CONSTRAINT = 'ck_agency_history_date';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION guard_line() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_status text;
BEGIN
  SELECT status INTO parent_status FROM dms.document
    WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD."documentId" ELSE NEW."documentId" END;
  -- A cascading draft delete no longer sees its parent.
  IF parent_status IS NOT NULL AND parent_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Only draft lines can change' USING ERRCODE = '23514', CONSTRAINT = 'ck_document_state';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW."documentId" <> OLD."documentId" THEN
    RAISE EXCEPTION 'Line document is immutable' USING ERRCODE = '23514', CONSTRAINT = 'ck_document_state';
  END IF;
  IF TG_OP <> 'INSERT' AND parent_status IS NULL THEN RETURN OLD; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF EXISTS (SELECT 1 FROM dms.document WHERE id = NEW."documentId" AND kind = 'PAYMENT_RECEIPT') THEN
    RAISE EXCEPTION 'Payment receipts have no lines' USING ERRCODE = '23514', CONSTRAINT = 'ck_document_total';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION guard_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Payment evidence cannot be deleted' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'INSERT' THEN
    -- QĐ4: an online payment request never exceeds the current debt.
    IF NEW.amount > (SELECT debt FROM dms.agency WHERE id = NEW."agencyId" FOR UPDATE) THEN
      RAISE EXCEPTION 'Online initiation amount exceeds current debt'
        USING ERRCODE = '23514', CONSTRAINT = 'ck_online_payment_debt';
    END IF;
    IF NEW.status <> 'PENDING' THEN RAISE EXCEPTION 'Online payment starts PENDING' USING ERRCODE = '23514'; END IF;
  ELSE
    IF (NEW.id, NEW."agencyId", NEW.provider, NEW."merchantReference", NEW."idempotencyKey", NEW.amount)
      IS DISTINCT FROM (OLD.id, OLD."agencyId", OLD.provider, OLD."merchantReference", OLD."idempotencyKey", OLD.amount) THEN
      RAISE EXCEPTION 'Payment identity and amount are immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'SUCCESS' THEN RAISE EXCEPTION 'Successful payment is immutable' USING ERRCODE = '23514'; END IF;
    -- A verified late success may supersede local FAILED/EXPIRED, never the reverse.
    IF OLD.status <> 'PENDING' AND NEW.status <> 'SUCCESS' THEN
      RAISE EXCEPTION 'Terminal payment only accepts a verified late success' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION check_online_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'SUCCESS' THEN
    IF NOT EXISTS (SELECT 1 FROM dms.payment_event WHERE "paymentId" = NEW.id AND "providerStatus" = 'SUCCESS') THEN
      RAISE EXCEPTION 'Successful online payment requires verified event evidence' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM dms.document d WHERE d.id = NEW."receiptDocumentId"
      AND d.kind = 'PAYMENT_RECEIPT' AND d.status = 'POSTED' AND d."receiptType" = 'ONLINE'
      AND d."agencyId" = NEW."agencyId" AND d."totalAmount" = NEW.amount) THEN
      RAISE EXCEPTION 'Successful payment requires one matching posted online receipt' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NULL;
END $$;

-- Common timestamps on every physical table.
DO $$ DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'dms' LOOP
    EXECUTE format('CREATE TRIGGER z_stamp BEFORE INSERT OR UPDATE ON dms.%I FOR EACH ROW EXECUTE FUNCTION dms.stamp_row()', t.tablename);
  END LOOP;
END $$;
CREATE TRIGGER a_append_only BEFORE UPDATE OR DELETE ON payment_event FOR EACH ROW EXECUTE FUNCTION deny_change();
CREATE TRIGGER a_append_only BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION deny_change();
CREATE TRIGGER a_auth BEFORE UPDATE ON app_user FOR EACH ROW EXECUTE FUNCTION guard_auth_version();
CREATE TRIGGER a_identity BEFORE UPDATE ON auth_token FOR EACH ROW EXECUTE FUNCTION guard_auth_token();
CREATE TRIGGER a_guard BEFORE INSERT OR UPDATE ON agency FOR EACH ROW EXECUTE FUNCTION guard_agency();
CREATE TRIGGER a0_history_date BEFORE UPDATE OF "acceptedDate" ON agency FOR EACH ROW EXECUTE FUNCTION guard_agency_history_date();
CREATE TRIGGER a_rules BEFORE UPDATE OR DELETE ON business_rule FOR EACH ROW EXECUTE FUNCTION guard_rules();
CREATE TRIGGER a_rules BEFORE UPDATE ON agency_type FOR EACH ROW EXECUTE FUNCTION guard_rules();
CREATE TRIGGER a0_fraction_policy BEFORE UPDATE ON unit FOR EACH ROW EXECUTE FUNCTION guard_recorded_unit_policy();
CREATE TRIGGER a_guard BEFORE INSERT OR UPDATE ON product FOR EACH ROW EXECUTE FUNCTION guard_product();
CREATE TRIGGER a0_eligible_delete BEFORE DELETE ON product FOR EACH ROW EXECUTE FUNCTION guard_eligible_owner_deletion();
CREATE TRIGGER a0_eligible_delete BEFORE DELETE ON agency FOR EACH ROW EXECUTE FUNCTION guard_eligible_owner_deletion();
CREATE TRIGGER a_guard BEFORE INSERT OR UPDATE OR DELETE ON document FOR EACH ROW EXECUTE FUNCTION guard_document();
CREATE TRIGGER a0_policy BEFORE INSERT OR UPDATE ON document_line FOR EACH ROW EXECUTE FUNCTION lock_line_policy();
CREATE TRIGGER a_guard BEFORE INSERT OR UPDATE OR DELETE ON document_line FOR EACH ROW EXECUTE FUNCTION guard_line();
CREATE TRIGGER a_guard BEFORE INSERT OR UPDATE OR DELETE ON online_payment FOR EACH ROW EXECUTE FUNCTION guard_payment();
CREATE CONSTRAINT TRIGGER integrity AFTER INSERT OR UPDATE ON online_payment
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_online_payment();

-- Optional substring search indexes (pg_trgm). Reuse an existing extension schema.
DO $$ DECLARE extension_schema text;
BEGIN
  SELECT n.nspname INTO extension_schema FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pg_trgm';
  IF extension_schema IS NULL THEN
    CREATE EXTENSION pg_trgm WITH SCHEMA dms;
    extension_schema := 'dms';
  END IF;
  EXECUTE format('CREATE INDEX ix_agency_name_contains ON dms.agency USING gin (lower(name) %I.gin_trgm_ops)', extension_schema);
  EXECUTE format('CREATE INDEX ix_product_name_contains ON dms.product USING gin (lower(name) %I.gin_trgm_ops)', extension_schema);
END $$;

COMMENT ON COLUMN agency.debt IS 'Current debt = Σ posted issues − Σ posted receipts; negative only after a late verified online payment.';
COMMENT ON COLUMN product.stock IS 'Current stock = Σ posted receipt quantities − Σ posted issue quantities.';
COMMENT ON COLUMN document."replacesDocumentId" IS 'Correction with reason: the cancelled document this posted document replaces (D7).';
COMMENT ON TABLE audit_log IS 'Append-only; transaction-local dms.actor_id/request_id/function_code provide context; hashes excluded.';

-- ------------------------------------------------------------ core data -------
INSERT INTO user_group (code, name) VALUES
  ('MANAGEMENT', 'Quản lý'), ('SALES', 'Kinh doanh'), ('WAREHOUSE', 'Kho'), ('ACCOUNTING', 'Kế toán');
INSERT INTO agency_type (code, name, "maxDebt") VALUES ('TYPE_1', 'Loại 1', 50000000), ('TYPE_2', 'Loại 2', 20000000);
INSERT INTO business_rule (id) VALUES (true);
INSERT INTO app_function (code, name) VALUES
  ('users.manage', 'Quản lý tài khoản'), ('groups.manage', 'Quản lý nhóm'), ('permissions.manage', 'Phân quyền'),
  ('rules.manage', 'Thay đổi quy định'), ('agency_type.manage', 'Quản lý loại đại lý'),
  ('unit.manage', 'Quản lý đơn vị tính'), ('product.manage', 'Quản lý mặt hàng'),
  ('agency.read', 'Tra cứu đại lý'), ('agency.manage', 'Tiếp nhận/cập nhật đại lý'),
  ('stock.receipt.prepare', 'Lập phiếu nhập'), ('stock.receipt.post', 'Ghi sổ phiếu nhập'),
  ('stock.issue.prepare', 'Lập phiếu xuất'), ('stock.issue.post', 'Ghi sổ phiếu xuất'),
  ('cash.receipt.prepare', 'Lập phiếu thu'), ('cash.receipt.post', 'Ghi sổ phiếu thu'),
  ('documents.correct', 'Sửa chứng từ có lý do'), ('documents.cancel', 'Hủy chứng từ'),
  ('sales.read', 'Tra cứu doanh số'), ('debt.read', 'Tra cứu công nợ'), ('reports.read', 'Báo cáo'),
  ('audit.read', 'Nhật ký'), ('payments.online', 'Thanh toán trực tuyến');
INSERT INTO group_permission ("groupId", "functionId", "isAllowed")
SELECT g.id, f.id, g.code = 'MANAGEMENT'
  OR (g.code = 'SALES' AND f.code IN ('agency.read', 'agency.manage', 'stock.issue.prepare', 'sales.read', 'debt.read'))
  OR (g.code = 'WAREHOUSE' AND f.code IN ('agency.read', 'unit.manage', 'product.manage', 'stock.receipt.prepare',
    'stock.receipt.post', 'stock.issue.post'))
  OR (g.code = 'ACCOUNTING' AND f.code IN ('agency.read', 'debt.read', 'sales.read', 'reports.read', 'cash.receipt.prepare',
    'cash.receipt.post', 'payments.online'))
FROM user_group g CROSS JOIN app_function f;

-- Audit metadata and business transitions (after the core rows above, like 0001).
DO $$ DECLARE t record;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('app_user', 'users.manage'), ('user_group', 'groups.manage'), ('group_permission', 'permissions.manage'),
    ('business_rule', 'rules.manage'), ('agency_type', 'agency_type.manage'),
    ('unit', 'unit.manage'), ('product', 'product.manage'), ('agency', 'agency.manage'),
    ('document', 'documents.correct'), ('document_line', 'documents.correct'),
    ('online_payment', 'payments.online')
  ) AS items(table_name, function_code) LOOP
    EXECUTE format('CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON dms.%I FOR EACH ROW EXECUTE FUNCTION dms.audit_change(%L)', t.table_name, t.function_code);
  END LOOP;
END $$;

-- Runtime uses authenticated backend services; no direct browser/PUBLIC access.
REVOKE ALL ON SCHEMA dms FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA dms FROM PUBLIC;
