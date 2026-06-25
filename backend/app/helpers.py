import os
import base64
import logging
import random
import re
import unicodedata
import asyncio
import smtplib
from email.message import EmailMessage
from datetime import datetime, timezone, timedelta
from typing import Optional

import bcrypt
import jwt as pyjwt
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_DAYS, KYC_KEY, logger
from app.database import db

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)

USER_PRIVATE_FIELDS = {
    "_id": 0,
    "password_hash": 0,
    "phone_verified": 0,
    "totp_secret": 0,
    "totp_pending_secret": 0,
}

USER_PUBLIC_PRIVATE_FIELDS = {
    **USER_PRIVATE_FIELDS,
    "phone": 0,
    "email": 0,
    "admin_phone": 0,
    "stripe_customer_id": 0,
    "stripe_subscription_id": 0,
}

def public_user_doc(user: dict, *, hide_phone: bool = False) -> dict:
    private = set(USER_PRIVATE_FIELDS)
    if hide_phone:
        private.update({"phone", "admin_phone", "stripe_customer_id", "stripe_subscription_id"})
    return {k: v for k, v in user.items() if k not in private}


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    return value or "utilisateur"

async def ensure_unique_user_slug(base: str, user_id: Optional[str] = None) -> str:
    root = slugify(base)[:70].strip("-") or "utilisateur"
    slug = root
    i = 2
    while True:
        existing = await db.users.find_one({"public_slug": slug}, {"_id": 0, "id": 1})
        if not existing or existing.get("id") == user_id:
            return slug
        suffix = f"-{i}"
        slug = (root[: 80 - len(suffix)].strip("-") or "utilisateur") + suffix
        i += 1

async def ensure_unique_collection_slug(collection_name: str, field: str, base: str, item_id: Optional[str] = None, fallback: str = "element") -> str:
    root = slugify(base)[:70].strip("-") or fallback
    slug = root
    i = 2
    collection = getattr(db, collection_name)
    while True:
        existing = await collection.find_one({field: slug}, {"_id": 0, "id": 1})
        if not existing or existing.get("id") == item_id:
            return slug
        suffix = f"-{i}"
        slug = (root[: 80 - len(suffix)].strip("-") or fallback) + suffix
        i += 1

async def ensure_unique_forum_slug(base: str, question_id: Optional[str] = None) -> str:
    return await ensure_unique_collection_slug("forum_questions", "slug", base, question_id, "question")

async def ensure_unique_mission_slug(base: str, mission_id: Optional[str] = None) -> str:
    return await ensure_unique_collection_slug("missions", "slug", base, mission_id, "mission")

def public_profile_name(user: dict) -> str:
    if user.get("role") == "merchant":
        return user.get("shop_name") or user.get("display_name") or "marchand"
    return user.get("display_name") or "comptable"

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expiré")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")

async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    payload = decode_token(creds.credentials)
    user = await db.users.find_one({"id": payload["sub"]}, USER_PRIVATE_FIELDS)
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    if user.get("banned"):
        raise HTTPException(status_code=403, detail="Compte suspendu")
    if payload.get("imp"):
        user["_impersonator_id"] = payload["imp"]
    return user


async def get_optional_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(optional_security)) -> Optional[dict]:
    if not creds:
        return None
    try:
        payload = decode_token(creds.credentials)
        user = await db.users.find_one({"id": payload["sub"]}, USER_PRIVATE_FIELDS)
    except HTTPException:
        return None
    if not user or user.get("banned"):
        return None
    if payload.get("imp"):
        user["_impersonator_id"] = payload["imp"]
    return user

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Accès admin requis")
    return user

def encrypt_bytes(plaintext: bytes) -> tuple[bytes, bytes, bytes]:
    iv = os.urandom(12)
    enc = Cipher(algorithms.AES(KYC_KEY), modes.GCM(iv), backend=default_backend()).encryptor()
    ct = enc.update(plaintext) + enc.finalize()
    return ct, iv, enc.tag

def decrypt_bytes(ciphertext: bytes, iv: bytes, tag: bytes) -> bytes:
    dec = Cipher(algorithms.AES(KYC_KEY), modes.GCM(iv, tag), backend=default_backend()).decryptor()
    return dec.update(ciphertext) + dec.finalize()

