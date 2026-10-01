"""Seed a complete, transactional and repeatable Agentra demo on migrated PostgreSQL."""

import hashlib
import json
import secrets
from datetime import date
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from argon2 import PasswordHasher
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import build_engine
from app.db.verify import check_database

DEMO_USERS = [
    ("quanly@agentra.demo", "Nguyễn Minh Anh", "MANAGEMENT", "AgentraDemo!2026#QL", "ACTIVE"),
    ("kinhdoanh@agentra.demo", "Trần Thảo Nguyên", "SALES", "AgentraDemo!2026#KD", "ACTIVE"),
    ("kho@agentra.demo", "Huỳnh Gia Phúc", "WAREHOUSE", "AgentraDemo!2026#KHO", "ACTIVE"),
    ("ketoan@agentra.demo", "Nguyễn Thúy Ngân", "ACCOUNTING", "AgentraDemo!2026#KT", "ACTIVE"),
    ("kinhdoanh2@agentra.demo", "Lê Hoàng Nam", "SALES", "AgentraDemo!2026#KD2", "ACTIVE"),
    ("kho2@agentra.demo", "Phạm Thu Hà", "WAREHOUSE", "AgentraDemo!2026#KHO2", "ACTIVE"),
    ("ketoan2@agentra.demo", "Nguyễn Hà Minh Tuấn", "ACCOUNTING", "AgentraDemo!2026#KT2", "ACTIVE"),
    ("locked@agentra.demo", "Tài khoản đã khóa (mẫu)", "SALES", "AgentraDemo!2026#LOCK", "LOCKED"),
]
DISTRICTS = [
    "Quận 1",
    "Quận 3",
    "Quận 4",
    "Quận 5",
    "Quận 6",
    "Quận 7",
    "Quận 8",
    "Quận 10",
    "Quận 11",
    "Quận 12",
    "Bình Thạnh",
    "Gò Vấp",
    "Phú Nhuận",
    "Tân Bình",
    "Tân Phú",
    "Bình Tân",
    "Thủ Đức",
    "Bình Chánh",
    "Hóc Môn",
    "Nhà Bè",
]
UNITS = [
    ("PIECE", "Cái", False),
    ("KG", "Kilôgam", True),
    ("LITRE", "Lít", True),
    ("BOX", "Hộp", False),
    ("PACK", "Gói", False),
    ("CARTON", "Thùng", False),
]
PRODUCTS = [
    ("Gạo thơm Jasmine", "KG", 22000),
    ("Gạo ST25", "KG", 35000),
    ("Đường tinh luyện", "KG", 21000),
    ("Đậu xanh tách vỏ", "KG", 38000),
    ("Dầu đậu nành", "LITRE", 42000),
    ("Nước mắm truyền thống", "LITRE", 65000),
    ("Sữa tươi tiệt trùng 1L", "BOX", 29000),
    ("Sữa đặc có đường", "BOX", 24000),
    ("Trà lài 100g", "PACK", 18000),
    ("Cà phê rang xay 250g", "PACK", 55000),
    ("Mì ăn liền thùng 30 gói", "CARTON", 95000),
    ("Bún khô 500g", "PACK", 16000),
    ("Bột mì đa dụng", "KG", 19000),
    ("Muối i-ốt 500g", "PACK", 5000),
    ("Nước rửa chén", "LITRE", 28000),
    ("Nước lau sàn", "LITRE", 32000),
    ("Khăn giấy hộp", "BOX", 14000),
    ("Túi rác cuộn", "PACK", 12000),
    ("Bàn chải đánh răng", "PIECE", 18000),
    ("Xà phòng thơm", "PIECE", 11000),
    ("Bánh quy bơ 300g", "BOX", 45000),
    ("Trà sen 100g (ngừng bán)", "PACK", 25000),
    ("Bình nước 750ml (sắp mở bán)", "PIECE", 70000),
    ("Nước giặt đậm đặc", "LITRE", 48000),
]
SEED_KEY = uuid5(NAMESPACE_URL, "agentra-demo-v1:stock:0")


