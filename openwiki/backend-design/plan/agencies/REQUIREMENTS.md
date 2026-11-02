# Requirements

BM1/QĐ1/QĐ7: ACTIVE creation, generated immutable DL-ID, zero separate debt/credit,
ACTIVE type/district and global district cap. Names/contact details are not unique.
Patch: ACTIVE new type with limit >= current debt; ACTIVE district move needs room;
acceptedDate cannot be after earliest existing document date, including drafts.
Nullable phone/address can be cleared; omitted fields retain values. No status/code
or client balance mutation. Read agency.read OR agency.manage; write agency.manage.

Termination requires reason, If-Match and Idempotency-Key, never zero debt. No
reopen. Replay same validated payload/key returns original committed projection;
different payload/key gives 409. Reauthorize every retry/replay. Delete requires
all document/payment/evidence history absent, zero cache; shared D02 repair.
