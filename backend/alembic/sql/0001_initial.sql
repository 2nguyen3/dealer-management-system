-- Agentra DMS / SME: PostgreSQL 16+ reference schema, UTF-8.
-- Immutable DDL snapshot for Alembic revision 0001. Transaction owned by Alembic.
-- Deliberately fails if schema dms already exists. No DROP, no live-data migration.
-- Business services must follow the transaction protocols in README.md.
CREATE SCHEMA dms;
SET LOCAL search_path = dms, pg_catalog;

-- Unconstrained NUMERIC domains reject invalid precision BEFORE typmod rounding.
-- A plain NUMERIC(18,0) would silently round an input such as 1.5 VND to 2.
CREATE DOMAIN money_vnd AS numeric CHECK (
  VALUE <> 'NaN'::numeric AND abs(VALUE) < 1000000000000000000 AND VALUE = trunc(VALUE)
);
CREATE DOMAIN quantity_value AS numeric CHECK (
  VALUE <> 'NaN'::numeric AND abs(VALUE) < 1000000000000000 AND VALUE = round(VALUE, 3)
);
CREATE DOMAIN price_rate AS numeric CHECK (
  VALUE <> 'NaN'::numeric AND VALUE > 0 AND VALUE < 1000 AND VALUE = round(VALUE, 6)
);

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
  CHECK ("expiresAt" > "createdAt")
);
CREATE INDEX ix_auth_token_user ON auth_token ("userId", purpose);
CREATE INDEX ix_auth_token_expiry ON auth_token ("expiresAt") WHERE "revokedAt" IS NULL;

