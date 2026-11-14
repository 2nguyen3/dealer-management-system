"""Fixed business data of seed v2 (handoff 6): staff, catalogue, agencies and events.

Agency and store names are fictional. Products carry real brands, as a distributor's
catalogue does. Streets were chosen to lie inside the named 2025 ward/commune.
"""

from datetime import date
from decimal import Decimal

# email, full name, group, password, status, account created (local date)
USERS = [
    (
        "thaonguyen@agentra.vn",
        "Nguyễn Trần Thảo Nguyên",
        "MANAGEMENT",
        "Agentra@2026#QuanLy1",
        "ACTIVE",
    ),
    ("minhtuan@agentra.vn", "Nguyễn Hà Minh Tuấn", "SALES", "Agentra@2026#KinhDoanh1", "ACTIVE"),
    ("giaphuc@agentra.vn", "Huỳnh Gia Phúc", "WAREHOUSE", "Agentra@2026#Kho1", "ACTIVE"),
    ("thuyngan@agentra.vn", "Nguyễn Thúy Ngân", "ACCOUNTING", "Agentra@2026#KeToan1", "ACTIVE"),
    ("hoangnam@agentra.vn", "Lê Hoàng Nam", "SALES", "Agentra@2026#KinhDoanh2", "ACTIVE"),
    ("myduyen@agentra.vn", "Võ Thị Mỹ Duyên", "SALES", "Agentra@2026#KinhDoanh3", "ACTIVE"),
    ("thuha@agentra.vn", "Phạm Thu Hà", "WAREHOUSE", "Agentra@2026#Kho2", "ACTIVE"),
    ("quocbao@agentra.vn", "Đặng Quốc Bảo", "WAREHOUSE", "Agentra@2026#Kho3", "ACTIVE"),
    ("ngochan@agentra.vn", "Trần Ngọc Hân", "ACCOUNTING", "Agentra@2026#KeToan2", "ACTIVE"),
    ("thanhtung@agentra.vn", "Bùi Thanh Tùng", "ACCOUNTING", "Agentra@2026#KeToan3", "ACTIVE"),
    ("vanluc@agentra.vn", "Phan Văn Lực", "SALES", "Agentra@2026#KinhDoanh4", "LOCKED"),
]
USER_CREATED = date(2025, 1, 6)
DUYEN_JOINED = date(2026, 8, 24)  # replaces Phan Văn Lực, who leaves at the end of August
LUC_LOCKED = date(2026, 8, 31)

# code, name, allows fraction
UNITS = [
    ("PIECE", "Cái", False),
    ("BOTTLE", "Chai", False),
    ("PACK", "Gói", False),
    ("BOX", "Hộp", False),
    ("CARTON", "Thùng", False),
    ("KG", "Kg", True),
    ("LITRE", "Lít", True),
    ("BAG", "Bịch", False),
]

