-- Session-local demo builders. Never installed as permanent business services.
CREATE FUNCTION pg_temp.actor() RETURNS bigint LANGUAGE sql AS $$
  SELECT current_setting('dms.actor_id')::bigint
$$;

CREATE FUNCTION pg_temp.flush_checks() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;
END $$;

CREATE FUNCTION pg_temp.trading_month(month_no integer, agencies bigint[], products bigint[],
  prices integer[], sales_actor bigint, warehouse_actor bigint, accounting_actor bigint,
  seed_key uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE i integer; j integer; start_no integer; day_no integer; agency_id bigint;
  lines jsonb; doc_id bigint; receipt_id bigint; payment_id bigint; amount_paid numeric;
  payment_key uuid; original dms.document_line%ROWTYPE; return_id bigint;
BEGIN
  PERFORM set_config('dms.actor_id',warehouse_actor::text,true);
  PERFORM set_config('dms.function_code','stock.receipt.post',true);
  FOR start_no IN 0..3 LOOP
    lines := '[]'::jsonb;
    FOR j IN start_no*6..start_no*6+5 LOOP
      IF j<>22 THEN
        lines := lines || jsonb_build_array(jsonb_build_object('product',products[j+1],
          'quantity',CASE WHEN j=20 THEN 3 ELSE 300 END,'price',prices[j+1]+(month_no-6)*500));
      END IF;
    END LOOP;
    doc_id := pg_temp.stock_draft('STOCK_RECEIPT',NULL,make_date(2026,month_no,1),lines,
      CASE WHEN month_no=6 AND start_no=0 THEN seed_key ELSE gen_random_uuid() END);
    PERFORM pg_temp.post_stock(doc_id);
    PERFORM pg_temp.flush_checks();
  END LOOP;
  FOR i IN 0..26 LOOP
    agency_id := agencies[i+1];
    FOREACH day_no IN ARRAY ARRAY[5,12] LOOP
      PERFORM set_config('dms.actor_id',sales_actor::text,true);
      PERFORM set_config('dms.function_code','stock.issue.prepare',true);
      lines := '[]'::jsonb;
      FOR j IN 0..2 LOOP
        lines := lines || jsonb_build_array(jsonb_build_object(
          'product',products[(i*2+day_no+j)%20+1],'quantity',2+i%3));
      END LOOP;
      doc_id := pg_temp.stock_draft('STOCK_ISSUE',agency_id,make_date(2026,month_no,day_no),
        lines,gen_random_uuid());
      PERFORM pg_temp.ready(doc_id,CASE WHEN i%7=0 THEN 20000 ELSE 0 END);
      PERFORM set_config('dms.actor_id',warehouse_actor::text,true);
      PERFORM set_config('dms.function_code','stock.issue.post',true);
      PERFORM pg_temp.post_stock(doc_id);
      PERFORM pg_temp.flush_checks();
      PERFORM set_config('dms.actor_id',accounting_actor::text,true);
      PERFORM set_config('dms.function_code','cash.receipt.post',true);
      IF day_no=5 AND i%3=0 THEN
        SELECT "currentDebt" INTO amount_paid FROM dms.agency_balance WHERE "agencyId"=agency_id;
        receipt_id := pg_temp.financial('PAYMENT_RECEIPT',agency_id,make_date(2026,month_no,8),
          amount_paid,'CASH','DEBT_COLLECTION',NULL,gen_random_uuid());
        PERFORM pg_temp.fifo(receipt_id);
        PERFORM pg_temp.flush_checks();
      ELSIF day_no=12 AND i%5<>0 THEN
        SELECT trunc("currentDebt"/2) INTO amount_paid FROM dms.agency_balance WHERE "agencyId"=agency_id;
        IF i%6=1 THEN
          payment_key := gen_random_uuid();
          PERFORM set_config('dms.function_code','payments.online',true);
          INSERT INTO dms.online_payment ("agencyId",provider,"merchantReference","idempotencyKey",
            amount,"expiresAt","createdBy") VALUES (agency_id,'DEMO_SANDBOX','DEMO-'||payment_key,
            payment_key,amount_paid,clock_timestamp()+interval '1 day',accounting_actor)
            RETURNING id INTO payment_id;
          receipt_id := pg_temp.financial('PAYMENT_RECEIPT',agency_id,make_date(2026,month_no,18),
            amount_paid,'ONLINE','DEBT_COLLECTION',NULL,gen_random_uuid());
          PERFORM pg_temp.fifo(receipt_id);
          INSERT INTO dms.payment_event ("paymentId","eventKey","providerStatus","verifiedPayload")
            VALUES (payment_id,'DEMO-SUCCESS-'||payment_id,'SUCCESS',
              jsonb_build_object('demo',true,'simulatedVerification',true));
          UPDATE dms.online_payment SET status='SUCCESS',"providerTransactionId"='DEMO-TXN-'||payment_id,
            "paymentTime"=clock_timestamp(),"receiptDocumentId"=receipt_id WHERE id=payment_id;
        ELSE
          receipt_id := pg_temp.financial('PAYMENT_RECEIPT',agency_id,make_date(2026,month_no,18),
            amount_paid,'BANK_TRANSFER','DEBT_COLLECTION',NULL,gen_random_uuid());
          PERFORM pg_temp.fifo(receipt_id);
        END IF;
        PERFORM pg_temp.flush_checks();
      END IF;
    END LOOP;
    IF month_no=9 AND i IN (2,4,6) THEN
      SELECT l.* INTO STRICT original FROM dms.document d JOIN dms.document_line l
        ON l."revisionId"=d."currentRevisionId" WHERE d.id=doc_id ORDER BY "lineNo" LIMIT 1;
      PERFORM set_config('dms.actor_id',warehouse_actor::text,true);
      PERFORM set_config('dms.function_code','returns.post',true);
      return_id := pg_temp.stock_draft('SALES_RETURN',agency_id,'2026-09-20',
        jsonb_build_array(jsonb_build_object('product',original."productId",'quantity',1,
          'price',original."unitPrice",'originLine',original.id,'returnAmount',original."unitPrice")),
        gen_random_uuid(),doc_id);
      PERFORM pg_temp.post_stock(return_id);
      PERFORM pg_temp.allocate(return_id,doc_id,original."unitPrice",'RETURN');
      PERFORM pg_temp.flush_checks();
    END IF;
  END LOOP;
END $$;

CREATE FUNCTION pg_temp.stock_draft(doc_kind text, agency_id bigint, business_date date,
  lines jsonb, creation_key uuid, origin_id bigint DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE doc_id bigint; rev_id bigint; item jsonb; line_no integer := 0;
  purchase numeric; selling numeric; rate numeric;
BEGIN
  SELECT "sellingPriceRate" INTO rate FROM dms.business_rule WHERE id;
  INSERT INTO dms.document (kind,"agencyId","originDocumentId","createdBy","creationKey")
    VALUES (doc_kind,agency_id,origin_id,pg_temp.actor(),creation_key) RETURNING id INTO doc_id;
  INSERT INTO dms.document_revision ("documentId","revisionNo","businessDate",
    "sellingPriceRate","maxDebtSnapshot",reason,note,"createdBy",
    "agencyName","agencyAddress","agencyPhone","agencyEmail")
  VALUES (doc_id,1,business_date,CASE WHEN doc_kind='STOCK_ISSUE' THEN rate END,
    CASE WHEN doc_kind='STOCK_ISSUE' THEN (SELECT t."maxDebt" FROM dms.agency a
      JOIN dms.agency_type t ON t.id=a."typeId" WHERE a.id=agency_id) END,
    CASE WHEN doc_kind='STOCK_ADJUSTMENT' THEN 'Đối chiếu kiểm kê kho mẫu' END,
    'Agentra demo v1 — dữ liệu mô phỏng, không phải giao dịch thật',pg_temp.actor(),
    (SELECT name FROM dms.agency WHERE id=agency_id),
    (SELECT address FROM dms.agency WHERE id=agency_id),
    (SELECT phone FROM dms.agency WHERE id=agency_id),
    (SELECT email FROM dms.agency WHERE id=agency_id)) RETURNING id INTO rev_id;
  FOR item IN SELECT value FROM jsonb_array_elements(lines) LOOP
    line_no := line_no+1;
    IF doc_kind='STOCK_ISSUE' THEN
      SELECT "currentPurchasePrice" INTO purchase FROM dms.inventory_balance
        WHERE "productId"=(item->>'product')::bigint;
      selling := round(purchase*rate,0);
    ELSE
      purchase := NULL;
      selling := (item->>'price')::numeric;
    END IF;
    INSERT INTO dms.document_line ("revisionId","lineNo","productId","unitId",
      "productName","unitName",quantity,"unitPrice","basePurchasePrice","originLineId","returnAmount")
    SELECT rev_id,line_no,p.id,u.id,p.name,u.name,(item->>'quantity')::numeric,selling,
      purchase,(item->>'originLine')::bigint,(item->>'returnAmount')::numeric
      FROM dms.product p JOIN dms.unit u ON u.id=p."unitId" WHERE p.id=(item->>'product')::bigint;
  END LOOP;
  UPDATE dms.document_revision SET "totalAmount"=(SELECT sum("lineAmount") FROM dms.document_line
    WHERE "revisionId"=rev_id) WHERE id=rev_id;
  UPDATE dms.document SET "currentRevisionId"=rev_id WHERE id=doc_id;
  RETURN doc_id;
END $$;

CREATE FUNCTION pg_temp.ready(doc_id bigint, immediate numeric DEFAULT 0) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE dms.document_revision SET state='READY',"readyBy"=pg_temp.actor(),
    "readyAt"=clock_timestamp(),"immediatePayment"=immediate
    WHERE id=(SELECT "currentRevisionId" FROM dms.document WHERE id=doc_id);
  UPDATE dms.document SET status='PENDING' WHERE id=doc_id AND status<>'POSTED';
END $$;

CREATE FUNCTION pg_temp.financial(doc_kind text, agency_id bigint, business_date date,
  total numeric, method text, receipt_type text, origin_id bigint, creation_key uuid,
  post_now boolean DEFAULT true)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE doc_id bigint; rev_id bigint;
BEGIN
  INSERT INTO dms.document (kind,"agencyId","receiptType","originDocumentId","createdBy","creationKey")
    VALUES (doc_kind,agency_id,receipt_type,origin_id,pg_temp.actor(),creation_key) RETURNING id INTO doc_id;
  INSERT INTO dms.document_revision ("documentId","revisionNo","businessDate","totalAmount",
    "paymentMethod",note,"createdBy","agencyName","agencyEmail","agencyAddress","agencyPhone")
  SELECT doc_id,1,business_date,total,method,
    'Agentra demo v1 — chứng từ mô phỏng',pg_temp.actor(),a.name,a.email,a.address,a.phone
    FROM dms.agency a WHERE a.id=agency_id RETURNING id INTO rev_id;
  UPDATE dms.document SET "currentRevisionId"=rev_id WHERE id=doc_id;
  IF post_now THEN
    UPDATE dms.document SET status='POSTED' WHERE id=doc_id;
    UPDATE dms.document_revision SET state='POSTED',"postedBy"=pg_temp.actor(),
      "postedAt"=clock_timestamp() WHERE id=rev_id;
    INSERT INTO dms.posting_batch ("revisionId",kind,"idempotencyKey","createdBy")
      VALUES (rev_id,'POST',gen_random_uuid(),pg_temp.actor());
  END IF;
  RETURN doc_id;
END $$;

CREATE FUNCTION pg_temp.allocate(doc_id bigint, issue_id bigint, paid numeric,
  entry_kind text DEFAULT 'PAYMENT') RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO dms.receivable_entry ("batchId","agencyId","issueDocumentId",kind,amount,
    "businessDate","businessOrder")
  SELECT b.id,d."agencyId",issue_id,entry_kind,-paid,r."businessDate",
    CASE WHEN d."receiptType"='AUTO_FROM_ISSUE' THEN o."businessOrder" ELSE d."businessOrder" END
    FROM dms.document d JOIN dms.document_revision r ON r.id=d."currentRevisionId"
    JOIN dms.posting_batch b ON b."revisionId"=r.id AND b.kind='POST'
    LEFT JOIN dms.document o ON o.id=d."originDocumentId" WHERE d.id=doc_id;
END $$;

CREATE FUNCTION pg_temp.fifo(doc_id bigint, entry_kind text DEFAULT 'PAYMENT')
RETURNS numeric LANGUAGE plpgsql AS $$
DECLARE remaining numeric; agency_id bigint; issue record; allocated numeric;
BEGIN
  SELECT r."totalAmount",d."agencyId" INTO remaining,agency_id FROM dms.document d
    JOIN dms.document_revision r ON r.id=d."currentRevisionId" WHERE d.id=doc_id;
  FOR issue IN SELECT i."issueDocumentId",i."outstandingAmount" FROM dms.invoice_balance i
    JOIN dms.document d ON d.id=i."issueDocumentId"
    WHERE i."agencyId"=agency_id AND i."outstandingAmount">0
    ORDER BY i."businessDate",d."businessOrder" LOOP
    allocated := least(remaining,issue."outstandingAmount");
    IF allocated>0 THEN PERFORM pg_temp.allocate(doc_id,issue."issueDocumentId",allocated,entry_kind); END IF;
    remaining := remaining-allocated;
    EXIT WHEN remaining=0;
  END LOOP;
  RETURN remaining;
END $$;

CREATE FUNCTION pg_temp.post_stock(doc_id bigint) RETURNS void LANGUAGE plpgsql AS $$
DECLARE d dms.document%ROWTYPE; r dms.document_revision%ROWTYPE; batch_id bigint;
  confirmation_id bigint; receipt_id bigint;
BEGIN
  SELECT * INTO STRICT d FROM dms.document WHERE id=doc_id;
  SELECT * INTO STRICT r FROM dms.document_revision WHERE id=d."currentRevisionId";
  IF d.kind='STOCK_ISSUE' AND r.state='DRAFT' THEN PERFORM pg_temp.ready(doc_id); END IF;
  IF r."immediatePayment">0 THEN
    INSERT INTO dms.upfront_confirmation ("issueRevisionId",amount,method,"receivedAt",
      "verifiedBy","evidenceReference") VALUES
      (r.id,r."immediatePayment",'CASH',clock_timestamp(),pg_temp.actor(),'DEMO-CASH-'||doc_id)
      RETURNING id INTO confirmation_id;
  END IF;
  UPDATE dms.document SET status='POSTED' WHERE id=doc_id RETURNING * INTO d;
  UPDATE dms.document_revision SET state='POSTED',"postedBy"=pg_temp.actor(),"postedAt"=clock_timestamp()
    WHERE id=d."currentRevisionId" RETURNING * INTO r;
  INSERT INTO dms.posting_batch ("revisionId",kind,"idempotencyKey","createdBy")
    VALUES (r.id,'POST',gen_random_uuid(),pg_temp.actor()) RETURNING id INTO batch_id;
  INSERT INTO dms.inventory_entry ("batchId","lineId","productId","unitId",quantity,"businessDate","businessOrder")
    SELECT batch_id,id,"productId","unitId",quantity*CASE WHEN d.kind='STOCK_ISSUE' THEN -1 ELSE 1 END,
      r."businessDate",d."businessOrder" FROM dms.document_line WHERE "revisionId"=r.id;
  IF d.kind='STOCK_ISSUE' THEN
    INSERT INTO dms.receivable_entry ("batchId","agencyId","issueDocumentId",kind,amount,"businessDate","businessOrder")
      VALUES (batch_id,d."agencyId",doc_id,'CHARGE',r."totalAmount",r."businessDate",d."businessOrder");
  END IF;
  IF r."immediatePayment">0 THEN
    receipt_id := pg_temp.financial('PAYMENT_RECEIPT',d."agencyId",r."businessDate",r."immediatePayment",
      'CASH','AUTO_FROM_ISSUE',doc_id,gen_random_uuid());
    PERFORM pg_temp.allocate(receipt_id,doc_id,r."immediatePayment");
    UPDATE dms.upfront_confirmation SET state='CONSUMED',"receiptDocumentId"=receipt_id WHERE id=confirmation_id;
  END IF;
END $$;

CREATE FUNCTION pg_temp.credit(doc_id bigint, origin_receipt_id bigint, value numeric)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE lot_id bigint; d dms.document%ROWTYPE; r dms.document_revision%ROWTYPE;
BEGIN
  SELECT * INTO STRICT d FROM dms.document WHERE id=doc_id;
  SELECT * INTO STRICT r FROM dms.document_revision WHERE id=d."currentRevisionId";
  INSERT INTO dms.credit_lot ("agencyId","sourceRevisionId","originReceiptId")
    VALUES (d."agencyId",r.id,origin_receipt_id) RETURNING id INTO lot_id;
  INSERT INTO dms.credit_entry ("batchId","agencyId","lotId",kind,amount,"businessDate","businessOrder")
    SELECT id,d."agencyId",lot_id,'CREATED',value,r."businessDate",d."businessOrder"
      FROM dms.posting_batch WHERE "revisionId"=r.id AND kind='POST';
  RETURN lot_id;
END $$;

CREATE FUNCTION pg_temp.use_credit(doc_id bigint, lot_id bigint, value numeric, entry_kind text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO dms.credit_entry ("batchId","agencyId","lotId",kind,amount,"businessDate","businessOrder")
    SELECT b.id,d."agencyId",lot_id,entry_kind,-value,r."businessDate",d."businessOrder"
    FROM dms.document d JOIN dms.document_revision r ON r.id=d."currentRevisionId"
    JOIN dms.posting_batch b ON b."revisionId"=r.id AND b.kind='POST' WHERE d.id=doc_id;
END $$;

CREATE FUNCTION pg_temp.reverse_stock(doc_id bigint, cancel_now boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE rev_id bigint; batch_id bigint;
BEGIN
  SELECT "currentRevisionId" INTO rev_id FROM dms.document WHERE id=doc_id;
  INSERT INTO dms.posting_batch ("revisionId",kind,"idempotencyKey","createdBy")
    VALUES (rev_id,'REVERSE',gen_random_uuid(),pg_temp.actor()) RETURNING id INTO batch_id;
  INSERT INTO dms.inventory_entry ("batchId","lineId","productId","unitId",quantity,
    "businessDate","businessOrder","reversesEntryId")
    SELECT batch_id,e."lineId",e."productId",e."unitId",-e.quantity,e."businessDate",e."businessOrder",e.id
    FROM dms.inventory_entry e JOIN dms.posting_batch b ON b.id=e."batchId"
    WHERE b."revisionId"=rev_id AND e."reversesEntryId" IS NULL
      AND NOT EXISTS (SELECT 1 FROM dms.inventory_entry x WHERE x."reversesEntryId"=e.id);
  IF cancel_now THEN
    UPDATE dms.document SET status='CANCELLED',"cancelledBy"=pg_temp.actor(),
      "cancelledAt"=clock_timestamp(),"cancelReason"='Hủy phiếu mẫu lập trùng'
      WHERE id=doc_id;
  END IF;
END $$;
