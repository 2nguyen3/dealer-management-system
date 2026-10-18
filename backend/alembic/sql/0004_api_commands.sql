-- Durable actor/operation/resource retry identities. No request bodies or secrets.
CREATE TABLE dms.api_idempotency (
  id uuid PRIMARY KEY,
  "actorId" bigint NOT NULL REFERENCES dms.app_user(id) ON DELETE RESTRICT,
  "operationId" text NOT NULL CHECK ("operationId" ~ '^[A-Za-z][A-Za-z0-9]*$'),
  "resourceScope" text NOT NULL CHECK (length("resourceScope") > 0),
  "clientKey" uuid NOT NULL,
  "requestDigest" bytea NOT NULL CHECK (octet_length("requestDigest") = 32),
  "formatVersion" integer NOT NULL DEFAULT 1 CHECK ("formatVersion" = 1),
  state text NOT NULL DEFAULT 'CLAIMED' CHECK (state IN ('CLAIMED','COMPLETED','ACCEPTED')),
  result jsonb,
  recovery jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_api_idempotency_scope UNIQUE ("actorId","operationId","resourceScope","clientKey"),
  CONSTRAINT ck_api_idempotency_result CHECK (
    (state='CLAIMED' AND result IS NULL AND recovery IS NULL) OR
    (state='COMPLETED' AND jsonb_typeof(result)='object' AND result IS NOT NULL AND recovery IS NULL) OR
    (state='ACCEPTED' AND jsonb_typeof(result)='object' AND result IS NOT NULL
      AND jsonb_typeof(recovery)='object' AND recovery IS NOT NULL)
  )
);
CREATE TRIGGER timestamps BEFORE INSERT OR UPDATE ON dms.api_idempotency
FOR EACH ROW EXECUTE FUNCTION dms.stamp_row();

CREATE FUNCTION dms.guard_api_command() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    RAISE EXCEPTION 'Durable command identities cannot be deleted' USING ERRCODE='23514';
  END IF;
  IF (NEW.id,NEW."actorId",NEW."operationId",NEW."resourceScope",NEW."clientKey",
      NEW."requestDigest",NEW."formatVersion") IS DISTINCT FROM
     (OLD.id,OLD."actorId",OLD."operationId",OLD."resourceScope",OLD."clientKey",
      OLD."requestDigest",OLD."formatVersion") OR OLD.state='COMPLETED' OR
     (OLD.state='ACCEPTED' AND NEW.state<>'COMPLETED') THEN
    RAISE EXCEPTION 'Durable command identity/result is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER a_identity BEFORE UPDATE OR DELETE ON dms.api_idempotency
FOR EACH ROW EXECUTE FUNCTION dms.guard_api_command();

REVOKE ALL ON dms.api_idempotency FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION dms.guard_api_command() FROM PUBLIC;
COMMENT ON TABLE dms.api_idempotency IS
  'Durable retry identity; safe typed results only; no generic expiry or credential storage.';
