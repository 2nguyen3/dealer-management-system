# M11 products

**Current:** full local completion, M09/M10 and D02/D16 passed; [evidence](VERIFICATION.md).

Prepared 2026-10-04 before code. Dependencies M09/M10; M10 precedes this code.
Owns listProducts/getProduct/createProduct/updateProduct/deleteProduct. Reuse
catalogue transport, auth, exact values, ETags/keysets and transactions. D16's
canonical DerivedSellingPrice is selected before publication. D02 repair belongs
to this module and is shared with M12. Order: reproduce 0005 deletion failure;
review additive 0006; model/repository/guards; routes; PG and scoped gates.
