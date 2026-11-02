-- Additive session lineage / credential-version snapshot. Never revives old tokens.
ALTER TABLE dms.auth_token ADD COLUMN "authVersion" integer;
ALTER TABLE dms.auth_token ADD COLUMN "sessionId" uuid;
UPDATE dms.auth_token t SET "authVersion" = u."authVersion",
  "sessionId" = CASE WHEN t.purpose = 'REFRESH' THEN gen_random_uuid() END,
  "revokedAt" = coalesce(t."revokedAt", clock_timestamp())
FROM dms.app_user u WHERE u.id = t."userId";
ALTER TABLE dms.auth_token ALTER COLUMN "authVersion" SET NOT NULL;
ALTER TABLE dms.auth_token ADD CONSTRAINT ck_auth_token_version CHECK ("authVersion" > 0);
ALTER TABLE dms.auth_token ADD CONSTRAINT ck_auth_token_session_shape
  CHECK ((purpose = 'REFRESH') = ("sessionId" IS NOT NULL));
CREATE INDEX ix_auth_token_session ON dms.auth_token ("userId", "sessionId");
CREATE UNIQUE INDEX uq_auth_token_live_session ON dms.auth_token ("sessionId")
  WHERE purpose = 'REFRESH' AND "revokedAt" IS NULL;
CREATE FUNCTION dms.guard_auth_token() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW."userId", NEW.purpose, NEW."tokenDigest", NEW."sessionId", NEW."authVersion", NEW."expiresAt")
    IS DISTINCT FROM
    (OLD."userId", OLD.purpose, OLD."tokenDigest", OLD."sessionId", OLD."authVersion", OLD."expiresAt")
  THEN
    RAISE EXCEPTION 'Token identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD."revokedAt" IS NOT NULL AND NEW."revokedAt" IS DISTINCT FROM OLD."revokedAt" THEN
    RAISE EXCEPTION 'Token revocation is irreversible' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER a_identity BEFORE UPDATE ON dms.auth_token
  FOR EACH ROW EXECUTE FUNCTION dms.guard_auth_token();
