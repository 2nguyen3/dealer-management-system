# Interface glossary (vi → en pivot)

Use these terms consistently in every interface language. English is the pivot: translate the
English meaning into the target language, keeping one target term per Vietnamese term.

| Tiếng Việt                | English                    | Note                                                     |
| ------------------------- | -------------------------- | -------------------------------------------------------- |
| Đại lý                    | Agency                     | A dealer the company sells to                             |
| Loại đại lý               | Agency type                |                                                          |
| Mặt hàng / Hàng hóa       | Product / Goods            |                                                          |
| Đơn vị tính               | Unit                       |                                                          |
| Phiếu nhập (hàng)         | Stock receipt              | Goods coming into the warehouse                          |
| Phiếu xuất (hàng)         | Stock issue                | Goods sold out to an agency                              |
| Phiếu thu (tiền)          | Payment receipt            |                                                          |
| Trả ngay                  | Upfront payment            | Money paid when goods are issued                         |
| Xác nhận trả ngay         | Upfront payment confirmation |                                                        |
| Ghi nhận tiền riêng       | Receive separately         | Upfront money turned into its own payment receipt        |
| Ghi sổ                    | Post                       | Irreversible bookkeeping action                          |
| Nộp (phiếu)               | Submit                     |                                                          |
| Nháp                      | Draft                      |                                                          |
| Sẵn sàng / Chờ xử lý      | Ready / Pending            |                                                          |
| Đã hủy                    | Cancelled                  |                                                          |
| Công nợ / Dư nợ           | Receivable / Debt balance  |                                                          |
| Hạn mức nợ                | Debt limit                 |                                                          |
| Dư có                     | Credit balance             | Money the company owes the agency                         |
| Bù trừ dư có              | Credit application         |                                                          |
| Hoàn tiền                 | Refund                     |                                                          |
| Trả hàng                  | Sales return               |                                                          |
| Kiểm kê                   | Stock count                |                                                          |
| Điều chỉnh kho            | Stock adjustment           |                                                          |
| Tồn kho / Thẻ kho         | Inventory / Stock card     |                                                          |
| Sửa sai                   | Correction                 | New version of a posted document                         |
| Hủy (chứng từ)            | Cancel / Void              |                                                          |
| Chứng từ                  | Document                   |                                                          |
| Phiên bản                 | Revision / Version         |                                                          |
| Ngày nghiệp vụ            | Business date              |                                                          |
| Phường/xã                 | Ward/Commune               |                                                          |
| Đặc khu                   | Special zone               |                                                          |
| Quy định                  | Business rule              |                                                          |
| Tỷ lệ giá bán             | Selling price rate         | Selling price = purchase price × rate                    |
| Thanh toán trực tuyến     | Online payment             | VNPAY gateway                                            |
| Đối soát                  | Reconcile                  |                                                          |
| Nhật ký hệ thống          | Audit log                  |                                                          |
| Phân quyền                | Permissions                |                                                          |
| Nhóm người dùng           | User group                 |                                                          |
| Cổng quản lý              | Portal                     | Former "Bàn làm việc" (Workspace)                        |
| Bảng điều khiển           | Dashboard                  |                                                          |
| Báo cáo                   | Report                     |                                                          |
| Hướng dẫn                 | Guide                      |                                                          |

## Never translate

- Placeholders in braces, exactly as written: `{code}`, `{amount}`, `{count}`…
- Document codes and prefixes: `PN-`, `PX-`, `PT-`, `TH-`, `DC-`, `BT-`, `HT-`, `KK-`, `DL-`.
- Currency `₫` / `VND`, product names `Agentra`, `VNPAY`, file formats `PDF`, `XLSX`, `CSV`,
  technical names `API`, `IPN`, `ETag`, `ID`, `email`, `URL`.
- Business data shown from the server (agency/product/ward names, notes, reasons). Interface
  strings may contain a Vietnamese example name (e.g. "VD: Đại lý Minh Châu"): translate "VD:"
  ("e.g."), keep the proper name.
