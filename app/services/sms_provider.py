from __future__ import annotations

import os
from dataclasses import dataclass
from urllib.parse import quote

import httpx


class SmsConfigurationError(Exception):
    pass


class SmsDeliveryError(Exception):
    pass


@dataclass(frozen=True)
class SmsDelivery:
    development_code: str | None = None


class SmsProvider:
    def send_otp(self, phone_number: str, code: str) -> SmsDelivery:
        raise NotImplementedError


class DevelopmentTestSmsProvider(SmsProvider):
    def send_otp(self, phone_number: str, code: str) -> SmsDelivery:
        del phone_number
        return SmsDelivery(development_code=code)


class TwilioSmsProvider(SmsProvider):
    def __init__(self, account_sid: str, auth_token: str, from_number: str):
        self.account_sid = account_sid
        self.auth_token = auth_token
        self.from_number = from_number

    def send_otp(self, phone_number: str, code: str) -> SmsDelivery:
        url = (
            "https://api.twilio.com/2010-04-01/Accounts/"
            f"{quote(self.account_sid, safe='')}/Messages.json"
        )
        try:
            response = httpx.post(
                url,
                data={
                    "To": phone_number,
                    "From": self.from_number,
                    "Body": f"Your AegisAI Platform Admin verification code is {code}. It expires in 10 minutes.",
                },
                auth=(self.account_sid, self.auth_token),
                timeout=10,
            )
            response.raise_for_status()
        except (httpx.HTTPError, ValueError) as exc:
            raise SmsDeliveryError("The SMS provider did not accept the verification message.") from exc
        return SmsDelivery()


def get_sms_provider() -> SmsProvider:
    provider_name = os.getenv("AEGISAI_SMS_PROVIDER", "").strip().lower()
    environment = os.getenv("AEGISAI_ENV", "").strip().lower()
    production_mode = any(
        os.getenv(name, "").strip().lower() in {"production", "prod"}
        for name in ("AEGISAI_ENV", "APP_ENV", "ENVIRONMENT", "NODE_ENV")
    )

    if provider_name == "test":
        if (
            production_mode
            or environment != "development"
            or os.getenv("AEGISAI_ENABLE_TEST_OTP", "").strip().lower() != "true"
        ):
            raise SmsConfigurationError(
                "The test SMS provider is available only when AEGISAI_ENV=development "
                "and AEGISAI_ENABLE_TEST_OTP=true."
            )
        return DevelopmentTestSmsProvider()

    if provider_name != "twilio":
        raise SmsConfigurationError(
            "Configure AEGISAI_SMS_PROVIDER=twilio and Twilio credentials before enabling SMS password recovery."
        )

    account_sid = os.getenv("AEGISAI_TWILIO_ACCOUNT_SID", "").strip()
    auth_token = os.getenv("AEGISAI_TWILIO_AUTH_TOKEN", "").strip()
    from_number = os.getenv("AEGISAI_TWILIO_FROM_NUMBER", "").strip()
    if not account_sid or not auth_token or not from_number:
        raise SmsConfigurationError(
            "Twilio SMS is not configured. Set AEGISAI_TWILIO_ACCOUNT_SID, "
            "AEGISAI_TWILIO_AUTH_TOKEN, and AEGISAI_TWILIO_FROM_NUMBER."
        )
    return TwilioSmsProvider(account_sid, auth_token, from_number)