def normalize_phone(phone: str) -> str:
    """Normalize Togo phone numbers."""
    digits = "".join(c for c in phone if c.isdigit())
    if digits.startswith("228"):
        return "+" + digits
    if len(digits) == 8:
        return "+228" + digits
    return "+" + digits if not phone.startswith("+") else phone


def _coerce_bool(value: object, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() not in ("0", "false", "no", "off", "")
    return bool(value)


def normalize_openwa_base_url(url: str) -> str:
    url = (url or "").strip().rstrip("/")
    if url.endswith("/api"):
        url = url[:-4].rstrip("/")
    return url

async def get_platform_config() -> dict:
    s = await db.app_settings.find_one({"_id": "platform"}) or {}
    return {
        "premium_price_fcfa": s.get("premium_price_fcfa", 2000),
        "premium_duration_days": s.get("premium_duration_days", 30),
        "premium_enabled": s.get("premium_enabled", False),
        "auth_dev_mode": _coerce_bool(
            s.get("auth_dev_mode"),
            (os.environ.get("ENV_ENV") or os.environ.get("NODE_ENV") or "prod").strip().lower()
            in ("dev", "development", "local", "test"),
        ),
        "public_backend_url": s.get("public_backend_url") or os.environ.get("PUBLIC_BACKEND_URL", ""),
        "whatsapp_service_url": s.get("whatsapp_service_url") or os.environ.get("WHATSAPP_SERVICE_URL", ""),
        "whatsapp_api_key": s.get("whatsapp_api_key") or os.environ.get("WHATSAPP_API_KEY", ""),
        "whatsapp_session_id": s.get("whatsapp_session_id") or os.environ.get("WHATSAPP_SESSION_ID", "default"),
        "whatsapp_verify_ssl": s.get("whatsapp_verify_ssl", True),
        "notifications_enabled": s.get("notifications_enabled", True),
        "whatsapp_notifications_enabled": s.get("whatsapp_notifications_enabled", True),
        "email_notifications_enabled": s.get("email_notifications_enabled", True),
        "review_visibility_paywall": s.get("review_visibility_paywall", False),
    }


async def is_auth_dev_mode() -> bool:
    cfg = await get_platform_config()
    return bool(cfg["auth_dev_mode"])


async def get_email_config() -> dict:
    s = await db.app_settings.find_one({"_id": "platform"}) or {}
    return {
        "host": s.get("smtp_host") or os.environ.get("SMTP_HOST", ""),
        "port": int(s.get("smtp_port") or os.environ.get("SMTP_PORT", "587") or 587),
        "username": s.get("smtp_user") or os.environ.get("SMTP_USER", ""),
        "password": s.get("smtp_password") or os.environ.get("SMTP_PASSWORD", ""),
        "from_addr": s.get("smtp_from") or os.environ.get("SMTP_FROM", os.environ.get("SMTP_USER", "")),
        "use_tls": _coerce_bool(s.get("smtp_use_tls"), os.environ.get("SMTP_USE_TLS", "true").lower() not in ("0", "false", "no")),
        "use_ssl": _coerce_bool(s.get("smtp_use_ssl"), os.environ.get("SMTP_USE_SSL", "false").lower() in ("1", "true", "yes")),
    }


async def send_email_raw(recipient: str, subject: str, body: str) -> bool:
    cfg = await get_email_config()
    if not cfg["host"] or not cfg["from_addr"] or not recipient:
        return False

    def _send() -> bool:
        msg = EmailMessage()
        msg["From"] = cfg["from_addr"]
        msg["To"] = recipient
        msg["Subject"] = subject
        msg.set_content(body)

        if cfg["use_ssl"]:
            client = smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=15)
        else:
            client = smtplib.SMTP(cfg["host"], cfg["port"], timeout=15)
        try:
            client.ehlo()
            if cfg["use_tls"] and not cfg["use_ssl"]:
                client.starttls()
                client.ehlo()
            if cfg["username"]:
                client.login(cfg["username"], cfg["password"] or "")
            client.send_message(msg)
            return True
        finally:
            try:
                client.quit()
            except Exception:
                client.close()

    try:
        return await asyncio.to_thread(_send)
    except Exception as e:
        logger.warning(f"send_email_raw failed for {recipient}: {e}")
        return False

