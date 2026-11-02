# M15 requirements

Authority: [OpenAPI](../../API/openapi.json), selected Q01/Q05/Q13/Q15,
reviewed SQL document/line/ledger guards through0006 and D16/D17 publication rules.

- Reads any stock.receipt.prepare/stock.receipt.post/inventory.read; create/update
  require prepare; post requires post; internal cancel requires documents.cancel.
- Create DRAFT with optional unique-product lines; positive quantity/price; ACTIVE
  product/unit and recorded fraction policy. Zero balance effects.
- Header PATCH accepts only businessDate/note, current DRAFT and parent If-Match.
- Post DRAFT→POSTED requires nonempty lines, refreshed ACTIVE masters/snapshots,
  correct totals, one POST batch, positive stock entries and actor/time.
- Price source is latest businessDate/original businessOrder/document ID receipt,
  not latest API time; older receipt does not replace newer price.
- Keyed create/post retries recover same result; changed payload409; stale412,
  missing If-Match428. Commit before success; response validated before commit.
- Draft cancellation retains history/lines and changes no balances. Posted
  correction/cancellation remains M29 and has no partial public handler.
