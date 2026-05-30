import os
import base64
import logging
import random
import asyncio
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
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    if user.get("banned"):
        raise HTTPException(status_code=403, detail="Compte suspendu")
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

async def get_platform_config() -> dict:
    s = await db.app_settings.find_one({"_id": "platform"}) or {}
    return {
        "premium_price_fcfa": s.get("premium_price_fcfa", 2000),
        "premium_duration_days": s.get("premium_duration_days", 30),
        "premium_enabled": s.get("premium_enabled", False),
        "public_backend_url": s.get("public_backend_url") or os.environ.get("PUBLIC_BACKEND_URL", ""),
        "whatsapp_service_url": s.get("whatsapp_service_url") or os.environ.get("WHATSAPP_SERVICE_URL", ""),
        "whatsapp_api_key": s.get("whatsapp_api_key") or os.environ.get("WHATSAPP_API_KEY", ""),
        "whatsapp_session_id": s.get("whatsapp_session_id") or os.environ.get("WHATSAPP_SESSION_ID", "default"),
        "whatsapp_verify_ssl": s.get("whatsapp_verify_ssl", True),
        "notifications_enabled": s.get("notifications_enabled", True),
        "review_visibility_paywall": s.get("review_visibility_paywall", False),
    }

async def send_whatsapp(phone: str, text: str) -> bool:
    cfg = await get_platform_config()
    wa_url = cfg["whatsapp_service_url"]
    wa_key = cfg["whatsapp_api_key"]
    wa_session = cfg["whatsapp_session_id"] or "default"
    if not wa_url or not wa_key:
        return False
    base = wa_url.rstrip("/")
    if base.endswith("/api"):
        base = base[:-4]
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

def notify_async(phone: str, text: str) -> None:
    try:
        asyncio.create_task(send_whatsapp(phone, text))
    except Exception as e:
        logger.warning(f"notify_async scheduling failed: {e}")

async def notify_user(user_id: str, text: str) -> None:
    cfg = await get_platform_config()
    if not cfg["notifications_enabled"]:
        return
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "phone": 1})
    if u and u.get("phone"):
        notify_async(u["phone"], text)

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