CREATE TABLE business_rule (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  "maxAgenciesPerDistrict" integer NOT NULL DEFAULT 4 CHECK ("maxAgenciesPerDistrict" > 0),
  "sellingPriceRate" price_rate NOT NULL DEFAULT 1.02,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE district (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (btrim(code) <> ''),
  name text NOT NULL UNIQUE CHECK (btrim(name) <> ''),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);

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

CREATE TABLE agency (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text GENERATED ALWAYS AS ('DL-' || id::text) STORED UNIQUE,
  name text NOT NULL CHECK (btrim(name) <> ''),
  "typeId" integer NOT NULL REFERENCES agency_type(id) ON DELETE RESTRICT,
  "districtId" integer NOT NULL REFERENCES district(id) ON DELETE RESTRICT,
  phone text CHECK (phone IS NULL OR btrim(phone) <> ''),
  address text,
  email text NOT NULL CHECK (email = btrim(email) AND position('@' IN email) > 1),
  "acceptedDate" date NOT NULL,
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
CREATE INDEX ix_agency_district_active ON agency ("districtId", id) WHERE status = 'ACTIVE';
CREATE INDEX ix_agency_type ON agency ("typeId", id);
CREATE INDEX ix_agency_district ON agency ("districtId", id);
CREATE INDEX ix_agency_name_prefix ON agency (lower(name) text_pattern_ops);
CREATE INDEX ix_agency_phone ON agency (phone) WHERE phone IS NOT NULL;

CREATE TABLE product (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text GENERATED ALWAYS AS ('MH-' || id::text) STORED UNIQUE,
  name text NOT NULL CHECK (btrim(name) <> ''),
  "unitId" integer NOT NULL REFERENCES unit(id) ON DELETE RESTRICT,
  "lowStockThreshold" quantity_value NOT NULL DEFAULT 0 CHECK ("lowStockThreshold" >= 0),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX ix_product_unit ON product ("unitId");
CREATE INDEX ix_product_name_prefix ON product (lower(name) text_pattern_ops);

CREATE SEQUENCE business_order_seq AS bigint;

-- Stable business identity; versions carry all editable business content.
CREATE TABLE document (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "creationKey" uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN (
    'STOCK_RECEIPT', 'STOCK_ISSUE', 'PAYMENT_RECEIPT', 'STOCK_ADJUSTMENT',
    'SALES_RETURN', 'CREDIT_APPLICATION', 'REFUND'
  )),
  code text GENERATED ALWAYS AS (
    CASE kind WHEN 'STOCK_RECEIPT' THEN 'PN-' WHEN 'STOCK_ISSUE' THEN 'PX-'
      WHEN 'PAYMENT_RECEIPT' THEN 'PT-' WHEN 'STOCK_ADJUSTMENT' THEN 'DC-'
      WHEN 'SALES_RETURN' THEN 'TH-' WHEN 'CREDIT_APPLICATION' THEN 'BT-'
      WHEN 'REFUND' THEN 'HT-' END || id::text
  ) STORED UNIQUE,
  "agencyId" bigint REFERENCES agency(id) ON DELETE RESTRICT,
  "originDocumentId" bigint REFERENCES document(id) ON DELETE RESTRICT,
  "receiptType" text CHECK ("receiptType" IN ('AUTO_FROM_ISSUE', 'DEBT_COLLECTION', 'RECEIVED_UNAPPLIED')),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING', 'POSTED', 'CANCELLED')),
  "currentRevisionId" bigint,
  "businessOrder" bigint UNIQUE,
  "cancelledBy" bigint REFERENCES app_user(id) ON DELETE RESTRICT,
  "cancelledAt" timestamptz,
  "cancelReason" text,
  "createdBy" bigint REFERENCES app_user(id) ON DELETE RESTRICT,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (id, "agencyId"),
  CHECK ((kind IN ('STOCK_RECEIPT', 'STOCK_ADJUSTMENT')) = ("agencyId" IS NULL)),
  CHECK ((kind = 'PAYMENT_RECEIPT') = ("receiptType" IS NOT NULL)),
  CHECK ("receiptType" IS DISTINCT FROM 'AUTO_FROM_ISSUE' OR "originDocumentId" IS NOT NULL),
  CHECK (kind NOT IN ('SALES_RETURN', 'REFUND') OR "originDocumentId" IS NOT NULL),
  CHECK ("originDocumentId" IS DISTINCT FROM id),
  CHECK ((status = 'CANCELLED') = ("cancelledAt" IS NOT NULL)),
  CHECK (status <> 'CANCELLED' OR ("cancelledBy" IS NOT NULL AND btrim(coalesce("cancelReason", '')) <> '')),
  CHECK (status <> 'POSTED' OR "businessOrder" IS NOT NULL)
);
CREATE UNIQUE INDEX uq_document_auto_receipt ON document ("originDocumentId")
  WHERE "receiptType" = 'AUTO_FROM_ISSUE';
CREATE INDEX ix_document_agency ON document ("agencyId", id);
CREATE INDEX ix_document_queue ON document (kind, status, id) WHERE status IN ('DRAFT', 'PENDING');
CREATE INDEX ix_document_origin ON document ("originDocumentId") WHERE "originDocumentId" IS NOT NULL;
CREATE UNIQUE INDEX uq_document_current_revision ON document ("currentRevisionId") WHERE "currentRevisionId" IS NOT NULL;
CREATE INDEX ix_document_posted_kind ON document (kind, id) WHERE status = 'POSTED';

CREATE TABLE document_revision (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "documentId" bigint NOT NULL REFERENCES document(id) ON DELETE RESTRICT,
  "revisionNo" integer NOT NULL CHECK ("revisionNo" > 0),
  state text NOT NULL DEFAULT 'DRAFT' CHECK (state IN ('DRAFT', 'READY', 'POSTED')),
  "businessDate" date NOT NULL,
  "totalAmount" money_vnd NOT NULL DEFAULT 0 CHECK ("totalAmount" >= 0),
  "immediatePayment" money_vnd NOT NULL DEFAULT 0 CHECK ("immediatePayment" >= 0 AND "immediatePayment" <= "totalAmount"),
  "sellingPriceRate" price_rate,
  "maxDebtSnapshot" money_vnd CHECK ("maxDebtSnapshot" >= 0),
  "paymentMethod" text CHECK ("paymentMethod" IN ('CASH', 'BANK_TRANSFER', 'ONLINE')),
  "agencyName" text,
  "agencyAddress" text,
  "agencyPhone" text,
  "agencyEmail" text,
  reason text,
  note text,
  "createdBy" bigint REFERENCES app_user(id) ON DELETE RESTRICT,
  "readyBy" bigint REFERENCES app_user(id) ON DELETE RESTRICT,
  "readyAt" timestamptz,
  "postedBy" bigint REFERENCES app_user(id) ON DELETE RESTRICT,
  "postedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE ("documentId", "revisionNo"),
  UNIQUE (id, "documentId"),
  CHECK (state <> 'READY' OR ("readyBy" IS NOT NULL AND "readyAt" IS NOT NULL)),
  CHECK ((state = 'POSTED') = ("postedAt" IS NOT NULL)),
  CHECK ("revisionNo" = 1 OR btrim(coalesce(reason, '')) <> '')
);
ALTER TABLE document ADD CONSTRAINT fk_document_current_revision
  FOREIGN KEY ("currentRevisionId", id) REFERENCES document_revision (id, "documentId")
  DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX ix_revision_date ON document_revision ("businessDate", "documentId") WHERE state = 'POSTED';

CREATE TABLE document_line (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "revisionId" bigint NOT NULL REFERENCES document_revision(id) ON DELETE RESTRICT,
  "lineNo" integer NOT NULL CHECK ("lineNo" > 0),
  "productId" bigint NOT NULL REFERENCES product(id) ON DELETE RESTRICT,
  "unitId" integer NOT NULL REFERENCES unit(id) ON DELETE RESTRICT,
  "productName" text NOT NULL CHECK (btrim("productName") <> ''),
  "unitName" text NOT NULL CHECK (btrim("unitName") <> ''),
  quantity quantity_value NOT NULL CHECK (quantity <> 0),
  "unitPrice" money_vnd NOT NULL CHECK ("unitPrice" >= 0),
  "basePurchasePrice" money_vnd CHECK ("basePurchasePrice" > 0),
  "returnAmount" money_vnd CHECK ("returnAmount" >= 0),
  "lineAmount" money_vnd GENERATED ALWAYS AS (coalesce("returnAmount", round(abs(quantity) * "unitPrice", 0))) STORED,
  "originLineId" bigint,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE ("revisionId", "lineNo"),
  UNIQUE ("revisionId", "productId"),
  UNIQUE (id, "productId", "unitId"),
  UNIQUE (id, "productId", "unitId", "unitPrice"),
  FOREIGN KEY ("originLineId", "productId", "unitId", "unitPrice")
    REFERENCES document_line(id, "productId", "unitId", "unitPrice") ON DELETE RESTRICT
);
CREATE INDEX ix_document_line_product ON document_line ("productId", "revisionId");
CREATE INDEX ix_document_line_unit ON document_line ("unitId");
CREATE INDEX ix_document_line_origin ON document_line ("originLineId") WHERE "originLineId" IS NOT NULL;

CREATE TABLE upfront_confirmation (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "issueRevisionId" bigint NOT NULL UNIQUE REFERENCES document_revision(id) ON DELETE RESTRICT,
  amount money_vnd NOT NULL CHECK (amount > 0),
  method text NOT NULL CHECK (method IN ('CASH', 'BANK_TRANSFER')),
  "receivedAt" timestamptz NOT NULL,
  "verifiedBy" bigint NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
  "verifiedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "evidenceReference" text,
  state text NOT NULL DEFAULT 'VERIFIED' CHECK (state IN ('VERIFIED', 'CONSUMED', 'RECEIVED_SEPARATELY')),
  "receiptDocumentId" bigint UNIQUE REFERENCES document(id) ON DELETE RESTRICT,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((state = 'VERIFIED') = ("receiptDocumentId" IS NULL))
);

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

CREATE TABLE posting_batch (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "revisionId" bigint NOT NULL REFERENCES document_revision(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('POST', 'REVERSE', 'REALLOCATE')),
  "idempotencyKey" uuid NOT NULL UNIQUE,
  "createdBy" bigint REFERENCES app_user(id) ON DELETE RESTRICT,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX uq_posting_batch_post ON posting_batch ("revisionId") WHERE kind = 'POST';
CREATE INDEX ix_posting_batch_revision ON posting_batch ("revisionId", id);

CREATE TABLE inventory_balance (
  "productId" bigint PRIMARY KEY REFERENCES product(id) ON DELETE RESTRICT,
  "currentStock" quantity_value NOT NULL DEFAULT 0 CHECK ("currentStock" >= 0),
  "currentPurchasePrice" money_vnd NOT NULL DEFAULT 0 CHECK ("currentPurchasePrice" >= 0),
  "priceSourceLineId" bigint REFERENCES document_line(id) ON DELETE RESTRICT,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE agency_balance (
  "agencyId" bigint PRIMARY KEY REFERENCES agency(id) ON DELETE RESTRICT,
  "currentDebt" money_vnd NOT NULL DEFAULT 0 CHECK ("currentDebt" >= 0),
  "currentCredit" money_vnd NOT NULL DEFAULT 0 CHECK ("currentCredit" >= 0),
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX ix_agency_balance_debt ON agency_balance ("currentDebt", "agencyId");

CREATE TABLE inventory_entry (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "batchId" bigint NOT NULL REFERENCES posting_batch(id) ON DELETE RESTRICT,
  "lineId" bigint NOT NULL,
  "productId" bigint NOT NULL REFERENCES product(id) ON DELETE RESTRICT,
  "unitId" integer NOT NULL REFERENCES unit(id) ON DELETE RESTRICT,
  quantity quantity_value NOT NULL CHECK (quantity <> 0),
  "businessDate" date NOT NULL,
  "businessOrder" bigint NOT NULL,
  "reversesEntryId" bigint UNIQUE REFERENCES inventory_entry(id) ON DELETE RESTRICT,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY ("lineId", "productId", "unitId") REFERENCES document_line(id, "productId", "unitId") ON DELETE RESTRICT
);
CREATE INDEX ix_inventory_entry_timeline ON inventory_entry ("productId", "businessDate", "businessOrder", id);
CREATE INDEX ix_inventory_entry_batch ON inventory_entry ("batchId");
CREATE INDEX ix_inventory_entry_line ON inventory_entry ("lineId");

-- Receivable allocations ARE ledger entries: source = batch's document;
-- target = issueDocumentId. Reallocation reverses old entries and appends new ones.
CREATE TABLE receivable_entry (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "batchId" bigint NOT NULL REFERENCES posting_batch(id) ON DELETE RESTRICT,
  "agencyId" bigint NOT NULL REFERENCES agency(id) ON DELETE RESTRICT,
  "issueDocumentId" bigint NOT NULL,
  kind text NOT NULL CHECK (kind IN ('CHARGE', 'PAYMENT', 'RETURN', 'CREDIT')),
  amount money_vnd NOT NULL CHECK (amount <> 0),
  "businessDate" date NOT NULL,
  "businessOrder" bigint NOT NULL,
  "reversesEntryId" bigint UNIQUE REFERENCES receivable_entry(id) ON DELETE RESTRICT,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY ("issueDocumentId", "agencyId") REFERENCES document(id, "agencyId") ON DELETE RESTRICT
);
CREATE INDEX ix_receivable_entry_timeline ON receivable_entry ("agencyId", "businessDate", "businessOrder", id);
CREATE INDEX ix_receivable_entry_issue ON receivable_entry ("issueDocumentId", "businessDate", "businessOrder");
CREATE INDEX ix_receivable_entry_batch ON receivable_entry ("batchId");

-- Credit lots retain cash provenance, essential for online refunds to the
-- original payment and for avoiding using the same credit twice.
CREATE TABLE credit_lot (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "agencyId" bigint NOT NULL REFERENCES agency(id) ON DELETE RESTRICT,
  "sourceRevisionId" bigint NOT NULL REFERENCES document_revision(id) ON DELETE RESTRICT,
  "originReceiptId" bigint NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (id, "agencyId"),
  FOREIGN KEY ("originReceiptId", "agencyId") REFERENCES document(id, "agencyId") ON DELETE RESTRICT
);
CREATE INDEX ix_credit_lot_agency ON credit_lot ("agencyId", id);
CREATE INDEX ix_credit_lot_source ON credit_lot ("sourceRevisionId");
CREATE INDEX ix_credit_lot_receipt ON credit_lot ("originReceiptId");

CREATE TABLE credit_entry (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "batchId" bigint NOT NULL REFERENCES posting_batch(id) ON DELETE RESTRICT,
  "agencyId" bigint NOT NULL REFERENCES agency(id) ON DELETE RESTRICT,
  "lotId" bigint NOT NULL,
  kind text NOT NULL CHECK (kind IN ('CREATED', 'REFUND', 'OFFSET')),
  amount money_vnd NOT NULL CHECK (amount <> 0),
  "businessDate" date NOT NULL,
  "businessOrder" bigint NOT NULL,
  "reversesEntryId" bigint UNIQUE REFERENCES credit_entry(id) ON DELETE RESTRICT,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY ("lotId", "agencyId") REFERENCES credit_lot(id, "agencyId") ON DELETE RESTRICT
);
CREATE INDEX ix_credit_entry_lot ON credit_entry ("lotId", "businessDate", "businessOrder");
CREATE INDEX ix_credit_entry_agency ON credit_entry ("agencyId", "businessDate", "businessOrder");
CREATE INDEX ix_credit_entry_batch ON credit_entry ("batchId");

CREATE TABLE refund_reservation (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "refundRevisionId" bigint NOT NULL REFERENCES document_revision(id) ON DELETE RESTRICT,
  "lotId" bigint NOT NULL REFERENCES credit_lot(id) ON DELETE RESTRICT,
  amount money_vnd NOT NULL CHECK (amount > 0),
  state text NOT NULL DEFAULT 'ACTIVE' CHECK (state IN ('ACTIVE', 'RELEASED', 'CONSUMED')),
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE ("refundRevisionId", "lotId")
);
CREATE INDEX ix_refund_reservation_lot ON refund_reservation ("lotId") WHERE state = 'ACTIVE';

CREATE TABLE refund_attempt (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "refundRevisionId" bigint NOT NULL REFERENCES document_revision(id) ON DELETE RESTRICT,
  "onlinePaymentId" bigint NOT NULL REFERENCES online_payment(id) ON DELETE RESTRICT,
  "idempotencyKey" uuid NOT NULL UNIQUE,
  "merchantRefundReference" text NOT NULL UNIQUE,
  "providerRefundId" text,
  amount money_vnd NOT NULL CHECK (amount > 0),
  state text NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING', 'UNKNOWN', 'SUCCESS', 'FAILED')),
  "completedAt" timestamptz,
  "failureReason" text,
  "verifiedResponse" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE ("onlinePaymentId", "providerRefundId"),
  CHECK (state NOT IN ('SUCCESS', 'FAILED') OR "completedAt" IS NOT NULL),
  CHECK (state <> 'SUCCESS' OR ("providerRefundId" IS NOT NULL AND "verifiedResponse" IS NOT NULL))
);
CREATE UNIQUE INDEX uq_refund_attempt_inflight ON refund_attempt ("refundRevisionId")
  WHERE state IN ('PENDING', 'UNKNOWN', 'SUCCESS');
CREATE INDEX ix_refund_attempt_payment ON refund_attempt ("onlinePaymentId");
CREATE INDEX ix_refund_attempt_pending ON refund_attempt ("createdAt", id) WHERE state IN ('PENDING', 'UNKNOWN');

CREATE TABLE stock_count (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text GENERATED ALWAYS AS ('KK-' || id::text) STORED UNIQUE,
  state text NOT NULL DEFAULT 'DRAFT' CHECK (state IN ('DRAFT', 'CONFIRMED')),
  "countedAt" timestamptz NOT NULL,
  "createdBy" bigint NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
  "confirmedBy" bigint REFERENCES app_user(id) ON DELETE RESTRICT,
  "confirmedAt" timestamptz,
  "adjustmentDocumentId" bigint UNIQUE REFERENCES document(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  reason text,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((state = 'CONFIRMED') = ("confirmedAt" IS NOT NULL)),
  CHECK (state <> 'CONFIRMED' OR "confirmedBy" IS NOT NULL)
);

CREATE TABLE stock_count_line (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "countId" bigint NOT NULL REFERENCES stock_count(id) ON DELETE RESTRICT,
  "productId" bigint NOT NULL REFERENCES product(id) ON DELETE RESTRICT,
  "unitId" integer NOT NULL REFERENCES unit(id) ON DELETE RESTRICT,
  "bookQuantity" quantity_value NOT NULL CHECK ("bookQuantity" >= 0),
  "countedQuantity" quantity_value NOT NULL CHECK ("countedQuantity" >= 0),
  difference quantity_value GENERATED ALWAYS AS ("countedQuantity" - "bookQuantity") STORED,
  "observedLastEntryId" bigint REFERENCES inventory_entry(id) ON DELETE RESTRICT,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE ("countId", "productId")
);
CREATE INDEX ix_stock_count_line_product ON stock_count_line ("productId", "countId");

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

CREATE FUNCTION stamp_row() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW."createdAt" := clock_timestamp();
    NEW."updatedAt" := NEW."createdAt";
  ELSE
    NEW."createdAt" := OLD."createdAt";
    NEW."updatedAt" := greatest(OLD."updatedAt", clock_timestamp());
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION deny_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; append a reversal/correction instead', TG_TABLE_NAME
    USING ERRCODE = '23514';
END $$;

CREATE FUNCTION protect_balance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR pg_trigger_depth() < 2 THEN
    RAISE EXCEPTION 'Balance caches are maintained by deferred ledger checks' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
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

CREATE FUNCTION initialize_balance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'agency' THEN
    INSERT INTO dms.agency_balance ("agencyId") VALUES (NEW.id);
  ELSE
    INSERT INTO dms.inventory_balance ("productId") VALUES (NEW.id);
  END IF;
  RETURN NULL;
END $$;

CREATE FUNCTION guard_agency() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  max_count integer;
  allowed_debt numeric;
BEGIN
  -- Serialize capacity checks, including moves between districts, with rule changes.
  SELECT "maxAgenciesPerDistrict" INTO STRICT max_count FROM dms.business_rule WHERE id FOR UPDATE;
  IF TG_OP = 'INSERT' AND NEW.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'New agency must start ACTIVE' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'TERMINATED' AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'Terminated agency cannot be reopened' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' OR NEW."typeId" <> OLD."typeId" THEN
    SELECT "maxDebt" INTO STRICT allowed_debt FROM dms.agency_type
      WHERE id = NEW."typeId" AND status = 'ACTIVE' FOR SHARE;
    IF TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM dms.agency_balance
      WHERE "agencyId" = OLD.id AND "currentDebt" > allowed_debt) THEN
      RAISE EXCEPTION 'Debt exceeds new agency type limit' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.status = 'ACTIVE' AND (TG_OP = 'INSERT' OR NEW."districtId" <> OLD."districtId") THEN
    PERFORM 1 FROM dms.district WHERE id = NEW."districtId" AND status = 'ACTIVE' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'District is inactive' USING ERRCODE = '23514'; END IF;
    IF (SELECT count(*) FROM dms.agency WHERE "districtId" = NEW."districtId"
      AND status = 'ACTIVE' AND id <> NEW.id) >= max_count THEN
      RAISE EXCEPTION 'District agency capacity exceeded' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION guard_rules() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Business rules cannot be deleted' USING ERRCODE = '23514'; END IF;
  IF TG_TABLE_NAME = 'business_rule' THEN
    IF EXISTS (SELECT 1 FROM dms.agency WHERE status = 'ACTIVE' GROUP BY "districtId"
      HAVING count(*) > NEW."maxAgenciesPerDistrict") THEN
      RAISE EXCEPTION 'New district limit is below existing active count' USING ERRCODE = '23514';
    END IF;
  ELSE
    PERFORM b."agencyId" FROM dms.agency_balance b JOIN dms.agency a ON a.id = b."agencyId"
      WHERE a."typeId" = NEW.id ORDER BY b."agencyId" FOR UPDATE OF b;
    IF EXISTS (SELECT 1 FROM dms.agency_balance b JOIN dms.agency a ON a.id = b."agencyId"
      WHERE a."typeId" = NEW.id AND b."currentDebt" > NEW."maxDebt") THEN
      RAISE EXCEPTION 'New debt limit is below existing debt' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION guard_unit_product() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'unit' THEN
    IF NEW."allowsFraction" <> OLD."allowsFraction" AND EXISTS (
      SELECT 1 FROM dms.document_line l JOIN dms.document_revision r ON r.id = l."revisionId"
      WHERE l."unitId" = OLD.id AND r.state = 'POSTED') THEN
      RAISE EXCEPTION 'Fraction policy of a used unit is immutable' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."unitId" <> OLD."unitId" AND EXISTS (
    SELECT 1 FROM dms.document_line l JOIN dms.document_revision r ON r.id = l."revisionId"
    WHERE l."productId" = OLD.id AND r.state = 'POSTED') THEN
    RAISE EXCEPTION 'Used product unit cannot change; create a new product' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION guard_document() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Documents cannot be physically deleted' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.id, NEW."creationKey", NEW.kind, NEW."agencyId", NEW."originDocumentId", NEW."receiptType")
      IS DISTINCT FROM (OLD.id, OLD."creationKey", OLD.kind, OLD."agencyId", OLD."originDocumentId", OLD."receiptType") THEN
      RAISE EXCEPTION 'Document identity, agency and origin are immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD."businessOrder" IS NOT NULL AND NEW."businessOrder" IS DISTINCT FROM OLD."businessOrder" THEN
      RAISE EXCEPTION 'Original business ordering is immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'CANCELLED' THEN RAISE EXCEPTION 'Cancelled document cannot change' USING ERRCODE = '23514'; END IF;
    IF OLD.kind = 'REFUND' AND OLD.status = 'POSTED' THEN
      RAISE EXCEPTION 'Actual paid-out refund cannot be cancelled/reposted as if cash never left' USING ERRCODE = '23514';
    END IF;
    IF OLD.kind = 'STOCK_ADJUSTMENT' AND OLD.status = 'POSTED' AND EXISTS (
      SELECT 1 FROM dms.stock_count WHERE "adjustmentDocumentId" = OLD.id AND state = 'CONFIRMED') THEN
      RAISE EXCEPTION 'Confirmed count adjustment is historical evidence; use a new count/adjustment' USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'POSTED' AND NEW.status NOT IN ('POSTED', 'CANCELLED') THEN
      RAISE EXCEPTION 'Posted document cannot return to draft' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.status = 'POSTED' AND (TG_OP = 'INSERT' OR OLD."businessOrder" IS NULL) THEN
    NEW."businessOrder" := nextval('dms.business_order_seq');
  ELSIF TG_OP = 'INSERT' OR OLD."businessOrder" IS NULL THEN
    NEW."businessOrder" := NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION guard_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE doc dms.document%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Revisions cannot be deleted' USING ERRCODE = '23514'; END IF;
  SELECT * INTO STRICT doc FROM dms.document WHERE id = NEW."documentId";
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.id, NEW."documentId", NEW."revisionNo") IS DISTINCT FROM (OLD.id, OLD."documentId", OLD."revisionNo") THEN
      RAISE EXCEPTION 'Revision identity cannot change' USING ERRCODE = '23514';
    END IF;
    IF OLD.state = 'POSTED' THEN RAISE EXCEPTION 'Posted revision is immutable' USING ERRCODE = '23514'; END IF;
    IF OLD.state = 'READY' AND (
      NEW.state <> 'POSTED' OR
      (to_jsonb(NEW) - ARRAY['state', 'postedAt', 'postedBy', 'updatedAt']) IS DISTINCT FROM
      (to_jsonb(OLD) - ARRAY['state', 'postedAt', 'postedBy', 'updatedAt'])) THEN
      RAISE EXCEPTION 'Ready revision is frozen; create a new revision to amend it' USING ERRCODE = '23514';
    END IF;
    IF doc.kind = 'STOCK_ISSUE' AND NEW.state = 'POSTED' AND OLD.state <> 'READY' THEN
      RAISE EXCEPTION 'Issue must freeze prices in READY before posting' USING ERRCODE = '23514';
    END IF;
    IF NEW.state = 'READY' AND OLD.state = 'DRAFT' AND doc.kind = 'STOCK_ISSUE' AND doc."businessOrder" IS NULL THEN
      PERFORM 1 FROM dms.business_rule WHERE id FOR SHARE;
      PERFORM b."productId" FROM dms.inventory_balance b JOIN dms.document_line l ON l."productId"=b."productId"
        WHERE l."revisionId"=NEW.id ORDER BY b."productId" FOR SHARE OF b;
      IF NEW."sellingPriceRate" IS DISTINCT FROM (SELECT "sellingPriceRate" FROM dms.business_rule WHERE id)
        OR NEW."maxDebtSnapshot" IS DISTINCT FROM (SELECT t."maxDebt" FROM dms.agency a JOIN dms.agency_type t ON t.id=a."typeId" WHERE a.id=doc."agencyId")
        OR EXISTS (SELECT 1 FROM dms.document_line l JOIN dms.inventory_balance b ON b."productId" = l."productId"
          WHERE l."revisionId" = NEW.id AND (l."basePurchasePrice" IS DISTINCT FROM b."currentPurchasePrice" OR b."currentPurchasePrice" <= 0)) THEN
        RAISE EXCEPTION 'New issue must freeze current purchase prices and current rate' USING ERRCODE = '23514';
      END IF;
    END IF;
    IF NEW.state = 'POSTED' AND OLD.state <> 'POSTED' THEN
      IF doc.kind IN ('STOCK_RECEIPT', 'STOCK_ISSUE') THEN
        PERFORM p.id FROM dms.product p JOIN dms.document_line l ON l."productId"=p.id JOIN dms.unit u ON u.id=p."unitId"
          WHERE l."revisionId"=NEW.id ORDER BY p.id FOR SHARE OF p, u;
      END IF;
      IF doc.kind = 'STOCK_ISSUE' THEN PERFORM 1 FROM dms.agency WHERE id=doc."agencyId" FOR SHARE; END IF;
      IF doc.kind IN ('STOCK_RECEIPT', 'STOCK_ISSUE') AND EXISTS (
        SELECT 1 FROM dms.document_line l JOIN dms.product p ON p.id = l."productId" JOIN dms.unit u ON u.id = p."unitId"
        WHERE l."revisionId" = NEW.id AND (p.status <> 'ACTIVE' OR u.status <> 'ACTIVE')) THEN
        RAISE EXCEPTION 'New receipt/issue cannot use inactive products/units' USING ERRCODE = '23514';
      END IF;
      IF doc.kind = 'STOCK_ISSUE' AND NOT EXISTS (SELECT 1 FROM dms.agency WHERE id = doc."agencyId" AND status = 'ACTIVE') THEN
        RAISE EXCEPTION 'Cannot post an issue for a terminated agency' USING ERRCODE = '23514';
      END IF;
      IF (doc.kind IN ('STOCK_RECEIPT', 'STOCK_ISSUE', 'STOCK_ADJUSTMENT', 'SALES_RETURN', 'CREDIT_APPLICATION', 'REFUND')
        OR (doc.kind = 'PAYMENT_RECEIPT' AND NEW."paymentMethod" <> 'ONLINE')) AND NEW."postedBy" IS NULL THEN
        RAISE EXCEPTION 'Manual posting requires an identified actor' USING ERRCODE = '23514';
      END IF;
      IF doc.kind = 'STOCK_ISSUE' AND EXISTS (SELECT 1 FROM dms.document_revision previous
        WHERE previous."documentId" = doc.id AND previous.state = 'POSTED'
          AND previous."immediatePayment" <> NEW."immediatePayment") THEN
        RAISE EXCEPTION 'Real immediate cash cannot change in a correction; use return/refund or separate receipt' USING ERRCODE = '23514';
      END IF;
    END IF;
  ELSIF NEW.state <> 'DRAFT' THEN
    RAISE EXCEPTION 'New revisions start as DRAFT' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION guard_line() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  revision_id bigint;
  parent_state text;
  doc_kind text;
  product_unit integer;
  fraction_allowed boolean;
BEGIN
  revision_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."revisionId" ELSE NEW."revisionId" END;
  SELECT r.state, d.kind INTO STRICT parent_state, doc_kind FROM dms.document_revision r
    JOIN dms.document d ON d.id = r."documentId" WHERE r.id = revision_id FOR UPDATE OF r;
  IF parent_state <> 'DRAFT' THEN RAISE EXCEPTION 'Lines of a frozen revision are immutable' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF TG_OP = 'UPDATE' AND (NEW.id, NEW."revisionId") IS DISTINCT FROM (OLD.id, OLD."revisionId") THEN
    RAISE EXCEPTION 'Line identity cannot change' USING ERRCODE = '23514';
  END IF;
  IF doc_kind NOT IN ('STOCK_RECEIPT', 'STOCK_ISSUE', 'STOCK_ADJUSTMENT', 'SALES_RETURN') THEN
    RAISE EXCEPTION 'Financial-only document cannot have product lines' USING ERRCODE = '23514';
  END IF;
  SELECT p."unitId", u."allowsFraction" INTO STRICT product_unit, fraction_allowed
    FROM dms.product p JOIN dms.unit u ON u.id = p."unitId" WHERE p.id = NEW."productId";
  IF NEW."unitId" <> product_unit OR (NOT fraction_allowed AND NEW.quantity <> trunc(NEW.quantity)) THEN
    RAISE EXCEPTION 'Quantity/unit does not match product unit policy' USING ERRCODE = '23514';
  END IF;
  IF (doc_kind <> 'STOCK_ADJUSTMENT' AND (NEW.quantity <= 0 OR NEW."unitPrice" <= 0))
    OR (doc_kind = 'STOCK_ADJUSTMENT' AND NEW."unitPrice" <> 0) THEN
    RAISE EXCEPTION 'Invalid quantity/price for document kind' USING ERRCODE = '23514';
  END IF;
  IF (doc_kind = 'SALES_RETURN') <> (NEW."originLineId" IS NOT NULL) THEN
    RAISE EXCEPTION 'Only returns must reference an original issue line' USING ERRCODE = '23514';
  END IF;
  IF (doc_kind = 'SALES_RETURN') <> (NEW."returnAmount" IS NOT NULL) THEN
    RAISE EXCEPTION 'Only return lines require cumulative-rounding amount' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION guard_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Payment evidence cannot be deleted' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'INSERT' THEN
    PERFORM 1 FROM dms.agency_balance WHERE "agencyId" = NEW."agencyId" FOR UPDATE;
    IF NEW.amount > (SELECT "currentDebt" FROM dms.agency_balance WHERE "agencyId" = NEW."agencyId") THEN
      RAISE EXCEPTION 'Online initiation amount exceeds current debt' USING ERRCODE = '23514';
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

-- Locks are acquired BEFORE appending entries; history checks run at transaction end.
CREATE FUNCTION guard_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  source_doc dms.document%ROWTYPE;
  source_revision dms.document_revision%ROWTYPE;
  batch_kind text;
  original jsonb;
  ledger_schema_name text := 'dms';
  expected_order bigint;
  issue_kind text;
BEGIN
  SELECT r.* INTO STRICT source_revision
    FROM dms.posting_batch b JOIN dms.document_revision r ON r.id = b."revisionId"
    WHERE b.id = NEW."batchId";
  SELECT * INTO STRICT source_doc FROM dms.document WHERE id = source_revision."documentId";
  SELECT kind INTO STRICT batch_kind FROM dms.posting_batch WHERE id = NEW."batchId";
  IF TG_TABLE_NAME = 'inventory_entry' THEN
    PERFORM 1 FROM dms.inventory_balance WHERE "productId" = NEW."productId" FOR UPDATE;
  ELSE
    PERFORM t.id FROM dms.agency_type t JOIN dms.agency a ON a."typeId" = t.id
      WHERE a.id = NEW."agencyId" FOR SHARE OF t;
    PERFORM 1 FROM dms.agency_balance WHERE "agencyId" = NEW."agencyId" FOR UPDATE;
    IF NEW."agencyId" IS DISTINCT FROM source_doc."agencyId" THEN
      RAISE EXCEPTION 'Ledger agency differs from source document' USING ERRCODE = '23514';
    END IF;
    IF TG_TABLE_NAME = 'receivable_entry' THEN
      SELECT kind INTO STRICT issue_kind FROM dms.document WHERE id = NEW."issueDocumentId";
      IF issue_kind <> 'STOCK_ISSUE' THEN RAISE EXCEPTION 'Allocation target must be an issue' USING ERRCODE = '23514'; END IF;
    ELSE
      PERFORM 1 FROM dms.credit_lot WHERE id = NEW."lotId" FOR UPDATE;
    END IF;
  END IF;
  IF NEW."reversesEntryId" IS NOT NULL THEN
    EXECUTE format('SELECT to_jsonb(e) FROM %I.%I e WHERE id = $1', ledger_schema_name, TG_TABLE_NAME)
      INTO STRICT original USING NEW."reversesEntryId";
    IF original ->> 'reversesEntryId' IS NOT NULL THEN
      RAISE EXCEPTION 'Do not reverse a reversal; post a new replacement' USING ERRCODE = '23514';
    END IF;
    IF (to_jsonb(NEW) - ARRAY['id', 'batchId', 'reversesEntryId', 'amount', 'quantity', 'createdAt', 'updatedAt'])
      IS DISTINCT FROM (original - ARRAY['id', 'batchId', 'reversesEntryId', 'amount', 'quantity', 'createdAt', 'updatedAt'])
      OR coalesce(to_jsonb(NEW) ->> 'amount', to_jsonb(NEW) ->> 'quantity')::numeric
        <> -coalesce(original ->> 'amount', original ->> 'quantity')::numeric THEN
      RAISE EXCEPTION 'Reversal must exactly negate original identity, effective time and value' USING ERRCODE = '23514';
    END IF;
    IF source_doc.id <> (SELECT r."documentId" FROM dms.posting_batch b
      JOIN dms.document_revision r ON r.id = b."revisionId" WHERE b.id = (original ->> 'batchId')::bigint) THEN
      RAISE EXCEPTION 'Reversal must belong to the original source document' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF batch_kind = 'REVERSE' THEN RAISE EXCEPTION 'REVERSE batch requires reversal entries' USING ERRCODE = '23514'; END IF;
  expected_order := source_doc."businessOrder";
  IF source_doc."receiptType" = 'AUTO_FROM_ISSUE' THEN
    SELECT "businessOrder" INTO expected_order FROM dms.document WHERE id = source_doc."originDocumentId";
  END IF;
  IF NEW."businessDate" <> source_revision."businessDate" OR NEW."businessOrder" IS DISTINCT FROM expected_order THEN
    RAISE EXCEPTION 'Effective date/order must match source business event' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'inventory_entry' THEN
    IF source_doc.kind NOT IN ('STOCK_RECEIPT', 'STOCK_ISSUE', 'STOCK_ADJUSTMENT', 'SALES_RETURN')
      OR NOT EXISTS (SELECT 1 FROM dms.document_line WHERE id = NEW."lineId" AND "revisionId" = source_revision.id) THEN
      RAISE EXCEPTION 'Inventory entry must reference a line of its source revision' USING ERRCODE = '23514';
    END IF;
    IF NEW.quantity <> (SELECT quantity * CASE WHEN source_doc.kind = 'STOCK_ISSUE' THEN -1 ELSE 1 END
      FROM dms.document_line WHERE id = NEW."lineId") THEN
      RAISE EXCEPTION 'Inventory entry quantity differs from source line' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'receivable_entry' THEN
    IF NOT ((source_doc.kind = 'STOCK_ISSUE' AND NEW.kind = 'CHARGE' AND NEW.amount > 0 AND NEW."issueDocumentId" = source_doc.id)
      OR (source_doc.kind = 'PAYMENT_RECEIPT' AND NEW.kind = 'PAYMENT' AND NEW.amount < 0)
      OR (source_doc.kind = 'SALES_RETURN' AND NEW.kind = 'RETURN' AND NEW.amount < 0 AND NEW."issueDocumentId" = source_doc."originDocumentId")
      OR (source_doc.kind = 'CREDIT_APPLICATION' AND NEW.kind = 'CREDIT' AND NEW.amount < 0)) THEN
      RAISE EXCEPTION 'Receivable entry kind/sign differs from source document' USING ERRCODE = '23514';
    END IF;
    IF source_doc."receiptType" = 'AUTO_FROM_ISSUE' AND NEW."issueDocumentId" <> source_doc."originDocumentId" THEN
      RAISE EXCEPTION 'Immediate payment cannot be allocated to another issue' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NOT ((source_doc.kind IN ('PAYMENT_RECEIPT', 'SALES_RETURN') AND NEW.kind = 'CREATED' AND NEW.amount > 0)
      OR (source_doc.kind = 'REFUND' AND NEW.kind = 'REFUND' AND NEW.amount < 0)
      OR (source_doc.kind = 'CREDIT_APPLICATION' AND NEW.kind = 'OFFSET' AND NEW.amount < 0)) THEN
      RAISE EXCEPTION 'Credit entry kind/sign differs from source document' USING ERRCODE = '23514';
    END IF;
    IF NEW.kind = 'CREATED' AND NOT EXISTS (SELECT 1 FROM dms.credit_lot
      WHERE id = NEW."lotId" AND "sourceRevisionId" = source_revision.id) THEN
      RAISE EXCEPTION 'Created credit must use a lot belonging to its source revision' USING ERRCODE = '23514';
    END IF;
    IF NEW.kind = 'REFUND' AND NOT EXISTS (SELECT 1 FROM dms.credit_lot
      WHERE id = NEW."lotId" AND "originReceiptId" = source_doc."originDocumentId") THEN
      RAISE EXCEPTION 'Refund must retain original cash provenance' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION assert_product(product_id bigint) RETURNS void LANGUAGE plpgsql AS $$
DECLARE stock numeric; price numeric := 0; price_line bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM (
      SELECT sum(sum(quantity)) OVER (ORDER BY "businessDate", "businessOrder" ROWS UNBOUNDED PRECEDING) AS balance
      FROM dms.inventory_entry WHERE "productId" = product_id GROUP BY "businessDate", "businessOrder"
    ) history WHERE balance < 0
  ) THEN RAISE EXCEPTION 'Historical stock becomes negative for product %', product_id USING ERRCODE = '23514'; END IF;
  SELECT coalesce(sum(quantity), 0) INTO stock FROM dms.inventory_entry WHERE "productId" = product_id;
  SELECT l."unitPrice", l.id INTO price, price_line FROM dms.document d
    JOIN dms.document_revision r ON r.id = d."currentRevisionId"
    JOIN dms.document_line l ON l."revisionId" = r.id
    WHERE d.kind = 'STOCK_RECEIPT' AND d.status = 'POSTED' AND l."productId" = product_id
    ORDER BY r."businessDate" DESC, d."businessOrder" DESC, d.id DESC LIMIT 1;
  UPDATE dms.inventory_balance SET "currentStock" = stock,
    "currentPurchasePrice" = coalesce(price, 0), "priceSourceLineId" = price_line WHERE "productId" = product_id;
END $$;

CREATE FUNCTION assert_agency(agency_id bigint, replay_history boolean DEFAULT true) RETURNS void LANGUAGE plpgsql AS $$
DECLARE debt numeric; credit numeric; max_debt numeric; source_id bigint;
BEGIN
  IF replay_history AND EXISTS (
    SELECT 1 FROM (
      SELECT sum(sum(amount)) OVER (PARTITION BY "issueDocumentId" ORDER BY "businessDate", "businessOrder"
        ROWS UNBOUNDED PRECEDING) AS balance
      FROM dms.receivable_entry WHERE "agencyId" = agency_id GROUP BY "issueDocumentId", "businessDate", "businessOrder"
    ) history WHERE balance < 0
  ) THEN RAISE EXCEPTION 'Historical invoice debt becomes negative for agency %', agency_id USING ERRCODE = '23514'; END IF;
  IF replay_history AND EXISTS (
    SELECT 1 FROM (
      SELECT sum(sum(amount)) OVER (PARTITION BY "lotId" ORDER BY "businessDate", "businessOrder"
        ROWS UNBOUNDED PRECEDING) AS balance
      FROM dms.credit_entry WHERE "agencyId" = agency_id GROUP BY "lotId", "businessDate", "businessOrder"
    ) history WHERE balance < 0
  ) THEN RAISE EXCEPTION 'Historical credit lot becomes negative for agency %', agency_id USING ERRCODE = '23514'; END IF;
  IF EXISTS (SELECT 1 FROM dms.receivable_entry WHERE "agencyId"=agency_id GROUP BY "issueDocumentId" HAVING sum(amount)<0)
    OR EXISTS (SELECT 1 FROM dms.credit_entry WHERE "agencyId"=agency_id GROUP BY "lotId" HAVING sum(amount)<0) THEN
    RAISE EXCEPTION 'Current invoice/credit lot becomes negative for agency %', agency_id USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM dms.credit_lot l WHERE l."agencyId" = agency_id AND
      coalesce((SELECT sum(e.amount) FROM dms.credit_entry e WHERE e."lotId" = l.id), 0) <
      coalesce((SELECT sum(x.amount) FROM dms.refund_reservation x WHERE x."lotId" = l.id AND x.state = 'ACTIVE'), 0)
  ) THEN RAISE EXCEPTION 'Credit is already reserved for a refund' USING ERRCODE = '23514'; END IF;
  SELECT coalesce(sum(amount), 0) INTO debt FROM dms.receivable_entry WHERE "agencyId" = agency_id;
  SELECT coalesce(sum(amount), 0) INTO credit FROM dms.credit_entry WHERE "agencyId" = agency_id;
  SELECT t."maxDebt" INTO STRICT max_debt FROM dms.agency a JOIN dms.agency_type t ON t.id = a."typeId" WHERE a.id = agency_id;
  IF debt > max_debt THEN RAISE EXCEPTION 'Current debt exceeds limit for agency %', agency_id USING ERRCODE = '23514'; END IF;
  -- Backdated changes can invalidate FIFO on an untouched later receipt.
  IF replay_history THEN
    FOR source_id IN SELECT id FROM dms.document WHERE "agencyId" = agency_id AND status = 'POSTED'
      AND kind IN ('PAYMENT_RECEIPT', 'CREDIT_APPLICATION', 'SALES_RETURN') LOOP
      PERFORM dms.assert_document(source_id);
    END LOOP;
  END IF;
  UPDATE dms.agency_balance SET "currentDebt" = debt, "currentCredit" = credit WHERE "agencyId" = agency_id;
END $$;

CREATE FUNCTION assert_document(document_id bigint) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  d dms.document%ROWTYPE;
  r dms.document_revision%ROWTYPE;
  origin dms.document%ROWTYPE;
  ar numeric;
  cr numeric;
  expected numeric;
  payment dms.online_payment%ROWTYPE;
BEGIN
  SELECT * INTO STRICT d FROM dms.document WHERE id = document_id;
  IF d."currentRevisionId" IS NULL THEN RAISE EXCEPTION 'Document requires a current revision' USING ERRCODE = '23514'; END IF;
  SELECT * INTO STRICT r FROM dms.document_revision WHERE id = d."currentRevisionId";
  IF r.state = 'POSTED' AND NOT EXISTS (SELECT 1 FROM dms.posting_batch WHERE "revisionId" = r.id AND kind = 'POST') THEN
    RAISE EXCEPTION 'Posted revision requires its own unique POST batch' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM dms.inventory_entry e JOIN dms.posting_batch b ON b.id = e."batchId"
      JOIN dms.document_revision v ON v.id = b."revisionId"
      WHERE v."documentId" = d.id AND v.id <> r.id GROUP BY v.id, e."productId" HAVING sum(e.quantity) <> 0
    UNION ALL
    SELECT 1 FROM dms.receivable_entry e JOIN dms.posting_batch b ON b.id = e."batchId"
      JOIN dms.document_revision v ON v.id = b."revisionId"
      WHERE v."documentId" = d.id AND v.id <> r.id GROUP BY v.id, e."issueDocumentId" HAVING sum(e.amount) <> 0
    UNION ALL
    SELECT 1 FROM dms.credit_entry e JOIN dms.posting_batch b ON b.id = e."batchId"
      JOIN dms.document_revision v ON v.id = b."revisionId"
      WHERE v."documentId" = d.id AND v.id <> r.id GROUP BY v.id, e."lotId" HAVING sum(e.amount) <> 0
  ) THEN RAISE EXCEPTION 'Superseded revision retains un-reversed effects' USING ERRCODE = '23514'; END IF;
  IF (d.status = 'POSTED' AND r.state <> 'POSTED') OR (d.status = 'PENDING' AND r.state <> 'READY')
    OR (d.status = 'DRAFT' AND r.state <> 'DRAFT') THEN
    RAISE EXCEPTION 'Document status and current revision state disagree' USING ERRCODE = '23514';
  END IF;
  IF d."originDocumentId" IS NOT NULL THEN
    SELECT * INTO STRICT origin FROM dms.document WHERE id = d."originDocumentId";
    IF origin."agencyId" IS DISTINCT FROM d."agencyId" OR
      (d.kind IN ('SALES_RETURN', 'PAYMENT_RECEIPT') AND origin.kind <> 'STOCK_ISSUE') OR
      (d.kind = 'REFUND' AND origin.kind <> 'PAYMENT_RECEIPT') THEN
      RAISE EXCEPTION 'Wrong origin document kind or agency' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF d."agencyId" IS NOT NULL AND r."businessDate" < (SELECT "acceptedDate" FROM dms.agency WHERE id = d."agencyId") THEN
    RAISE EXCEPTION 'Business date precedes agency acceptance' USING ERRCODE = '23514';
  END IF;
  IF d."agencyId" IS NOT NULL AND r.state IN ('READY', 'POSTED')
    AND (btrim(coalesce(r."agencyName",''))='' OR btrim(coalesce(r."agencyEmail",''))='') THEN
    RAISE EXCEPTION 'Frozen agency document requires name/email snapshots' USING ERRCODE = '23514';
  END IF;
  IF (d.kind IN ('PAYMENT_RECEIPT', 'REFUND')) <> (r."paymentMethod" IS NOT NULL) THEN
    RAISE EXCEPTION 'Payment method does not match document kind' USING ERRCODE = '23514';
  END IF;
  IF d.kind <> 'STOCK_ISSUE' AND r."immediatePayment" <> 0 THEN
    RAISE EXCEPTION 'Only an issue has immediate payment' USING ERRCODE = '23514';
  END IF;
  IF d.kind IN ('STOCK_RECEIPT', 'STOCK_ISSUE', 'SALES_RETURN', 'STOCK_ADJUSTMENT') THEN
    IF EXISTS (SELECT 1 FROM dms.document_revision v WHERE v."documentId" = d.id AND
      v."totalAmount" <> coalesce((SELECT sum(l."lineAmount") FROM dms.document_line l WHERE l."revisionId" = v.id), 0)) THEN
      RAISE EXCEPTION 'Revision total differs from rounded line totals' USING ERRCODE = '23514';
    END IF;
    IF r.state IN ('READY', 'POSTED') AND NOT EXISTS (SELECT 1 FROM dms.document_line WHERE "revisionId" = r.id) THEN
      RAISE EXCEPTION 'Confirmed stock document requires lines' USING ERRCODE = '23514';
    END IF;
  ELSIF EXISTS (SELECT 1 FROM dms.document_line WHERE "revisionId" = r.id) THEN
    RAISE EXCEPTION 'Financial-only document has product lines' USING ERRCODE = '23514';
  END IF;
  IF r.state IN ('READY', 'POSTED') AND d.kind = 'STOCK_ISSUE' AND (
    r."sellingPriceRate" IS NULL OR r."maxDebtSnapshot" IS NULL OR EXISTS (
      SELECT 1 FROM dms.document_line WHERE "revisionId" = r.id AND
        ("basePurchasePrice" IS NULL OR "unitPrice" <> round("basePurchasePrice" * r."sellingPriceRate", 0)))) THEN
    RAISE EXCEPTION 'Frozen issue price snapshot is incomplete/inconsistent' USING ERRCODE = '23514';
  END IF;
  IF d.kind = 'STOCK_ADJUSTMENT' AND r.state <> 'DRAFT' AND btrim(coalesce(r.reason, '')) = '' THEN
    RAISE EXCEPTION 'Adjustment requires a reason' USING ERRCODE = '23514';
  END IF;
  IF r.state = 'POSTED' AND d.kind NOT IN ('STOCK_ADJUSTMENT', 'SALES_RETURN') AND r."totalAmount" <= 0 THEN
    RAISE EXCEPTION 'Posted monetary document requires a positive total' USING ERRCODE = '23514';
  END IF;
  IF d.kind = 'SALES_RETURN' AND EXISTS (
    SELECT 1 FROM dms.document_line l JOIN dms.document_line ol ON ol.id = l."originLineId"
    JOIN dms.document_revision ov ON ov.id = ol."revisionId"
    WHERE l."revisionId" = r.id AND (ov."documentId" <> d."originDocumentId" OR ov.state <> 'POSTED')) THEN
    RAISE EXCEPTION 'Return must reference posted lines of its original issue' USING ERRCODE = '23514';
  END IF;
  IF d.kind = 'STOCK_ISSUE' THEN
    IF EXISTS (
      SELECT 1 FROM (
        SELECT l."productId", sum(l.quantity) AS returned, min(l."unitPrice") AS min_price, max(l."unitPrice") AS max_price
        FROM dms.document rd JOIN dms.document_line l ON l."revisionId" = rd."currentRevisionId"
        WHERE rd.kind = 'SALES_RETURN' AND rd.status = 'POSTED' AND rd."originDocumentId" = d.id GROUP BY l."productId"
      ) x LEFT JOIN dms.document_line sold ON sold."revisionId" = r.id AND sold."productId" = x."productId"
      WHERE d.status <> 'POSTED' OR sold.id IS NULL OR x.returned > sold.quantity
        OR x.min_price <> sold."unitPrice" OR x.max_price <> sold."unitPrice"
    ) THEN RAISE EXCEPTION 'Return quantity/price exceeds current original sale' USING ERRCODE = '23514'; END IF;
    IF EXISTS (
      SELECT 1 FROM (
        SELECT l."lineAmount", l."unitPrice",
          sum(l.quantity) OVER (PARTITION BY l."productId" ORDER BY rv."businessDate", rd."businessOrder") AS returned_qty,
          coalesce(sum(l."lineAmount") OVER (PARTITION BY l."productId" ORDER BY rv."businessDate", rd."businessOrder"
            ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS previous_amount
        FROM dms.document rd JOIN dms.document_revision rv ON rv.id = rd."currentRevisionId"
          JOIN dms.document_line l ON l."revisionId" = rv.id
        WHERE rd.kind = 'SALES_RETURN' AND rd.status = 'POSTED' AND rd."originDocumentId" = d.id
      ) x WHERE x."lineAmount" <> round(x.returned_qty * x."unitPrice", 0) - x.previous_amount
    ) THEN RAISE EXCEPTION 'Return amount must use cumulative rounding' USING ERRCODE = '23514'; END IF;
    IF d.status = 'POSTED' AND r."immediatePayment" > 0 AND NOT EXISTS (
      SELECT 1 FROM dms.document pd JOIN dms.document_revision pr ON pr.id = pd."currentRevisionId"
      JOIN dms.upfront_confirmation u ON u."receiptDocumentId" = pd.id
      JOIN dms.document_revision verified_revision ON verified_revision.id = u."issueRevisionId"
      WHERE pd."originDocumentId" = d.id AND pd."receiptType" = 'AUTO_FROM_ISSUE' AND pd.status = 'POSTED'
        AND pr."totalAmount" = r."immediatePayment" AND pr."businessDate" = r."businessDate"
        AND verified_revision."documentId" = d.id AND verified_revision.state = 'POSTED'
        AND u.state = 'CONSUMED' AND u.amount = r."immediatePayment"
    ) THEN RAISE EXCEPTION 'Issue immediate payment requires consumed confirmation and matching receipt' USING ERRCODE = '23514'; END IF;
    IF (d.status <> 'POSTED' OR r."immediatePayment" = 0) AND EXISTS (
      SELECT 1 FROM dms.document WHERE "originDocumentId" = d.id AND "receiptType" = 'AUTO_FROM_ISSUE' AND status = 'POSTED'
    ) THEN RAISE EXCEPTION 'Auto receipt cannot remain posted without corresponding immediate payment' USING ERRCODE = '23514'; END IF;
  END IF;
  IF d."receiptType" = 'AUTO_FROM_ISSUE' AND d.status = 'POSTED' AND (
    origin.status <> 'POSTED' OR NOT EXISTS (SELECT 1 FROM dms.document_revision ir
      WHERE ir.id = origin."currentRevisionId" AND ir."immediatePayment" = r."totalAmount" AND ir."businessDate" = r."businessDate")) THEN
    RAISE EXCEPTION 'Auto receipt must follow the original issue' USING ERRCODE = '23514';
  END IF;
  IF d.kind = 'PAYMENT_RECEIPT' AND r."paymentMethod" = 'ONLINE' AND d.status = 'POSTED' THEN
    SELECT * INTO payment FROM dms.online_payment WHERE "receiptDocumentId" = d.id AND status = 'SUCCESS';
    IF NOT FOUND OR payment."agencyId" <> d."agencyId" OR payment.amount <> r."totalAmount"
      OR d."receiptType" <> 'DEBT_COLLECTION' THEN
      RAISE EXCEPTION 'ONLINE receipt requires a matching successful online payment' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF d.kind = 'PAYMENT_RECEIPT' THEN
    IF d.status = 'POSTED' AND d."receiptType" = 'RECEIVED_UNAPPLIED' AND NOT EXISTS (
      SELECT 1 FROM dms.upfront_confirmation WHERE "receiptDocumentId"=d.id AND state='RECEIVED_SEPARATELY') THEN
      RAISE EXCEPTION 'Unmatched upfront cash requires verified real receipt evidence' USING ERRCODE = '23514';
    END IF;
    PERFORM dms.assert_online_payment(id) FROM dms.online_payment WHERE "receiptDocumentId" = d.id;
    PERFORM dms.assert_upfront(id) FROM dms.upfront_confirmation WHERE "receiptDocumentId" = d.id;
  END IF;
  IF d.kind = 'PAYMENT_RECEIPT' AND (
    coalesce((SELECT sum(fr."totalAmount") FROM dms.document fd JOIN dms.document_revision fr ON fr.id=fd."currentRevisionId"
      WHERE fd.kind='REFUND' AND fd.status='POSTED' AND fd."originDocumentId"=d.id),0)
    + coalesce((SELECT sum(x.amount) FROM dms.refund_reservation x JOIN dms.document_revision v ON v.id=x."refundRevisionId"
      JOIN dms.document fd ON fd.id=v."documentId" WHERE fd."originDocumentId"=d.id AND x.state='ACTIVE'),0)
    > CASE WHEN d.status='POSTED' THEN r."totalAmount" ELSE 0 END
  ) THEN RAISE EXCEPTION 'Paid and reserved refunds exceed original real receipt' USING ERRCODE = '23514'; END IF;
  IF d.kind = 'REFUND' AND d.status = 'POSTED' AND r."paymentMethod" = 'ONLINE' AND NOT EXISTS (
    SELECT 1 FROM dms.refund_attempt a JOIN dms.online_payment p ON p.id = a."onlinePaymentId"
    WHERE a."refundRevisionId" = r.id AND a.state = 'SUCCESS' AND a.amount = r."totalAmount"
      AND p.status = 'SUCCESS' AND p."receiptDocumentId" = d."originDocumentId"
  ) THEN RAISE EXCEPTION 'ONLINE refund requires confirmed matching provider success' USING ERRCODE = '23514'; END IF;

  -- All source entries across archived versions must net to the current document.
  SELECT coalesce(sum(e.amount), 0) INTO ar FROM dms.receivable_entry e
    JOIN dms.posting_batch b ON b.id = e."batchId" JOIN dms.document_revision v ON v.id = b."revisionId" WHERE v."documentId" = d.id;
  SELECT coalesce(sum(e.amount), 0) INTO cr FROM dms.credit_entry e
    JOIN dms.posting_batch b ON b.id = e."batchId" JOIN dms.document_revision v ON v.id = b."revisionId" WHERE v."documentId" = d.id;
  expected := CASE WHEN d.status = 'POSTED' THEN r."totalAmount" ELSE 0 END;
  IF (d.kind = 'STOCK_ISSUE' AND (ar <> expected OR cr <> 0))
    OR (d.kind IN ('PAYMENT_RECEIPT', 'SALES_RETURN') AND (-ar + cr <> expected OR ar > 0 OR cr < 0))
    OR (d.kind = 'CREDIT_APPLICATION' AND (-ar <> expected OR -cr <> expected))
    OR (d.kind = 'REFUND' AND (ar <> 0 OR -cr <> expected))
    OR (d.kind IN ('STOCK_RECEIPT', 'STOCK_ADJUSTMENT') AND (ar <> 0 OR cr <> 0)) THEN
    RAISE EXCEPTION 'Ledger does not reconcile to current document %', d.code USING ERRCODE = '23514';
  END IF;
  IF d.kind = 'PAYMENT_RECEIPT' AND d."receiptType" = 'DEBT_COLLECTION'
    AND r."paymentMethod" <> 'ONLINE' AND cr <> 0 THEN
    RAISE EXCEPTION 'Manual debt collection cannot deliberately exceed debt' USING ERRCODE = '23514';
  END IF;
  IF d."receiptType" = 'AUTO_FROM_ISSUE' AND cr <> 0 THEN
    RAISE EXCEPTION 'Immediate receipt must pay its own issue, not create excess credit' USING ERRCODE = '23514';
  END IF;
  IF d.status = 'POSTED' AND d.kind = 'SALES_RETURN' THEN
    SELECT coalesce(sum(e.amount), 0) INTO expected FROM dms.receivable_entry e
      JOIN dms.posting_batch b ON b.id = e."batchId" JOIN dms.document_revision v ON v.id = b."revisionId"
      WHERE e."issueDocumentId" = d."originDocumentId" AND v."documentId" <> d.id
        AND (e."businessDate", e."businessOrder") < (r."businessDate", d."businessOrder");
    IF -ar <> least(expected, r."totalAmount") OR cr <> greatest(r."totalAmount" - expected, 0) THEN
      RAISE EXCEPTION 'Return must reduce unpaid invoice first, then create refundable credit' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF d.status = 'POSTED' AND d.kind IN ('PAYMENT_RECEIPT', 'CREDIT_APPLICATION')
    AND d."receiptType" IS DISTINCT FROM 'AUTO_FROM_ISSUE' THEN
    IF EXISTS (
      WITH available AS (
        SELECT e."issueDocumentId", iv."businessDate" AS issue_date, i."businessOrder" AS issue_order, sum(e.amount) AS due
        FROM dms.receivable_entry e JOIN dms.posting_batch b ON b.id = e."batchId"
          JOIN dms.document_revision v ON v.id = b."revisionId"
          JOIN dms.document i ON i.id = e."issueDocumentId"
          JOIN dms.document_revision iv ON iv.id = i."currentRevisionId"
        WHERE e."agencyId" = d."agencyId" AND v."documentId" <> d.id
          AND (e."businessDate", e."businessOrder") <= (r."businessDate", d."businessOrder")
        GROUP BY e."issueDocumentId", iv."businessDate", i."businessOrder" HAVING sum(e.amount) > 0
      ), fifo AS (
        SELECT *, greatest(least(due, r."totalAmount" - coalesce(sum(due) OVER (
          ORDER BY issue_date, issue_order ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0)), 0) AS wanted
        FROM available
      ), applied AS (
        SELECT e."issueDocumentId", -sum(e.amount) AS paid FROM dms.receivable_entry e
          JOIN dms.posting_batch b ON b.id = e."batchId" JOIN dms.document_revision v ON v.id = b."revisionId"
          WHERE v."documentId" = d.id GROUP BY e."issueDocumentId"
      ) SELECT 1 FROM fifo FULL JOIN applied USING ("issueDocumentId") WHERE coalesce(wanted, 0) <> coalesce(paid, 0)
    ) THEN RAISE EXCEPTION 'Debt collection/credit application must allocate FIFO' USING ERRCODE = '23514'; END IF;
  END IF;
  IF EXISTS (
    WITH actual AS (
      SELECT e."productId", sum(e.quantity) AS qty FROM dms.inventory_entry e
        JOIN dms.posting_batch b ON b.id = e."batchId" JOIN dms.document_revision v ON v.id = b."revisionId"
        WHERE v."documentId" = d.id GROUP BY e."productId"
    ), wanted AS (
      SELECT "productId", quantity * CASE WHEN d.kind = 'STOCK_ISSUE' THEN -1 ELSE 1 END AS qty
        FROM dms.document_line WHERE "revisionId" = r.id AND d.status = 'POSTED'
    ) SELECT 1 FROM actual FULL JOIN wanted USING ("productId") WHERE coalesce(actual.qty, 0) <> coalesce(wanted.qty, 0)
  ) THEN RAISE EXCEPTION 'Inventory ledger does not reconcile to current document %', d.code USING ERRCODE = '23514'; END IF;
END $$;

CREATE FUNCTION assert_online_payment(payment_id bigint) RETURNS void LANGUAGE plpgsql AS $$
DECLARE p dms.online_payment%ROWTYPE;
BEGIN
  SELECT * INTO STRICT p FROM dms.online_payment WHERE id = payment_id;
  IF p.status = 'SUCCESS' THEN
    IF NOT EXISTS (SELECT 1 FROM dms.payment_event WHERE "paymentId" = p.id AND "providerStatus" = 'SUCCESS') THEN
      RAISE EXCEPTION 'Successful online payment requires verified event evidence' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM dms.document d JOIN dms.document_revision r ON r.id = d."currentRevisionId"
      WHERE d.id = p."receiptDocumentId" AND d.kind = 'PAYMENT_RECEIPT' AND d.status = 'POSTED'
        AND d."agencyId" = p."agencyId" AND r."paymentMethod" = 'ONLINE' AND r."totalAmount" = p.amount) THEN
      RAISE EXCEPTION 'Successful payment requires one matching posted receipt' USING ERRCODE = '23514';
    END IF;
  END IF;
END $$;

CREATE FUNCTION assert_upfront(confirmation_id bigint) RETURNS void LANGUAGE plpgsql AS $$
DECLARE u dms.upfront_confirmation%ROWTYPE; issue dms.document%ROWTYPE;
BEGIN
  SELECT * INTO STRICT u FROM dms.upfront_confirmation WHERE id = confirmation_id;
  SELECT d.* INTO STRICT issue FROM dms.document d JOIN dms.document_revision r ON r."documentId" = d.id WHERE r.id = u."issueRevisionId";
  IF issue.kind <> 'STOCK_ISSUE' OR NOT EXISTS (SELECT 1 FROM dms.document_revision
    WHERE id = u."issueRevisionId" AND state IN ('READY', 'POSTED') AND "immediatePayment" = u.amount) THEN
    RAISE EXCEPTION 'Upfront verification must match a frozen issue revision and amount' USING ERRCODE = '23514';
  END IF;
  IF u.state <> 'VERIFIED' AND NOT EXISTS (
    SELECT 1 FROM dms.document d JOIN dms.document_revision r ON r.id = d."currentRevisionId"
    WHERE d.id = u."receiptDocumentId" AND d.kind = 'PAYMENT_RECEIPT' AND d.status = 'POSTED'
      AND d."agencyId" = issue."agencyId" AND r."totalAmount" = u.amount AND r."paymentMethod" = u.method
      AND ((u.state = 'CONSUMED' AND d."receiptType" = 'AUTO_FROM_ISSUE' AND d."originDocumentId" = issue.id)
        OR (u.state = 'RECEIVED_SEPARATELY' AND d."receiptType" = 'RECEIVED_UNAPPLIED'))
  ) THEN RAISE EXCEPTION 'Verified funds must resolve to the correct real receipt' USING ERRCODE = '23514'; END IF;
END $$;

CREATE FUNCTION assert_refund(refund_revision_id bigint) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r dms.document_revision%ROWTYPE; d dms.document%ROWTYPE; reserved numeric;
BEGIN
  SELECT * INTO STRICT r FROM dms.document_revision WHERE id = refund_revision_id;
  SELECT * INTO STRICT d FROM dms.document WHERE id = r."documentId";
  IF d.kind <> 'REFUND' THEN RAISE EXCEPTION 'Refund reservation/attempt requires a REFUND document' USING ERRCODE = '23514'; END IF;
  PERFORM dms.assert_document(d."originDocumentId");
  IF EXISTS (SELECT 1 FROM dms.refund_reservation x JOIN dms.credit_lot l ON l.id = x."lotId"
    WHERE x."refundRevisionId" = r.id AND (l."agencyId" <> d."agencyId" OR l."originReceiptId" <> d."originDocumentId")) THEN
    RAISE EXCEPTION 'Refund reservation cash provenance/agency differs' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM dms.refund_attempt a JOIN dms.online_payment p ON p.id = a."onlinePaymentId"
    WHERE a."refundRevisionId" = r.id AND (p.status <> 'SUCCESS' OR p."receiptDocumentId" <> d."originDocumentId"
      OR a.amount <> r."totalAmount" OR r."paymentMethod" <> 'ONLINE')) THEN
    RAISE EXCEPTION 'Refund attempt differs from original successful online payment' USING ERRCODE = '23514';
  END IF;
  SELECT coalesce(sum(amount), 0) INTO reserved FROM dms.refund_reservation WHERE "refundRevisionId" = r.id AND state = 'ACTIVE';
  IF EXISTS (SELECT 1 FROM dms.refund_attempt WHERE "refundRevisionId" = r.id AND state IN ('PENDING', 'UNKNOWN'))
    AND (reserved <> r."totalAmount" OR d.status = 'CANCELLED') THEN
    RAISE EXCEPTION 'In-flight/unknown refund must retain its full credit reservation' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM dms.refund_attempt WHERE "refundRevisionId" = r.id AND state = 'SUCCESS')
    AND (d.status <> 'POSTED' OR d."currentRevisionId" <> r.id) THEN
    RAISE EXCEPTION 'Successful refund must be posted exactly once' USING ERRCODE = '23514';
  END IF;
  IF r.state = 'POSTED' AND EXISTS (SELECT 1 FROM dms.refund_reservation WHERE "refundRevisionId" = r.id AND state = 'ACTIVE') THEN
    RAISE EXCEPTION 'Posted refund must consume its reservation' USING ERRCODE = '23514';
  END IF;
  IF r.state = 'POSTED' THEN
    IF (SELECT coalesce(sum(amount), 0) FROM dms.refund_reservation WHERE "refundRevisionId" = r.id AND state = 'CONSUMED') <> r."totalAmount" THEN
      RAISE EXCEPTION 'Posted refund must consume its full reserved amount' USING ERRCODE = '23514';
    END IF;
  END IF;
END $$;

CREATE FUNCTION check_document_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE document_id bigint; row_data jsonb;
BEGIN
  row_data := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  IF TG_TABLE_NAME = 'document' THEN document_id := (row_data ->> 'id')::bigint;
  ELSIF TG_TABLE_NAME = 'document_revision' THEN document_id := (row_data ->> 'documentId')::bigint;
  ELSE
    SELECT "documentId" INTO STRICT document_id FROM dms.document_revision WHERE id = (row_data ->> 'revisionId')::bigint;
  END IF;
  PERFORM dms.assert_document(document_id);
  PERFORM dms.assert_document("originDocumentId") FROM dms.document
    WHERE id = document_id AND "originDocumentId" IS NOT NULL;
  RETURN NULL;
END $$;

CREATE FUNCTION check_ledger_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source_id bigint; replay_history boolean;
BEGIN
  IF TG_TABLE_NAME = 'inventory_entry' THEN PERFORM dms.assert_product(NEW."productId");
  ELSE
    -- Latest-only postings cannot invalidate earlier FIFO/history. Reversals
    -- and backdated checkpoints must replay the affected agency in full.
    replay_history := NEW."reversesEntryId" IS NOT NULL
      OR EXISTS (SELECT 1 FROM dms.receivable_entry WHERE "agencyId"=NEW."agencyId"
        AND ("businessDate","businessOrder")>(NEW."businessDate",NEW."businessOrder"))
      OR EXISTS (SELECT 1 FROM dms.credit_entry WHERE "agencyId"=NEW."agencyId"
        AND ("businessDate","businessOrder")>(NEW."businessDate",NEW."businessOrder"));
    PERFORM dms.assert_agency(NEW."agencyId",replay_history);
  END IF;
  SELECT r."documentId" INTO STRICT source_id FROM dms.posting_batch b
    JOIN dms.document_revision r ON r.id = b."revisionId" WHERE b.id = NEW."batchId";
  PERFORM dms.assert_document(source_id);
  RETURN NULL;
END $$;

CREATE FUNCTION check_payment_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'online_payment' THEN PERFORM dms.assert_online_payment(NEW.id);
  ELSIF TG_TABLE_NAME = 'upfront_confirmation' THEN PERFORM dms.assert_upfront(NEW.id);
  ELSIF TG_TABLE_NAME = 'credit_lot' THEN
    IF NOT EXISTS (SELECT 1 FROM dms.document d WHERE d.id = NEW."originReceiptId"
      AND d.kind = 'PAYMENT_RECEIPT' AND d."agencyId" = NEW."agencyId" AND d.status = 'POSTED') THEN
      RAISE EXCEPTION 'Credit lot requires a real posted receipt of the same agency' USING ERRCODE = '23514';
    END IF;
  ELSE
    PERFORM dms.assert_refund(NEW."refundRevisionId");
    IF TG_TABLE_NAME = 'refund_reservation' THEN
      PERFORM dms.assert_agency("agencyId",false) FROM dms.credit_lot WHERE id = NEW."lotId";
    END IF;
  END IF;
  RETURN NULL;
END $$;

CREATE FUNCTION guard_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_data jsonb; new_data jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Financial evidence cannot be deleted' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;
  old_data := to_jsonb(OLD) - ARRAY['state', 'receiptDocumentId', 'providerRefundId', 'completedAt', 'failureReason', 'verifiedResponse', 'updatedAt'];
  new_data := to_jsonb(NEW) - ARRAY['state', 'receiptDocumentId', 'providerRefundId', 'completedAt', 'failureReason', 'verifiedResponse', 'updatedAt'];
  IF old_data IS DISTINCT FROM new_data THEN RAISE EXCEPTION 'Financial evidence identity/amount is immutable' USING ERRCODE = '23514'; END IF;
  IF TG_TABLE_NAME = 'upfront_confirmation' THEN
    IF OLD.state = 'RECEIVED_SEPARATELY' OR (OLD.state = 'CONSUMED' AND NEW.state <> 'RECEIVED_SEPARATELY') THEN
      RAISE EXCEPTION 'Upfront verification cannot be consumed twice' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'refund_reservation' THEN
    IF OLD.state <> 'ACTIVE' OR NEW.state = 'ACTIVE' THEN
      RAISE EXCEPTION 'Reservation may only be consumed or released once' USING ERRCODE = '23514';
    END IF;
  ELSIF OLD.state IN ('SUCCESS', 'FAILED') THEN
    RAISE EXCEPTION 'Terminal refund attempt is immutable; reuse result or create a safe retry' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION lock_refund_credit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_id bigint; receipt_id bigint;
BEGIN
  SELECT "agencyId","originReceiptId" INTO STRICT owner_id,receipt_id FROM dms.credit_lot WHERE id=NEW."lotId";
  PERFORM 1 FROM dms.agency_balance WHERE "agencyId"=owner_id FOR UPDATE;
  PERFORM 1 FROM dms.document WHERE id=receipt_id FOR UPDATE;
  PERFORM 1 FROM dms.credit_lot WHERE id=NEW."lotId" FOR UPDATE;
  RETURN NEW;
END $$;

CREATE FUNCTION guard_stock_count() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent dms.stock_count%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Stock counts cannot be deleted' USING ERRCODE = '23514'; END IF;
  IF TG_TABLE_NAME = 'stock_count_line' THEN
    SELECT * INTO STRICT parent FROM dms.stock_count WHERE id = NEW."countId" FOR UPDATE;
    IF parent.state <> 'DRAFT' THEN RAISE EXCEPTION 'Confirmed stock count lines are immutable' USING ERRCODE = '23514'; END IF;
    IF NOT EXISTS (SELECT 1 FROM dms.product p JOIN dms.unit u ON u.id = p."unitId"
      WHERE p.id = NEW."productId" AND p."unitId" = NEW."unitId"
        AND (u."allowsFraction" OR (NEW."bookQuantity" = trunc(NEW."bookQuantity") AND NEW."countedQuantity" = trunc(NEW."countedQuantity")))) THEN
      RAISE EXCEPTION 'Count quantity/unit does not match product' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.state = 'CONFIRMED' THEN RAISE EXCEPTION 'Confirmed stock count is immutable' USING ERRCODE = '23514'; END IF;
    IF NEW.state = 'CONFIRMED' THEN
      PERFORM b."productId" FROM dms.inventory_balance b JOIN dms.stock_count_line l ON l."productId" = b."productId"
        WHERE l."countId" = NEW.id ORDER BY b."productId" FOR UPDATE OF b;
      IF EXISTS (SELECT 1 FROM dms.stock_count_line l WHERE l."countId" = NEW.id AND
        (l."observedLastEntryId" IS DISTINCT FROM (SELECT max(id) FROM dms.inventory_entry WHERE "productId" = l."productId")
          OR l."bookQuantity" <> (SELECT "currentStock" FROM dms.inventory_balance WHERE "productId" = l."productId"))) THEN
        RAISE EXCEPTION 'Stock changed since count snapshot; reconcile/recount first' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION check_stock_count_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c dms.stock_count%ROWTYPE; count_id bigint;
BEGIN
  IF TG_TABLE_NAME = 'stock_count' THEN count_id := NEW.id;
  ELSE count_id := NEW."countId"; END IF;
  SELECT * INTO STRICT c FROM dms.stock_count WHERE id = count_id;
  IF c.state = 'CONFIRMED' THEN
    IF NOT EXISTS (SELECT 1 FROM dms.stock_count_line WHERE "countId" = c.id) THEN
      RAISE EXCEPTION 'Confirmed count requires observations' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM dms.stock_count_line WHERE "countId" = c.id AND difference <> 0) THEN
      IF NOT EXISTS (SELECT 1 FROM dms.document d WHERE d.id = c."adjustmentDocumentId"
        AND d.kind = 'STOCK_ADJUSTMENT' AND d.status = 'POSTED') THEN
        RAISE EXCEPTION 'Count difference requires a posted adjustment' USING ERRCODE = '23514';
      END IF;
      IF EXISTS (
        SELECT 1 FROM (SELECT * FROM dms.stock_count_line WHERE "countId" = c.id) x FULL JOIN (
          SELECT l.* FROM dms.document d JOIN dms.document_line l ON l."revisionId" = d."currentRevisionId"
            WHERE d.id = c."adjustmentDocumentId"
        ) y ON y."productId" = x."productId"
        WHERE coalesce(x.difference, 0) <> coalesce(y.quantity, 0)
      ) THEN RAISE EXCEPTION 'Count differences do not match adjustment lines' USING ERRCODE = '23514'; END IF;
    ELSIF c."adjustmentDocumentId" IS NOT NULL THEN
      RAISE EXCEPTION 'Zero-difference count does not need an adjustment' USING ERRCODE = '23514';
    END IF;
  END IF;
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

