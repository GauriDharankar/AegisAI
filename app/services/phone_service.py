from __future__ import annotations

import hashlib
import hmac
import os
import re
import base64

from cryptography.fernet import Fernet, InvalidToken


class PhoneConfigurationError(Exception):
    pass


def normalize_phone_number(phone_number: str) -> str:
    normalized = re.sub(r"[\s().-]", "", phone_number)
    if not re.fullmatch(r"\+[1-9][0-9]{7,14}", normalized):
        raise ValueError("Enter a valid phone number in international E.164 format.")
    return normalized


def _phone_key() -> bytes:
    try:
        key = os.getenv("AEGISAI_PHONE_ENCRYPTION_KEY", "").strip().encode("ascii")
    except UnicodeEncodeError as exc:
        raise PhoneConfigurationError("AEGISAI_PHONE_ENCRYPTION_KEY must be a valid Fernet key.") from exc
    if not key:
        raise PhoneConfigurationError("AEGISAI_PHONE_ENCRYPTION_KEY is required for Platform Admin phone security.")
    try:
        Fernet(key)
    except (ValueError, TypeError) as exc:
        raise PhoneConfigurationError("AEGISAI_PHONE_ENCRYPTION_KEY must be a valid Fernet key.") from exc
    return key


def validate_phone_encryption_key() -> None:
    _phone_key()


def encrypt_phone_number(phone_number: str) -> str:
    normalized = normalize_phone_number(phone_number)
    return Fernet(_phone_key()).encrypt(normalized.encode("ascii")).decode("ascii")


def decrypt_phone_number(encrypted_phone_number: str) -> str:
    try:
        plaintext = Fernet(_phone_key()).decrypt(encrypted_phone_number.encode("ascii"))
        decoded_phone = plaintext.decode("ascii")
    except (InvalidToken, UnicodeDecodeError, UnicodeEncodeError) as exc:
        raise PhoneConfigurationError("Unable to decrypt the registered Platform Admin phone number.") from exc
    return normalize_phone_number(decoded_phone)


def hash_phone_number(phone_number: str) -> str:
    normalized = normalize_phone_number(phone_number)
    key = hashlib.sha256(base64.urlsafe_b64decode(_phone_key()) + b"phone-lookup").digest()
    return hmac.new(key, normalized.encode("ascii"), hashlib.sha256).hexdigest()


def hash_password_reset_value(value: str, purpose: str) -> str:
    key = hashlib.sha256(base64.urlsafe_b64decode(_phone_key()) + purpose.encode("ascii")).digest()
    return hmac.new(key, value.encode("ascii"), hashlib.sha256).hexdigest()