# Supplier groups drive which products arrive together on one receipt.
# key, name, unit, group, purchase price, demand weight, line qty (low, high, step)
PRODUCTS = [
    ("hao_hao", "Mì Hảo Hảo tôm chua cay thùng 30 gói", "CARTON", "M", 112000, 10, (3, 20, 1)),
    ("omachi", "Mì Omachi xốt bò hầm thùng 30 gói", "CARTON", "M", 226000, 5, (2, 10, 1)),
    ("nam_ngu", "Nước mắm Nam Ngư 500ml", "BOTTLE", "M", 21500, 7, (12, 72, 12)),
    ("chinsu_mam", "Nước mắm Chinsu cá hồi 500ml", "BOTTLE", "M", 30500, 4, (12, 48, 12)),
    ("tuong_ot", "Tương ớt Chinsu chai 250g", "BOTTLE", "M", 12800, 5, (24, 96, 12)),
    ("knorr", "Hạt nêm Knorr thịt thăn xương ống 900g", "PACK", "U", 76000, 5, (6, 30, 6)),
    ("omo", "Bột giặt OMO Matic cửa trên 3kg", "BAG", "U", 168000, 5, (4, 20, 2)),
    ("comfort", "Nước xả vải Comfort đậm đặc túi 3,2 lít", "BAG", "U", 158000, 3, (2, 12, 2)),
    ("sunlight", "Nước rửa chén Sunlight chanh 750g", "BOTTLE", "U", 26500, 6, (12, 48, 12)),
    ("ps", "Kem đánh răng P/S bảo vệ 123 tuýp 230g", "PIECE", "U", 33000, 4, (12, 48, 12)),
    ("clear", "Dầu gội Clear mát lạnh bạc hà 630g", "BOTTLE", "U", 152000, 3, (3, 12, 3)),
    (
        "vinamilk",
        "Sữa tươi tiệt trùng Vinamilk có đường 180ml thùng 48 hộp",
        "CARTON",
        "V",
        345000,
        6,
        (2, 10, 1),
    ),
    ("ong_tho", "Sữa đặc Ông Thọ nhãn trắng hộp 380g", "BOX", "V", 25500, 5, (24, 96, 24)),
    ("coca", "Nước ngọt Coca-Cola lon 320ml thùng 24 lon", "CARTON", "B", 205000, 6, (2, 12, 1)),
    ("aquafina", "Nước suối Aquafina 500ml thùng 24 chai", "CARTON", "B", 96000, 5, (3, 15, 1)),
    ("khong_do", "Trà xanh Không Độ 455ml thùng 24 chai", "CARTON", "B", 172000, 4, (2, 10, 1)),
    (
        "number_one",
        "Nước tăng lực Number One 330ml thùng 24 chai",
        "CARTON",
        "B",
        230000,
        3,
        (2, 8, 1),
    ),
    ("simply", "Dầu ăn Simply đậu nành chai 1 lít", "BOTTLE", "C", 56000, 6, (12, 48, 12)),
    ("tuong_an", "Dầu ăn Tường An Cooking Oil chai 1 lít", "BOTTLE", "C", 45500, 5, (12, 48, 12)),
    ("duong", "Đường tinh luyện Biên Hòa gói 1kg", "PACK", "D", 27500, 6, (10, 50, 10)),
    ("duong_ky", "Đường cát trắng Biên Hòa (bán theo kg)", "KG", "D", 23800, 3, (5, 40, "0.5")),
    ("ajinomoto", "Bột ngọt Ajinomoto gói 1kg", "PACK", "D", 66000, 4, (5, 30, 5)),
    ("maggi", "Nước tương Maggi đậu nành chai 700ml", "BOTTLE", "D", 26000, 4, (12, 48, 12)),
    ("gao", "Gạo ST25 Ông Cua túi 5kg", "BAG", "E", 175000, 5, (2, 12, 1)),
    ("g7", "Cà phê G7 3in1 hộp 18 gói", "BOX", "E", 52000, 4, (6, 30, 6)),
    ("chocopie", "Bánh Chocopie Orion hộp 12 cái", "BOX", "E", 49000, 4, (6, 24, 6)),
    ("pulppy", "Giấy vệ sinh Pulppy Classic lốc 10 cuộn", "BAG", "E", 62000, 3, (4, 20, 2)),
    (
        "mam_pq",
        "Nước mắm truyền thống Phú Quốc 40 độ (bán theo lít)",
        "LITRE",
        "E",
        68000,
        2,
        (5, 30, "0.5"),
    ),
    ("trung_thu", "Bánh trung thu Kinh Đô hộp 4 cái 150g", "BOX", "E", 298000, 0, (4, 20, 2)),
    ("omo_long", "Nước giặt OMO Matic cửa trước túi 3,6kg", "BAG", "U", 0, 0, (2, 10, 2)),
]
PRODUCTS_CREATED = date(2026, 5, 25)
# Seasonal and late products: key -> created date
LATE_PRODUCTS = {"trung_thu": date(2026, 8, 3), "omo_long": date(2026, 11, 5)}
NEVER_RECEIVED = "omo_long"
# Discontinued products (status INACTIVE): last receipt date, clearance date, deactivation date
DISCONTINUED = {
    "number_one": (date(2026, 8, 20), date(2026, 9, 28), date(2026, 10, 1)),
    "trung_thu": (date(2026, 9, 16), date(2026, 9, 29), date(2026, 10, 2)),
}
MOONCAKE_SEASON = (date(2026, 8, 10), date(2026, 9, 25))
# Supplier price increases: key -> [(effective date, new purchase price)]
PRICE_CHANGES = {
    "coca": [(date(2026, 7, 6), 212000)],
    "hao_hao": [(date(2026, 8, 3), 116000)],
    "simply": [(date(2026, 9, 7), 59500)],
    "ong_tho": [(date(2026, 9, 21), 26500)],
    "duong": [(date(2026, 10, 5), 28900)],
    "vinamilk": [(date(2026, 11, 2), 352000)],
}