class DemoSeed:
    def __init__(self, connection):
        self.connection = connection
        self.serial = 0
        self.users = {}
        self.agencies = []
        self.products = []

    def query(self, sql: str, **params):
        return self.connection.execute(text(sql), params)

    def key(self, kind: str):
        result = uuid5(NAMESPACE_URL, f"agentra-demo-v1:{kind}:{self.serial}")
        self.serial += 1
        return result

    def actor(self, group: str, function: str) -> None:
        self.query(
            """
            SELECT set_config('dms.actor_id',:actor,true),
              set_config('dms.function_code',:function,true),
              set_config('dms.request_id','agentra-demo-v1',true)
        """,
            actor=str(self.users[group]),
            function=function,
        )

    def flush(self) -> None:
        self.query("SELECT pg_temp.flush_checks()")

    def catalog(self) -> None:
        hasher = PasswordHasher()
        for email, name, group, password, status in DEMO_USERS:
            user_id = self.query(
                """
                INSERT INTO dms.app_user ("fullName",email,"passwordHash","groupId",status)
                SELECT :name,:email,:password,id,:status FROM dms.user_group WHERE code=:group
                RETURNING id
            """,
                name=name,
                email=email,
                password=hasher.hash(password),
                group=group,
                status=status,
            ).scalar_one()
            self.users.setdefault(group, user_id)
            # Only digests of unissued random tokens, all revoked: no live demo sessions.
            for purpose in ("REFRESH", "PASSWORD_RESET"):
                self.query(
                    """
                    INSERT INTO dms.auth_token
                      ("userId",purpose,"tokenDigest","expiresAt","revokedAt")
                    VALUES (:user,:purpose,:digest,
                      clock_timestamp()+interval '1 day',clock_timestamp())
                """,
                    user=user_id,
                    purpose=purpose,
                    digest=hashlib.sha256(secrets.token_bytes(32)).digest(),
                )
        self.actor("MANAGEMENT", "district.manage")
        district_ids = [
            self.query(
                """
            INSERT INTO dms.district (code,name) VALUES (:code,:name) RETURNING id
        """,
                code=f"DISTRICT_{i + 1:02}",
                name=name,
            ).scalar_one()
            for i, name in enumerate(DISTRICTS)
        ]
        self.actor("MANAGEMENT", "unit.manage")
        unit_ids = {
            code: self.query(
                """
            INSERT INTO dms.unit (code,name,"allowsFraction")
            VALUES (:code,:name,:fraction) RETURNING id
        """,
                code=code,
                name=name,
                fraction=fraction,
            ).scalar_one()
            for code, name, fraction in UNITS
        }
        self.actor("WAREHOUSE", "product.manage")
        for name, unit, _ in PRODUCTS:
            self.products.append(
                self.query(
                    """
                INSERT INTO dms.product (name,"unitId","lowStockThreshold")
                VALUES (:name,:unit,25) RETURNING id
            """,
                    name=name,
                    unit=unit_ids[unit],
                ).scalar_one()
            )
        self.actor("SALES", "agency.manage")
        names = [
            "An Phát",
            "Minh Châu",
            "Bình Minh",
            "Hưng Thịnh",
            "Phúc Lộc",
            "Kim Ngân",
            "Thanh Tâm",
            "Hải Đăng",
            "Ngọc Lan",
            "Thiên Phú",
            "Gia Hưng",
            "Hoàng Mai",
            "Đông Á",
            "Việt Thành",
            "Tân Tiến",
        ]
        for i in range(30):
            name = f"Đại lý {names[i % len(names)]}"  # Intentional names repeated across districts.
            self.agencies.append(
                self.query(
                    """
                INSERT INTO dms.agency (name,"typeId","districtId",phone,address,email,
                  "acceptedDate","createdBy","updatedBy")
                SELECT :name,id,:district,:phone,:address,:email,'2026-01-05',:actor,:actor
                FROM dms.agency_type WHERE code=:type RETURNING id
            """,
                    name=name,
                    district=district_ids[i // 3],
                    phone=f"0901{i + 1:06}",
                    address=f"{20 + i * 7} Đường số {i % 8 + 1}, {DISTRICTS[i // 3]}, TP.HCM (mẫu)",
                    email=f"daily{i + 1:02}@agentra.demo",
                    actor=self.users["SALES"],
                    type="TYPE_1" if i % 2 == 0 else "TYPE_2",
                ).scalar_one()
            )

    def stock(
        self,
        kind: str,
        day: date,
        lines: list,
        agency=None,
        origin=None,
        state="POSTED",
        immediate=0,
    ) -> int:
        group, function = {
            "STOCK_RECEIPT": ("WAREHOUSE", "stock.receipt.post"),
            "STOCK_ISSUE": ("SALES", "stock.issue.prepare"),
            "SALES_RETURN": ("WAREHOUSE", "returns.post"),
            "STOCK_ADJUSTMENT": ("MANAGEMENT", "stock.adjustment.post"),
        }[kind]
        self.actor(group, function)
        doc_id = self.query(
            """
            SELECT pg_temp.stock_draft(:kind,:agency,:day,CAST(:lines AS jsonb),:key,:origin)
        """,
            kind=kind,
            agency=agency,
            day=day,
            lines=json.dumps(lines),
            key=self.key("stock"),
            origin=origin,
        ).scalar_one()
        if kind == "STOCK_ISSUE" and state != "DRAFT":
            self.query("SELECT pg_temp.ready(:doc,:immediate)", doc=doc_id, immediate=immediate)
        if state == "POSTED":
            self.actor(
                "WAREHOUSE" if kind == "STOCK_ISSUE" else group,
                "stock.issue.post" if kind == "STOCK_ISSUE" else function,
            )
            self.query("SELECT pg_temp.post_stock(:doc)", doc=doc_id)
        return doc_id

    def financial(
        self,
        kind,
        agency,
        day,
        amount,
        method=None,
        receipt="DEBT_COLLECTION",
        origin=None,
        post=True,
    ):
        self.actor(
            "ACCOUNTING",
            "credit.apply"
            if kind == "CREDIT_APPLICATION"
            else "cash.refund.post"
            if kind == "REFUND"
            else "cash.receipt.post",
        )
        return self.query(
            """
            SELECT pg_temp.financial(:kind,:agency,:day,:amount,:method,:receipt,:origin,:key,:post)
        """,
            kind=kind,
            agency=agency,
            day=day,
            amount=amount,
            method=method,
            receipt=receipt if kind == "PAYMENT_RECEIPT" else None,
            origin=origin,
            key=self.key("financial"),
            post=post,
        ).scalar_one()

    def debt(self, agency):
        return self.query(
            'SELECT "currentDebt" FROM dms.agency_balance WHERE "agencyId"=:id', id=agency
        ).scalar_one()

    def collect(self, agency, day, amount, method="BANK_TRANSFER"):
        doc = self.financial("PAYMENT_RECEIPT", agency, day, amount, method)
        remaining = self.query("SELECT pg_temp.fifo(:doc)", doc=doc).scalar_one()
        if remaining:
            raise RuntimeError("A manual receipt must not exceed outstanding debt")
        self.flush()
        return doc

    def online_pending(self, agency, amount):
        self.actor("ACCOUNTING", "payments.online")
        key = self.key("payment")
        return self.query(
            """
            INSERT INTO dms.online_payment ("agencyId",provider,"merchantReference",
              "idempotencyKey",amount,"expiresAt","createdBy")
            VALUES (:agency,'DEMO_SANDBOX',:reference,:key,:amount,
              clock_timestamp()+interval '1 day',:actor) RETURNING id
        """,
            agency=agency,
            reference=f"DEMO-{key}",
            key=key,
            amount=amount,
            actor=self.users["ACCOUNTING"],
        ).scalar_one()

    def online_success(self, payment, day):
        row = (
            self.query("SELECT * FROM dms.online_payment WHERE id=:id", id=payment).mappings().one()
        )
        receipt = self.financial("PAYMENT_RECEIPT", row["agencyId"], day, row["amount"], "ONLINE")
        excess = self.query("SELECT pg_temp.fifo(:doc)", doc=receipt).scalar_one()
        lot = None
        if excess:
            lot = self.query(
                "SELECT pg_temp.credit(:doc,:doc,:amount)", doc=receipt, amount=excess
            ).scalar_one()
        self.actor("ACCOUNTING", "payments.online")
        self.query(
            """
            INSERT INTO dms.payment_event
              ("paymentId","eventKey","providerStatus","verifiedPayload")
            VALUES (:id,:event,'SUCCESS',
              jsonb_build_object('demo',true,'simulatedVerification',true))
        """,
            id=payment,
            event=f"DEMO-SUCCESS-{payment}",
        )
        self.query(
            """
            UPDATE dms.online_payment SET status='SUCCESS',"providerTransactionId"=:reference,
              "paymentTime"=clock_timestamp(),"receiptDocumentId"=:receipt WHERE id=:id
        """,
            id=payment,
            reference=f"DEMO-TXN-{payment}",
            receipt=receipt,
        )
        self.flush()
        return receipt, lot

    def trading_history(self):
        # One round trip per month; trigger checks still run after each business event.
        self.serial = 1  # stock:0 is the committed dataset marker created in SQL below.
        for month in range(6, 10):
            self.query(
                """SELECT pg_temp.trading_month(:month,CAST(:agencies AS bigint[]),
                  CAST(:products AS bigint[]),CAST(:prices AS integer[]),
                  :sales,:warehouse,:accounting,:key)""",
                month=month,
                agencies=self.agencies,
                products=self.products,
                prices=[row[2] for row in PRODUCTS],
                sales=self.users["SALES"],
                warehouse=self.users["WAREHOUSE"],
                accounting=self.users["ACCOUNTING"],
                key=SEED_KEY,
            )
            print(f"Prepared trading history: 2026-{month:02}", flush=True)

    def credit_scenarios(self):
        # A late successful callback receives real (simulated) money after cash cleared debt.
        agency = self.agencies[0]
        amount = self.debt(agency)
        payment = self.online_pending(agency, amount)
        self.collect(agency, date(2026, 9, 21), amount, "CASH")
        receipt, lot = self.online_success(payment, date(2026, 9, 22))
        self.stock(
            "STOCK_ISSUE",
            date(2026, 9, 23),
            [
                {"product": self.products[0], "quantity": 1},
                {"product": self.products[1], "quantity": 1},
            ],
            agency,
        )
        self.flush()
        offset_amount = self.debt(agency)
        offset = self.financial("CREDIT_APPLICATION", agency, date(2026, 9, 24), offset_amount)
        self.query("SELECT pg_temp.fifo(:doc,'CREDIT')", doc=offset)
        self.query(
            "SELECT pg_temp.use_credit(:doc,:lot,:amount,'OFFSET')",
            doc=offset,
            lot=lot,
            amount=offset_amount,
        )
        self.flush()
        # Paid sale returned: credit retains the original receipt cash provenance.
        invoice = self.query(
            """
            SELECT d.id FROM dms.document d
            JOIN dms.document_revision r ON r.id=d."currentRevisionId"
            WHERE d."agencyId"=:agency AND d.kind='STOCK_ISSUE' AND d.status='POSTED'
              AND r."businessDate"='2026-09-12' ORDER BY d.id LIMIT 1
        """,
            agency=agency,
        ).scalar_one()
        line = (
            self.query(
                """
            SELECT l.* FROM dms.document d
            JOIN dms.document_line l ON l."revisionId"=d."currentRevisionId"
            WHERE d.id=:id ORDER BY l."lineNo" LIMIT 1
        """,
                id=invoice,
            )
            .mappings()
            .one()
        )
        returned = self.stock(
            "SALES_RETURN",
            date(2026, 9, 25),
            [
                {
                    "product": line["productId"],
                    "quantity": 1,
                    "price": str(line["unitPrice"]),
                    "originLine": line["id"],
                    "returnAmount": str(line["unitPrice"]),
                }
            ],
            agency,
            invoice,
        )
        cash_source = self.query(
            """
            SELECT d.id FROM dms.document d
            JOIN dms.document_revision r ON r.id=d."currentRevisionId"
            WHERE d."agencyId"=:agency AND d.kind='PAYMENT_RECEIPT'
              AND r."businessDate"='2026-09-21'
        """,
            agency=agency,
        ).scalar_one()
        return_lot = self.query(
            "SELECT pg_temp.credit(:doc,:receipt,:amount)",
            doc=returned,
            receipt=cash_source,
            amount=line["unitPrice"],
        ).scalar_one()
        self.flush()
        # Successful, pending, unknown and failed online refunds with correct reservations.
        for state, value in (
            ("SUCCESS", 10000),
            ("PENDING", 5000),
            ("UNKNOWN", 5000),
            ("FAILED", 5000),
        ):
            refund = self.financial(
                "REFUND", agency, date(2026, 9, 26), value, "ONLINE", origin=receipt, post=False
            )
            revision = self.query(
                'SELECT "currentRevisionId" FROM dms.document WHERE id=:id', id=refund
            ).scalar_one()
            self.query(
                """
                INSERT INTO dms.refund_reservation ("refundRevisionId","lotId",amount)
                VALUES (:revision,:lot,:amount)
            """,
                revision=revision,
                lot=lot,
                amount=value,
            )
            attempt = self.query(
                """
                INSERT INTO dms.refund_attempt
                  ("refundRevisionId","onlinePaymentId","idempotencyKey",
                  "merchantRefundReference",amount)
                VALUES (:revision,:payment,:key,:ref,:amount) RETURNING id
            """,
                revision=revision,
                payment=payment,
                key=self.key("refund"),
                ref=f"DEMO-REFUND-{refund}",
                amount=value,
            ).scalar_one()
            if state in ("SUCCESS", "FAILED"):
                self.query(
                    """
                    UPDATE dms.refund_attempt SET state=:state,"completedAt"=clock_timestamp(),
                      "providerRefundId"=:proof,"verifiedResponse"=jsonb_build_object('demo',true),
                      "failureReason"=:reason WHERE id=:id
                """,
                    state=state,
                    proof=f"DEMO-REFUND-TXN-{attempt}" if state == "SUCCESS" else None,
                    reason="Provider mô phỏng từ chối" if state == "FAILED" else None,
                    id=attempt,
                )
                if state == "SUCCESS":
                    self.post_refund(refund, revision, lot, value)
                else:
                    self.query(
                        """
                        UPDATE dms.refund_reservation SET state='RELEASED'
                        WHERE "refundRevisionId"=:id
                    """,
                        id=revision,
                    )
            elif state == "UNKNOWN":
                self.query(
                    """
                    UPDATE dms.refund_attempt SET state='UNKNOWN',
                      "failureReason"='Mô phỏng timeout; cần đối soát'
                    WHERE id=:id
                """,
                    id=attempt,
                )
            self.flush()
        # Cash refund of a paid return: reserve then consume when posting.
        value = line["unitPrice"] // 2
        refund = self.financial(
            "REFUND", agency, date(2026, 9, 27), value, "CASH", origin=cash_source, post=False
        )
        revision = self.query(
            'SELECT "currentRevisionId" FROM dms.document WHERE id=:id', id=refund
        ).scalar_one()
        self.query(
            """
            INSERT INTO dms.refund_reservation ("refundRevisionId","lotId",amount)
            VALUES (:rev,:lot,:amount)
        """,
            rev=revision,
            lot=return_lot,
            amount=value,
        )
        self.post_refund(refund, revision, return_lot, value)
        self.flush()

    def post_refund(self, doc, revision, lot, value):
        self.query("UPDATE dms.document SET status='POSTED' WHERE id=:id", id=doc)
        self.query(
            """
            UPDATE dms.document_revision SET state='POSTED',"postedBy"=pg_temp.actor(),
              "postedAt"=clock_timestamp() WHERE id=:id
        """,
            id=revision,
        )
        self.query(
            """
            INSERT INTO dms.posting_batch ("revisionId",kind,"idempotencyKey","createdBy")
            VALUES (:rev,'POST',:key,pg_temp.actor())
        """,
            rev=revision,
            key=self.key("batch"),
        )
        self.query(
            "SELECT pg_temp.use_credit(:doc,:lot,:amount,'REFUND')", doc=doc, lot=lot, amount=value
        )
        self.query(
            """
            UPDATE dms.refund_reservation SET state='CONSUMED' WHERE "refundRevisionId"=:id
        """,
            id=revision,
        )

    def queues_and_history(self):
        self.actor("ACCOUNTING", "payments.online")
        for i, state in enumerate(("PENDING", "FAILED", "EXPIRED")):
            payment = self.online_pending(self.agencies[i + 1], 10000)
            if state != "PENDING":
                self.query(
                    """
                    UPDATE dms.online_payment SET status=:state WHERE id=:id
                """,
                    state=state,
                    id=payment,
                )
                self.query(
                    """
                    INSERT INTO dms.payment_event
                      ("paymentId","eventKey","providerStatus","verifiedPayload")
                    VALUES (:id,:key,:state,jsonb_build_object('demo',true))
                """,
                    id=payment,
                    key=f"DEMO-{state}-{payment}",
                    state=state,
                )
        for i in range(6):
            self.stock(
                "STOCK_ISSUE",
                date(2026, 9, 28),
                [
                    {"product": self.products[i], "quantity": 3},
                    {"product": self.products[i + 6], "quantity": 2},
                ],
                self.agencies[i + 2],
                state="DRAFT" if i < 3 else "PENDING",
            )
        # Verified upfront cash not yet attached to a receipt, visible to accounting.
        pending = self.stock(
            "STOCK_ISSUE",
            date(2026, 9, 28),
            [{"product": self.products[0], "quantity": 5}],
            self.agencies[9],
            state="PENDING",
            immediate=10000,
        )
        self.actor("ACCOUNTING", "cash.upfront.verify")
        self.query(
            """
            INSERT INTO dms.upfront_confirmation ("issueRevisionId",amount,method,"receivedAt",
              "verifiedBy","evidenceReference") SELECT "currentRevisionId",10000,'BANK_TRANSFER',
              clock_timestamp(),pg_temp.actor(),'DEMO-UPFRONT-PENDING'
              FROM dms.document WHERE id=:id
        """,
            id=pending,
        )
        for i in range(2):
            self.stock(
                "STOCK_RECEIPT",
                date(2026, 9, 29),
                [{"product": self.products[i], "quantity": 100, "price": PRODUCTS[i][2]}],
                state="DRAFT",
            )
        cancelled = self.stock(
            "STOCK_RECEIPT",
            date(2026, 9, 29),
            [{"product": self.products[0], "quantity": 5, "price": 25000}],
        )
        self.flush()
        self.actor("MANAGEMENT", "documents.cancel")
        self.query("SELECT pg_temp.reverse_stock(:id)", id=cancelled)
        self.flush()
        corrected = self.stock(
            "STOCK_RECEIPT",
            date(2026, 9, 29),
            [{"product": self.products[0], "quantity": 10, "price": 25000}],
        )
        self.flush()
        self.actor("MANAGEMENT", "documents.correct")
        self.query("SELECT pg_temp.reverse_stock(:id,false)", id=corrected)
        revision = self.query(
            """
            INSERT INTO dms.document_revision
              ("documentId","revisionNo","businessDate","totalAmount",
              reason,note,"createdBy") VALUES (:doc,2,'2026-09-29',300000,
              'Sửa số lượng từ 10 thành 12 theo biên bản nhận hàng',
              'Agentra demo v1',pg_temp.actor()) RETURNING id
        """,
            doc=corrected,
        ).scalar_one()
        self.query(
            """
            INSERT INTO dms.document_line ("revisionId","lineNo","productId","unitId","productName",
              "unitName",quantity,"unitPrice") SELECT :rev,1,p.id,u.id,p.name,u.name,12,25000
              FROM dms.product p JOIN dms.unit u ON u.id=p."unitId" WHERE p.id=:product
        """,
            rev=revision,
            product=self.products[0],
        )
        self.query(
            'UPDATE dms.document SET "currentRevisionId"=:rev WHERE id=:doc',
            rev=revision,
            doc=corrected,
        )
        self.query("SELECT pg_temp.post_stock(:doc)", doc=corrected)
        self.flush()
        self.actor("SALES", "agency.manage")
        for agency in self.agencies[25:27]:
            self.query(
                """
                UPDATE dms.agency SET status='TERMINATED',"terminatedAt"=clock_timestamp(),
                  "terminationReason"='Kết thúc hợp tác theo đề nghị đại lý (mẫu)',
                  "updatedBy"=pg_temp.actor()
                WHERE id=:id
            """,
                id=agency,
            )
        # Collection remains allowed for a terminated agency.
        self.collect(self.agencies[25], date(2026, 9, 30), 10000, "CASH")
        self.actor("WAREHOUSE", "product.manage")
        self.query("UPDATE dms.product SET status='INACTIVE' WHERE id=:id", id=self.products[21])
        self.actor("MANAGEMENT", "district.manage")
        self.query("UPDATE dms.district SET status='INACTIVE' WHERE code='DISTRICT_20'")
        self.flush()

    def stock_counts(self):
        # Confirmed with differences, confirmed without differences, and draft count.
        for mode in ("adjusted", "balanced", "draft"):
            self.actor("WAREHOUSE", "stock.count")
            count = self.query(
                """
                INSERT INTO dms.stock_count ("countedAt","createdBy",reason)
                VALUES (clock_timestamp(),pg_temp.actor(),:reason) RETURNING id
            """,
                reason=f"Kiểm kê mẫu cuối tháng 09/2026 — {mode}",
            ).scalar_one()
            changes = []
            for i, product in enumerate(self.products[:12]):
                difference = (2 if i == 0 else -1 if i == 1 else 0) if mode == "adjusted" else 0
                self.query(
                    """
                    INSERT INTO dms.stock_count_line ("countId","productId","unitId","bookQuantity",
                      "countedQuantity","observedLastEntryId")
                    SELECT :count,p.id,p."unitId",b."currentStock",b."currentStock"+:delta,
                      (SELECT max(id) FROM dms.inventory_entry WHERE "productId"=p.id)
                    FROM dms.product p JOIN dms.inventory_balance b ON b."productId"=p.id
                    WHERE p.id=:product
                """,
                    count=count,
                    product=product,
                    delta=difference,
                )
                if difference:
                    changes.append({"product": product, "quantity": difference, "price": 0})
            if mode != "draft":
                adjustment = (
                    self.stock("STOCK_ADJUSTMENT", date(2026, 9, 30), changes, state="DRAFT")
                    if changes
                    else None
                )
                self.actor("MANAGEMENT", "stock.count")
                self.query(
                    """
                    UPDATE dms.stock_count SET state='CONFIRMED',"confirmedBy"=pg_temp.actor(),
                      "confirmedAt"=clock_timestamp(),"adjustmentDocumentId"=:adjustment
                    WHERE id=:id
                """,
                    id=count,
                    adjustment=adjustment,
                )
                if adjustment:
                    self.query("SELECT pg_temp.post_stock(:doc)", doc=adjustment)
            self.flush()


def main() -> None:
    engine = build_engine(get_settings().database_url())
    try:
        with engine.begin() as connection:
            connection.exec_driver_sql("SELECT pg_advisory_xact_lock(20261001,1)")
            version = connection.exec_driver_sql(
                "SELECT version_num FROM public.alembic_version"
            ).scalar_one()
            if version != "0002":
                raise RuntimeError("Run alembic upgrade head before seeding (expected 0002)")
            exists = connection.execute(
                text('SELECT id FROM dms.document WHERE "creationKey"=:key'), {"key": SEED_KEY}
            ).scalar_one_or_none()
            if exists:
                counts = check_database(connection, seeded=True)
                print("Demo v1 already seeded; verified existing data, no changes.")
            else:
                for table in ("app_user", "agency", "product", "district", "unit", "document"):
                    if connection.exec_driver_sql(
                        f'SELECT EXISTS (SELECT 1 FROM dms."{table}")'
                    ).scalar_one():
                        raise RuntimeError(
                            f"Unrecognized existing data in {table}; "
                            "seed requires an empty demo database"
                        )
                with connection.connection.driver_connection.cursor() as cursor:
                    cursor.execute(
                        (Path(__file__).parent / "sql" / "seed_helpers.sql").read_text(
                            encoding="utf-8"
                        ),
                        prepare=False,
                    )
                seed = DemoSeed(connection)
                seed.catalog()
                seed.trading_history()
                seed.credit_scenarios()
                seed.queues_and_history()
                seed.stock_counts()
                seed.flush()
                counts = check_database(connection, seeded=True)
        # Print success only AFTER the transaction has committed.
        print("PASS: Agentra demo v1 committed and verified.")
        for table, count in counts.items():
            print(f"{table}: {count}")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
