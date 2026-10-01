-- Meaningful regression checks against the real PostgreSQL constraint/trigger engine.
-- psql -v ON_ERROR_STOP=1 -f DMS.sql -f seed.example.sql -f verify.sql
-- All fixtures/helpers are transaction-local; persistent test data is rolled back.
BEGIN;
SET LOCAL search_path = dms, pg_catalog;

CREATE FUNCTION pg_temp.require(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
  PERFORM set_config('dms.test_passes', (coalesce(nullif(current_setting('dms.test_passes',true),'')::integer,0)+1)::text, true);
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
    IF actual_state <> expected_state THEN RAISE EXCEPTION 'FAIL: %; expected %, received %: %', label, expected_state, actual_state, SQLERRM; END IF;
  END;
  SET CONSTRAINTS ALL DEFERRED;
  PERFORM set_config('dms.test_passes', (coalesce(nullif(current_setting('dms.test_passes',true),'')::integer,0)+1)::text, true);
END $$;

INSERT INTO app_user ("fullName", email, "passwordHash", "groupId")
SELECT 'Verification only', 'verify-only@example.invalid', 'test-only-not-a-login-hash', id FROM user_group WHERE code = 'MANAGEMENT';
SELECT set_config('dms.actor_id', (SELECT id::text FROM app_user WHERE email = 'verify-only@example.invalid'), true);
SELECT set_config('dms.request_id', 'sql-regression', true);

CREATE FUNCTION pg_temp.actor() RETURNS bigint LANGUAGE sql AS $$ SELECT current_setting('dms.actor_id')::bigint $$;

CREATE FUNCTION pg_temp.stock_draft(doc_kind text, agency_id bigint, business_date date,
  product_id bigint, qty numeric, price numeric, origin_id bigint DEFAULT NULL,
  origin_line_id bigint DEFAULT NULL, return_amount numeric DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE doc_id bigint; rev_id bigint; selling numeric; total numeric;
BEGIN
  selling := CASE WHEN doc_kind = 'STOCK_ISSUE' THEN round(price * 1.02, 0) ELSE price END;
  total := coalesce(return_amount, round(abs(qty) * selling, 0));
  INSERT INTO dms.document (kind, "agencyId", "originDocumentId", "createdBy")
    VALUES (doc_kind, agency_id, origin_id, pg_temp.actor()) RETURNING id INTO doc_id;
  INSERT INTO dms.document_revision ("documentId", "revisionNo", "businessDate", "totalAmount",
    "sellingPriceRate", "maxDebtSnapshot", reason, "createdBy")
  VALUES (doc_id, 1, business_date, total, CASE WHEN doc_kind = 'STOCK_ISSUE' THEN 1.02 END,
    CASE WHEN doc_kind = 'STOCK_ISSUE' THEN (SELECT t."maxDebt" FROM dms.agency a JOIN dms.agency_type t ON t.id=a."typeId" WHERE a.id=agency_id) END,
    'verification', pg_temp.actor()) RETURNING id INTO rev_id;
  UPDATE dms.document_revision r SET "agencyName"=a.name,"agencyEmail"=a.email,"agencyPhone"=a.phone,"agencyAddress"=a.address
    FROM dms.agency a WHERE r.id=rev_id AND a.id=agency_id;
  INSERT INTO dms.document_line ("revisionId", "lineNo", "productId", "unitId", "productName", "unitName",
    quantity, "unitPrice", "basePurchasePrice", "originLineId", "returnAmount")
  SELECT rev_id, 1, p.id, u.id, p.name, u.name, qty, selling,
    CASE WHEN doc_kind = 'STOCK_ISSUE' THEN price END, origin_line_id, return_amount
    FROM dms.product p JOIN dms.unit u ON u.id = p."unitId" WHERE p.id = product_id;
  UPDATE dms.document SET "currentRevisionId" = rev_id WHERE id = doc_id;
  RETURN doc_id;
END $$;

CREATE FUNCTION pg_temp.ready(doc_id bigint, immediate numeric DEFAULT 0) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE dms.document_revision SET state = 'READY', "readyBy" = pg_temp.actor(), "readyAt" = clock_timestamp(),
    "immediatePayment" = immediate WHERE id = (SELECT "currentRevisionId" FROM dms.document WHERE id = doc_id);
  UPDATE dms.document SET status = 'PENDING' WHERE id = doc_id AND status <> 'POSTED';
END $$;

CREATE FUNCTION pg_temp.post_stock(doc_id bigint) RETURNS void LANGUAGE plpgsql AS $$
DECLARE d dms.document%ROWTYPE; r dms.document_revision%ROWTYPE; batch_id bigint;
BEGIN
  SELECT * INTO d FROM dms.document WHERE id = doc_id;
  SELECT * INTO r FROM dms.document_revision WHERE id = d."currentRevisionId";
  IF d.kind = 'STOCK_ISSUE' AND r.state = 'DRAFT' THEN PERFORM pg_temp.ready(doc_id); END IF;
  UPDATE dms.document SET status = 'POSTED' WHERE id = doc_id RETURNING * INTO d;
  UPDATE dms.document_revision SET state = 'POSTED', "postedBy" = pg_temp.actor(), "postedAt" = clock_timestamp()
    WHERE id = d."currentRevisionId" RETURNING * INTO r;
  INSERT INTO dms.posting_batch ("revisionId", kind, "idempotencyKey", "createdBy")
    VALUES (r.id, 'POST', gen_random_uuid(), pg_temp.actor()) RETURNING id INTO batch_id;
  INSERT INTO dms.inventory_entry ("batchId", "lineId", "productId", "unitId", quantity, "businessDate", "businessOrder")
  SELECT batch_id, id, "productId", "unitId", quantity * CASE WHEN d.kind = 'STOCK_ISSUE' THEN -1 ELSE 1 END,
    r."businessDate", d."businessOrder" FROM dms.document_line WHERE "revisionId" = r.id;
  IF d.kind = 'STOCK_ISSUE' THEN
    INSERT INTO dms.receivable_entry ("batchId", "agencyId", "issueDocumentId", kind, amount, "businessDate", "businessOrder")
    VALUES (batch_id, d."agencyId", d.id, 'CHARGE', r."totalAmount", r."businessDate", d."businessOrder");
  END IF;
END $$;

CREATE FUNCTION pg_temp.financial(doc_kind text, agency_id bigint, business_date date, total numeric,
  method text DEFAULT NULL, receipt_type text DEFAULT NULL, origin_id bigint DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE doc_id bigint; rev_id bigint;
BEGIN
  INSERT INTO dms.document (kind, "agencyId", "receiptType", "originDocumentId", "createdBy")
    VALUES (doc_kind, agency_id, receipt_type, origin_id, pg_temp.actor()) RETURNING id INTO doc_id;
  INSERT INTO dms.document_revision ("documentId", "revisionNo", "businessDate", "totalAmount", "paymentMethod", "createdBy")
    VALUES (doc_id, 1, business_date, total, method, pg_temp.actor()) RETURNING id INTO rev_id;
  UPDATE dms.document_revision r SET "agencyName"=a.name,"agencyEmail"=a.email,"agencyPhone"=a.phone,"agencyAddress"=a.address
    FROM dms.agency a WHERE r.id=rev_id AND a.id=agency_id;
  UPDATE dms.document SET "currentRevisionId" = rev_id, status = 'POSTED' WHERE id = doc_id;
  UPDATE dms.document_revision SET state = 'POSTED', "postedBy" = pg_temp.actor(), "postedAt" = clock_timestamp() WHERE id = rev_id;
  INSERT INTO dms.posting_batch ("revisionId", kind, "idempotencyKey", "createdBy") VALUES (rev_id, 'POST', gen_random_uuid(), pg_temp.actor());
  RETURN doc_id;
END $$;

CREATE FUNCTION pg_temp.allocate(doc_id bigint, issue_id bigint, amount_paid numeric, entry_kind text DEFAULT 'PAYMENT')
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO dms.receivable_entry ("batchId", "agencyId", "issueDocumentId", kind, amount, "businessDate", "businessOrder")
  SELECT b.id, d."agencyId", issue_id, entry_kind, -amount_paid, r."businessDate",
    CASE WHEN d."receiptType" = 'AUTO_FROM_ISSUE' THEN o."businessOrder" ELSE d."businessOrder" END
  FROM dms.document d JOIN dms.document_revision r ON r.id = d."currentRevisionId"
    JOIN dms.posting_batch b ON b."revisionId" = r.id AND b.kind = 'POST'
    LEFT JOIN dms.document o ON o.id = d."originDocumentId" WHERE d.id = doc_id;
END $$;

CREATE FUNCTION pg_temp.credit(doc_id bigint, origin_receipt_id bigint, value numeric) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE lot_id bigint; d dms.document%ROWTYPE; r dms.document_revision%ROWTYPE;
BEGIN
  SELECT * INTO d FROM dms.document WHERE id = doc_id;
  SELECT * INTO r FROM dms.document_revision WHERE id = d."currentRevisionId";
  INSERT INTO dms.credit_lot ("agencyId", "sourceRevisionId", "originReceiptId") VALUES (d."agencyId", r.id, origin_receipt_id) RETURNING id INTO lot_id;
  INSERT INTO dms.credit_entry ("batchId", "agencyId", "lotId", kind, amount, "businessDate", "businessOrder")
    SELECT id, d."agencyId", lot_id, 'CREATED', value, r."businessDate", d."businessOrder"
    FROM dms.posting_batch WHERE "revisionId" = r.id AND kind = 'POST';
  RETURN lot_id;
END $$;

CREATE FUNCTION pg_temp.reverse(doc_id bigint, cancel_document boolean DEFAULT true) RETURNS void LANGUAGE plpgsql AS $$
DECLARE rev_id bigint; batch_id bigint;
BEGIN
  SELECT "currentRevisionId" INTO rev_id FROM dms.document WHERE id = doc_id;
  INSERT INTO dms.posting_batch ("revisionId", kind, "idempotencyKey", "createdBy")
    VALUES (rev_id, 'REVERSE', gen_random_uuid(), pg_temp.actor()) RETURNING id INTO batch_id;
  INSERT INTO dms.inventory_entry ("batchId", "lineId", "productId", "unitId", quantity, "businessDate", "businessOrder", "reversesEntryId")
  SELECT batch_id, e."lineId", e."productId", e."unitId", -e.quantity, e."businessDate", e."businessOrder", e.id
    FROM dms.inventory_entry e JOIN dms.posting_batch b ON b.id = e."batchId"
    JOIN dms.document_revision r ON r.id = b."revisionId" WHERE r."documentId" = doc_id AND e."reversesEntryId" IS NULL
    AND NOT EXISTS (SELECT 1 FROM dms.inventory_entry x WHERE x."reversesEntryId" = e.id);
  INSERT INTO dms.receivable_entry ("batchId", "agencyId", "issueDocumentId", kind, amount, "businessDate", "businessOrder", "reversesEntryId")
  SELECT batch_id, e."agencyId", e."issueDocumentId", e.kind, -e.amount, e."businessDate", e."businessOrder", e.id
    FROM dms.receivable_entry e JOIN dms.posting_batch b ON b.id = e."batchId"
    JOIN dms.document_revision r ON r.id = b."revisionId" WHERE r."documentId" = doc_id AND e."reversesEntryId" IS NULL
    AND NOT EXISTS (SELECT 1 FROM dms.receivable_entry x WHERE x."reversesEntryId" = e.id);
  INSERT INTO dms.credit_entry ("batchId", "agencyId", "lotId", kind, amount, "businessDate", "businessOrder", "reversesEntryId")
  SELECT batch_id, e."agencyId", e."lotId", e.kind, -e.amount, e."businessDate", e."businessOrder", e.id
    FROM dms.credit_entry e JOIN dms.posting_batch b ON b.id = e."batchId"
    JOIN dms.document_revision r ON r.id = b."revisionId" WHERE r."documentId" = doc_id AND e."reversesEntryId" IS NULL
    AND NOT EXISTS (SELECT 1 FROM dms.credit_entry x WHERE x."reversesEntryId" = e.id);
  IF cancel_document THEN
    UPDATE dms.document SET status = 'CANCELLED', "cancelledBy" = pg_temp.actor(), "cancelledAt" = clock_timestamp(), "cancelReason" = 'verification' WHERE id = doc_id;
  END IF;
END $$;

CREATE FUNCTION pg_temp.redate_issue(doc_id bigint, new_date date) RETURNS void LANGUAGE plpgsql AS $$
DECLARE previous dms.document_revision%ROWTYPE; revision_id bigint;
BEGIN
  SELECT r.* INTO previous FROM dms.document d JOIN dms.document_revision r ON r.id=d."currentRevisionId" WHERE d.id=doc_id;
  PERFORM pg_temp.reverse(doc_id,false);
  INSERT INTO dms.document_revision ("documentId","revisionNo","businessDate","totalAmount","immediatePayment",
    "sellingPriceRate","maxDebtSnapshot","agencyName","agencyEmail","agencyAddress","agencyPhone",reason,"createdBy")
  VALUES (doc_id,previous."revisionNo"+1,new_date,previous."totalAmount",previous."immediatePayment",
    previous."sellingPriceRate",previous."maxDebtSnapshot",previous."agencyName",previous."agencyEmail",
    previous."agencyAddress",previous."agencyPhone",'date correction',pg_temp.actor()) RETURNING id INTO revision_id;
  INSERT INTO dms.document_line ("revisionId","lineNo","productId","unitId","productName","unitName",quantity,"unitPrice","basePurchasePrice")
    SELECT revision_id,"lineNo","productId","unitId","productName","unitName",quantity,"unitPrice","basePurchasePrice"
    FROM dms.document_line WHERE "revisionId"=previous.id;
  UPDATE dms.document SET "currentRevisionId"=revision_id WHERE id=doc_id;
  PERFORM pg_temp.post_stock(doc_id);
END $$;

DO $$ DECLARE agency_id bigint; other_id bigint; product_id bigint;
  receipt_id bigint; first_issue bigint; second_issue bigint; manual_id bigint;
  online_id bigint; online_receipt bigint; lot_id bigint; return_id bigint; refund_id bigint; offset_id bigint;
  original_line bigint; revision_id bigint; third_issue bigint; latest_receipt bigint; old_revision bigint;
  count_id bigint; adjustment_id bigint; upfront_id bigint; auto_receipt bigint; immediate_issue bigint;
  measured_product bigint; measured_issue bigint; partial_return bigint; failed_issue bigint; unmatched_receipt bigint;
  allocation_batch bigint; correction_issue bigint; correction_target bigint; correction_receipt bigint;
  history_agency bigint; history_issue bigint; history_receipt bigint;
BEGIN
  INSERT INTO dms.agency (name, "typeId", "districtId", email, "acceptedDate")
    SELECT 'Same name', t.id, x.id, 'agency-test@example.invalid', DATE '2026-01-01'
    FROM dms.agency_type t CROSS JOIN dms.district x WHERE t.code = 'TYPE_1' AND x.code = 'DEMO_DISTRICT_1' RETURNING id INTO agency_id;
  INSERT INTO dms.agency (name, "typeId", "districtId", email, "acceptedDate")
    SELECT 'Same name', t.id, x.id, 'other-test@example.invalid', DATE '2026-01-01'
    FROM dms.agency_type t CROSS JOIN dms.district x WHERE t.code = 'TYPE_1' AND x.code = 'DEMO_DISTRICT_2' RETURNING id INTO other_id;
  SELECT id INTO product_id FROM dms.product WHERE name = 'Mặt hàng mẫu 1';
  PERFORM pg_temp.require((SELECT count(*) = 2 FROM dms.agency WHERE name = 'Same name'), 'agency names may repeat');
  PERFORM pg_temp.reject('UPDATE dms.business_rule SET "sellingPriceRate"=''NaN''', 'NaN rate');
  PERFORM pg_temp.reject('UPDATE dms.agency_type SET "maxDebt"=1.5', 'fractional VND must reject, not silently round');
  PERFORM pg_temp.reject(format('SELECT pg_temp.stock_draft(''STOCK_RECEIPT'',NULL,''2026-06-01'',%s,1.0001,100)', product_id), 'excess quantity precision must reject');
  PERFORM pg_temp.reject(format('UPDATE dms.agency_balance SET "currentDebt"=1 WHERE "agencyId"=%s', agency_id), 'direct debt tampering');
  PERFORM pg_temp.reject(format('SELECT pg_temp.stock_draft(''STOCK_RECEIPT'',NULL,''2026-06-01'',%s,0.5,100)', product_id), 'fractional count unit');
  receipt_id := pg_temp.stock_draft('STOCK_RECEIPT', NULL, '2026-06-01', product_id, 100, 100);
  PERFORM pg_temp.post_stock(receipt_id);
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
  PERFORM pg_temp.require((SELECT "currentStock" = 100 AND "currentPurchasePrice" = 100 FROM dms.inventory_balance WHERE "productId" = product_id), 'receipt updates derived balance');

  first_issue := pg_temp.stock_draft('STOCK_ISSUE', agency_id, '2026-06-02', product_id, 10, 100);
  PERFORM pg_temp.post_stock(first_issue);
  second_issue := pg_temp.stock_draft('STOCK_ISSUE', agency_id, '2026-06-03', product_id, 10, 100);
  PERFORM pg_temp.post_stock(second_issue);
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
  PERFORM pg_temp.require((SELECT "currentDebt" = 2040 FROM dms.agency_balance WHERE "agencyId" = agency_id), 'two invoices create debt');
  PERFORM pg_temp.reject(format('UPDATE dms.document_revision SET "totalAmount"=1 WHERE id=(SELECT "currentRevisionId" FROM dms.document WHERE id=%s)', first_issue), 'posted content immutable');
  PERFORM pg_temp.reject(format('DELETE FROM dms.document WHERE id=%s', receipt_id), 'physical document deletion');
  PERFORM pg_temp.reject(format('UPDATE dms.agency_type SET "maxDebt"=1000 WHERE id=(SELECT "typeId" FROM dms.agency WHERE id=%s)', agency_id), 'lower debt limit below actual debt');
  -- Real overstock posting must fail, not merely drafting it.
  PERFORM pg_temp.reject(format('SELECT pg_temp.post_stock(pg_temp.stock_draft(''STOCK_ISSUE'',%s,''2026-06-03'',%s,1000,100))', agency_id, product_id), 'overstock posting');

  -- Wrong invoice order must be rejected, even when total agency debt is positive.
  PERFORM pg_temp.reject(format('SELECT pg_temp.allocate(pg_temp.financial(''PAYMENT_RECEIPT'',%s,''2026-06-04'',500,''CASH'',''DEBT_COLLECTION''),%s,500)', agency_id, second_issue), 'FIFO enforcement');
  manual_id := pg_temp.financial('PAYMENT_RECEIPT', agency_id, '2026-06-04', 500, 'BANK_TRANSFER', 'DEBT_COLLECTION');
  PERFORM pg_temp.allocate(manual_id, first_issue, 500);
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
  PERFORM pg_temp.require((SELECT "currentDebt" = 1540 FROM dms.agency_balance WHERE "agencyId" = agency_id), 'partial FIFO collection');
  PERFORM pg_temp.reject(format('SELECT pg_temp.allocate(pg_temp.financial(''PAYMENT_RECEIPT'',%s,''2026-06-04'',10,''CASH'',''DEBT_COLLECTION''),%s,10)', other_id, first_issue), 'cross-agency allocation', '23503');

  -- Online is valid at initiation. Another collection later reduces the debt.
  INSERT INTO dms.online_payment ("agencyId", provider, "merchantReference", "idempotencyKey", amount, "expiresAt")
    VALUES (agency_id, 'SANDBOX', 'test-online-1', gen_random_uuid(), 1540, clock_timestamp() + interval '1 hour') RETURNING id INTO online_id;
  manual_id := pg_temp.financial('PAYMENT_RECEIPT', agency_id, '2026-06-05', 1000, 'CASH', 'DEBT_COLLECTION');
  PERFORM pg_temp.allocate(manual_id, first_issue, 520);
  PERFORM pg_temp.allocate(manual_id, second_issue, 480);
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
  online_receipt := pg_temp.financial('PAYMENT_RECEIPT', agency_id, '2026-06-06', 1540, 'ONLINE', 'DEBT_COLLECTION');
  PERFORM pg_temp.allocate(online_receipt, second_issue, 540);
  lot_id := pg_temp.credit(online_receipt, online_receipt, 1000);
  INSERT INTO dms.payment_event ("paymentId", "eventKey", "providerStatus") VALUES (online_id, 'event-success-1', 'SUCCESS');
  UPDATE dms.online_payment SET status='SUCCESS', "providerTransactionId"='provider-1', "paymentTime"=clock_timestamp(), "receiptDocumentId"=online_receipt WHERE id=online_id;
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
  PERFORM pg_temp.require((SELECT "currentDebt"=0 AND "currentCredit"=1000 FROM dms.agency_balance WHERE "agencyId"=agency_id), 'actual online excess becomes credit');
  PERFORM pg_temp.reject(format('INSERT INTO dms.payment_event ("paymentId","eventKey","providerStatus") VALUES (%s,''event-success-1'',''SUCCESS'')', online_id), 'callback deduplication', '23505');
  PERFORM pg_temp.reject(format('SELECT pg_temp.reverse(%s)', online_receipt), 'successful online cash cannot be erased');

  -- Return after payment: stock returns now; original June sale is retained.
  SELECT id INTO original_line FROM dms.document_line WHERE "revisionId"=(SELECT "currentRevisionId" FROM dms.document WHERE id=second_issue);
  return_id := pg_temp.stock_draft('SALES_RETURN', agency_id, '2026-07-01', product_id, 2, 102, second_issue, original_line, 204);
  PERFORM pg_temp.post_stock(return_id);
  PERFORM pg_temp.credit(return_id, online_receipt, 204);
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
  PERFORM pg_temp.require((SELECT "currentStock"=82 FROM dms.inventory_balance WHERE "productId"=product_id), 'return changes current stock');
  PERFORM pg_temp.require((SELECT "salesAmount"=2040 AND "returnAmount"=0 FROM dms.sales_report('2026-06-01','2026-07-01') WHERE "agencyId"=agency_id), 'June gross sale is retained');
  PERFORM pg_temp.require((SELECT "salesAmount"=0 AND "returnAmount"=204 AND "netSalesAmount"=-204 FROM dms.sales_report('2026-07-01','2026-08-01') WHERE "agencyId"=agency_id), 'July actual return may create negative net sales');

  -- Credit application is not a new cash receipt.
  third_issue := pg_temp.stock_draft('STOCK_ISSUE', agency_id, '2026-07-02', product_id, 2, 100);
  PERFORM pg_temp.post_stock(third_issue);
  offset_id := pg_temp.financial('CREDIT_APPLICATION', agency_id, '2026-07-03', 204);
  PERFORM pg_temp.allocate(offset_id, third_issue, 204, 'CREDIT');
  INSERT INTO dms.credit_entry ("batchId","agencyId","lotId",kind,amount,"businessDate","businessOrder")
    SELECT b.id,agency_id,lot_id,'OFFSET',-204,r."businessDate",d."businessOrder" FROM dms.document d
      JOIN dms.document_revision r ON r.id=d."currentRevisionId" JOIN dms.posting_batch b ON b."revisionId"=r.id WHERE d.id=offset_id;
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
  PERFORM pg_temp.require((SELECT "currentDebt"=0 AND "currentCredit"=1000 FROM dms.agency_balance WHERE "agencyId"=agency_id), 'offset draws credit without cash');

  -- Refund first reserves credit, then consumes it only on confirmed provider success.
  INSERT INTO dms.document (kind,"agencyId","originDocumentId","createdBy") VALUES ('REFUND',agency_id,online_receipt,pg_temp.actor()) RETURNING id INTO refund_id;
  INSERT INTO dms.document_revision ("documentId","revisionNo","businessDate","totalAmount","paymentMethod","createdBy")
    VALUES (refund_id,1,'2026-07-04',100,'ONLINE',pg_temp.actor()) RETURNING id INTO revision_id;
  UPDATE dms.document_revision r SET "agencyName"=a.name,"agencyEmail"=a.email FROM dms.agency a WHERE r.id=revision_id AND a.id=agency_id;
  UPDATE dms.document SET "currentRevisionId"=revision_id WHERE id=refund_id;
  INSERT INTO dms.refund_reservation ("refundRevisionId","lotId",amount) VALUES (revision_id,lot_id,100);
  INSERT INTO dms.refund_attempt ("refundRevisionId","onlinePaymentId","idempotencyKey","merchantRefundReference",amount)
    VALUES (revision_id,online_id,gen_random_uuid(),'refund-test-1',100);
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
  PERFORM pg_temp.require((SELECT reserved=100 AND available=696 FROM dms.credit_availability WHERE id=lot_id), 'refund reserves spendable credit');
  PERFORM pg_temp.reject(format('UPDATE dms.refund_reservation SET state=''RELEASED'' WHERE "refundRevisionId"=%s',revision_id), 'cannot release in-flight refund');
  UPDATE dms.refund_attempt SET state='SUCCESS',"providerRefundId"='refund-provider-1',"completedAt"=clock_timestamp(),"verifiedResponse"='{}' WHERE "refundRevisionId"=revision_id;
  UPDATE dms.document SET status='POSTED' WHERE id=refund_id;
  UPDATE dms.document_revision SET state='POSTED',"postedBy"=pg_temp.actor(),"postedAt"=clock_timestamp() WHERE id=revision_id;
  INSERT INTO dms.posting_batch ("revisionId",kind,"idempotencyKey") VALUES (revision_id,'POST',gen_random_uuid());
  INSERT INTO dms.credit_entry ("batchId","agencyId","lotId",kind,amount,"businessDate","businessOrder")
    SELECT b.id,agency_id,lot_id,'REFUND',-100,r."businessDate",d."businessOrder" FROM dms.document d
      JOIN dms.document_revision r ON r.id=d."currentRevisionId" JOIN dms.posting_batch b ON b."revisionId"=r.id WHERE d.id=refund_id;
  UPDATE dms.refund_reservation SET state='CONSUMED' WHERE "refundRevisionId"=revision_id;
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
  PERFORM pg_temp.require((SELECT "currentCredit"=900 FROM dms.agency_balance WHERE "agencyId"=agency_id), 'successful refund reduces credit');
  PERFORM pg_temp.reject(format('SELECT pg_temp.reverse(%s)',refund_id), 'real refund cannot be erased');

  -- Late entry of an older purchase must not overwrite a newer business-date price.
  latest_receipt := pg_temp.stock_draft('STOCK_RECEIPT',NULL,'2026-05-25',product_id,1,80);
  PERFORM pg_temp.post_stock(latest_receipt);
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
  PERFORM pg_temp.require((SELECT "currentPurchasePrice"=100 FROM dms.inventory_balance WHERE "productId"=product_id), 'late old purchase preserves latest business-date price');
  PERFORM pg_temp.reverse(latest_receipt);
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;

  -- Current stock after cancelling the first receipt WOULD stay positive, but June history would not.
  latest_receipt := pg_temp.stock_draft('STOCK_RECEIPT',NULL,'2026-07-05',product_id,100,200);
  PERFORM pg_temp.post_stock(latest_receipt);
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
  PERFORM pg_temp.require((SELECT "currentStock"-100 >= 0 FROM dms.inventory_balance WHERE "productId"=product_id), 'current-only cancellation check would pass');
  -- Historical stock validation catches a cancellation current stock alone would allow.
  PERFORM pg_temp.reject(format('SELECT pg_temp.reverse(%s)',receipt_id), 'historical negative inventory');

  -- Replace a posted revision, preserving identity and old content; reverse and repost atomically.
  SELECT "currentRevisionId" INTO old_revision FROM dms.document WHERE id=latest_receipt;
  PERFORM pg_temp.reverse(latest_receipt,false);
  INSERT INTO dms.document_revision ("documentId","revisionNo","businessDate","totalAmount",reason,"createdBy")
    VALUES (latest_receipt,2,'2026-07-05',13500,'correct quantity and price',pg_temp.actor()) RETURNING id INTO revision_id;
  INSERT INTO dms.document_line ("revisionId","lineNo","productId","unitId","productName","unitName",quantity,"unitPrice")
    SELECT revision_id,1,"productId","unitId","productName","unitName",90,150 FROM dms.document_line WHERE "revisionId"=old_revision;
  UPDATE dms.document SET "currentRevisionId"=revision_id WHERE id=latest_receipt;
  PERFORM pg_temp.post_stock(latest_receipt);
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
  PERFORM pg_temp.require((SELECT "currentStock"=170 AND "currentPurchasePrice"=150 FROM dms.inventory_balance WHERE "productId"=product_id), 'revision replacement reconciles stock and price');
  PERFORM pg_temp.require((SELECT quantity=100 AND "unitPrice"=200 FROM dms.document_line WHERE "revisionId"=old_revision), 'old revision retained unchanged');
  PERFORM pg_temp.require((SELECT "unitPrice"=102 FROM dms.document_line WHERE "revisionId"=(SELECT "currentRevisionId" FROM dms.document WHERE id=first_issue)), 'old selling prices preserved');
  PERFORM pg_temp.reject(format('UPDATE dms.product SET "unitId"=(SELECT id FROM dms.unit WHERE code=''KG'') WHERE id=%s',product_id), 'used product cannot change unit');

  -- Physical count including zero-difference lines can create a controlled adjustment.
  INSERT INTO dms.stock_count ("countedAt","createdBy",reason) VALUES (clock_timestamp(),pg_temp.actor(),'count test') RETURNING id INTO count_id;
  INSERT INTO dms.stock_count_line ("countId","productId","unitId","bookQuantity","countedQuantity","observedLastEntryId")
    SELECT count_id,product_id,"unitId",170,172,(SELECT max(id) FROM dms.inventory_entry WHERE "productId"=product_id) FROM dms.product WHERE id=product_id;
  adjustment_id := pg_temp.stock_draft('STOCK_ADJUSTMENT',NULL,'2026-07-06',product_id,2,0);
  UPDATE dms.stock_count SET state='CONFIRMED',"confirmedBy"=pg_temp.actor(),"confirmedAt"=clock_timestamp(),"adjustmentDocumentId"=adjustment_id WHERE id=count_id;
  PERFORM pg_temp.post_stock(adjustment_id);
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
  PERFORM pg_temp.require((SELECT "currentStock"=172 FROM dms.inventory_balance WHERE "productId"=product_id), 'confirmed count adjustment');

  -- Atomic immediate receipt makes final debt legal even if gross invoice exceeds the limit.
  UPDATE dms.agency_type SET "maxDebt"=250 WHERE id=(SELECT "typeId" FROM dms.agency WHERE id=agency_id);
  immediate_issue := pg_temp.stock_draft('STOCK_ISSUE',agency_id,'2026-07-08',product_id,2,150);
  PERFORM pg_temp.ready(immediate_issue,100);
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
  PERFORM pg_temp.reject(format('SELECT pg_temp.post_stock(%s)',immediate_issue), 'cannot post declared immediate payment without confirmation/receipt');
  INSERT INTO dms.upfront_confirmation ("issueRevisionId",amount,method,"receivedAt","verifiedBy")
    SELECT "currentRevisionId",100,'CASH',clock_timestamp(),pg_temp.actor() FROM dms.document WHERE id=immediate_issue RETURNING id INTO upfront_id;
  PERFORM pg_temp.post_stock(immediate_issue);
  auto_receipt := pg_temp.financial('PAYMENT_RECEIPT',agency_id,'2026-07-08',100,'CASH','AUTO_FROM_ISSUE',immediate_issue);
  PERFORM pg_temp.allocate(auto_receipt,immediate_issue,100);
  UPDATE dms.upfront_confirmation SET state='CONSUMED',"receiptDocumentId"=auto_receipt WHERE id=upfront_id;
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
  PERFORM pg_temp.require((SELECT "currentDebt"=206 FROM dms.agency_balance WHERE "agencyId"=agency_id), 'atomic issue and immediate cash respects final limit');
  PERFORM pg_temp.reject(format('SELECT pg_temp.reverse(%s)',auto_receipt), 'auto receipt cannot be cancelled independently');

  -- Two half returns of a 1 VND line must total 1 VND, not 2 VND.
  SELECT id INTO measured_product FROM dms.product WHERE name='Mặt hàng mẫu 4';
  latest_receipt := pg_temp.stock_draft('STOCK_RECEIPT',NULL,'2026-07-09',measured_product,1,1);
  PERFORM pg_temp.post_stock(latest_receipt);
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
  measured_issue := pg_temp.stock_draft('STOCK_ISSUE',agency_id,'2026-07-09',measured_product,1,1);
  PERFORM pg_temp.post_stock(measured_issue);
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
  SELECT id INTO original_line FROM dms.document_line WHERE "revisionId"=(SELECT "currentRevisionId" FROM dms.document WHERE id=measured_issue);
  partial_return := pg_temp.stock_draft('SALES_RETURN',agency_id,'2026-07-10',measured_product,0.5,1,measured_issue,original_line,1);
  PERFORM pg_temp.post_stock(partial_return);
  PERFORM pg_temp.allocate(partial_return,measured_issue,1,'RETURN');
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
  partial_return := pg_temp.stock_draft('SALES_RETURN',agency_id,'2026-07-11',measured_product,0.5,1,measured_issue,original_line,0);
  PERFORM pg_temp.post_stock(partial_return);
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
  PERFORM pg_temp.require((SELECT sum("totalAmount")=1 FROM dms.current_document WHERE "originDocumentId"=measured_issue AND kind='SALES_RETURN' AND status='POSTED'), 'partial returns never exceed original rounded amount');
  PERFORM pg_temp.require((SELECT "currentStock"=1 FROM dms.inventory_balance WHERE "productId"=measured_product), 'zero-value partial return still restores stock');
  PERFORM pg_temp.reject(format('SELECT pg_temp.post_stock(pg_temp.stock_draft(''SALES_RETURN'',%s,''2026-07-12'',%s,0.001,1,%s,%s,0))',agency_id,measured_product,measured_issue,original_line), 'cannot return more quantity than sold');

  -- Money already received must remain accounted for when an unposted issue is abandoned.
  failed_issue := pg_temp.stock_draft('STOCK_ISSUE',agency_id,'2026-07-12',product_id,3,150);
  PERFORM pg_temp.ready(failed_issue,300);
  INSERT INTO dms.upfront_confirmation ("issueRevisionId",amount,method,"receivedAt","verifiedBy")
    SELECT "currentRevisionId",300,'BANK_TRANSFER',clock_timestamp(),pg_temp.actor() FROM dms.document WHERE id=failed_issue RETURNING id INTO upfront_id;
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
  PERFORM pg_temp.require((SELECT "currentDebt"=206 FROM dms.agency_balance WHERE "agencyId"=agency_id), 'upfront verification alone does not reduce debt');
  UPDATE dms.document SET status='CANCELLED',"cancelledBy"=pg_temp.actor(),"cancelledAt"=clock_timestamp(),"cancelReason"='shipment abandoned' WHERE id=failed_issue;
  unmatched_receipt := pg_temp.financial('PAYMENT_RECEIPT',agency_id,'2026-07-12',300,'BANK_TRANSFER','RECEIVED_UNAPPLIED',failed_issue);
  PERFORM pg_temp.allocate(unmatched_receipt,immediate_issue,206);
  PERFORM pg_temp.credit(unmatched_receipt,unmatched_receipt,94);
  UPDATE dms.upfront_confirmation SET state='RECEIVED_SEPARATELY',"receiptDocumentId"=unmatched_receipt WHERE id=upfront_id;
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
  PERFORM pg_temp.require((SELECT "currentDebt"=0 AND "currentCredit"=994 FROM dms.agency_balance WHERE "agencyId"=agency_id), 'failed shipment retains actual received cash and excess');

  -- Reallocation preserves the receipt while a mistaken older invoice is cancelled.
  UPDATE dms.agency SET "typeId"=(SELECT id FROM dms.agency_type WHERE code='TYPE_2') WHERE id=other_id;
  correction_issue := pg_temp.stock_draft('STOCK_ISSUE',other_id,'2026-07-13',product_id,3,150);
  PERFORM pg_temp.post_stock(correction_issue);
  correction_target := pg_temp.stock_draft('STOCK_ISSUE',other_id,'2026-07-14',product_id,5,150);
  PERFORM pg_temp.post_stock(correction_target);
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
  correction_receipt := pg_temp.financial('PAYMENT_RECEIPT',other_id,'2026-07-15',612,'CASH','DEBT_COLLECTION');
  PERFORM pg_temp.allocate(correction_receipt,correction_issue,459);
  PERFORM pg_temp.allocate(correction_receipt,correction_target,153);
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
  PERFORM pg_temp.reverse(correction_issue);
  PERFORM pg_temp.reverse(correction_receipt,false);
  INSERT INTO dms.posting_batch ("revisionId",kind,"idempotencyKey","createdBy")
    SELECT "currentRevisionId",'REALLOCATE',gen_random_uuid(),pg_temp.actor() FROM dms.document WHERE id=correction_receipt RETURNING id INTO allocation_batch;
  INSERT INTO dms.receivable_entry ("batchId","agencyId","issueDocumentId",kind,amount,"businessDate","businessOrder")
    SELECT allocation_batch,other_id,correction_target,'PAYMENT',-612,r."businessDate",d."businessOrder"
    FROM dms.document d JOIN dms.document_revision r ON r.id=d."currentRevisionId" WHERE d.id=correction_receipt;
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
  PERFORM pg_temp.require((SELECT "currentDebt"=153 FROM dms.agency_balance WHERE "agencyId"=other_id), 'cancellation and reallocation preserve actual receipt');
  PERFORM pg_temp.require((SELECT status='POSTED' AND "totalAmount"=612 FROM dms.current_document WHERE id=correction_receipt), 'reallocation never changes cash received');

  -- Current debt stays positive if the invoice moves after its collection;
  -- the historical debt at the collection date must still reject that edit.
  INSERT INTO dms.agency (name,"typeId","districtId",email,"acceptedDate")
    SELECT 'history-check',t.id,x.id,'history@example.invalid','2026-01-01' FROM dms.agency_type t CROSS JOIN dms.district x
    WHERE t.code='TYPE_2' AND x.code='DEMO_DISTRICT_3' RETURNING id INTO history_agency;
  history_issue := pg_temp.stock_draft('STOCK_ISSUE',history_agency,'2026-08-01',product_id,10,150);
  PERFORM pg_temp.post_stock(history_issue);
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
  history_receipt := pg_temp.financial('PAYMENT_RECEIPT',history_agency,'2026-08-02',500,'CASH','DEBT_COLLECTION');
  PERFORM pg_temp.allocate(history_receipt,history_issue,500);
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
  PERFORM pg_temp.require((SELECT "currentDebt"=1030 FROM dms.agency_balance WHERE "agencyId"=history_agency), 'date change would preserve positive current debt');
  PERFORM pg_temp.reject(format('SELECT pg_temp.redate_issue(%s,''2026-08-03'')',history_issue), 'date change cannot make past debt negative');

  -- Zero differences remain useful count evidence without a fake stock movement.
  INSERT INTO dms.stock_count ("countedAt","createdBy") VALUES (clock_timestamp(),pg_temp.actor()) RETURNING id INTO count_id;
  INSERT INTO dms.stock_count_line ("countId","productId","unitId","bookQuantity","countedQuantity","observedLastEntryId")
    SELECT count_id,measured_product,"unitId",1,1,(SELECT max(id) FROM dms.inventory_entry WHERE "productId"=measured_product) FROM dms.product WHERE id=measured_product;
  UPDATE dms.stock_count SET state='CONFIRMED',"confirmedBy"=pg_temp.actor(),"confirmedAt"=clock_timestamp() WHERE id=count_id;
  SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
  PERFORM pg_temp.require((SELECT state='CONFIRMED' AND "adjustmentDocumentId" IS NULL FROM dms.stock_count WHERE id=count_id), 'zero-difference count needs no adjustment');

  -- Capacity is global policy, inactive agencies do not count, termination cannot be undone.
  INSERT INTO dms.agency (name,"typeId","districtId",email,"acceptedDate")
    SELECT 'capacity-'||n,t.id,x.id,'capacity-'||n||'@example.invalid','2026-01-01'
    FROM dms.agency_type t CROSS JOIN dms.district x CROSS JOIN generate_series(1,3) n WHERE t.code='TYPE_1' AND x.code='DEMO_DISTRICT_1';
  PERFORM pg_temp.reject('INSERT INTO dms.agency (name,"typeId","districtId",email,"acceptedDate") SELECT ''fifth'',t.id,x.id,''fifth@example.invalid'',''2026-01-01'' FROM dms.agency_type t CROSS JOIN dms.district x WHERE t.code=''TYPE_1'' AND x.code=''DEMO_DISTRICT_1''', 'district capacity');
  PERFORM pg_temp.reject('UPDATE dms.business_rule SET "maxAgenciesPerDistrict"=3', 'cannot lower district capacity below usage');
  UPDATE dms.agency SET status='TERMINATED',"terminatedAt"=clock_timestamp(),"terminationReason"='test' WHERE id=other_id;
  PERFORM pg_temp.reject(format('UPDATE dms.agency SET status=''ACTIVE'',"terminatedAt"=NULL,"terminationReason"=NULL WHERE id=%s',other_id), 'termination cannot be reopened');
  PERFORM pg_temp.reject('UPDATE dms.audit_log SET action=''UPDATE''', 'audit immutable');
  PERFORM pg_temp.require(NOT EXISTS (SELECT 1 FROM dms.audit_log WHERE "newData" ? 'passwordHash' OR "oldData" ? 'passwordHash'), 'audit excludes password hashes');
  PERFORM pg_temp.require((SELECT "numberOfIssues"=2 AND "salesRate"=100 FROM dms.sales_report('2026-06-01','2026-07-01') WHERE "agencyId"=agency_id), 'sales counts headers, not entries');
  PERFORM pg_temp.require((SELECT "openingDebt"=0 AND "debtIncrease"=2040 AND "cashApplied"=2040 AND "closingDebt"=0 FROM dms.debt_report('2026-06-01','2026-07-01') WHERE "agencyId"=agency_id), 'debt report counts applied cash, not excess');
END $$;

SET CONSTRAINTS ALL IMMEDIATE;
SELECT current_setting('dms.test_passes')::integer AS checks,
  'PASS: SQL integrity, FIFO, online excess, returns, credits, refunds and reports' AS result;
ROLLBACK;
