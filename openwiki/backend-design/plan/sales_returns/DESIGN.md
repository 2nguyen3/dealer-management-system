# M23 design and confirmed test seams

SalesReturnService extends FinancialDocumentService. Repository owns origin-line and
chronological current-return queries. Pure cumulative_amounts validates cap and exact
HALF_UP differences independently from persistence. Prepare return lines from immutable
origin snapshots with zero-allowed returnAmount. No current purchase-price lookup.

Lock rule → sorted affected agency-history products/units → inventory balances →
agency type/profile/balance → ordered agency document/revisions/lots. Recheck discovered
product closure and live authorization after waits; compare aggregate parent ETag.
Post candidate, compute chronological return amounts. For changed dependent return,
create successor DRAFT, copy unchanged snapshots/quantities/origin pointers, substitute
computed amounts, reverse old inventory/financial legs, post replacement and move
currentRevisionId. Then replay M16 financial sources with protected receipt minima.
Force final deferred constraints before balance projection and caller commit.

The exact-sourceRevisionId CREATED guard was concretely reproduced as part of the
protected successor-lot failure. Reviewed0007 permits only a current POSTED successor
of the same SALES_RETURN with an original POSTED source revision. Physical lot,
sourceRevisionId and originReceiptId remain immutable. M16 repository.lots/events
maps these physical lots and consumed-refund keys to the owner's current return
revision for financial planning; replenishment targets the original lot ID. All
other agency/kind/date/reversal/provenance guards remain in force. Reserved/paid
minima that genuinely lose backing still reject atomically. Full M29 corrections
remain separately owned; no unsupported-history fallback is introduced.

Confirmed seams: pure arithmetic fixture (1 VND,0.5+0.5), source JSON schemas through
actual TestClient, real generated Supabase schemas and fresh Session assertions,
independent return-cap/authorization races, injected inventory/replay/finalizer failure.
