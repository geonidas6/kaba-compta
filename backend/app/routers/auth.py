import base64
import io
import random
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

import pyotp
import qrcode
from fastapi import APIRouter, HTTPException, Depends

from app.database import db
from app.models import (
    AuthResponse,
    LoginRequest,
    LoginVerifyRequest,
    OTPSendRequest,
    OTPVerifyRequest,
    PasswordChangeRequest,
    RegisterRequest,
    SecuritySettingsUpdate,
    TwoFactorCodeRequest,
    UserPublic,
)
from app.helpers import (
    normalize_phone,
    hash_password,
    verify_password,
    create_token,
    get_current_user,
    now_iso,
    send_whatsapp,
    apply_notification_template,
    public_user_doc,
    ensure_unique_user_slug,
    logger,
)

router = APIRouter(prefix="/auth", tags=["auth"])

LOGIN_CHALLENGE_MINUTES = 10
ISSUER_NAME = "Kaba-Compta"

def _expiry(minutes: int = LOGIN_CHALLENGE_MINUTES) -> str:
    return (datetime.now(timezone.utc) + timedelta(minutes=minutes)).isoformat()

def _parse_dt(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed

def _otp_code() -> str:
    return f"{random.randint(0, 999999):06d}"

async def _send_otp(phone: str, code: str, reason: str = "connexion", *, allow_dev_code: bool = False) -> tuple[Optional[str], str]:
    logger.info(f"[OTP] reason={reason} phone={phone} code={code}")
    template_key = "otp_phone_verification" if reason == "verification_telephone" else "otp_login"
    default_message = (
        f"🔐 Votre code Kaba-Compta est : *{code}*\n\n"
        "Ce code expire dans 10 minutes. Ne le partagez avec personne."
    )
    _, _, message_body, enabled = await apply_notification_template(
        template_key,
        "Code Kaba-Compta",
        f"Votre code est {code}.",
        default_message,
        {
            "code": code,
            "reason": reason,
            "expires_minutes": LOGIN_CHALLENGE_MINUTES,
            "app_name": "Kaba-Compta",
        },
    )
    if not enabled:
        raise HTTPException(status_code=503, detail="L'envoi des codes OTP WhatsApp est désactivé par l'administrateur.")
    sent = await send_whatsapp(phone, message_body or default_message)
    if sent:
        return None, "whatsapp"
    if allow_dev_code:
        return code, "whatsapp_dev"
    raise HTTPException(
        status_code=503,
        detail="Le service WhatsApp n'est pas prêt. Reconnectez la session WhatsApp dans OpenWA puis réessayez.",
    )

def _auth_payload(user: dict) -> dict:
    token = create_token(user["id"], user["role"])
    return {"token": token, "user": public_user_doc(user)}

async def _create_login_challenge(user: dict, methods: list[str]) -> dict:
    challenge_id = str(uuid.uuid4())
    otp_code = _otp_code() if "whatsapp_otp" in methods else None
    doc = {
        "id": challenge_id,
        "user_id": user["id"],
        "phone": user["phone"],
        "methods": methods,
        "otp_code": otp_code,
        "expires_at": _expiry(),
        "created_at": now_iso(),
    }
    await db.login_challenges.insert_one(doc)
    dev_code = None
    channel = None
    if otp_code:
        dev_code, channel = await _send_otp(user["phone"], otp_code, "connexion", allow_dev_code=False)
    return {
        "requires_2fa": True,
        "challenge_id": challenge_id,
        "methods": methods,
        "phone": user["phone"],
        "dev_code": dev_code,
        "channel": channel,
    }

@router.post("/register", response_model=AuthResponse)
async def register(data: RegisterRequest):
    if data.role == "admin":
        raise HTTPException(status_code=400, detail="Rôle non autorisé")
    phone = normalize_phone(data.phone)
    existing = await db.users.find_one({"phone": phone})
    if existing:
        raise HTTPException(status_code=400, detail="Numéro déjà utilisé")
    public_slug = await ensure_unique_user_slug(data.shop_name or data.display_name)
    user_doc = {
        "id": str(uuid.uuid4()),
        "phone": phone,
        "password_hash": hash_password(data.password),
        "role": data.role,
        "display_name": data.display_name,
        "email": data.email,
        "shop_name": data.shop_name,
        "city": data.city or "Lomé",
        "avatar_url": None,
        "public_slug": public_slug,
        "bio": "",
        "education_level": "Licence" if data.role == "assistant" else None,
        "skills": [],
        "languages": [],
        "experiences": [],
        "formations": [],
        "references": [],
        "kyc_status": "not_required" if data.role == "merchant" else "pending",
        "is_premium": False,
        "rating_avg": 0.0,
        "rating_count": 0,
        "phone_verified": False,
        "totp_enabled": False,
        "whatsapp_login_otp_enabled": False,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user_doc)
    return _auth_payload(user_doc)

@router.post("/login", response_model=AuthResponse)
async def login(data: LoginRequest):
    phone = normalize_phone(data.phone)
    user = await db.users.find_one({"phone": phone})
    if not user or not verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Numéro ou mot de passe incorrect")
    methods = []
    if user.get("totp_enabled") and user.get("totp_secret"):
        methods.append("totp")
    if user.get("whatsapp_login_otp_enabled"):
        methods.append("whatsapp_otp")
    if methods:
        return await _create_login_challenge(user, methods)
    return _auth_payload(user)

@router.post("/login/verify", response_model=AuthResponse)
async def login_verify(data: LoginVerifyRequest):
    challenge = await db.login_challenges.find_one({"id": data.challenge_id})
    if not challenge:
        raise HTTPException(status_code=400, detail="Vérification introuvable ou déjà utilisée")
    if datetime.now(timezone.utc) > _parse_dt(challenge["expires_at"]):
        await db.login_challenges.delete_one({"id": data.challenge_id})
        raise HTTPException(status_code=400, detail="Code expiré")
    if data.method not in challenge.get("methods", []):
        raise HTTPException(status_code=400, detail="Méthode de vérification invalide")
    user = await db.users.find_one({"id": challenge["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    code = (data.code or "").strip().replace(" ", "")
    if data.method == "totp":
        secret = user.get("totp_secret")
        if not user.get("totp_enabled") or not secret:
            raise HTTPException(status_code=400, detail="Application d'authentification non activée")
        if not pyotp.TOTP(secret).verify(code, valid_window=1):
            raise HTTPException(status_code=400, detail="Code incorrect")
    else:
        if challenge.get("otp_code") != code:
            raise HTTPException(status_code=400, detail="Code incorrect")

    await db.login_challenges.delete_one({"id": data.challenge_id})
    return _auth_payload(user)

@router.post("/otp/send")
async def otp_send(data: OTPSendRequest):
    phone = normalize_phone(data.phone)
    code = _otp_code()
    await db.otps.update_one(
        {"phone": phone},
        {"$set": {
            "phone": phone,
            "code": code,
            "expires_at": _expiry(),
            "created_at": now_iso(),
        }},
        upsert=True,
    )
    dev_code, channel = await _send_otp(phone, code, "verification_telephone", allow_dev_code=True)
    return {"sent": True, "dev_code": dev_code, "channel": channel}

@router.post("/otp/verify")
async def otp_verify(data: OTPVerifyRequest):
    phone = normalize_phone(data.phone)
    record = await db.otps.find_one({"phone": phone}, {"_id": 0})
    if not record or record["code"] != data.code:
        raise HTTPException(status_code=400, detail="Code incorrect")
    if datetime.now(timezone.utc) > _parse_dt(record["expires_at"]):
        raise HTTPException(status_code=400, detail="Code expiré")
    await db.users.update_one({"phone": phone}, {"$set": {"phone_verified": True}})
    await db.otps.delete_one({"phone": phone})
    return {"verified": True}

@router.post("/2fa/totp/setup")
async def totp_setup(user: dict = Depends(get_current_user)):
    secret = pyotp.random_base32()
    account = f"{user.get('display_name') or user.get('phone')} ({user.get('phone')})"
    uri = pyotp.TOTP(secret).provisioning_uri(name=account, issuer_name=ISSUER_NAME)
    qr = qrcode.QRCode(border=2, box_size=8)
    qr.add_data(uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#1F4E3D", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_data_url = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
    await db.users.update_one({"id": user["id"]}, {"$set": {"totp_pending_secret": secret}})
    return {"secret": secret, "otpauth_url": uri, "qr_data_url": qr_data_url}

@router.post("/2fa/totp/enable", response_model=UserPublic)
async def totp_enable(data: TwoFactorCodeRequest, user: dict = Depends(get_current_user)):
    full_user = await db.users.find_one({"id": user["id"]})
    secret = full_user.get("totp_pending_secret") or full_user.get("totp_secret")
    if not secret:
        raise HTTPException(status_code=400, detail="Lancez d'abord la configuration de l'application d'authentification")
    code = (data.code or "").strip().replace(" ", "")
    if not pyotp.TOTP(secret).verify(code, valid_window=1):
        raise HTTPException(status_code=400, detail="Code incorrect")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"totp_enabled": True, "totp_secret": secret}, "$unset": {"totp_pending_secret": ""}},
    )
    fresh = await db.users.find_one({"id": user["id"]})
    return public_user_doc(fresh)

@router.post("/2fa/totp/disable", response_model=UserPublic)
async def totp_disable(user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"totp_enabled": False}, "$unset": {"totp_secret": "", "totp_pending_secret": ""}},
    )
    fresh = await db.users.find_one({"id": user["id"]})
    return public_user_doc(fresh)

@router.put("/security", response_model=UserPublic)
async def update_security(data: SecuritySettingsUpdate, user: dict = Depends(get_current_user)):
    update = {}
    if data.whatsapp_login_otp_enabled is not None:
        update["whatsapp_login_otp_enabled"] = bool(data.whatsapp_login_otp_enabled)
    if update:
        await db.users.update_one({"id": user["id"]}, {"$set": update})
    fresh = await db.users.find_one({"id": user["id"]})
    return public_user_doc(fresh)

@router.put("/password")
async def change_password(data: PasswordChangeRequest, user: dict = Depends(get_current_user)):
    full_user = await db.users.find_one({"id": user["id"]})
    if not full_user or not verify_password(data.current_password, full_user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")
    if len(data.new_password or "") < 6:
        raise HTTPException(status_code=400, detail="Le nouveau mot de passe doit contenir au moins 6 caractères")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(data.new_password)}})
    return {"changed": True}

@router.get("/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return user