-- Common timestamps on EVERY physical table, including join/ledger tables.
DO $$ DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'dms' LOOP
    EXECUTE format('CREATE TRIGGER z_stamp BEFORE INSERT OR UPDATE ON dms.%I FOR EACH ROW EXECUTE FUNCTION dms.stamp_row()', t.tablename);
  END LOOP;
  FOR t IN SELECT unnest(ARRAY['inventory_entry', 'receivable_entry', 'credit_entry', 'posting_batch', 'credit_lot', 'payment_event', 'audit_log']) AS name LOOP
    EXECUTE format('CREATE TRIGGER a_append_only BEFORE UPDATE OR DELETE ON dms.%I FOR EACH ROW EXECUTE FUNCTION dms.deny_change()', t.name);
  END LOOP;
END $$;

CREATE TRIGGER a_cache BEFORE UPDATE OR DELETE ON inventory_balance FOR EACH ROW EXECUTE FUNCTION protect_balance();
CREATE TRIGGER a_cache BEFORE UPDATE OR DELETE ON agency_balance FOR EACH ROW EXECUTE FUNCTION protect_balance();
CREATE TRIGGER a_guard BEFORE INSERT OR UPDATE ON agency FOR EACH ROW EXECUTE FUNCTION guard_agency();
CREATE TRIGGER initialize AFTER INSERT ON agency FOR EACH ROW EXECUTE FUNCTION initialize_balance();
CREATE TRIGGER initialize AFTER INSERT ON product FOR EACH ROW EXECUTE FUNCTION initialize_balance();
CREATE TRIGGER a_rules BEFORE UPDATE OR DELETE ON business_rule FOR EACH ROW EXECUTE FUNCTION guard_rules();
CREATE TRIGGER a_rules BEFORE UPDATE ON agency_type FOR EACH ROW EXECUTE FUNCTION guard_rules();
CREATE TRIGGER a_unit BEFORE UPDATE ON unit FOR EACH ROW EXECUTE FUNCTION guard_unit_product();
CREATE TRIGGER a_unit BEFORE UPDATE ON product FOR EACH ROW EXECUTE FUNCTION guard_unit_product();
CREATE TRIGGER a_auth BEFORE UPDATE ON app_user FOR EACH ROW EXECUTE FUNCTION guard_auth_version();
CREATE TRIGGER a_guard BEFORE INSERT OR UPDATE OR DELETE ON document FOR EACH ROW EXECUTE FUNCTION guard_document();
CREATE TRIGGER a_guard BEFORE INSERT OR UPDATE OR DELETE ON document_revision FOR EACH ROW EXECUTE FUNCTION guard_revision();
CREATE TRIGGER a_guard BEFORE INSERT OR UPDATE OR DELETE ON document_line FOR EACH ROW EXECUTE FUNCTION guard_line();
CREATE TRIGGER a_guard BEFORE INSERT OR UPDATE OR DELETE ON online_payment FOR EACH ROW EXECUTE FUNCTION guard_payment();
CREATE TRIGGER a_guard BEFORE UPDATE OR DELETE ON upfront_confirmation FOR EACH ROW EXECUTE FUNCTION guard_evidence();
CREATE TRIGGER a_guard BEFORE UPDATE OR DELETE ON refund_attempt FOR EACH ROW EXECUTE FUNCTION guard_evidence();
CREATE TRIGGER a_guard BEFORE UPDATE OR DELETE ON refund_reservation FOR EACH ROW EXECUTE FUNCTION guard_evidence();
CREATE TRIGGER b_lock BEFORE INSERT OR UPDATE ON refund_reservation FOR EACH ROW EXECUTE FUNCTION lock_refund_credit();
CREATE TRIGGER a_guard BEFORE INSERT OR UPDATE OR DELETE ON stock_count FOR EACH ROW EXECUTE FUNCTION guard_stock_count();
CREATE TRIGGER a_guard BEFORE INSERT OR UPDATE OR DELETE ON stock_count_line FOR EACH ROW EXECUTE FUNCTION guard_stock_count();