# Ward code -> real streets inside that ward/commune after the 2025 merger.
STREETS = {
    "26740": ["Lê Lợi", "Nguyễn Huệ", "Hàm Nghi", "Lý Tự Trọng"],
    "27139": ["Võ Văn Tần", "Trần Quốc Thảo", "Bà Huyện Thanh Quan"],
    "27265": ["Hoàng Diệu", "Tôn Đản", "Đoàn Văn Bơ"],
    "27343": ["Châu Văn Liêm", "Hải Thượng Lãn Ông", "Tản Đà"],
    "27364": ["Bình Phú", "Lý Chiêu Hoàng"],
    "27478": ["Huỳnh Tấn Phát", "Bùi Văn Ba"],
    "27418": ["Tạ Quang Bửu", "Phạm Thế Hiển"],
    "27169": ["Thành Thái", "Tô Hiến Thành"],
    "27238": ["Minh Phụng", "Lò Siêu"],
    "26791": ["Nguyễn Văn Quá"],
    "26929": ["Nơ Trang Long", "Bạch Đằng"],
    "26884": ["Quang Trung", "Nguyễn Văn Lượng"],
    "27073": ["Lê Văn Sỹ", "Huỳnh Văn Bánh", "Trần Huy Liệu", "Đặng Văn Ngữ"],
    "27004": ["Cộng Hòa", "Bàu Cát", "Trường Chinh"],
    "27031": ["Lũy Bán Bích", "Âu Cơ"],
    "27442": ["Mã Lò", "Lê Văn Quới"],
    "26824": ["Võ Văn Ngân", "Đặng Văn Bi", "Kha Vạn Cân"],
    "27637": ["Quốc lộ 1A", "Đinh Đức Thiện"],
    "27559": ["Lê Thị Hà", "Bà Triệu", "Trưng Nữ Vương"],
    "27655": ["Nguyễn Bình", "Lê Văn Lương"],
}