async def send_whatsapp(phone: str, text: str) -> bool:
    cfg = await get_platform_config()
    if not cfg["notifications_enabled"] or not cfg["whatsapp_notifications_enabled"]:
        return False
    wa_url = cfg["whatsapp_service_url"]
    wa_key = cfg["whatsapp_api_key"]
    wa_session = cfg["whatsapp_session_id"] or "default"
    if not wa_url or not wa_key:
        return False
    base = normalize_openwa_base_url(wa_url)
    endpoint = f"{base}/api/sessions/{wa_session}/messages/send-text"
    wa_phone = phone.lstrip("+").replace(" ", "") + "@c.us"
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10.0, verify=cfg["whatsapp_verify_ssl"]) as hc:
            r = await hc.post(
                endpoint,
                headers={"X-API-Key": wa_key, "Content-Type": "application/json"},
                json={"chatId": wa_phone, "text": text},
            )
            return 200 <= r.status_code < 300
    except Exception as e:
        logger.warning(f"send_whatsapp failed for {phone}: {e}")
        return False


async def send_email(recipient: str, subject: str, body: str) -> bool:
    platform = await get_platform_config()
    if not platform["notifications_enabled"] or not platform["email_notifications_enabled"]:
        return False
    return await send_email_raw(recipient, subject, body)


async def send_email_to_user(user_id: str, subject: str, body: str) -> bool:
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "email": 1})
    if not user or not user.get("email"):
        return False
    return await send_email(user["email"], subject, body)


async def _send_user_notification_channels(
    user_id: str,
    *,
    subject: str,
    body: str,
    whatsapp_text: Optional[str] = None,
) -> dict[str, bool]:
    cfg = await get_platform_config()
    if not cfg["notifications_enabled"]:
        return {"whatsapp": False, "email": False}

    user = await db.users.find_one({"id": user_id}, {"_id": 0, "phone": 1, "email": 1})
    results = {"whatsapp": False, "email": False}
    if cfg["whatsapp_notifications_enabled"] and user and user.get("phone") and whatsapp_text:
        results["whatsapp"] = await send_whatsapp(user["phone"], whatsapp_text)
    if cfg["email_notifications_enabled"] and user and user.get("email"):
        results["email"] = await send_email(user["email"], subject, body)
    return results

def notify_async(phone: str, text: str) -> None:
    try:
        asyncio.create_task(send_whatsapp(phone, text))
    except Exception as e:
        logger.warning(f"notify_async scheduling failed: {e}")

async def notify_user(user_id: str, text: str) -> None:
    await _send_user_notification_channels(
        user_id,
        subject="Notification Kaba-Compta",
        body=text,
        whatsapp_text=text,
    )


async def notify_user_channels(
    user_id: str,
    *,
    notif_type: str,
    title: str,
    body: str,
    whatsapp_text: Optional[str] = None,
    email_subject: Optional[str] = None,
    email_body: Optional[str] = None,
    actor_id: Optional[str] = None,
    actor_name: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    link: Optional[str] = None,
) -> dict:
    notif = await create_in_app_notification(
        user_id,
        notif_type,
        title,
        body,
        actor_id=actor_id,
        actor_name=actor_name,
        entity_type=entity_type,
        entity_id=entity_id,
        link=link,
    )
    if not notif:
        return notif
    rendered_title = notif.get("title") if notif else title
    rendered_body = notif.get("body") if notif else body
    await _send_user_notification_channels(
        user_id,
        subject=email_subject or rendered_title,
        body=email_body or rendered_body,
        whatsapp_text=whatsapp_text or rendered_body,
    )
    return notif