DO $$ DECLARE name text;
BEGIN
  FOREACH name IN ARRAY ARRAY['inventory_entry', 'receivable_entry', 'credit_entry'] LOOP
    EXECUTE format('CREATE TRIGGER a_guard BEFORE INSERT ON dms.%I FOR EACH ROW EXECUTE FUNCTION dms.guard_ledger()', name);
    EXECUTE format('CREATE CONSTRAINT TRIGGER integrity AFTER INSERT ON dms.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION dms.check_ledger_trigger()', name);
  END LOOP;
  FOREACH name IN ARRAY ARRAY['document', 'document_revision', 'document_line'] LOOP
    EXECUTE format('CREATE CONSTRAINT TRIGGER integrity AFTER INSERT OR UPDATE OR DELETE ON dms.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION dms.check_document_trigger()', name);
  END LOOP;
  FOREACH name IN ARRAY ARRAY['online_payment', 'upfront_confirmation', 'credit_lot', 'refund_reservation', 'refund_attempt'] LOOP
    EXECUTE format('CREATE CONSTRAINT TRIGGER integrity AFTER INSERT OR UPDATE ON dms.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION dms.check_payment_trigger()', name);
  END LOOP;
  FOREACH name IN ARRAY ARRAY['stock_count', 'stock_count_line'] LOOP
    EXECUTE format('CREATE CONSTRAINT TRIGGER integrity AFTER INSERT OR UPDATE ON dms.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION dms.check_stock_count_trigger()', name);
  END LOOP;
