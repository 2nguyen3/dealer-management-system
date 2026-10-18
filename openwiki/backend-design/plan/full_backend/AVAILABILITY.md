# Published backend operation checkpoint

**Updated:** 2026-10-18. **Source/isolated-test/configured-Supabase head:** 0007.
**Runtime:**105 operations, including **103 of154** target operations plus two health.
M21–M24 handlers pass owning gates:59new owning cases; packet338offline+84realPG+
24direct/Nginx and affected30-file exact100%(1162statements/162branches).
Historical M17–M20 evidence below is not a new whole-suite run.

HTTP paths, schemas, permissions and transport requirements come from the single
[target OpenAPI](../../API/openapi.json). This is availability/evidence, not a
second specification. Actual runtime OpenAPI publishes these handlers only.

| Owner | Published target operation IDs | Accepted branches / evidence |
| --- | --- | --- |
| M01 auth | login, refreshTokens, logout, getCurrentUser, changePassword, requestPasswordReset, resetPasswordWithToken | Seven full auth operations; [auth evidence](../authentication/VERIFICATION.md), retained combined tests at M03 checkpoint. |
| M03 groups | listUserGroups, getUserGroup, createUserGroup, updateUserGroup, deleteUserGroup | Complete five-operation scope, permission combinations, ACTIVE/LOCKED blockers and eligible cleanup; [group evidence](../user_groups/VERIFICATION.md). |
| M04 users | listUsers, getUser, createUser, updateUser, resetUserPassword | Full M04 first/full gate; hash-only credentials, profile/group/status/admin reset, joined-label ETags and atomic session invalidation; [users evidence](../users/VERIFICATION.md). |
| M07 districts | listDistricts, getDistrict, createDistrict, updateDistrict, deleteDistrict | Full M07 first/full gate; global capacity, active/terminated references, state/deletion/race guards; [district evidence](../districts/VERIFICATION.md). |
| M08 agency types | listAgencyTypes, getAgencyType, createAgencyType, updateAgencyType, deleteAgencyType | Full M08 first/full gate; exact maxDebt, current-debt blockers, counts, snapshots/reference/lock guards; [type evidence](../agency_types/VERIFICATION.md). |
| M09 units | listUnits, getUnit, createUnit, updateUnit, deleteUnit | Full M09 first/full gate; recorded fraction policy, state, all-reference deletion and 0005 first-use serialization; [unit evidence](../units/VERIFICATION.md). |
| M05 permissions | listFunctions, getFunction, listGroupPermissions, getGroupPermission, setGroupPermission | Five full registry/grant operations; live authorization and serialized pair/preconditions; [evidence](../permissions/VERIFICATION.md). |
| M06 audit_logs | listAuditLogs, getAuditLog | Two immutable authorized reads, exact entity/nested-number redaction and keysets; [evidence](../audit_logs/VERIFICATION.md). |
| M10 business_rules | getBusinessRules, updateBusinessRules | Singleton/cap/rate locks, audit/snapshot protection and D16; [evidence](../business_rules/VERIFICATION.md). |
| M11 products | listProducts, getProduct, createProduct, updateProduct, deleteProduct | Exact quotes/provenance, recorded-unit guards and D02 eligible deletion; [evidence](../products/VERIFICATION.md). |
| M12 agencies | listAgencies, getAgency, createAgency, updateAgency, deleteAgency, terminateAgency | Atomic admission/profile/date/limit checks, permanent keyed termination, live replay authorization and D02; [evidence](../agencies/VERIFICATION.md). |
| M14 inventory | listProductInventoryEntries | Complete atomic date/order statements, all persisted goods kinds, reversals, scoped keysets and D14 aggregate historical balances; [evidence](../inventory/VERIFICATION.md). |
| M15 receipt core | listStockReceipts, getStockReceipt, createStockReceipt, updateStockReceiptDraft, postStockReceipt | Five full operations; neutral keyed drafts, final snapshots and atomic stock/business-date price selection, populated history and opposing races; [evidence](../stock_receipts/VERIFICATION.md). |
| M17/M19 issues | listStockIssues, getStockIssue, createStockIssue, updateStockIssueDraft, submitStockIssue, replacePendingStockIssue, postStockIssue | Seven full operations, server-priced READY snapshots, zero/verified-upfront atomic posting and history-preserving replacement; [evidence](../stock_issues/VERIFICATION.md). |
| M18 manual receipt core | listPaymentReceipts, getPaymentReceipt, createPaymentReceipt, updatePaymentReceiptDraft, postPaymentReceipt | Five full operations, date-valid exact FIFO, special-receipt protection and backdated replay; [evidence](../payment_receipts/VERIFICATION.md). |
| M19 upfront | listUpfrontConfirmations, getUpfrontConfirmation, verifyUpfrontPayment, receiveUpfrontSeparately | Four full operations, immutable evidence/full cash/separate credit and opposing races; [evidence](../upfront_payments/VERIFICATION.md). |
| M20 receivables | listReceivables, getAgencyBalance, listAgencyInvoiceBalances, getInvoiceBalance, listAgencyReceivableEntries, listDocumentAllocations | Six exact financial reads with snapshot totals, current/original debt, atomic ledgers, historical aggregates and source/target allocations; [evidence](../receivables/VERIFICATION.md). |
| M21 adjustment core | listStockAdjustments, getStockAdjustment, createStockAdjustment, updateStockAdjustmentDraft, postStockAdjustment | Signed stock-only quantities, zero totals/prices, historical stock and count-linked protection; [evidence](../stock_adjustments/VERIFICATION.md). |
| M22 counts | listStockCounts, createStockCount, getStockCount, updateStockCountDraft, listStockCountLines, createStockCountLine, getStockCountLine, updateStockCountLine, recountStock, confirmStockCount | Private stock-entry observations, fresh recount, zero-only evidence and conditional atomic adjustment; [evidence](../stock_counts/VERIFICATION.md). |
| M23 return core | listSalesReturns, getSalesReturn, createSalesReturn, updateSalesReturnDraft, postSalesReturn | Original sale snapshots, cumulative zero-value increments, immutable successor rounding and protected cash provenance; [evidence](../sales_returns/VERIFICATION.md). |
| M24 credit | listAgencyCreditLots, getCreditLot, listAgencyCreditEntries | Reservation-aware lots and full historical ledgers; sole agency balance remains M20-owned; [evidence](../agency_credit/VERIFICATION.md). |