# Profiles: N normal, H near the debt limit at the end, Z settled to zero in November,
# X small negative debt (VNPAY success after a cash payment), U has never paid,
# T terminated after settling, W accepted recently and without transactions.
# name, ward code, type, street, accepted, profile, account manager, email
AGENCIES = [
    (
        "Tạp hóa Hồng Phúc",
        "27073",
        "TYPE_1",
        "Lê Văn Sỹ",
        "2025-03-10",
        "N",
        "minhtuan",
        "taphoahongphuc@gmail.com",
    ),
    (
        "Cửa hàng Bách hóa Kim Liên",
        "27073",
        "TYPE_2",
        "Huỳnh Văn Bánh",
        "2025-05-19",
        "N",
        "hoangnam",
        None,
    ),
    ("Tạp hóa Cô Ba Mai", "27073", "TYPE_2", "Trần Huy Liệu", "2025-08-04", "H", "minhtuan", None),
    (
        "Đại lý Thành Đạt",
        "27073",
        "TYPE_1",
        "Đặng Văn Ngữ",
        "2026-02-23",
        "N",
        "vanluc",
        "dailythanhdat.pn@gmail.com",
    ),
    (
        "Cửa hàng Minh Khang",
        "26740",
        "TYPE_2",
        "Lý Tự Trọng",
        "2025-04-14",
        "Z",
        "hoangnam",
        "cuahangminhkhang@gmail.com",
    ),
    (
        "NPP Phú Lộc",
        "27004",
        "TYPE_1",
        "Cộng Hòa",
        "2025-02-17",
        "H",
        "minhtuan",
        "npp.phuloc@gmail.com",
    ),
    ("Tạp hóa Minh Phát", "26884", "TYPE_2", "Nguyễn Văn Lượng", "2025-06-09", "N", "vanluc", None),
    ("Tạp hóa Minh Phát", "26824", "TYPE_2", "Đặng Văn Bi", "2026-01-12", "N", "hoangnam", None),
    (
        "Đại lý Tấn Lợi",
        "27442",
        "TYPE_1",
        "Mã Lò",
        "2025-07-21",
        "N",
        "vanluc",
        "tanloi.binhtan@gmail.com",
    ),
    ("Cửa hàng Thiên Ân", "27031", "TYPE_2", "Lũy Bán Bích", "2025-09-08", "N", "hoangnam", None),
    ("Tạp hóa Bảo Ngọc", "27139", "TYPE_2", "Trần Quốc Thảo", "2025-10-13", "N", "minhtuan", None),
    (
        "Đại lý Hưng Thịnh",
        "27343",
        "TYPE_1",
        "Hải Thượng Lãn Ông",
        "2025-03-24",
        "N",
        "hoangnam",
        "hungthinh.cholon@gmail.com",
    ),
    ("Tạp hóa Thanh Tâm", "27265", "TYPE_2", "Tôn Đản", "2025-11-03", "Z", "minhtuan", None),
    ("Cửa hàng Phước Lộc", "27364", "TYPE_1", "Bình Phú", "2025-06-30", "N", "vanluc", None),
    ("Tạp hóa Út Hiền", "27478", "TYPE_2", "Bùi Văn Ba", "2025-12-08", "N", "hoangnam", None),
    (
        "Đại lý Kim Ngân",
        "27418",
        "TYPE_1",
        "Tạ Quang Bửu",
        "2025-04-28",
        "N",
        "minhtuan",
        "dailykimngan@gmail.com",
    ),
    (
        "Tạp hóa Diệu Linh",
        "27169",
        "TYPE_2",
        "Tô Hiến Thành",
        "2026-01-26",
        "X",
        "hoangnam",
        "taphoadieulinh@gmail.com",
    ),
    ("Cửa hàng Vạn Phát", "27238", "TYPE_1", "Lò Siêu", "2025-08-18", "N", "vanluc", None),
    ("Tạp hóa Ngọc Trâm", "26791", "TYPE_2", "Nguyễn Văn Quá", "2026-03-09", "N", "minhtuan", None),
    ("Đại lý Quốc Thắng", "26929", "TYPE_1", "Nơ Trang Long", "2025-05-05", "H", "hoangnam", None),
    ("Tạp hóa Chị Tư Lan", "26884", "TYPE_2", "Quang Trung", "2025-10-27", "N", "minhtuan", None),
    ("Cửa hàng Hòa Bình", "27004", "TYPE_2", "Bàu Cát", "2026-04-13", "N", "vanluc", None),
    (
        "Đại lý Song Toàn",
        "27637",
        "TYPE_1",
        "Quốc lộ 1A",
        "2025-09-22",
        "N",
        "hoangnam",
        "songtoan.binhchanh@gmail.com",
    ),
    ("Tạp hóa Bà Sáu", "27559", "TYPE_2", "Lê Thị Hà", "2025-12-22", "N", "minhtuan", None),
    ("Đại lý Phát Đạt", "27655", "TYPE_1", "Nguyễn Bình", "2026-02-09", "N", "hoangnam", None),
    ("Tạp hóa Hạnh Dung", "26824", "TYPE_2", "Võ Văn Ngân", "2026-05-18", "Z", "minhtuan", None),
    (
        "Cửa hàng Tâm Đức",
        "26740",
        "TYPE_1",
        "Hàm Nghi",
        "2025-07-07",
        "N",
        "vanluc",
        "cuahangtamduc@gmail.com",
    ),
    ("Tạp hóa Hoàng Oanh", "27655", "TYPE_2", "Lê Văn Lương", "2026-07-14", "N", "hoangnam", None),
    ("Tạp hóa Thu Trang", "27442", "TYPE_2", "Lê Văn Quới", "2026-08-24", "U", "myduyen", None),
    ("Đại lý Vĩnh Hưng", "27031", "TYPE_1", "Âu Cơ", "2025-06-16", "T", "vanluc", None),
    ("Tạp hóa Mỹ Châu", "27343", "TYPE_2", "Châu Văn Liêm", "2025-11-17", "T", "hoangnam", None),
    (
        "Cửa hàng Gia Bảo",
        "27559",
        "TYPE_2",
        "Bà Triệu",
        "2026-10-06",
        "W",
        "myduyen",
        "cuahanggiabao@gmail.com",
    ),
    ("Tạp hóa Kim Yến", "27139", "TYPE_2", "Võ Văn Tần", "2026-10-19", "W", "minhtuan", None),
    ("Đại lý Đức Trí", "26791", "TYPE_1", "Nguyễn Văn Quá", "2026-10-27", "W", "hoangnam", None),
]
TERMINATIONS = {
    "Đại lý Vĩnh Hưng": (date(2026, 9, 29), "Chủ cửa hàng chuyển nhượng mặt bằng"),
    "Tạp hóa Mỹ Châu": (date(2026, 9, 30), "Ngừng kinh doanh từ 01/10/2026"),
}
NEGATIVE_DAY = date(2026, 11, 10)
NEGATIVE_ONLINE_AMOUNT = Decimal(1_500_000)