END $$;

-- Read models: current states are small caches; statement/history comes from ledgers.
CREATE VIEW current_document AS
SELECT d.id, d.code, d.kind, d."agencyId", d."originDocumentId", d."receiptType", d.status,
  d."businessOrder", d."createdAt", d."updatedAt", d."cancelReason",
  r.id AS "revisionId", r."revisionNo", r."businessDate", r."totalAmount", r."immediatePayment",
  r."totalAmount" - r."immediatePayment" AS "remainingAtIssue",
  r."paymentMethod", r."sellingPriceRate", r."maxDebtSnapshot", r."postedAt"
FROM document d JOIN document_revision r ON r.id = d."currentRevisionId";

CREATE VIEW agency_overview AS
SELECT a.*, t.name AS "typeName", t."maxDebt", x.name AS "districtName",
  b."currentDebt", b."currentCredit", t."maxDebt" - b."currentDebt" AS "remainingCreditLimit"
FROM agency a JOIN agency_type t ON t.id = a."typeId" JOIN district x ON x.id = a."districtId"
JOIN agency_balance b ON b."agencyId" = a.id;

CREATE VIEW inventory_overview AS
SELECT p.*, u.name AS "unitName", b."currentStock", b."currentPurchasePrice", b."priceSourceLineId",
  round(b."currentPurchasePrice" * r."sellingPriceRate", 0) AS "currentSellingPrice",
  b."currentStock" < p."lowStockThreshold" AS "isLowStock"
