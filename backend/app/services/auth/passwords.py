"""Password hashing, verification, and policy enforcement via stdlib hashlib.scrypt."""
import base64
import hashlib
import hmac
import secrets
from typing import List, Optional, Tuple

from app.errors import ApiError

# Built-in list of >= 50 common passwords (lowercase)
COMMON_PASSWORDS = {
    "password1234", "password12345", "123456789012", "qwertyuiop12", "administrator",
    "admin1234567", "welcome12345", "changeme1234", "passwordpassword", "iloveyou1234",
    "letmein12345", "monkey123456", "dragon123456", "master123456", "football1234",
    "baseball1234", "superman1234", "trustno11234", "princess1234", "sunshine1234",
    "starwars1234", "whatever1234", "shadow123456", "killer123456", "jordan123456",
    "michael12345", "charlie12345", "donald123456", "batman123456", "hockey123456",
    "ranger123456", "secret123456", "mustang12345", "hunter123456", "soccer123456",
    "orange123456", "freedom12345", "thunder12345", "summer123456", "winter123456",
    "spring123456", "autumn123456", "system123456", "testpassword1", "testadmin123",
    "passwordadmin", "correcthorsebattery", "p@ssword1234", "adobe1234567", "root12345678",
    "default12345", "access123456", "matrix123456", "111111111111", "000000000000"
}

# scrypt cost parameters (OWASP: N=2^15, r=8, p=3). Tests may lower SCRYPT_LN for speed.
SCRYPT_LN = 15
SCRYPT_R = 8
SCRYPT_P = 3
SCRYPT_DKLEN = 32
SCRYPT_MAXMEM = 64 * 1024 * 1024
_PREFIX = "$scrypt$"


def _b64encode_nopad(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii").rstrip("=")


def _b64decode_nopad(s: str) -> bytes:
    if len(s) % 4 == 1:
        raise ValueError("Invalid base64 length")
    return base64.b64decode(s + "=" * (-len(s) % 4), validate=True)


def _derive(password: str, salt: bytes, ln: int, r: int, p: int, dklen: int) -> bytes:
    return hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=1 << ln, r=r, p=p, maxmem=SCRYPT_MAXMEM, dklen=dklen
    )


def _parse(hashed: str) -> Optional[Tuple[int, int, int, bytes, bytes]]:
    """Parse `$scrypt$ln=..,r=..,p=..$<salt>$<hash>` into (ln, r, p, salt, digest), or None if malformed."""
    if not isinstance(hashed, str) or not hashed.startswith(_PREFIX):
        return None
    parts = hashed.split("$")
    if len(parts) != 5:
        return None
    try:
        params = dict(item.split("=", 1) for item in parts[2].split(","))
        if set(params) != {"ln", "r", "p"} or len(parts[2].split(",")) != 3:
            return None
        ln, r, p = int(params["ln"]), int(params["r"]), int(params["p"])
        salt, digest = _b64decode_nopad(parts[3]), _b64decode_nopad(parts[4])
    except (ValueError, TypeError):
        return None
    # Reject absurd stored parameters so a crafted hash cannot burn CPU/memory.
    if not (10 <= ln <= 20 and 1 <= r <= 16 and 1 <= p <= 16) or not salt or len(digest) != SCRYPT_DKLEN:
        return None
    return ln, r, p, salt, digest


def hash_password(password: str) -> str:
    """Hash a password: `$scrypt$ln=15,r=8,p=3$<salt b64>$<hash b64>` (no padding)."""
    salt = secrets.token_bytes(16)
    digest = _derive(password, salt, SCRYPT_LN, SCRYPT_R, SCRYPT_P, SCRYPT_DKLEN)
    return f"{_PREFIX}ln={SCRYPT_LN},r={SCRYPT_R},p={SCRYPT_P}${_b64encode_nopad(salt)}${_b64encode_nopad(digest)}"


def verify_password(password: str, hashed: str) -> bool:
    """Check a password against a stored hash using its stored parameters. Never raises."""
    parsed = _parse(hashed)
    if parsed is None or not isinstance(password, str):
        return False
    ln, r, p, salt, digest = parsed
    try:
        return hmac.compare_digest(_derive(password, salt, ln, r, p, len(digest)), digest)
    except (ValueError, MemoryError):
        return False


def check_needs_rehash(hashed: str) -> bool:
    """True when the hash is not scrypt or was made with different parameters than the current ones."""
    parsed = _parse(hashed)
    return parsed is None or parsed[:3] != (SCRYPT_LN, SCRYPT_R, SCRYPT_P)


# Hash used to equalize login timing for unknown identifiers.
DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


def verify_dummy(password: str) -> None:
    """Spend the same time as a real verification, for unknown accounts."""
    verify_password(password, DUMMY_HASH)


def validate_password_policy(
    new_password: str,
    email: str,
    current_password: Optional[str] = None,
) -> None:
    """
    Enforce password policy:
    - Length 12-128
    - Must not contain email local part when >= 4 chars
    - Must not be in common passwords list
    - Must differ from current password on change
    Raises ApiError(422) on any violation.
    """
    errors: List[dict] = []

    if len(new_password) < 12:
        errors.append({"field": "new_password", "msg": "Password must be at least 12 characters long"})
    elif len(new_password) > 128:
        errors.append({"field": "new_password", "msg": "Password must not exceed 128 characters"})

    if email and "@" in email:
        local_part = email.split("@")[0].lower()
        if len(local_part) >= 4 and local_part in new_password.lower():
            errors.append({"field": "new_password", "msg": "Password must not contain email username"})

    if new_password.lower() in COMMON_PASSWORDS:
        errors.append({"field": "new_password", "msg": "Password is too common"})

    if current_password is not None and new_password == current_password:
        errors.append({"field": "new_password", "msg": "New password must differ from current password"})

    if errors:
        raise ApiError(status_code=422, detail="Validation failed", errors=errors)
