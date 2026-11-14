-- Regression checks of the simplified 0011 schema against the real PostgreSQL trigger and
-- constraint engine (handoff 4.4/5.4). verify.py runs this file after the 0011 snapshot in
-- an isolated schema (every "dms" token is renamed) and always rolls the transaction back.
SET LOCAL search_path = dms, pg_catalog;

CREATE FUNCTION pg_temp.pass() RETURNS void LANGUAGE sql AS $$
  SELECT set_config('dms.test_passes',
    (coalesce(nullif(current_setting('dms.test_passes', true), '')::integer, 0) + 1)::text, true)
$$;

CREATE FUNCTION pg_temp.require(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
  PERFORM pg_temp.pass();
END $$;

CREATE FUNCTION pg_temp.reject(command text, label text, expected_state text DEFAULT '23514')
RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual_state text;
BEGIN
  BEGIN
    EXECUTE command;
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'Expected rejection: %', label;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS actual_state = RETURNED_SQLSTATE;
    IF actual_state <> expected_state THEN
      RAISE EXCEPTION 'FAIL: %; expected %, received %: %', label, expected_state, actual_state, SQLERRM;
    END IF;
  END;
  SET CONSTRAINTS ALL DEFERRED;
  PERFORM pg_temp.pass();
END $$;

CREATE FUNCTION pg_temp.ctx(function_code text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('dms.function_code', function_code, true)
$$;

-- ------------------------------------------------------------------ fixtures ----
INSERT INTO app_user ("fullName", email, "passwordHash", "groupId")
SELECT 'Kiểm tra hồi quy', 'regression@agentra.invalid', 'argon2-not-a-login', id
FROM user_group WHERE code = 'MANAGEMENT';
SELECT set_config('dms.actor_id', (SELECT id::text FROM app_user WHERE email = 'regression@agentra.invalid'), true);
SELECT set_config('dms.request_id', 'sql-regression', true);
SELECT pg_temp.ctx('unit.manage');
INSERT INTO unit (code, name, "allowsFraction") VALUES ('R_PIECE', 'Cái hồi quy', false), ('R_KG', 'Kg hồi quy', true);
SELECT pg_temp.ctx('product.manage');
INSERT INTO product (name, "unitId") SELECT 'Hàng hồi quy ' || n, (SELECT id FROM unit WHERE code = 'R_PIECE')
FROM generate_series(1, 3) n;
SELECT pg_temp.ctx('agency.manage');
CREATE TEMP TABLE rw AS SELECT id, row_number() OVER (ORDER BY id) AS n FROM ward ORDER BY id LIMIT 3;
INSERT INTO agency (name, "typeId", "wardId", "acceptedDate")
SELECT 'Đại lý hồi quy ' || n, (SELECT id FROM agency_type WHERE code = CASE WHEN n = 1 THEN 'TYPE_2' ELSE 'TYPE_1' END),
  (SELECT id FROM rw WHERE rw.n = 2), dms.business_today() - 30
FROM generate_series(1, 2) n;

CREATE FUNCTION pg_temp.agency(n integer) RETURNS bigint LANGUAGE sql AS $$
  SELECT id FROM dms.agency WHERE name = 'Đại lý hồi quy ' || n
$$;
CREATE FUNCTION pg_temp.product(n integer) RETURNS bigint LANGUAGE sql AS $$
  SELECT id FROM dms.product WHERE name = 'Hàng hồi quy ' || n
$$;

-- A posted document written the way DocumentService does it (balances in the same step).
CREATE FUNCTION pg_temp.post_goods(doc_kind text, agency_id bigint, product_id bigint, qty numeric, price numeric)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE doc_id bigint; total numeric := round(qty * price, 0);
BEGIN
  PERFORM pg_temp.ctx(CASE doc_kind WHEN 'STOCK_RECEIPT' THEN 'stock.receipt.prepare' ELSE 'stock.issue.prepare' END);
  INSERT INTO dms.document (kind, "agencyId", "businessDate", "totalAmount", "createdBy")
  VALUES (doc_kind, agency_id, dms.business_today(), total, current_setting('dms.actor_id')::bigint)
  RETURNING id INTO doc_id;
  INSERT INTO dms.document_line ("documentId", "lineNo", "productId", "unitId", "productName", "unitName", quantity, "unitPrice")
  SELECT doc_id, 1, p.id, p."unitId", p.name, u.name, qty, price FROM dms.product p JOIN dms.unit u ON u.id = p."unitId"
  WHERE p.id = product_id;
  PERFORM pg_temp.ctx(CASE doc_kind WHEN 'STOCK_RECEIPT' THEN 'stock.receipt.post' ELSE 'stock.issue.post' END);
  IF doc_kind = 'STOCK_RECEIPT' THEN
    UPDATE dms.product SET stock = stock + qty, "lastPurchasePrice" = price WHERE id = product_id;
  ELSE
    UPDATE dms.product SET stock = stock - qty WHERE id = product_id;
    UPDATE dms.agency SET debt = debt + total WHERE id = agency_id;
  END IF;
  UPDATE dms.document SET status = 'POSTED', "postedAt" = dms.app_now(),
    "postedBy" = current_setting('dms.actor_id')::bigint,
    "sellingPriceRate" = CASE WHEN doc_kind = 'STOCK_ISSUE' THEN 1.02 END
  WHERE id = doc_id;
  RETURN doc_id;
END $$;

CREATE FUNCTION pg_temp.post_payment(agency_id bigint, amount numeric, receipt_type text DEFAULT 'CASH')
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE doc_id bigint;
BEGIN
  PERFORM pg_temp.ctx(CASE WHEN receipt_type = 'ONLINE' THEN 'payments.online' ELSE 'cash.receipt.prepare' END);
  INSERT INTO dms.document (kind, "agencyId", "receiptType", "businessDate", "totalAmount")
  VALUES ('PAYMENT_RECEIPT', agency_id, receipt_type, dms.business_today(), amount) RETURNING id INTO doc_id;
  PERFORM pg_temp.ctx(CASE WHEN receipt_type = 'ONLINE' THEN 'payments.online' ELSE 'cash.receipt.post' END);
  UPDATE dms.agency SET debt = debt - amount WHERE id = agency_id;
  UPDATE dms.document SET status = 'POSTED', "postedAt" = dms.app_now() WHERE id = doc_id;
  RETURN doc_id;
END $$;

-- --------------------------------------------------------------- structure ----
SELECT pg_temp.require((SELECT count(*) FROM pg_tables WHERE schemaname = 'dms') = 16, '16 tables');
SELECT pg_temp.require((SELECT count(*) FROM ward) = 168, '168 wards');
SELECT pg_temp.require((SELECT count(*) FROM app_function) = 22, '22 functions');
SELECT pg_temp.require((SELECT count(*) FROM user_group) = 4, '4 groups');
SELECT pg_temp.require((SELECT count(*) FROM group_permission gp JOIN user_group g ON g.id = gp."groupId"
  WHERE g.code = 'SALES' AND gp."isAllowed") = 5, 'SALES default grants');
SELECT pg_temp.require((SELECT ("maxAgenciesPerWard", "sellingPriceRate") = (4, 1.02::numeric) FROM business_rule),
  'business rule defaults');
SELECT pg_temp.require((SELECT array_agg("maxDebt"::numeric ORDER BY code) FROM agency_type) = ARRAY[50000000, 20000000]::numeric[],
  'agency type limits');
SELECT pg_temp.require((SELECT set_config('dms.clock', '2026-06-01T23:30:00+07:00', true)) IS NOT NULL
  AND dms.business_today() = DATE '2026-06-01' AND dms.app_now() = TIMESTAMPTZ '2026-06-01T23:30:00+07:00',
  'dms.clock drives app_now/business_today in Asia/Ho_Chi_Minh');
SELECT set_config('dms.clock', '', true);

-- ------------------------------------------------------------------ agency ----
SELECT pg_temp.require((SELECT code = 'DL-' || id FROM agency WHERE id = pg_temp.agency(1)), 'generated agency code');
SELECT pg_temp.reject($$INSERT INTO dms.agency (name, "typeId", "wardId", "acceptedDate", debt)
  VALUES ('x', (SELECT id FROM dms.agency_type LIMIT 1), (SELECT id FROM rw WHERE n = 1), current_date, 1)$$,
  'new agency starts without debt');
SELECT pg_temp.reject($$INSERT INTO dms.agency (name, "typeId", "wardId", "acceptedDate", status, "terminatedAt", "terminationReason")
  VALUES ('x', (SELECT id FROM dms.agency_type LIMIT 1), (SELECT id FROM rw WHERE n = 1), current_date, 'TERMINATED', now(), 'x')$$,
  'new agency starts ACTIVE');
INSERT INTO agency (name, "typeId", "wardId", "acceptedDate")
SELECT 'Đại lý đầy phường ' || n, (SELECT id FROM agency_type WHERE code = 'TYPE_2'), (SELECT id FROM rw WHERE rw.n = 2), current_date - 5
FROM generate_series(1, 2) n;
SELECT pg_temp.reject($$INSERT INTO dms.agency (name, "typeId", "wardId", "acceptedDate")
  VALUES ('Thứ năm', (SELECT id FROM dms.agency_type LIMIT 1), (SELECT id FROM rw WHERE n = 2), current_date)$$,
  'QĐ1 ward capacity');
UPDATE agency SET status = 'TERMINATED', "terminatedAt" = now(), "terminationReason" = 'Ngừng hợp tác'
WHERE name = 'Đại lý đầy phường 2';
SELECT pg_temp.require((SELECT count(*) FROM agency WHERE "wardId" = (SELECT id FROM rw WHERE n = 2) AND status = 'ACTIVE') = 3,
  'terminated agency frees ward capacity');
SELECT pg_temp.reject($$UPDATE dms.agency SET status = 'ACTIVE', "terminatedAt" = NULL WHERE name = 'Đại lý đầy phường 2'$$,
  'terminated agency cannot be reopened');
SELECT pg_temp.reject($$UPDATE dms.agency SET debt = 5 WHERE id = pg_temp.agency(1)$$, 'debt changes only through posting');

-- --------------------------------------------------------------- products ----
SELECT pg_temp.require((SELECT code = 'MH-' || id FROM product WHERE id = pg_temp.product(1)), 'generated product code');
SELECT pg_temp.reject($$INSERT INTO dms.product (name, "unitId", stock) VALUES ('x', (SELECT id FROM dms.unit LIMIT 1), 1)$$,
  'new product starts without stock');
SELECT pg_temp.reject($$INSERT INTO dms.product (name, "unitId", "lastPurchasePrice") VALUES ('x', (SELECT id FROM dms.unit LIMIT 1), 10)$$,
  'new product starts without price');
SELECT pg_temp.reject($$UPDATE dms.product SET stock = 3 WHERE id = pg_temp.product(1)$$, 'stock changes only through posting');
SELECT pg_temp.require((SELECT count(*) FROM product WHERE id = pg_temp.product(3)) = 1, 'unused product exists');
SELECT pg_temp.ctx('product.manage');
DELETE FROM product WHERE id = pg_temp.product(3);
SELECT pg_temp.require(pg_temp.product(3) IS NULL, 'unused product can be deleted');
SELECT pg_temp.ctx('unit.manage');
UPDATE unit SET "allowsFraction" = true WHERE code = 'R_PIECE';
UPDATE unit SET "allowsFraction" = false WHERE code = 'R_PIECE';
SELECT pg_temp.require((SELECT NOT "allowsFraction" FROM unit WHERE code = 'R_PIECE'), 'unused unit policy may change');

-- ------------------------------------------------------- posting & balances ----
SELECT pg_temp.post_goods('STOCK_RECEIPT', NULL, pg_temp.product(1), 100, 10000);
SELECT pg_temp.require((SELECT (stock, "lastPurchasePrice") = (100::numeric, 10000::numeric) FROM product WHERE id = pg_temp.product(1)),
  'receipt posting adds stock and sets the purchase price');
SELECT pg_temp.require((SELECT code LIKE 'PN-%' FROM document WHERE kind = 'STOCK_RECEIPT' LIMIT 1), 'PN code');
SELECT pg_temp.post_goods('STOCK_ISSUE', pg_temp.agency(1), pg_temp.product(1), 10, 10200);
SELECT pg_temp.require((SELECT debt FROM agency WHERE id = pg_temp.agency(1)) = 102000, 'issue posting adds debt');
SELECT pg_temp.require((SELECT stock FROM product WHERE id = pg_temp.product(1)) = 90, 'issue posting removes stock');
SELECT pg_temp.require((SELECT code LIKE 'PX-%' FROM document WHERE kind = 'STOCK_ISSUE' LIMIT 1), 'PX code');
SELECT pg_temp.reject($$SELECT pg_temp.post_goods('STOCK_ISSUE', pg_temp.agency(1), pg_temp.product(1), 91, 10200)$$,
  'QĐ5 stock never negative');
SELECT pg_temp.reject($$SELECT pg_temp.post_goods('STOCK_ISSUE', pg_temp.agency(1), pg_temp.product(1), 80, 300000)$$,
  'QĐ3 debt limit at issue posting');
SELECT pg_temp.post_payment(pg_temp.agency(1), 2000);
SELECT pg_temp.require((SELECT debt FROM agency WHERE id = pg_temp.agency(1)) = 100000, 'payment posting reduces debt');
SELECT pg_temp.require((SELECT code LIKE 'PT-%' FROM document WHERE kind = 'PAYMENT_RECEIPT' LIMIT 1), 'PT code');
SELECT pg_temp.ctx('documents.cancel');
UPDATE agency SET debt = debt + 20000000 WHERE id = pg_temp.agency(1);
SELECT pg_temp.require((SELECT debt FROM agency WHERE id = pg_temp.agency(1)) > 20000000,
  'QĐ7 cancelling a payment may exceed the limit');
UPDATE agency SET debt = debt - 20000000 WHERE id = pg_temp.agency(1);
SELECT pg_temp.ctx('documents.cancel');
UPDATE agency SET debt = 30000000 WHERE id = pg_temp.agency(2);
SELECT pg_temp.ctx('agency.manage');
SELECT pg_temp.reject($$UPDATE dms.agency SET "typeId" = (SELECT id FROM dms.agency_type WHERE code = 'TYPE_2') WHERE id = pg_temp.agency(2)$$,
  'type change cannot drop the limit below debt');
SELECT pg_temp.ctx('agency_type.manage');
SELECT pg_temp.reject($$UPDATE dms.agency_type SET "maxDebt" = 1000 WHERE code = 'TYPE_1'$$, 'type limit cannot drop below debt');
SELECT pg_temp.ctx('rules.manage');
SELECT pg_temp.reject($$UPDATE dms.business_rule SET "maxAgenciesPerWard" = 2$$, 'ward rule cannot drop below active count');
SELECT pg_temp.reject($$DELETE FROM dms.business_rule$$, 'business rule cannot be deleted');
SELECT pg_temp.ctx('documents.cancel');
UPDATE agency SET debt = 0 WHERE id = pg_temp.agency(2);
SELECT pg_temp.ctx('agency.manage');
SELECT pg_temp.reject($$DELETE FROM dms.agency WHERE id = pg_temp.agency(1)$$, 'agency with history cannot be deleted');
SELECT pg_temp.reject($$UPDATE dms.agency SET "acceptedDate" = dms.business_today() + 1 WHERE id = pg_temp.agency(1)$$,
  'acceptedDate cannot move after recorded history');
SELECT pg_temp.ctx('product.manage');
SELECT pg_temp.reject($$DELETE FROM dms.product WHERE id = pg_temp.product(1)$$, 'product with history cannot be deleted');
SELECT pg_temp.reject($$UPDATE dms.product SET "unitId" = (SELECT id FROM dms.unit WHERE code = 'R_KG') WHERE id = pg_temp.product(1)$$,
  'recorded product unit is immutable');
SELECT pg_temp.ctx('unit.manage');
SELECT pg_temp.reject($$UPDATE dms.unit SET "allowsFraction" = true WHERE code = 'R_PIECE'$$, 'recorded unit fraction policy is immutable');
SELECT pg_temp.ctx('stock.issue.post');
SELECT pg_temp.reject($$UPDATE dms.product SET stock = -1 WHERE id = pg_temp.product(2)$$, 'stock CHECK even in posting context');

-- --------------------------------------------------------------- documents ----
SELECT pg_temp.ctx('stock.receipt.prepare');
SELECT pg_temp.reject($$INSERT INTO dms.document (kind, "businessDate", status, "postedAt") VALUES ('STOCK_RECEIPT', current_date, 'POSTED', now())$$,
  'documents start as DRAFT');
SELECT pg_temp.reject($$INSERT INTO dms.document (kind, "agencyId", "businessDate") VALUES ('STOCK_RECEIPT', pg_temp.agency(1), dms.business_today())$$,
  'receipt has no agency');
SELECT pg_temp.reject($$INSERT INTO dms.document (kind, "businessDate") VALUES ('STOCK_ISSUE', dms.business_today())$$,
  'issue needs an agency');
SELECT pg_temp.reject($$INSERT INTO dms.document (kind, "agencyId", "businessDate") VALUES ('PAYMENT_RECEIPT', pg_temp.agency(1), dms.business_today())$$,
  'payment needs a receipt type');
SELECT pg_temp.reject($$INSERT INTO dms.document (kind, "businessDate", "sellingPriceRate") VALUES ('STOCK_RECEIPT', dms.business_today(), 1.02)$$,
  'only issues store the selling rate');
SELECT pg_temp.reject($$INSERT INTO dms.document (kind, "businessDate") VALUES ('STOCK_RECEIPT', dms.business_today() + 1)$$,
  'business date cannot be in the future');
SELECT pg_temp.reject($$INSERT INTO dms.document (kind, "agencyId", "businessDate") VALUES ('STOCK_ISSUE', pg_temp.agency(1), dms.business_today() - 400)$$,
  'business date cannot precede agency acceptance');
INSERT INTO document (kind, "businessDate", "totalAmount") VALUES ('STOCK_RECEIPT', dms.business_today(), 999);
CREATE TEMP TABLE rd AS SELECT max(id) AS id FROM document WHERE kind = 'STOCK_RECEIPT' AND status = 'DRAFT';
SELECT pg_temp.reject($$UPDATE dms.document SET status = 'POSTED', "postedAt" = now() WHERE id = (SELECT id FROM rd)$$,
  'posted goods document needs lines');
INSERT INTO document_line ("documentId", "lineNo", "productId", "unitId", "productName", "unitName", quantity, "unitPrice")
SELECT (SELECT id FROM rd), 1, p.id, p."unitId", p.name, 'Cái', 2, 100 FROM product p WHERE p.id = pg_temp.product(2);
SELECT pg_temp.reject($$UPDATE dms.document SET status = 'POSTED', "postedAt" = now() WHERE id = (SELECT id FROM rd)$$,
  'posted total must equal line amounts');
SELECT pg_temp.reject($$UPDATE dms.document SET status = 'CANCELLED', "cancelledAt" = now(), "cancelledBy" = 1, "cancelReason" = 'x' WHERE id = (SELECT id FROM rd)$$,
  'drafts are deleted, not cancelled');
SELECT pg_temp.reject($$INSERT INTO dms.document_line ("documentId", "lineNo", "productId", "unitId", "productName", "unitName", quantity, "unitPrice")
  SELECT (SELECT id FROM rd), 2, p.id, p."unitId", p.name, 'Cái', 1, 1 FROM dms.product p WHERE p.id = pg_temp.product(2)$$,
  'one line per product', '23505');
DELETE FROM document WHERE id = (SELECT id FROM rd);
SELECT pg_temp.require(NOT EXISTS (SELECT 1 FROM document_line WHERE "documentId" = (SELECT id FROM rd)), 'deleting a draft removes its lines');
CREATE TEMP TABLE posted AS SELECT min(id) AS id FROM document WHERE kind = 'STOCK_ISSUE' AND status = 'POSTED';
SELECT pg_temp.reject($$UPDATE dms.document SET "totalAmount" = 1 WHERE id = (SELECT id FROM posted)$$, 'posted content is immutable');
SELECT pg_temp.reject($$UPDATE dms.document_line SET quantity = 1 WHERE "documentId" = (SELECT id FROM posted)$$, 'posted lines are immutable');
SELECT pg_temp.reject($$DELETE FROM dms.document WHERE id = (SELECT id FROM posted)$$, 'only drafts can be deleted');
SELECT pg_temp.reject($$UPDATE dms.document SET status = 'CANCELLED', "cancelledAt" = now() WHERE id = (SELECT id FROM posted)$$,
  'cancellation needs actor and reason');
SELECT pg_temp.ctx('documents.cancel');
UPDATE document SET status = 'CANCELLED', "cancelledAt" = now(), "cancelledBy" = current_setting('dms.actor_id')::bigint,
  "cancelReason" = 'Đại lý đổi ý' WHERE id = (SELECT id FROM posted);
SELECT pg_temp.require((SELECT status FROM document WHERE id = (SELECT id FROM posted)) = 'CANCELLED', 'posted document can be cancelled');
SELECT pg_temp.reject($$UPDATE dms.document SET note = 'x' WHERE id = (SELECT id FROM posted)$$, 'cancelled documents are immutable');
SELECT pg_temp.ctx('documents.correct');
INSERT INTO document (kind, "agencyId", "businessDate", "replacesDocumentId")
VALUES ('STOCK_ISSUE', pg_temp.agency(1), dms.business_today(), (SELECT id FROM posted));
SELECT pg_temp.require((SELECT count(*) FROM document WHERE "replacesDocumentId" = (SELECT id FROM posted)) = 1,
  'correction references the cancelled document');
SELECT pg_temp.reject($$INSERT INTO dms.document (kind, "agencyId", "businessDate", "replacesDocumentId")
  VALUES ('STOCK_ISSUE', pg_temp.agency(1), dms.business_today(), (SELECT id FROM posted))$$, 'a document is replaced once', '23505');
SELECT pg_temp.reject($$INSERT INTO dms.document (kind, "agencyId", "receiptType", "businessDate", "replacesDocumentId")
  VALUES ('PAYMENT_RECEIPT', pg_temp.agency(1), 'CASH', dms.business_today(), (SELECT min(id) FROM dms.document WHERE kind = 'STOCK_RECEIPT'))$$,
  'replacement keeps kind and agency');
CREATE TEMP TABLE pay AS SELECT max(id) AS id FROM document WHERE kind = 'PAYMENT_RECEIPT';
SELECT pg_temp.reject($$INSERT INTO dms.document_line ("documentId", "lineNo", "productId", "unitId", "productName", "unitName", quantity, "unitPrice")
  SELECT (SELECT id FROM pay), 1, p.id, p."unitId", p.name, 'Cái', 1, 1 FROM dms.product p WHERE p.id = pg_temp.product(2)$$,
  'payment receipts have no lines');
SELECT pg_temp.ctx('cash.receipt.prepare');
INSERT INTO document (kind, "agencyId", "receiptType", "businessDate") VALUES ('PAYMENT_RECEIPT', pg_temp.agency(1), 'CASH', dms.business_today());
SELECT pg_temp.reject($$UPDATE dms.document SET status = 'POSTED', "postedAt" = now() WHERE id = (SELECT max(id) FROM dms.document WHERE kind = 'PAYMENT_RECEIPT')$$,
  'posted payment amount is positive');

-- ---------------------------------------------------------- online payments ----
SELECT pg_temp.ctx('payments.online');
SELECT pg_temp.reject($$INSERT INTO dms.online_payment ("agencyId", provider, "merchantReference", "idempotencyKey", amount, "expiresAt")
  VALUES (pg_temp.agency(1), 'VNPAY', 'VNP0', gen_random_uuid(), 999999999, now() + interval '15 minutes')$$,
  'checkout amount cannot exceed debt');
SELECT pg_temp.reject($$INSERT INTO dms.online_payment ("agencyId", provider, "merchantReference", "idempotencyKey", amount, "expiresAt", status)
  VALUES (pg_temp.agency(1), 'VNPAY', 'VNP1', gen_random_uuid(), 1000, now() + interval '15 minutes', 'FAILED')$$,
  'checkout starts PENDING');
INSERT INTO online_payment ("agencyId", provider, "merchantReference", "idempotencyKey", amount, "expiresAt")
VALUES (pg_temp.agency(1), 'VNPAY', 'VNP2', gen_random_uuid(), 50000, now() + interval '15 minutes'),
       (pg_temp.agency(1), 'VNPAY', 'VNP3', gen_random_uuid(), 1000, now() + interval '15 minutes');
SELECT pg_temp.reject($$UPDATE dms.online_payment SET status = 'SUCCESS', "paymentTime" = now(), "providerTransactionId" = '1',
  "receiptDocumentId" = (SELECT id FROM pay) WHERE "merchantReference" = 'VNP2'$$, 'success needs verified evidence and its online receipt');
SELECT pg_temp.reject($$UPDATE dms.online_payment SET amount = 2 WHERE "merchantReference" = 'VNP2'$$, 'payment amount is immutable');
SELECT pg_temp.reject($$DELETE FROM dms.online_payment WHERE "merchantReference" = 'VNP2'$$, 'payment evidence cannot be deleted');
INSERT INTO payment_event ("paymentId", "eventKey", "providerStatus", "verifiedPayload")
SELECT id, 'vnpay:regression', 'SUCCESS', '{"status":"SUCCESS"}' FROM online_payment WHERE "merchantReference" = 'VNP2';
SELECT pg_temp.post_payment(pg_temp.agency(1), 50000, 'ONLINE');
UPDATE online_payment SET status = 'SUCCESS', "paymentTime" = now(), "providerTransactionId" = '14806001',
  "receiptDocumentId" = (SELECT max(id) FROM document WHERE "receiptType" = 'ONLINE') WHERE "merchantReference" = 'VNP2';
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;
SELECT pg_temp.require((SELECT status FROM online_payment WHERE "merchantReference" = 'VNP2') = 'SUCCESS', 'verified success records one receipt');
SELECT pg_temp.reject($$UPDATE dms.online_payment SET status = 'FAILED' WHERE "merchantReference" = 'VNP2'$$, 'successful payment is immutable');
SELECT pg_temp.reject($$UPDATE dms.payment_event SET "providerStatus" = 'FAILED'$$, 'payment events are append-only');
UPDATE online_payment SET status = 'FAILED' WHERE "merchantReference" = 'VNP3';
SELECT pg_temp.reject($$UPDATE dms.online_payment SET status = 'PENDING' WHERE "merchantReference" = 'VNP3'$$,
  'terminal payment only accepts a late verified success');
SELECT pg_temp.reject($$INSERT INTO dms.online_payment ("agencyId", provider, "merchantReference", "idempotencyKey", amount, "expiresAt", "providerTransactionId")
  VALUES (pg_temp.agency(1), 'VNPAY', 'VNP4', gen_random_uuid(), 1000, now() + interval '15 minutes', '14806001')$$,
  'provider transaction id is unique', '23505');

-- ------------------------------------------------------------ audit & auth ----
SELECT pg_temp.require((SELECT count(*) FROM audit_log WHERE "requestId" = 'sql-regression' AND "actorType" = 'USER') > 20,
  'mutations are audited with the actor');
SELECT pg_temp.require(EXISTS (SELECT 1 FROM audit_log WHERE "functionCode" = 'stock.issue.post' AND "entityName" = 'agency'),
  'balance changes carry their posting function');
SELECT pg_temp.require(NOT EXISTS (SELECT 1 FROM audit_log WHERE "newData" ? 'passwordHash' OR "oldData" ? 'passwordHash'),
  'audit snapshots exclude password hashes');
SELECT pg_temp.reject($$UPDATE dms.audit_log SET action = 'DELETE'$$, 'audit log is append-only');
SELECT pg_temp.reject($$DELETE FROM dms.audit_log$$, 'audit log cannot be deleted');
SELECT pg_temp.ctx('users.manage');
UPDATE app_user SET "passwordHash" = 'argon2-rotated' WHERE email = 'regression@agentra.invalid';
SELECT pg_temp.require((SELECT "authVersion" FROM app_user WHERE email = 'regression@agentra.invalid') = 2,
  'password change increments the auth version');
SELECT pg_temp.reject($$UPDATE dms.app_user SET "authVersion" = 1 WHERE email = 'regression@agentra.invalid'$$,
  'auth version cannot go backwards');
SELECT pg_temp.reject($$INSERT INTO dms.app_user ("fullName", email, "passwordHash", "groupId")
  SELECT 'x', 'REGRESSION@agentra.invalid', 'h', id FROM dms.user_group LIMIT 1$$, 'emails are case-insensitively unique', '23505');
