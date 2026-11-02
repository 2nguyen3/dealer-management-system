# Requirements — M04

| Requirement | Source | Acceptance |
| --- | --- | --- |
| U01 five operations, users.manage throughout | OpenAPI Users | exact paths, status sets, schemas, headers and permissions |
| U02 email identity, hash-only nonempty password | BM11/QĐ11; uq_app_user_email_ci | mixed-case race, one-character/space passwords; secret-free response/errors/audit |
| U03 group FK and source ACTIVE/LOCKED | 0001 app_user; Users requests | missing group 404; strict catalogue JSON ID, BIGINT string user ID |
| U04 group/status/reset invalidate atomically | Users descriptions; 0001 authVersion, M01 | old bearer/refresh/reset tokens rejected; profile-only update retains sessions |
| U05 ETag complete visible resource | M02; source If-Match | missing 428, malformed 422, stale 412 with current ETag, serialized stale writers |
| U06 reset never unlocks | source resetUserPassword | locked status retained, no password response, no new session |
| U07 persisted writes/rollback/audit | QĐ14; General Plan | independent connection verifies committed hash/version/tokens and definite failure rollback |

Email syntax and password handling reuse authentication validators without new
length/complexity rules. User ETag includes joined group labels and timestamps;
password changes update updatedAt, so reset invalidates an old ETag too.
