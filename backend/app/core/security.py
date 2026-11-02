from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHashError, VerificationError

HASHER = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4, type=Type.ID)
# One hash per process, never a known-user shortcut.
DUMMY_HASH = HASHER.hash("unknown-account-dummy-password")


def hash_password(password: str) -> str:
    return HASHER.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return HASHER.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False