FROM product p JOIN unit u ON u.id = p."unitId" JOIN inventory_balance b ON b."productId" = p.id
CROSS JOIN business_rule r;

CREATE VIEW invoice_balance AS
SELECT d.id AS "issueDocumentId", d.code, d."agencyId", r."businessDate", r."totalAmount",
  coalesce(sum(e.amount), 0)::numeric(18,0) AS "outstandingAmount",
  CASE WHEN coalesce(sum(e.amount), 0) = 0 THEN 'SETTLED'
    WHEN coalesce(sum(e.amount), 0) = r."totalAmount" THEN 'UNSETTLED' ELSE 'PARTIAL' END AS "settlementStatus"
FROM document d JOIN document_revision r ON r.id = d."currentRevisionId"
LEFT JOIN receivable_entry e ON e."issueDocumentId" = d.id
WHERE d.kind = 'STOCK_ISSUE' AND d.status = 'POSTED'
GROUP BY d.id, r.id;

CREATE VIEW credit_availability AS
SELECT l.*, coalesce(e.balance, 0)::numeric(18,0) AS balance,
  coalesce(x.reserved, 0)::numeric(18,0) AS reserved,
  (coalesce(e.balance, 0) - coalesce(x.reserved, 0))::numeric(18,0) AS available
FROM credit_lot l
LEFT JOIN LATERAL (SELECT sum(amount) AS balance FROM credit_entry WHERE "lotId"=l.id) e ON true
LEFT JOIN LATERAL (SELECT sum(amount) AS reserved FROM refund_reservation WHERE "lotId"=l.id AND state='ACTIVE') x ON true;