async def notify_admins_channels(
    *,
    notif_type: str,
    title: str,
    body: str,
    whatsapp_text: Optional[str] = None,
    email_subject: Optional[str] = None,
    email_body: Optional[str] = None,
    actor_id: Optional[str] = None,
    actor_name: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    link: Optional[str] = None,
) -> int:
    admins = await db.users.find({"role": "admin", "banned": {"$ne": True}}, {"_id": 0, "id": 1}).to_list(100)
    sent = 0
    for admin in admins:
        notif = await create_in_app_notification(
            admin["id"],
            notif_type,
            title,
            body,
            actor_id=actor_id,
            actor_name=actor_name,
            entity_type=entity_type,
            entity_id=entity_id,
            link=link,
        )
        if not notif:
            continue
        rendered_title = notif.get("title") if notif else title
        rendered_body = notif.get("body") if notif else body
        await _send_user_notification_channels(
            admin["id"],
            subject=email_subject or rendered_title,
            body=email_body or rendered_body,
            whatsapp_text=whatsapp_text or rendered_body,
        )
        sent += 1
    return sent


def render_template_string(template: str, values: dict) -> str:
    result = template or ""
    for key, value in (values or {}).items():
        result = result.replace("{" + str(key) + "}", str(value or ""))
    return result

async def apply_notification_template(
    notif_type: str,
    title: str,
    body: str,
    whatsapp_text: Optional[str] = None,
    variables: Optional[dict] = None,
) -> tuple[str, str, Optional[str], bool]:
    template = await db.notification_templates.find_one({"key": notif_type}, {"_id": 0})
    if not template:
        return title, body, whatsapp_text, True
    if template.get("enabled") is False:
        return title, body, whatsapp_text, False
    values = {
        "title": title,
        "body": body,
        "whatsapp_text": whatsapp_text or body,
        **(variables or {}),
    }
    return (
        render_template_string(template.get("title_template") or title, values),
        render_template_string(template.get("body_template") or body, values),
        render_template_string(template.get("whatsapp_template") or whatsapp_text or body, values) if (template.get("whatsapp_template") or whatsapp_text) else None,
        True,
    )

async def create_in_app_notification(
    user_id: str,
    notif_type: str,
    title: str,
    body: str,
    *,
    actor_id: Optional[str] = None,
    actor_name: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    link: Optional[str] = None,
) -> dict:
    variables = {
        "actor_name": actor_name or "",
        "actor_id": actor_id or "",
        "entity_type": entity_type or "",
        "entity_id": entity_id or "",
        "link": link or "",
    }
    title, body, _, enabled = await apply_notification_template(notif_type, title, body, variables=variables)
    if not enabled:
        return {}
    doc = {
        "id": str(os.urandom(16).hex()),
        "user_id": user_id,
        "type": notif_type,
        "title": title,
        "body": body,
        "actor_id": actor_id,
        "actor_name": actor_name,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "link": link,
        "is_read": False,
        "created_at": now_iso(),
    }
    await db.notifications.insert_one(doc)
    doc.pop("_id", None)
    return doc

async def check_and_expire_kyc():
    from datetime import datetime, timezone
    today_iso = datetime.now(timezone.utc).date().isoformat()
    cursor = db.users.find({"role": "assistant", "kyc_status": "approved"})
    async for u in cursor:
        docs = await db.kyc_documents.find({
            "user_id": u["id"],
            "doc_type": {"$in": ["id_card", "passport"]}
        }).to_list(100)
        has_expired = False
        expired_doc_name = ""
        for d in docs:
            exp = d.get("expiry_date")
            if exp and exp < today_iso:
                has_expired = True
                expired_doc_name = d.get("doc_type")
                break
        if has_expired:
            await db.users.update_one({"id": u["id"]}, {"$set": {"kyc_status": "expired"}})
            doc_label = "Carte d'identité" if expired_doc_name == "id_card" else "Passeport"
            await notify_user(
                u["id"],
                f"⚠️ Kaba-Compta : Votre document de vérification ({doc_label}) a expiré. Votre badge professionnel 'Pro' a été retiré et vous ne pouvez plus faire de nouvelles offres de mission. Veuillez téléverser un document valide dans votre profil."
            )
            logger.info(f"[KYC] Expired KYC for user {u['id']} (phone {u.get('phone')}) due to expired {expired_doc_name}")
