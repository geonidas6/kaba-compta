import random
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends

from app.database import db
from app.models import RegisterRequest, LoginRequest, OTPSendRequest, OTPVerifyRequest, AuthResponse, UserPublic
from app.helpers import (
    normalize_phone,
    hash_password,
    verify_password,
    create_token,
    get_current_user,
    now_iso,
    get_platform_config,
    logger
)

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=AuthResponse)
async def register(data: RegisterRequest):
    if data.role == "admin":
        raise HTTPException(status_code=400, detail="Rôle non autorisé")
    phone = normalize_phone(data.phone)
    existing = await db.users.find_one({"phone": phone})
    if existing:
        raise HTTPException(status_code=400, detail="Numéro déjà utilisé")
    user_doc = {
        "id": str(uuid.uuid4()),
        "phone": phone,
        "password_hash": hash_password(data.password),
        "role": data.role,
        "display_name": data.display_name,
        "shop_name": data.shop_name,
        "city": data.city or "Lomé",
        "avatar_url": None,
        "bio": "",
        "kyc_status": "not_required" if data.role == "merchant" else "pending",
        "is_premium": False,
        "rating_avg": 0.0,
        "rating_count": 0,
        "phone_verified": False,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user_doc)
    public = {k: v for k, v in user_doc.items() if k not in ("_id", "password_hash", "phone_verified")}
    token = create_token(user_doc["id"], user_doc["role"])
    return {"token": token, "user": public}

@router.post("/login", response_model=AuthResponse)
async def login(data: LoginRequest):
    phone = normalize_phone(data.phone)
    user = await db.users.find_one({"phone": phone})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Numéro ou mot de passe incorrect")
    public = {k: v for k, v in user.items() if k not in ("_id", "password_hash", "phone_verified")}
    token = create_token(user["id"], user["role"])
    return {"token": token, "user": public}

@router.post("/otp/send")
async def otp_send(data: OTPSendRequest):
    phone = normalize_phone(data.phone)
    code = f"{random.randint(0, 999999):06d}"
    await db.otps.update_one(
        {"phone": phone},
        {"$set": {
            "phone": phone,
            "code": code,
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
            "created_at": now_iso(),
        }},
        upsert=True,
    )
    logger.info(f"[OTP] phone={phone} code={code}")

    cfg = await get_platform_config()
    wa_url = cfg["whatsapp_service_url"]
    wa_key = cfg["whatsapp_api_key"]
    wa_session = cfg["whatsapp_session_id"] or "default"
    dev_code: Optional[str] = code
    channel = "whatsapp_dev"
    if wa_url and wa_key:
        try:
            import httpx
            base = wa_url.rstrip("/")
            if base.endswith("/api"):
                base = base[:-4]
            endpoint = f"{base}/api/sessions/{wa_session}/messages/send-text"
            wa_phone = phone.lstrip("+").replace(" ", "") + "@c.us"
            message_body = (
                f"🔐 Votre code de vérification Kaba-Compta est : *{code}*\n\n"
                "Ce code expire dans 10 minutes. Ne le partagez avec personne."
            )
            async with httpx.AsyncClient(timeout=10.0, verify=cfg["whatsapp_verify_ssl"]) as hc:
                r = await hc.post(
                    endpoint,
                    headers={"X-API-Key": wa_key, "Content-Type": "application/json"},
                    json={"chatId": wa_phone, "text": message_body},
                )
                if 200 <= r.status_code < 300:
                    channel = "whatsapp"
                    dev_code = None
                else:
                    logger.warning(f"[OTP] WhatsApp service error {r.status_code}")
        except Exception as e:
            logger.warning(f"[OTP] WhatsApp service unreachable: {e}")

    return {"sent": True, "dev_code": dev_code, "channel": channel}

@router.post("/otp/verify")
async def otp_verify(data: OTPVerifyRequest):
    phone = normalize_phone(data.phone)
    record = await db.otps.find_one({"phone": phone}, {"_id": 0})
    if not record or record["code"] != data.code:
        raise HTTPException(status_code=400, detail="Code incorrect")
    exp = datetime.fromisoformat(record["expires_at"])
    if datetime.now(timezone.utc) > exp:
        raise HTTPException(status_code=400, detail="Code expiré")
    await db.users.update_one({"phone": phone}, {"$set": {"phone_verified": True}})
    await db.otps.delete_one({"phone": phone})
    return {"verified": True}

@router.get("/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return user