-- BM6.1 retains gross sales/count/share; returns/net are explicit extra columns.
CREATE FUNCTION sales_report(from_date date, to_date date)
RETURNS TABLE ("agencyId" bigint, "agencyCode" text, "agencyName" text, "numberOfIssues" bigint,
  "salesAmount" numeric, "salesRate" numeric, "returnAmount" numeric, "netSalesAmount" numeric)
LANGUAGE sql STABLE AS $$
  WITH totals AS (
    SELECT "agencyId", count(*) FILTER (WHERE kind = 'STOCK_ISSUE') AS issue_count,
      coalesce(sum("totalAmount") FILTER (WHERE kind = 'STOCK_ISSUE'), 0) AS sales,
      coalesce(sum("totalAmount") FILTER (WHERE kind = 'SALES_RETURN'), 0) AS returns
    FROM dms.current_document WHERE status = 'POSTED' AND kind IN ('STOCK_ISSUE', 'SALES_RETURN')
      AND "businessDate" >= from_date AND "businessDate" < to_date GROUP BY "agencyId"
  ) SELECT a.id, a.code, a.name, t.issue_count, t.sales,
    CASE WHEN sum(t.sales) OVER () = 0 THEN 0 ELSE round(t.sales * 100 / sum(t.sales) OVER (), 4) END,
    t.returns, t.sales - t.returns FROM totals t JOIN dms.agency a ON a.id = t."agencyId" ORDER BY a.id