M02 supplies verified transport/exact-value/precondition/cursor/command primitives;
it adds no public operation. These groups need no document-kind replay. Later
financial writers still require D17 persisted-history coverage.

Published operations support their complete promised branches. M13 foundations
and internal receipt draft cancellation do not publish partial M28/M29 operations.
The receipt module remains core-only: posted corrections/full cancellation are open.
Positive receipt posting needs no financial replay; all seeded goods history and
frozen financial snapshots are covered. Current checkpoint passes219 offline+345
PG/TLS+20 direct/Nginx with exact100% combined coverage (3622 statements/622 branches);
repeat seed and54 SQL checks pass at0006.
All method/path/media/permission details derive from the target OpenAPI; runtime
operation inventory is tested against it. Source head must be deployed explicitly;
Supabase remains an operational deployment input.

Frontend handoff: real health/auth, administration/audit and master data now support
F04–F13 after their own foundations/auth/shell prerequisites. No React module is
closed by this backend checkpoint. R2/R3 engineering gates pass; R4–R6 remain open.

Frontend goods handoff additionally permits inventory statements and receipt
list/detail/create-with-lines/header/post after frontend prerequisites. Shared
line editing/full cancellation/corrections are unavailable; F14/F16 workbenches
cannot close until their later backend/browser gates pass.

M16 settlement is now internally verified; no new HTTP operation. Its executable
seven-kind financial capability register covers frozen return splits/credit/refund
protection without closing later owning writers/return-line rounding/corrections.
[Evidence](../settlement_core/VERIFICATION.md):617 non-deployment cases, exact100%
(4096 statements/830 branches); retained20-case M15 deployment evidence not rerun.

M17–M20 owning80-case gate passes exact100% over808statements/98branches;
22direct/Nginx smoke cases pass. The configured Supabase schema was explicitly
upgraded0002→0006, live integrity/demo checks pass and new collection reads return200.
Retained M01–M16 regression now passes all370current PG/TLS nodes across resumed runs.
Current total308offline+397PG/TLS=705non-deployment cases; the affected M16–M20/shared
33-file production scope is exact100%(1285/306), not untouched-code/harness coverage.
Public cancel/correction/shared line routes
remain unavailable through M28/M29. Frontend readiness includes issue preparation,
posting, upfront verification/separation and financial reads after its own foundations.

**Next:** expand M25 credit_applications' owning six-file plan.
Full completion requires M25–M32, deferred M28/M29 operations and R6 release evidence.
Frontend may consume these operation-specific contracts after its foundations;
M22 has no delete, M21/M23 public posted cancel/corrections remain unavailable.
Credit historical balances use AggregateMoney after a real1.2e18/current7e17 witness;
keep all money/ID/quantity string rules from the canonical contract.
