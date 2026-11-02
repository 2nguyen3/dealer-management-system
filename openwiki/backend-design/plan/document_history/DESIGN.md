# M28 design

DocumentHistoryService composes shared DocumentService, FinancialDocumentRepository
search projections and per-kind preparation. Readers use a kind permission registry
already owned by M13. Search query uses outeragency join for warehouse kinds and a
scope-signed keysetcursor; no contact fields outside canonical summaries.

Child-write discovery collects product/agency/origin IDs, acquires product/unit/stock
before agency/balance/history/document locks. Reload after waits, check live prepare
grant, current DRAFT, complete aggregateETag and confirmed-count immutability. Reuse
DocumentService.edit_line for receipt/issue/adjustment with validated server-prepared
DraftLine. Returns rebuild proposed complete current lines through SalesReturnService
original-line validator and cumulative rounding, preserving draft identity. All writes
are caller-owned single transactions with forced deferredconstraints before projection.

Print consumes an authorized copied document+selectedrevision projection after DB
transaction release. HTML uses stdlib escaping; ReportLab Platypus builds PDF using
bundled OFL NotoSans Vietnamese-capable font. No HTML-to-PDF/browser/URL fetching.
Static localfont only, repeat tableheaders, wrap long names/notes and page totals.
ContentDisposition has safe ASCII fallback plus UTF8 filename; Accept parsed with
quality values, application/pdf and text/html, */* defaults HTML, unsupported406.
Any render failure occurs before responsebody; no writes in renderer.