$$;

CREATE FUNCTION debt_report(from_date date, to_date date)
RETURNS TABLE ("agencyId" bigint, "agencyCode" text, "agencyName" text, "openingDebt" numeric,
  "debtIncrease" numeric, "cashApplied" numeric, "returnsApplied" numeric, "creditApplied" numeric,
  "debtDecrease" numeric, "closingDebt" numeric)
LANGUAGE sql STABLE AS $$
  WITH events AS (
    -- Group originals/reversals at their effective event, not by entry sign alone.
    SELECT "agencyId", "businessDate", "businessOrder", kind, sum(amount) AS amount
    FROM dms.receivable_entry WHERE "businessDate" < to_date GROUP BY "agencyId", "businessDate", "businessOrder", kind
  ), totals AS (
    SELECT "agencyId", coalesce(sum(amount) FILTER (WHERE "businessDate" < from_date), 0) AS opening,
      coalesce(sum(amount) FILTER (WHERE "businessDate" >= from_date AND kind = 'CHARGE'), 0) AS increase,
      -coalesce(sum(amount) FILTER (WHERE "businessDate" >= from_date AND kind = 'PAYMENT'), 0) AS cash,
      -coalesce(sum(amount) FILTER (WHERE "businessDate" >= from_date AND kind = 'RETURN'), 0) AS returns,
      -coalesce(sum(amount) FILTER (WHERE "businessDate" >= from_date AND kind = 'CREDIT'), 0) AS credits
    FROM events GROUP BY "agencyId"
  ) SELECT a.id, a.code, a.name, t.opening, t.increase, t.cash, t.returns, t.credits,
    t.cash + t.returns + t.credits, t.opening + t.increase - t.cash - t.returns - t.credits
  FROM totals t JOIN dms.agency a ON a.id = t."agencyId"
  WHERE t.increase <> 0 OR t.cash <> 0 OR t.returns <> 0 OR t.credits <> 0 ORDER BY a.id
$$;

COMMENT ON TABLE document IS 'Stable business identity; one current immutable posted revision, with draft corrections retained separately.';
COMMENT ON TABLE receivable_entry IS 'Immutable invoice allocations and debt movements. Date/order checkpoints combine atomic issue + immediate receipt.';
COMMENT ON TABLE credit_entry IS 'Separate nonnegative dealer credit liability; not negative receivable, not new cash on offsets.';
COMMENT ON TABLE inventory_balance IS 'Derived cache, refreshed by deferred constraints; force SET CONSTRAINTS ALL IMMEDIATE before returning balances.';
COMMENT ON TABLE audit_log IS 'Append-only; transaction-local dms.actor_id/request_id provide actor context; sensitive hashes excluded.';
COMMENT ON COLUMN document_line."returnAmount" IS 'Return cumulative rounding: round(total returned quantity * original price) minus prior return amounts.';
COMMENT ON COLUMN current_document."remainingAtIssue" IS 'BM3 original remainder after immediate payment, NOT current outstanding invoice debt.';

INSERT INTO user_group (code, name) VALUES
  ('MANAGEMENT', 'Quản lý'), ('SALES', 'Kinh doanh'), ('WAREHOUSE', 'Kho'), ('ACCOUNTING', 'Kế toán');
INSERT INTO agency_type (code, name, "maxDebt") VALUES ('TYPE_1', 'Loại 1', 10000000), ('TYPE_2', 'Loại 2', 5000000);
INSERT INTO business_rule (id) VALUES (true);
INSERT INTO app_function (code, name) VALUES
  ('users.manage', 'Quản lý tài khoản'), ('groups.manage', 'Quản lý nhóm'), ('permissions.manage', 'Phân quyền'),
  ('rules.manage', 'Thay đổi quy định'), ('district.manage', 'Quản lý quận'), ('agency_type.manage', 'Quản lý loại đại lý'),
  ('unit.manage', 'Quản lý đơn vị tính'), ('product.manage', 'Quản lý mặt hàng'),
  ('agency.read', 'Tra cứu đại lý'), ('agency.manage', 'Tiếp nhận/cập nhật đại lý'),
  ('inventory.read', 'Tra cứu tồn kho'), ('stock.receipt.prepare', 'Lập phiếu nhập'), ('stock.receipt.post', 'Xác nhận nhập'),
  ('stock.issue.prepare', 'Lập phiếu xuất'), ('stock.issue.post', 'Xác nhận xuất'),
  ('cash.receipt.prepare', 'Lập phiếu thu'), ('cash.receipt.post', 'Xác nhận thu'), ('cash.upfront.verify', 'Xác nhận khoản trả ngay'),
  ('stock.count', 'Kiểm kê'), ('stock.adjustment.prepare', 'Lập điều chỉnh kho'), ('stock.adjustment.post', 'Duyệt điều chỉnh kho'),
  ('returns.prepare', 'Lập trả hàng'), ('returns.post', 'Xác nhận trả hàng'),
  ('cash.refund.prepare', 'Lập hoàn tiền'), ('cash.refund.post', 'Xác nhận hoàn tiền'), ('credit.apply', 'Bù trừ dư có'),
  ('documents.correct', 'Sửa chứng từ đã xác nhận'), ('documents.cancel', 'Hủy chứng từ'),
  ('sales.read', 'Tra cứu doanh số'), ('debt.read', 'Tra cứu công nợ'), ('reports.read', 'Báo cáo'),
  ('audit.read', 'Nhật ký'), ('payments.online', 'Thanh toán sandbox');
INSERT INTO group_permission ("groupId", "functionId", "isAllowed")
SELECT g.id, f.id, g.code = 'MANAGEMENT'
  OR (g.code = 'SALES' AND f.code IN ('agency.read', 'agency.manage', 'inventory.read', 'stock.issue.prepare', 'sales.read', 'debt.read'))
  OR (g.code = 'WAREHOUSE' AND f.code IN ('agency.read', 'unit.manage', 'product.manage', 'inventory.read', 'stock.receipt.prepare', 'stock.receipt.post',
    'stock.issue.post', 'stock.count', 'stock.adjustment.prepare', 'returns.prepare', 'returns.post'))
  OR (g.code = 'ACCOUNTING' AND f.code IN ('agency.read', 'debt.read', 'sales.read', 'reports.read', 'cash.receipt.prepare',
    'cash.receipt.post', 'cash.upfront.verify', 'cash.refund.prepare', 'cash.refund.post', 'credit.apply', 'payments.online'))
FROM user_group g CROSS JOIN app_function f;

-- Audit metadata/business transitions; ledger INSERTs already provide immutable detail.
DO $$ DECLARE t record;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('app_user', 'users.manage'), ('user_group', 'groups.manage'), ('group_permission', 'permissions.manage'),
    ('business_rule', 'rules.manage'), ('agency_type', 'agency_type.manage'), ('district', 'district.manage'),
    ('unit', 'unit.manage'), ('product', 'product.manage'), ('agency', 'agency.manage'),
    ('document', 'documents.correct'), ('document_revision', 'documents.correct'), ('document_line', 'documents.correct'),
    ('upfront_confirmation', 'cash.upfront.verify'), ('online_payment', 'payments.online'),
    ('refund_reservation', 'cash.refund.post'), ('refund_attempt', 'cash.refund.post'),
    ('stock_count', 'stock.count'), ('stock_count_line', 'stock.count')
  ) AS items(table_name, function_code) LOOP
    EXECUTE format('CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON dms.%I FOR EACH ROW EXECUTE FUNCTION dms.audit_change(%L)', t.table_name, t.function_code);
  END LOOP;
END $$;

-- Runtime must use a separate non-owner login with explicit grants. No direct
-- browser access; permissions/RBAC are enforced by authenticated backend services.
REVOKE ALL ON SCHEMA dms FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA dms FROM PUBLIC;
