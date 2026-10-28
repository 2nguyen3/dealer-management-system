# M28 requirements

- All seven persisted kinds and historical DRAFT/READY/POSTED versions remain readable
  under owning kind grants. Implicit search filters permitted kinds; an explicit
  forbidden kind403. Cursor includes authorized kind set and filters.
- Cross-parent revision/line IDs404, even if caller can read both parents. Financial
  versions return empty goods lines and reject edits. Only current DRAFT is writable.
- Receipt positive price; issue price/basepurchase server-owned; adjustment zero price
  and signed nonzeroquantity; return original-line unit/price/provenance and cumulative
  rounding. Complete parentETag serializes header/child writes; delete204 returns parent token.
- Preserve old snapshots and immutable count-linked adjustments/paidrefund content.
- Print selected/current revision authorized detached snapshot, HTMLdefault/PDFAccept,
  unsupported406. Escape untrusted text, prohibit remote/userURLfetching, show draft/
  canceled markers, exact strings/filenames/media and Vietnamese glyphs/page layout.
- Full posted corrections/cancellation and R5 remain M29-owned/open.
