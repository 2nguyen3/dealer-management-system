# Design — M07

District maps existing table. DistrictRepository.query projects scalar active
count and singleton max in one statement. Lock business_rule FOR SHARE before
district FOR UPDATE, matching admission rule-first order and protecting capacity
ETags from concurrent rule/admission changes. Delete checks every agency reference.
Shared anchor-v2 cursors store ID plus fixed-size sort-boundary digest, resolve
within original filters, and reject deleted/moved/mismatched anchors with 400.

DistrictService uses shared CatalogueService for signed anchor pagination, exact
typed projection, ETag, audited authorized transaction, forced constraints and
commit/rollback; repository owns query/lock/reference policy. Code/name uniqueness
and FK conflicts translate safely. Five explicit router handlers preserve source
permissions, q/code/status/catalogue sort, If-Match/Location/ETag and empty 204.
No migration expected. Admission's existing trigger rechecks inactive state after
waiting. Test both state-change/admission winning orders on independent connections.