# Planned issue counts per month (seasonal peaks: Mid-Autumn in September, November).
MONTHLY_ISSUES = {6: 39, 7: 37, 8: 40, 9: 48, 10: 41, 11: 33}
HOLIDAYS = {date(2026, 9, 1), date(2026, 9, 2)}

# Manager corrections/cancellations: date, action, reason
SPECIALS = [
    (date(2026, 6, 17), "cancel_issue", "Đại lý đổi ý, chưa lấy hàng"),
    (date(2026, 7, 8), "correct_issue", "Nhập sai số lượng dòng 2, lập lại phiếu"),
    (date(2026, 7, 15), "cancel_receipt", "Nhà cung cấp giao nhầm quy cách, đã trả lại cả lô"),
    (
        date(2026, 7, 22),
        "wrong_agency_payment",
        "Ghi nhầm đại lý, đã lập lại phiếu thu đúng đại lý",
    ),
    (date(2026, 8, 12), "correct_issue", "Giao thiếu hàng, lập lại phiếu theo số thực giao"),
    (date(2026, 8, 19), "correct_receipt", "Nhập sai số lượng dòng 2, lập lại phiếu"),
    (date(2026, 9, 9), "duplicate_issue", "Lập trùng phiếu, đại lý chỉ đặt một đơn"),
    (date(2026, 9, 23), "correct_issue", "Đại lý bớt một mặt hàng khi nhận, lập lại phiếu"),
    (date(2026, 10, 14), "cancel_issue", "Xe giao hàng gặp sự cố, đại lý hủy đơn"),
    (date(2026, 10, 21), "duplicate_receipt", "Lập trùng phiếu nhập của nhà cung cấp"),
    (
        date(2026, 10, 28),
        "cancel_transfer",
        "Chuyển khoản chưa về tài khoản công ty, hủy chờ đối soát",
    ),
    (date(2026, 11, 4), "correct_issue", "Nhập sai số lượng dòng 1, lập lại phiếu"),
    (date(2026, 11, 11), "cancel_issue", "Đại lý báo tạm đóng cửa sửa chữa, chưa nhận hàng"),
]

# VNPAY checkouts: date, outcome (the negative-debt case is scripted separately)
ONLINE_PLAN = [
    (date(2026, 7, 9), "SUCCESS"),
    (date(2026, 7, 21), "FAILED"),
    (date(2026, 7, 30), "SUCCESS"),
    (date(2026, 8, 7), "SUCCESS"),
    (date(2026, 8, 18), "EXPIRED"),
    (date(2026, 8, 27), "SUCCESS"),
    (date(2026, 9, 4), "FAILED"),
    (date(2026, 9, 15), "SUCCESS"),
    (date(2026, 9, 24), "SUCCESS"),
    (date(2026, 10, 2), "FAILED"),
    (date(2026, 10, 9), "SUCCESS"),
    (date(2026, 10, 16), "EXPIRED"),
    (date(2026, 10, 23), "SUCCESS"),
    (date(2026, 10, 30), "FAILED"),
    (date(2026, 11, 3), "SUCCESS"),
    (date(2026, 11, 6), "EXPIRED"),
    (date(2026, 11, 9), "FAILED"),
    (date(2026, 11, 12), "SUCCESS"),
]

PAYMENT_NOTES = [
    "Khách chuyển khoản Vietcombank",
    "Chuyển khoản Techcombank, nội dung ghi tên cửa hàng",
    "Thu tiền mặt khi giao hàng",
    "Trả đợt 1 theo thỏa thuận",
    "Trả đợt 2, còn lại cuối tháng thanh toán",
    "Chủ cửa hàng gửi tiền qua nhân viên giao hàng",
    "Chuyển khoản ACB",
]
ISSUE_NOTES = [
    "Giao trước 10 giờ sáng",
    "Giao đợt 2 theo đơn đặt hàng",
    "Đại lý lấy hàng tại kho",
    "Giao kèm hóa đơn đỏ",
    "Gọi trước khi giao, cửa hàng nghỉ trưa",
]
RECEIPT_NOTES = {
    "M": "Hàng Masan và Acecook theo đơn đặt tuần",
    "U": "Hàng Unilever theo đơn đặt tuần",
    "V": "Hàng Vinamilk giao tại kho",
    "B": "Nước giải khát, kiểm đếm đủ thùng",
    "C": "Dầu ăn Calofic, Tường An",
    "D": "Đường, bột ngọt, nước tương",
    "E": "Hàng khô nhập theo đơn",
}
