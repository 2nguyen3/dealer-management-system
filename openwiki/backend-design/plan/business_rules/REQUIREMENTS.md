# Requirements and D16 decision

BM1/QĐ1/QĐ7: global positive integer cap <=2147483647, cannot fall below any
district's ACTIVE usage. Return district blockers. Rate is exact 0<rate<1000,
at most six fractional digits; JSON numeric/float input is rejected. PATCH is
nonempty, forbids null/extra fields, requires If-Match. GET any rules.manage,
agency.manage, stock.issue.prepare or inventory.read; write rules.manage.

D16 decision: adopt DerivedSellingPrice, a nonnegative integer string without
Money's storage bound, for Product and InventoryChange.currentSellingPrice.
Do not constrain otherwise valid rules/purchase prices or clamp derived quotes.
Stored document prices remain positive Money <10^18. Later issue writers must
reject zero/out-of-range quotes with 409 SELLING_PRICE_UNUSABLE before persistence;
this is a publication dependency of M13/M17, not a new issue endpoint here.
History snapshots are never rewritten by current rule changes.
