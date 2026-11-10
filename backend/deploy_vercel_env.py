"""Upload core or native VNPAY Sandbox settings without exposing their values."""

import argparse
import shutil
import subprocess
from pathlib import Path

from pydantic import ValidationError

from app.core.config import Settings, validate_auth_startup_settings

VERCEL_CLI = "vercel@65.12.1"
PUBLIC_ORIGIN = "https://agentra-dms.vercel.app"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--environment", choices=("preview", "production"), default="preview")
    parser.add_argument("--vnpay", action="store_true", help="Upload only native sandbox settings")
    parser.add_argument(
        "--update-existing", action="store_true", help="Allow replacing selected keys"
    )
    parser.add_argument("--check", action="store_true", help="Validate locally without uploading")
    parser.add_argument(
        "--env-file", default=".env", help="Backend env file, relative to backend/ (default .env)"
    )
    parser.add_argument(
        "--database-only", action="store_true", help="Upload only the DB_* connection keys"
    )
    args = parser.parse_args()
    npx = shutil.which("npx")
    if npx is None:
        print("Node.js/npm is required to run the Vercel CLI.")
        return 1

    try:
        settings = Settings(_env_file=Path(__file__).with_name(args.env_file))
        validate_auth_startup_settings(settings)
    except (ValidationError, ValueError):
        print("Invalid backend settings. Check DB_* and AUTH_SIGNING_KEY locally.")
        return 1

    values = {
        "DB_HOST": settings.db_host,
        "DB_PORT": str(settings.db_port),
        "DB_NAME": settings.db_name,
        "DB_USER": settings.db_user,
        "DB_PASSWORD": settings.db_password.get_secret_value(),
        "DB_SSLMODE": settings.db_sslmode,
        "AUTH_SIGNING_KEY": settings.auth_signing_key.get_secret_value(),
        "AUTH_ISSUER": settings.auth_issuer,
        "AUTH_AUDIENCE": settings.auth_audience,
        "CORS_ORIGINS": "[]",
    }
    if args.database_only:
        values = {name: value for name, value in values.items() if name.startswith("DB_")}
    if args.vnpay:
        if not settings.vnpay_tmn_code or not settings.vnpay_hash_secret.get_secret_value():
            print("VNPAY sandbox merchant credentials are missing from local backend settings.")
            return 1
        if settings.payment_provider:
            print("A separate PAYMENT_* provider is configured; native VNPAY must stay separate.")
            return 1
        values = {
            "VNPAY_TMN_CODE": settings.vnpay_tmn_code,
            "VNPAY_HASH_SECRET": settings.vnpay_hash_secret.get_secret_value(),
            "VNPAY_IPN_URL": PUBLIC_ORIGIN + "/api/v1/integrations/vnpay/ipn",
            "VNPAY_RETURN_URL": PUBLIC_ORIGIN + "/api/v1/integrations/vnpay/return",
            "VNPAY_PAYMENT_URL": settings.vnpay_payment_url,
            "VNPAY_API_URL": settings.vnpay_api_url,
        }
    if args.check:
        print(f"Valid local configuration for {len(values)} selected keys (values hidden).")
        print(
            "Database TLS enabled:", settings.db_sslmode in ("require", "verify-ca", "verify-full")
        )
        print("Supabase pooler configured:", settings.db_host.endswith(".pooler.supabase.com"))
        print("Native VNPAY credentials present:", bool(settings.vnpay_tmn_code))
        print("Mail delivery enabled locally:", settings.auth_mail_enabled)
        return 0
    for name, value in values.items():
        result = subprocess.run(
            [
                npx,
                "--yes",
                VERCEL_CLI,
                "env",
                "add",
                name,
                "--environment",
                args.environment,
                "--sensitive",
                "--yes",
                *(["--force"] if args.update_existing else []),
            ],
            input=value,
            text=True,
            capture_output=True,
            cwd=Path(__file__).resolve().parent.parent,
            check=False,
        )
        if result.returncode:
            # CLI errors may contain supplied values. Never print the captured output.
            print(f"Could not add {name}. Check CLI login, project link, and existing variables.")
            print("Inspect variable names with vercel env ls; use --update-existing intentionally.")
            return 1
        print(f"Added {name} to {args.environment} (value hidden).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
