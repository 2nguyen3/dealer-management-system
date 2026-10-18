# Requirements

BM2/QĐ2/BM9/QĐ9 and source Product requests/projections: generated immutable MH-ID,
BIGINT string IDs, duplicate names allowed, ACTIVE unit on creation/new assignment,
read-only stock/purchase/derived selling price and price-source provenance. Threshold
is exact Quantity; isLowStock uses strict <. No change of unit after any recorded
document/count reference, including canceled history. Deletion requires no usage
and zero stock/purchase/source cache. Filters/sorts/ranges match source, inclusive
stock endpoints. Reads product.manage OR inventory.read; writes product.manage.

D02: preserve direct cache mutation denial and all RESTRICT business references;
permit only zero-cache cascade from eligible owner deletion. IDs/codes never reused.
