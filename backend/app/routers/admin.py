import os
import io
import uuid
import base64
import zipfile
import json
import shutil
from datetime import datetime, timezone, timedelta
from typing import Optional, Literal

import httpx

import jwt as pyjwt
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import StreamingResponse, FileResponse

from app.database import db
from app.models import AdminUserUpdate, PlatformSettingsUpdate, BroadcastRequest, WhatsAppTestRequest, NotificationTemplateUpdate
from app.config import JWT_SECRET, JWT_ALGORITHM, logger
from app.helpers import (
    require_admin,
    decrypt_bytes,
    now_iso,
    normalize_phone,
    get_platform_config,
    public_profile_name,
    ensure_unique_user_slug,
    ensure_unique_forum_slug,
    ensure_unique_mission_slug,
    notify_user_channels,
)

router = APIRouter(prefix="/admin", tags=["admin"])

CRONICLE_TITLE_PREFIX = "Kaba-Compta - "

DEFAULT_NOTIFICATION_TEMPLATES = [
    {"key": "otp_login", "label": "OTP connexion WhatsApp", "title_template": "Code de connexion", "body_template": "Votre code de connexion est {code}.", "whatsapp_template": "🔐 Votre code Kaba-Compta est : *{code}*\n\nCe code expire dans {expires_minutes} minutes. Ne le partagez avec personne.", "audience": "Utilisateur connecté", "trigger": "Envoyé lors d'une connexion avec authentification WhatsApp."},
    {"key": "otp_phone_verification", "label": "OTP vérification téléphone", "title_template": "Code de vérification", "body_template": "Votre code de vérification est {code}.", "whatsapp_template": "✅ Kaba-Compta : votre code de vérification est *{code}*\n\nIl expire dans {expires_minutes} minutes.", "audience": "Utilisateur inscrit", "trigger": "Envoyé juste après l'inscription ou la vérification du numéro."},
    {"key": "forum_answer", "label": "Réponse à une question", "title_template": "Nouvelle réponse", "body_template": "{actor_name} a répondu à votre question.", "whatsapp_template": "Kaba-Compta : {actor_name} a répondu à votre question.", "audience": "Auteur de la question", "trigger": "Envoyé quand quelqu'un répond à une question du forum."},
    {"key": "forum_reaction", "label": "Réaction forum", "title_template": "Nouvelle réaction", "body_template": "{actor_name} a réagi à votre publication.", "whatsapp_template": "Kaba-Compta : {actor_name} a réagi à votre publication.", "audience": "Auteur de la publication", "trigger": "Envoyé quand quelqu'un réagit à une publication du forum."},
    {"key": "forum_reply", "label": "Commentaire sur réponse", "title_template": "Nouveau commentaire", "body_template": "{actor_name} a répondu à votre réponse.", "whatsapp_template": "Kaba-Compta : {actor_name} a répondu à votre réponse.", "audience": "Auteur de la réponse", "trigger": "Envoyé quand quelqu'un commente une réponse du forum."},
    {"key": "kyc_pending", "label": "KYC en attente", "title_template": "Nouveau dossier KYC", "body_template": "Un dossier KYC vient d'être soumis et attend votre validation.", "whatsapp_template": "Kaba-Compta : un dossier KYC vient d'être soumis et attend votre validation.", "audience": "Admins", "trigger": "Envoyé quand un comptable dépose un dossier KYC complet en attente de validation."},
    {"key": "mission_match", "label": "Mission correspondant au profil", "title_template": "Nouvelle mission compatible", "body_template": "Une nouvelle mission correspond à votre profil.", "whatsapp_template": "Kaba-Compta : une nouvelle mission correspond à votre profil.", "audience": "Comptables correspondants", "trigger": "Envoyé immédiatement après publication d'une mission compatible avec le profil."},
    {"key": "review_reminder", "label": "Rappel d'avis", "title_template": "Rappel d'avis à laisser", "body_template": "Votre mission est terminée. Il reste un avis à déposer.", "whatsapp_template": "Kaba-Compta : votre mission est terminée. Il reste un avis à déposer.", "audience": "Les deux participants de la mission", "trigger": "Envoyé après une mission terminée si un avis manque encore."},
    {"key": "kyc_approved", "label": "KYC approuvé", "title_template": "Documents approuvés", "body_template": "Votre dossier KYC a été approuvé. Vous pouvez maintenant accéder à toutes les fonctionnalités de Kaba-Compta.", "whatsapp_template": "Kaba-Compta : votre dossier KYC a été approuvé. Vous pouvez maintenant accéder à toutes les fonctionnalités.", "audience": "Assistant concerné", "trigger": "Envoyé juste après validation du dossier KYC par un admin."},
    {"key": "kyc_rejected", "label": "KYC rejeté", "title_template": "Documents à corriger", "body_template": "Votre dossier KYC n'a pas pu être validé. Merci de corriger vos documents et de les renvoyer.", "whatsapp_template": "Kaba-Compta : votre dossier KYC n'a pas pu être validé. Merci de corriger vos documents et de les renvoyer.", "audience": "Assistant concerné", "trigger": "Envoyé juste après un refus du dossier KYC."},
    {"key": "kyc_expired", "label": "KYC expiré", "title_template": "Document KYC expiré", "body_template": "{body}", "whatsapp_template": "{whatsapp_text}", "audience": "Assistant concerné", "trigger": "Envoyé automatiquement par cron quand une pièce d'identité expire."},
    {"key": "mission_no_offer", "label": "Mission sans offre", "title_template": "Aucune offre reçue", "body_template": "{body}", "whatsapp_template": "{whatsapp_text}", "audience": "Marchand créateur de la mission", "trigger": "Envoyé par cron quand une mission reste sans offre après un délai."},
    {"key": "mission_pending_selection", "label": "Offres en attente", "title_template": "Des offres attendent votre décision", "body_template": "{body}", "whatsapp_template": "{whatsapp_text}", "audience": "Marchand créateur de la mission", "trigger": "Envoyé par cron quand des offres attendent une décision depuis un moment."},
    {"key": "mission_deadline", "label": "Échéance mission", "title_template": "Mission bientôt à échéance", "body_template": "{body}", "whatsapp_template": "{whatsapp_text}", "audience": "Assistant assigné", "trigger": "Envoyé par cron quand la mission approche de son délai de livraison."},
    {"key": "mission_overdue", "label": "Mission en retard", "title_template": "Mission en retard", "body_template": "{body}", "whatsapp_template": "{whatsapp_text}", "audience": "Marchand et assistant", "trigger": "Envoyé par cron quand le délai prévu est dépassé."},
    {"key": "forum_unanswered", "label": "Question sans réponse", "title_template": "Votre question attend une réponse", "body_template": "{body}", "whatsapp_template": "{whatsapp_text}", "audience": "Auteur de la question", "trigger": "Envoyé par cron après un long silence sur une question du forum."},
    {"key": "forum_digest", "label": "Résumé forum comptables", "title_template": "Questions forum à aider", "body_template": "{body}", "whatsapp_template": "{whatsapp_text}", "audience": "Comptables actifs", "trigger": "Envoyé par cron quand des questions restent sans réponse."},
    {"key": "daily_digest", "label": "Résumé quotidien", "title_template": "{title}", "body_template": "{body}", "whatsapp_template": "{whatsapp_text}", "audience": "Marchands, comptables et admins selon leur rôle", "trigger": "Envoyé tous les jours par cron sous forme de résumé d'activité."},
]

CRONICLE_JOBS = [


    {
        "key": "kyc_expiry",
        "title": "KYC expiré",
        "description": "Expire les KYC dont la pièce est périmée et notifie le comptable.",
        "schedule": "Tous les jours à 02:00",
        "command": "docker exec kaba-compta-api-1 python -m app.crons kyc_expiry",
        "timing": {"hours": [2], "minutes": [0]},
    },
    {
        "key": "mission_status_housekeeping",
        "title": "Traitements missions",
        "description": "Ferme les missions inactives, synchronise les offres et marque les retards.",
        "schedule": "Toutes les heures",
        "command": "docker exec kaba-compta-api-1 python -m app.crons mission_status_housekeeping",
        "timing": {"minutes": [0]},
    },
    {
        "key": "mission_notifications",
        "title": "Notifications missions",
        "description": "Notifie les missions sans offre, décisions en attente, échéances et retards.",
        "schedule": "Toutes les 6 heures",
        "command": "docker exec kaba-compta-api-1 python -m app.crons mission_notifications",
        "timing": {"hours": [0, 6, 12, 18], "minutes": [0]},
    },
    {
        "key": "forum_notifications",
        "title": "Notifications forum",
        "description": "Relance les questions sans réponse et notifie les signalements admin.",
        "schedule": "Tous les jours à 10:00",
        "command": "docker exec kaba-compta-api-1 python -m app.crons forum_notifications",
        "timing": {"hours": [10], "minutes": [0]},
    },
    {
        "key": "review_reminders",
        "title": "Rappels d'avis",
        "description": "Relance les participants des missions terminées qui n'ont pas encore laissé d'avis.",
        "schedule": "Tous les jours à 09:00",
        "command": "docker exec kaba-compta-api-1 python -m app.crons review_reminders",
        "timing": {"hours": [9], "minutes": [0]},
    },

    {
        "key": "sitemap_generate",
        "title": "Sitemap SEO",
        "description": "Régénère le sitemap public avec les profils et les nouveaux sujets du forum.",
        "schedule": "Toutes les 6 heures",
        "command": "docker exec kaba-compta-api-1 python -m app.crons sitemap_generate",
        "timing": {"hours": [0, 6, 12, 18], "minutes": [10]},
    },
    {
        "key": "cleanup",
        "title": "Nettoyage technique",
        "description": "Supprime OTP expirés, notifications lues anciennes et vieux logs.",
        "schedule": "Tous les jours à 03:00",
        "command": "docker exec kaba-compta-api-1 python -m app.crons cleanup",
        "timing": {"hours": [3], "minutes": [0]},
    },
    {
        "key": "daily_digest",
        "title": "Résumé quotidien",
        "description": "Crée les résumés quotidiens marchand, comptable et admin.",
        "schedule": "Tous les jours à 08:00",
        "command": "docker exec kaba-compta-api-1 python -m app.crons daily_digest",
        "timing": {"hours": [8], "minutes": [0]},
    },
]


def normalize_cronicle_url(url: str) -> str:
    url = (url or "").strip()
    if url and not url.startswith(("http://", "https://")):
        url = "https://" + url
    url = url.rstrip("/")
    if url.endswith("/api"):
        url = url[:-4].rstrip("/")
    return url


def cronicle_json_response(response: httpx.Response, context: str, cronicle_url: str = "", request_info: Optional[dict] = None) -> dict:
    try:
        return response.json()
    except ValueError:
        content_type = response.headers.get("content-type", "")
        received_html = "html" in content_type.lower() or (response.text or "").lstrip().lower().startswith("<!doctype html")
        hint = "L'URL enregistrée semble pointer vers une page web, pas vers l'API Cronicle." if received_html else "Cronicle n'a pas renvoyé du JSON valide."
        message = (
            f"{hint} Vérifiez l'URL API Cronicle pendant {context}. "
            "Exemple attendu: https://cronicle.it-sefako.com"
            + (f". URL utilisée: {cronicle_url}" if cronicle_url else "")
        )
        raise HTTPException(
            status_code=502,
            detail={"message": message, "request": request_info},
        )


def cronicle_payload(job: dict) -> dict:
    return {
        "enabled": 1,
        "title": CRONICLE_TITLE_PREFIX + job["title"],
        "timezone": "Africa/Lome",
        "category": "general",
        "target": "allgrp",
        "algo": "prefer_first",
        "plugin": "shellplug",
        "params": {
            "script": "#!/bin/bash\n" + job["command"],
            "annotate": 1,
            "json": 1,
        },
        "timing": job["timing"],
        "max_children": 1,
        "timeout": 0,
        "retries": 0,
        "queue": 0,
        "queue_max": 0,
        "catch_up": 0,
        "detached": 0,
        "notes": job["description"],
    }


@router.get("/stats")
async def admin_stats(_: dict = Depends(require_admin)):
    users_count = await db.users.count_documents({})
    merchants = await db.users.count_documents({"role": "merchant"})
    assistants = await db.users.count_documents({"role": "assistant"})
    premium_assistants = await db.users.count_documents({"role": "assistant", "is_premium": True})
    missions_total = await db.missions.count_documents({})
    missions_open = await db.missions.count_documents({"status": {"$in": ["ouverte", "en_discussion"]}})
    missions_in_progress = await db.missions.count_documents({"status": "en_travail"})
    missions_completed = await db.missions.count_documents({"status": "terminee"})
    offers_total = await db.offers.count_documents({})
    forum_questions = await db.forum_questions.count_documents({})
    forum_answers = await db.forum_answers.count_documents({})
    open_reports = await db.forum_reports.count_documents({"status": "open"})
    kyc_pending = await db.users.count_documents({"role": "assistant", "kyc_status": "pending"})
    return {
        "users_count": users_count,
        "merchants": merchants,
        "assistants": assistants,
        "premium_assistants": premium_assistants,
        "missions_total": missions_total,
        "missions_open": missions_open,
        "missions_in_progress": missions_in_progress,
        "missions_completed": missions_completed,
        "offers_total": offers_total,
        "forum_questions": forum_questions,
        "forum_answers": forum_answers,
        "open_reports": open_reports,
        "kyc_pending_count": kyc_pending,
    }

@router.get("/users")
async def admin_users_list(
    _: dict = Depends(require_admin),
    role: Optional[str] = None,
    q: Optional[str] = None,
):
    flt: dict = {}
    if role:
        flt["role"] = role
    if q:
        flt["$or"] = [
            {"display_name": {"$regex": q, "$options": "i"}},
            {"shop_name": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
        ]
    users = await db.users.find(flt, {"_id": 0, "password_hash": 0, "phone_verified": 0, "totp_secret": 0, "totp_pending_secret": 0}).sort("created_at", -1).to_list(500)
    return users

@router.put("/users/{user_id}")
async def admin_user_update(user_id: str, data: AdminUserUpdate, _: dict = Depends(require_admin)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update:
        return {"updated": False}
    # If phone is updated, normalize it
    if "phone" in update:
        update["phone"] = normalize_phone(update["phone"])
    res = await db.users.update_one({"id": user_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    fresh = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0, "phone_verified": 0, "totp_secret": 0, "totp_pending_secret": 0})
    return fresh

@router.delete("/users/{user_id}")
async def admin_delete_user(user_id: str, _: dict = Depends(require_admin)):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if target.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Impossible de supprimer un administrateur")

    # Delete main user document
    await db.users.delete_one({"id": user_id})

    # Clean up relational collections
    await db.kyc_documents.delete_many({"user_id": user_id})
    await db.offers.delete_many({"assistant_id": user_id})
    await db.messages.delete_many({"$or": [{"sender_id": user_id}, {"recipient_id": user_id}]})
    await db.reviews.delete_many({"$or": [{"from_user_id": user_id}, {"to_user_id": user_id}]})
    await db.forum_questions.delete_many({"author_id": user_id})
    await db.forum_answers.delete_many({"author_id": user_id})
    await db.missions.delete_many({"merchant_id": user_id})
    await db.missions.update_many({"selected_assistant_id": user_id}, {"$set": {"selected_assistant_id": None, "status": "ouverte"}})

    logger.info(f"[DELETE_USER] user_id={user_id} deleted by admin")
    return {"deleted": True, "user_id": user_id}

@router.post("/users/{user_id}/impersonate")
async def admin_impersonate(user_id: str, admin: dict = Depends(require_admin)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0, "phone_verified": 0, "totp_secret": 0, "totp_pending_secret": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if target.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Impossible d'usurper un autre admin")
    payload = {
        "sub": target["id"],
        "role": target["role"],
        "imp": admin["id"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=2),
    }
    token = pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    logger.info(f"[IMPERSONATE] admin={admin['id']} -> user={user_id}")
    return {"token": token, "user": target, "impersonator_id": admin["id"]}

@router.get("/kyc/pending")
async def admin_kyc_pending(_: dict = Depends(require_admin)):
    assistants = await db.users.find(
        {"role": "assistant", "kyc_status": "pending"},
        {"_id": 0, "password_hash": 0, "phone_verified": 0, "totp_secret": 0, "totp_pending_secret": 0}
    ).to_list(500)
    out = []
    for u in assistants:
        docs = await db.kyc_documents.find(
            {"user_id": u["id"]},
            {"_id": 0, "ciphertext_b64": 0, "iv_b64": 0, "tag_b64": 0}
        ).to_list(20)
        out.append({"user": u, "documents": docs})
    return out

@router.get("/kyc/{doc_id}/file")
async def admin_kyc_file(doc_id: str, _: dict = Depends(require_admin)):
    doc = await db.kyc_documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")
    plaintext = decrypt_bytes(
        base64.b64decode(doc["ciphertext_b64"]),
        base64.b64decode(doc["iv_b64"]),
        base64.b64decode(doc["tag_b64"]),
    )
    return StreamingResponse(io.BytesIO(plaintext), media_type=doc["content_type"])

@router.post("/kyc/{user_id}/decision")
async def admin_kyc_decision(
    user_id: str,
    decision: str,
    _: dict = Depends(require_admin),
):
    if decision not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Décision invalide")
    new_status = "approved" if decision == "approve" else "rejected"
    res = await db.users.update_one({"id": user_id}, {"$set": {"kyc_status": new_status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    title = "Documents approuvés" if decision == "approve" else "Documents à corriger"
    body = (
        "Votre dossier KYC a été approuvé. Vous pouvez maintenant accéder à toutes les fonctionnalités de Kaba-Compta."
        if decision == "approve"
        else "Votre dossier KYC n'a pas pu être validé. Merci de corriger vos documents et de les renvoyer."
    )
    whatsapp_text = (
        "Kaba-Compta : votre dossier KYC a été approuvé. Vous pouvez maintenant accéder à toutes les fonctionnalités."
        if decision == "approve"
        else "Kaba-Compta : votre dossier KYC n'a pas pu être validé. Merci de corriger vos documents et de les renvoyer."
    )
    await notify_user_channels(
        user_id,
        notif_type="kyc_approved" if decision == "approve" else "kyc_rejected",
        title=title,
        body=body,
        whatsapp_text=whatsapp_text,
        entity_type="kyc",
        entity_id=user_id,
        link="/app/profile",
    )
    return {"user_id": user_id, "kyc_status": new_status}

@router.get("/missions")
async def admin_missions(_: dict = Depends(require_admin), status_f: Optional[str] = None):
    flt: dict = {}
    if status_f:
        flt["status"] = status_f
    items = await db.missions.find(flt, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

@router.get("/notification-templates")
async def admin_notification_templates(_: dict = Depends(require_admin)):
    existing = await db.notification_templates.find({}, {"_id": 0}).to_list(200)
    by_key = {item["key"]: item for item in existing}
    items = []
    for default in DEFAULT_NOTIFICATION_TEMPLATES:
        merged = {**default, **by_key.get(default["key"], {})}
        merged.setdefault("enabled", True)
        items.append(merged)
    return items

@router.put("/notification-templates/{key}")
async def admin_notification_template_update(key: str, data: NotificationTemplateUpdate, admin: dict = Depends(require_admin)):
    allowed = {item["key"] for item in DEFAULT_NOTIFICATION_TEMPLATES}
    if key not in allowed:
        raise HTTPException(status_code=404, detail="Modèle de notification introuvable")
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    update.update({"key": key, "updated_at": now_iso(), "updated_by": admin["id"]})
    await db.notification_templates.update_one({"key": key}, {"$set": update}, upsert=True)
    fresh = await db.notification_templates.find_one({"key": key}, {"_id": 0})
    return fresh


@router.get("/settings")
async def admin_settings_get(_: dict = Depends(require_admin)):
    platform = await db.app_settings.find_one({"_id": "platform"}) or {}
    public_url = platform.get("public_backend_url") or os.environ.get("PUBLIC_BACKEND_URL", "")

    def mask(s: str) -> str:
        if not s:
            return ""
        if len(s) <= 12:
            return "•" * len(s)
        return s[:8] + "•" * (len(s) - 12) + s[-4:]

    return {
        "platform": {
            "premium_enabled": platform.get("premium_enabled", False),
            "premium_price_fcfa": platform.get("premium_price_fcfa", 2000),
            "premium_duration_days": platform.get("premium_duration_days", 30),
            "review_visibility_paywall": platform.get("review_visibility_paywall", False),
            "public_backend_url": public_url,
            "whatsapp_service_url": platform.get("whatsapp_service_url", os.environ.get("WHATSAPP_SERVICE_URL", "")),
            "whatsapp_session_id": platform.get("whatsapp_session_id", "default"),
            "whatsapp_api_key_set": bool(platform.get("whatsapp_api_key") or os.environ.get("WHATSAPP_API_KEY", "")),
            "whatsapp_api_key_masked": mask(platform.get("whatsapp_api_key") or os.environ.get("WHATSAPP_API_KEY", "")),
            "whatsapp_verify_ssl": platform.get("whatsapp_verify_ssl", True),
            "notifications_enabled": platform.get("notifications_enabled", True),
            "cronicle_url": platform.get("cronicle_url", os.environ.get("CRONICLE_URL", "")),
            "cronicle_api_key_set": bool(platform.get("cronicle_api_key") or os.environ.get("CRONICLE_API_KEY", "")),
            "cronicle_api_key_masked": mask(platform.get("cronicle_api_key") or os.environ.get("CRONICLE_API_KEY", "")),
            "cronicle_jobs": CRONICLE_JOBS,
        }
    }

@router.put("/settings/platform")
async def admin_settings_platform(data: PlatformSettingsUpdate, admin: dict = Depends(require_admin)):
    current = await db.app_settings.find_one({"_id": "platform"}) or {"_id": "platform"}
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    current.update(update)
    current["updated_at"] = now_iso()
    current["updated_by"] = admin["id"]
    await db.app_settings.update_one({"_id": "platform"}, {"$set": current}, upsert=True)
    return {"updated": True, "fields": list(update.keys())}

@router.post("/cronicle/redeploy")
async def admin_cronicle_redeploy(admin: dict = Depends(require_admin)):
    platform = await db.app_settings.find_one({"_id": "platform"}) or {}
    cronicle_url = normalize_cronicle_url(platform.get("cronicle_url") or os.environ.get("CRONICLE_URL", ""))
    api_key = platform.get("cronicle_api_key") or os.environ.get("CRONICLE_API_KEY", "")
    if not cronicle_url or not api_key:
        raise HTTPException(status_code=400, detail="URL Cronicle et token API requis")

    deleted = []
    created = []
    errors = []
    requests = []
    try:
        async with httpx.AsyncClient(timeout=30.0) as hc:
            schedule_request = {
                "action": "get_schedule",
                "method": "GET",
                "url": f"{cronicle_url}/api/app/get_schedule",
                "params": {"api_key": "***", "offset": 0, "limit": 500},
            }
            requests.append(schedule_request)
            schedule = await hc.get(
                schedule_request["url"],
                params={"api_key": api_key, "offset": 0, "limit": 500},
            )
            schedule.raise_for_status()
            rows = cronicle_json_response(schedule, "la lecture du planning", cronicle_url, schedule_request).get("rows", [])
            for row in rows:
                title = row.get("title") or ""
                event_id = row.get("id")
                if not event_id or not title.startswith(CRONICLE_TITLE_PREFIX):
                    continue
                delete_request = {
                    "action": "delete_event",
                    "method": "POST",
                    "url": f"{cronicle_url}/api/app/delete_event",
                    "params": {"api_key": "***"},
                    "json": {"id": event_id, "title": title},
                }
                requests.append(delete_request)
                r = await hc.post(
                    delete_request["url"],
                    params={"api_key": api_key},
                    json={"id": event_id},
                )
                if 200 <= r.status_code < 300:
                    deleted.append({"id": event_id, "title": title})
                else:
                    errors.append({"action": "delete", "id": event_id, "title": title, "status": r.status_code, "body": r.text[:500]})

            for job in CRONICLE_JOBS:
                payload = cronicle_payload(job)
                create_request = {
                    "action": "create_event",
                    "method": "POST",
                    "url": f"{cronicle_url}/api/app/create_event",
                    "params": {"api_key": "***"},
                    "json": payload,
                }
                requests.append(create_request)
                r = await hc.post(
                    create_request["url"],
                    params={"api_key": api_key},
                    json=payload,
                )
                if 200 <= r.status_code < 300:
                    data = cronicle_json_response(r, "la création d'une tâche", cronicle_url, create_request) if r.content else {}
                    created.append({"title": payload["title"], "id": data.get("id")})
                else:
                    errors.append({"action": "create", "title": payload["title"], "status": r.status_code, "body": r.text[:500]})
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=502,
            detail={
                "message": f"Erreur de communication avec Cronicle: {str(e)}",
                "requests": requests,
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Cronicle redeploy failed")
        raise HTTPException(status_code=500, detail=f"Erreur Cronicle: {str(e)}")

    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "action": "cronicle_redeploy",
        "deleted_count": len(deleted),
        "created_count": len(created),
        "errors_count": len(errors),
        "created_at": now_iso(),
    })
    return {"deleted": deleted, "created": created, "errors": errors, "jobs": CRONICLE_JOBS, "requests": requests}


@router.get("/users/{user_id}/full")
async def admin_user_full(user_id: str, _: dict = Depends(require_admin)):
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0, "phone_verified": 0, "totp_secret": 0, "totp_pending_secret": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    missions_as_merchant = await db.missions.find(
        {"merchant_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    missions_as_assistant = await db.missions.find(
        {"selected_assistant_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    offers = await db.offers.find(
        {"assistant_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    reviews_received = await db.reviews.find(
        {"to_user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    reviews_given = await db.reviews.find(
        {"from_user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    forum_questions = await db.forum_questions.count_documents({"author_id": user_id})
    forum_answers = await db.forum_answers.count_documents({"author_id": user_id})
    kyc_docs = await db.kyc_documents.find(
        {"user_id": user_id},
        {"_id": 0, "ciphertext_b64": 0, "iv_b64": 0, "tag_b64": 0},
    ).to_list(50)
    audit_logs = await db.audit_logs.find(
        {"actor_user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)

    # Note: legacy features (payouts, payments, cash entries count, stock count, credits count)
    # are returned as zero or empty array to avoid breaking the frontend if it checks these fields.
    return {
        "user": u,
        "stats": {
            "missions_as_merchant": len(missions_as_merchant),
            "missions_as_assistant": len(missions_as_assistant),
            "offers_sent": len(offers),
            "forum_questions": forum_questions,
            "forum_answers": forum_answers,
            "reviews_received_count": len(reviews_received),
            "reviews_given_count": len(reviews_given),
            "audit_logs_count": len(audit_logs),
            "missions_as_merchant_count": len(missions_as_merchant),
            "missions_as_assistant_count": len(missions_as_assistant),
            "total_earned": 0,
            "total_spent": 0,
            "cash_entries_count": 0,
            "stock_items_count": 0,
            "credits_count": 0,
            "open_credits_count": 0,
        },
        "missions_as_merchant": missions_as_merchant,
        "missions_as_assistant": missions_as_assistant,
        "offers": offers,
        "reviews_received": reviews_received,
        "reviews_given": reviews_given,
        "kyc_documents": kyc_docs,
        "audit_logs": audit_logs,
        "payments": [],
        "payouts": [],
    }

@router.get("/audit-logs")
async def admin_audit_logs(_: dict = Depends(require_admin), limit: int = 200):
    logs = await db.audit_logs.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    ids = set()
    for lg in logs:
        if lg.get("admin_id"):
            ids.add(lg["admin_id"])
        if lg.get("actor_user_id"):
            ids.add(lg["actor_user_id"])
    users = await db.users.find(
        {"id": {"$in": list(ids)}},
        {"_id": 0, "id": 1, "display_name": 1, "role": 1, "shop_name": 1},
    ).to_list(500)
    by_id = {u["id"]: u for u in users}
    for lg in logs:
        a = by_id.get(lg.get("admin_id", ""))
        u = by_id.get(lg.get("actor_user_id", ""))
        lg["admin_name"] = a.get("display_name") if a else None
        lg["actor_name"] = u.get("display_name") if u else None
        lg["actor_role"] = u.get("role") if u else None
    return logs

@router.get("/forum/reports")
async def admin_forum_reports(_: dict = Depends(require_admin), status_f: str = "open"):
    flt: dict = {}
    if status_f and status_f != "all":
        flt["status"] = status_f
    reports = await db.forum_reports.find(flt, {"_id": 0}).sort("created_at", -1).to_list(500)
    for r in reports:
        if r["target_type"] == "question":
            t = await db.forum_questions.find_one({"id": r["target_id"]}, {"_id": 0, "title": 1, "body": 1, "is_hidden": 1})
        else:
            t = await db.forum_answers.find_one({"id": r["target_id"]}, {"_id": 0, "body": 1, "question_id": 1, "is_hidden": 1})
        r["target"] = t
    return reports

@router.post("/forum/reports/{report_id}/resolve")
async def admin_forum_report_resolve(
    report_id: str,
    action: str,  # dismiss | hide | delete
    admin: dict = Depends(require_admin),
):
    r = await db.forum_reports.find_one({"id": report_id}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Signalement introuvable")
    if action == "hide":
        coll = "forum_questions" if r["target_type"] == "question" else "forum_answers"
        await db[coll].update_one({"id": r["target_id"]}, {"$set": {"is_hidden": True}})
    elif action == "delete":
        if r["target_type"] == "question":
            await db.forum_questions.delete_one({"id": r["target_id"]})
            await db.forum_answers.delete_many({"question_id": r["target_id"]})
        else:
            await db.forum_answers.delete_one({"id": r["target_id"]})
    elif action != "dismiss":
        raise HTTPException(status_code=400, detail="Action invalide")
    await db.forum_reports.update_one(
        {"id": report_id},
        {"$set": {"status": "resolved", "action": action, "resolved_at": now_iso()}}
    )
    return {"resolved": True, "action": action}

@router.get("/forum/questions")
async def admin_forum_questions(_: dict = Depends(require_admin), q: Optional[str] = None):
    flt: dict = {}
    if q:
        flt["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"body": {"$regex": q, "$options": "i"}},
        ]
    questions = await db.forum_questions.find(flt, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return questions

@router.get("/forum/questions/{q_id}")
async def admin_forum_question_detail(q_id: str, _: dict = Depends(require_admin)):
    q = await db.forum_questions.find_one({"id": q_id}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="Question introuvable")
    return q

@router.post("/forum/questions/{q_id}/toggle-hide")
async def admin_forum_question_toggle_hide(q_id: str, _: dict = Depends(require_admin)):
    q = await db.forum_questions.find_one({"id": q_id})
    if not q:
        raise HTTPException(status_code=404, detail="Question introuvable")
    new_state = not q.get("is_hidden", False)
    await db.forum_questions.update_one({"id": q_id}, {"$set": {"is_hidden": new_state}})
    return {"id": q_id, "is_hidden": new_state}

@router.delete("/forum/questions/{q_id}")
async def admin_forum_question_delete(q_id: str, _: dict = Depends(require_admin)):
    await db.forum_questions.delete_one({"id": q_id})
    await db.forum_answers.delete_many({"question_id": q_id})
    return {"deleted": True}

@router.get("/forum/questions/{q_id}/answers")
async def admin_forum_question_answers(q_id: str, _: dict = Depends(require_admin)):
    answers = await db.forum_answers.find({"question_id": q_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return answers

@router.post("/forum/answers/{a_id}/toggle-hide")
async def admin_forum_answer_toggle_hide(a_id: str, _: dict = Depends(require_admin)):
    a = await db.forum_answers.find_one({"id": a_id})
    if not a:
        raise HTTPException(status_code=404, detail="Réponse introuvable")
    new_state = not a.get("is_hidden", False)
    await db.forum_answers.update_one({"id": a_id}, {"$set": {"is_hidden": new_state}})
    return {"id": a_id, "is_hidden": new_state}

@router.delete("/forum/answers/{a_id}")
async def admin_forum_answer_delete(a_id: str, _: dict = Depends(require_admin)):
    a = await db.forum_answers.find_one({"id": a_id})
    if a:
        await db.forum_answers.delete_one({"id": a_id})
        await db.forum_questions.update_one({"id": a["question_id"]}, {"$inc": {"answers_count": -1}})
    return {"deleted": True}

@router.delete("/forum/answers/{a_id}/replies/{reply_id}")
async def admin_forum_reply_delete(a_id: str, reply_id: str, _: dict = Depends(require_admin)):
    await db.forum_answers.update_one(
        {"id": a_id},
        {"$pull": {"replies": {"id": reply_id}}}
    )
    return {"deleted": True}

@router.post("/whatsapp/test")
async def admin_whatsapp_test(data: WhatsAppTestRequest, _: dict = Depends(require_admin)):
    cfg = await get_platform_config()
    wa_url = cfg["whatsapp_service_url"]
    wa_key = cfg["whatsapp_api_key"]
    wa_session = cfg["whatsapp_session_id"] or "default"
    if not wa_url or not wa_key:
        raise HTTPException(status_code=400, detail="URL et clé API WhatsApp doivent être configurées")
    phone = normalize_phone(data.phone)
    wa_phone = phone.lstrip("+").replace(" ", "") + "@c.us"
    body = data.message or (
        f"✅ Test Kaba-Compta : votre configuration WhatsApp fonctionne ! Envoyé le {now_iso()}."
    )
    base = wa_url.rstrip("/")
    if base.endswith("/api"):
        base = base[:-4]
    endpoint = f"{base}/api/sessions/{wa_session}/messages/send-text"
    payload = {"chatId": wa_phone, "text": body}
    sent_request = {
        "method": "POST",
        "endpoint": endpoint,
        "headers": {
            "X-API-Key": f"{wa_key[:8]}...{wa_key[-4:]}" if len(wa_key) > 12 else "********",
            "Content-Type": "application/json",
        },
        "json": payload,
    }
    try:
        import httpx
        async with httpx.AsyncClient(timeout=15.0, verify=cfg["whatsapp_verify_ssl"]) as hc:
            r = await hc.post(
                endpoint,
                headers={"X-API-Key": wa_key, "Content-Type": "application/json"},
                json=payload,
            )
        response_text = r.text[:4000]
        try:
            response_json = r.json()
        except Exception:
            response_json = None
        return {
            "ok": 200 <= r.status_code < 300,
            "status_code": r.status_code,
            "endpoint": endpoint,
            "phone_sent_to": wa_phone,
            "sent": sent_request,
            "api_response": {
                "status_code": r.status_code,
                "headers": dict(r.headers),
                "json": response_json,
                "text": response_text,
            },
            "response": response_text,
        }
    except Exception as e:
        return {
            "ok": False,
            "error": str(e),
            "endpoint": endpoint,
            "phone_sent_to": wa_phone,
            "sent": sent_request,
        }

@router.get("/whatsapp/status")
async def admin_whatsapp_status(_: dict = Depends(require_admin)):
    cfg = await get_platform_config()
    wa_url = cfg["whatsapp_service_url"]
    wa_key = cfg["whatsapp_api_key"]
    wa_session = cfg["whatsapp_session_id"] or "default"
    if not wa_url or not wa_key:
        return {"configured": False}
    base = wa_url.rstrip("/")
    if base.endswith("/api"):
        base = base[:-4]
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10.0, verify=cfg["whatsapp_verify_ssl"]) as hc:
            r = await hc.get(
                f"{base}/api/sessions/{wa_session}",
                headers={"X-API-Key": wa_key},
            )
        return {
            "configured": True,
            "status_code": r.status_code,
            "endpoint": f"{base}/api/sessions/{wa_session}",
            "data": r.json() if "application/json" in r.headers.get("content-type", "") else r.text[:500],
        }
    except Exception as e:
        return {"configured": True, "error": str(e)}

@router.post("/broadcast")
async def admin_broadcast(data: BroadcastRequest, admin: dict = Depends(require_admin)):
    if not data.message or len(data.message) < 2:
        raise HTTPException(status_code=400, detail="Message vide")
    if len(data.message) > 5000:
        raise HTTPException(status_code=400, detail="Message trop long (max 5000 caractères)")

    if data.audience == "user":
        if not data.user_id:
            raise HTTPException(status_code=400, detail="user_id requis")
        users = await db.users.find({"id": data.user_id}, {"_id": 0, "id": 1, "phone": 1, "display_name": 1}).to_list(1)
    elif data.audience == "all_merchants":
        users = await db.users.find(
            {"role": "merchant", "banned": {"$ne": True}},
            {"_id": 0, "id": 1, "phone": 1, "display_name": 1}
        ).to_list(10000)
    elif data.audience == "all_assistants":
        users = await db.users.find(
            {"role": "assistant", "banned": {"$ne": True}},
            {"_id": 0, "id": 1, "phone": 1, "display_name": 1}
        ).to_list(10000)
    else:
        users = await db.users.find(
            {"role": {"$in": ["merchant", "assistant"]}, "banned": {"$ne": True}},
            {"_id": 0, "id": 1, "phone": 1, "display_name": 1}
        ).to_list(10000)

    cfg = await get_platform_config()
    wa_url = cfg["whatsapp_service_url"]
    wa_key = cfg["whatsapp_api_key"]
    wa_session = cfg["whatsapp_session_id"] or "default"

    broadcast_id = str(uuid.uuid4())
    doc = {
        "id": broadcast_id,
        "admin_id": admin["id"],
        "admin_name": admin.get("display_name"),
        "audience": data.audience,
        "user_id": data.user_id,
        "message": data.message,
        "total_targets": len(users),
        "queued": 0,
        "failed": 0,
        "status": "processing",
        "batches": [],
        "created_at": now_iso(),
    }
    await db.broadcasts.insert_one(doc)

    if not wa_url or not wa_key:
        await db.broadcasts.update_one(
            {"id": broadcast_id},
            {"$set": {"status": "failed", "error": "WhatsApp non configuré"}}
        )
        raise HTTPException(status_code=400, detail="WhatsApp non configuré dans Paramètres")

    if len(users) == 0:
        await db.broadcasts.update_one(
            {"id": broadcast_id},
            {"$set": {"status": "completed", "queued": 0, "failed": 0}}
        )
        return {"broadcast_id": broadcast_id, "queued": 0, "failed": 0, "total": 0}

    base = wa_url.rstrip("/")
    if base.endswith("/api"):
        base = base[:-4]
    endpoint = f"{base}/api/sessions/{wa_session}/messages/send-bulk"

    queued = 0
    failed = 0
    batches_log = []
    import httpx
    async with httpx.AsyncClient(timeout=30.0, verify=cfg["whatsapp_verify_ssl"]) as hc:
        for i in range(0, len(users), 100):
            chunk = users[i:i + 100]
            messages = [
                {
                    "chatId": u["phone"].lstrip("+").replace(" ", "") + "@c.us",
                    "type": "text",
                    "content": {"text": data.message},
                }
                for u in chunk
            ]
            try:
                r = await hc.post(
                    endpoint,
                    headers={"X-API-Key": wa_key, "Content-Type": "application/json"},
                    json={
                        "messages": messages,
                        "options": {
                            "delayBetweenMessages": 3000,
                            "randomizeDelay": True,
                            "stopOnError": False,
                        },
                    },
                )
                if 200 <= r.status_code < 300:
                    queued += len(chunk)
                    try:
                        batches_log.append({"status": r.status_code, "data": r.json().get("data", {})})
                    except Exception:
                        batches_log.append({"status": r.status_code, "data": None})
                else:
                    failed += len(chunk)
                    batches_log.append({"status": r.status_code, "error": r.text[:200]})
            except Exception as e:
                failed += len(chunk)
                batches_log.append({"status": 0, "error": str(e)[:200]})

    final_status = "completed" if failed == 0 else ("partial" if queued > 0 else "failed")
    await db.broadcasts.update_one(
        {"id": broadcast_id},
        {"$set": {
            "status": final_status,
            "queued": queued,
            "failed": failed,
            "batches": batches_log,
            "completed_at": now_iso(),
        }}
    )
    return {
        "broadcast_id": broadcast_id,
        "queued": queued,
        "failed": failed,
        "total": len(users),
        "status": final_status,
    }

@router.get("/broadcasts")
async def admin_broadcasts_list(_: dict = Depends(require_admin), limit: int = 50):
    items = await db.broadcasts.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return items

# ===== BACKUP / RESTORE =====

BACKUP_DIR = "/Users/sefako/Documents/www/fazgom/backend/backups"

def get_backup_path(filename: str) -> str:
    safe_name = os.path.basename(filename or "")
    if safe_name != filename or not safe_name.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Nom de sauvegarde invalide")
    backup_dir = os.path.abspath(BACKUP_DIR)
    path = os.path.abspath(os.path.join(backup_dir, safe_name))
    if not path.startswith(backup_dir + os.sep):
        raise HTTPException(status_code=400, detail="Nom de sauvegarde invalide")
    return path

async def perform_restore(zip_bytes: bytes):
    import io
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zip_file:
        if "database_backup.json" not in zip_file.namelist():
            raise HTTPException(status_code=400, detail="Fichier database_backup.json manquant dans l'archive")
        
        db_data_raw = zip_file.read("database_backup.json").decode("utf-8")
        db_data = json.loads(db_data_raw)
        
        # Restore MongoDB collections
        for coll_name, docs in db_data.items():
            await db[coll_name].drop()
            if docs:
                for d in docs:
                    if "_id" in d:
                        del d["_id"]
                await db[coll_name].insert_many(docs)
        
        # Restore uploads if they were zipped
        uploads_path = "/Users/sefako/Documents/www/fazgom/backend/uploads"
        if os.path.exists(uploads_path):
            shutil.rmtree(uploads_path)
        os.makedirs(uploads_path, exist_ok=True)
        
        for name in zip_file.namelist():
            if name.startswith("uploads/"):
                rel_path = name[len("uploads/"):]
                if not rel_path:
                    continue
                dest_path = os.path.join(uploads_path, rel_path)
                os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                with open(dest_path, "wb") as f:
                    f.write(zip_file.read(name))

@router.post("/backup/create")
async def admin_backup_create(admin: dict = Depends(require_admin)):
    try:
        os.makedirs(BACKUP_DIR, exist_ok=True)
        filename = f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
        filepath = os.path.join(BACKUP_DIR, filename)

        # Fetch all collections
        collections = await db.list_collection_names()
        db_data = {}
        for coll_name in collections:
            docs = await db[coll_name].find({}).to_list(100000)
            serialized_docs = []
            for d in docs:
                if "_id" in d:
                    d["_id"] = str(d["_id"])
                serialized_docs.append(d)
            db_data[coll_name] = serialized_docs

        # Create zip
        with zipfile.ZipFile(filepath, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            zip_file.writestr("database_backup.json", json.dumps(db_data, indent=2))
            
            uploads_path = "/Users/sefako/Documents/www/fazgom/backend/uploads"
            if os.path.exists(uploads_path):
                for root, dirs, files in os.walk(uploads_path):
                    for file in files:
                        full_path = os.path.join(root, file)
                        rel_path = os.path.relpath(full_path, uploads_path)
                        zip_file.write(full_path, arcname=os.path.join("uploads", rel_path))

        logger.info(f"[BACKUP] backup created: {filename} by admin={admin['id']}")
        return {"message": "Sauvegarde créée avec succès", "filename": filename}
    except Exception as e:
        logger.error(f"[BACKUP] failed: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la création de la sauvegarde: {str(e)}")

@router.get("/backup/list")
async def admin_backup_list(_: dict = Depends(require_admin)):
    try:
        os.makedirs(BACKUP_DIR, exist_ok=True)
        files = []
        for f in os.listdir(BACKUP_DIR):
            if f.endswith(".zip"):
                full_path = os.path.join(BACKUP_DIR, f)
                stat = os.stat(full_path)
                files.append({
                    "filename": f,
                    "size": stat.st_size,
                    "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat()
                })
        files.sort(key=lambda x: x["created_at"], reverse=True)
        return files
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/backup/download/{filename}")
async def admin_backup_download(filename: str, _: dict = Depends(require_admin)):
    filepath = get_backup_path(filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Sauvegarde introuvable")
    return FileResponse(filepath, media_type="application/zip", filename=filename)

@router.post("/backup/restore/{filename}")
async def admin_backup_restore(filename: str, admin: dict = Depends(require_admin)):
    filepath = get_backup_path(filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Sauvegarde introuvable")
    try:
        with open(filepath, "rb") as f:
            data = f.read()
        await perform_restore(data)
        logger.info(f"[RESTORE] restore performed from {filename} by admin={admin['id']}")
        return {"message": "Restauration effectuée avec succès"}
    except Exception as e:
        logger.error(f"[RESTORE] failed: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la restauration: {str(e)}")

@router.delete("/backup/{filename}")
async def admin_backup_delete(filename: str, admin: dict = Depends(require_admin)):
    filepath = get_backup_path(filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Sauvegarde introuvable")
    try:
        os.remove(filepath)
        logger.info(f"[BACKUP] backup deleted: {filename} by admin={admin['id']}")
        return {"deleted": True, "filename": filename}
    except Exception as e:
        logger.error(f"[BACKUP] delete failed: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la suppression: {str(e)}")

@router.post("/backup/upload-restore")
async def admin_backup_upload_restore(file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Veuillez fournir un fichier .zip")
    try:
        data = await file.read()
        await perform_restore(data)
        logger.info(f"[RESTORE] restore performed from uploaded file {file.filename} by admin={admin['id']}")
        return {"message": "Restauration depuis le fichier effectuée avec succès"}
    except Exception as e:
        logger.error(f"[RESTORE_UPLOAD] failed: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la restauration: {str(e)}")

# ===== DEV TOOLS / FAKE DATA =====

@router.post("/dev/generate-fake-data")
async def admin_generate_fake_data(admin: dict = Depends(require_admin)):
    from app.helpers import hash_password
    import random
    
    try:
        # Keep admin users
        admin_users = await db.users.find({"role": "admin"}).to_list(100)
        
        # Clear tables
        await db.users.delete_many({"role": {"$ne": "admin"}})
        await db.missions.delete_many({})
        await db.offers.delete_many({})
        await db.messages.delete_many({})
        await db.reviews.delete_many({})
        await db.forum_questions.delete_many({})
        await db.forum_answers.delete_many({})
        await db.kyc_documents.delete_many({})
        await db.broadcasts.delete_many({})
        await db.audit_logs.delete_many({})
        
        # Seed 5 Merchants
        merchants = [
            {"id": str(uuid.uuid4()), "phone": "+22890111111", "display_name": "Elom Lawson", "shop_name": "Lawson Agro", "city": "Lomé", "role": "merchant"},
            {"id": str(uuid.uuid4()), "phone": "+22890222222", "display_name": "Akossiwa Adanlete", "shop_name": "Boutique Togo-Design", "city": "Lomé", "role": "merchant"},
            {"id": str(uuid.uuid4()), "phone": "+22890333333", "display_name": "Komi Agbovon", "shop_name": "Alimentation Agbovon", "city": "Kara", "role": "merchant"},
            {"id": str(uuid.uuid4()), "phone": "+22890444444", "display_name": "Ekoué Folly", "shop_name": "Folly Services", "city": "Sokodé", "role": "merchant"},
            {"id": str(uuid.uuid4()), "phone": "+22890555555", "display_name": "Adjoa Mawulolo", "shop_name": "Mawulolo Cosmétiques", "city": "Kpalimé", "role": "merchant"},
        ]
        
        pwd_hash = hash_password("password123")
        for m in merchants:
            m["public_slug"] = await ensure_unique_user_slug(public_profile_name(m), m["id"])
            m.update({
                "password_hash": pwd_hash,
                "avatar_url": None,
                "bio": "Commerçant indépendant actif.",
                "kyc_status": "not_required",
                "is_premium": False,
                "rating_avg": 0.0,
                "rating_count": 0,
                "phone_verified": True,
                "created_at": now_iso(),
            })
            await db.users.insert_one(m)
            
        # Seed 5 Assistants
        assistants = [
            {"id": str(uuid.uuid4()), "phone": "+22891111111", "display_name": "Koffi Mawulikplimi", "city": "Lomé", "role": "assistant", "kyc_status": "approved", "rating_avg": 4.8, "rating_count": 3, "is_premium": True},
            {"id": str(uuid.uuid4()), "phone": "+22891222222", "display_name": "Sena Ananou", "city": "Lomé", "role": "assistant", "kyc_status": "approved", "rating_avg": 4.5, "rating_count": 2, "is_premium": False},
            {"id": str(uuid.uuid4()), "phone": "+22891333333", "display_name": "Abla Kpomegbe", "city": "Kpalimé", "role": "assistant", "kyc_status": "approved", "rating_avg": 4.2, "rating_count": 1, "is_premium": False},
            {"id": str(uuid.uuid4()), "phone": "+22891444444", "display_name": "Kossi Sodji", "city": "Lomé", "role": "assistant", "kyc_status": "pending", "rating_avg": 0.0, "rating_count": 0, "is_premium": False},
            {"id": str(uuid.uuid4()), "phone": "+22891555555", "display_name": "Sika Agbeli", "city": "Atakpamé", "role": "assistant", "kyc_status": "pending", "rating_avg": 0.0, "rating_count": 0, "is_premium": False},
        ]
        
        for a in assistants:
            a["public_slug"] = await ensure_unique_user_slug(public_profile_name(a), a["id"])
            a.update({
                "password_hash": pwd_hash,
                "avatar_url": None,
                "bio": f"Licencié en gestion comptable. Disponible pour vos inventaires et pointages de caisse à {a['city']}.",
                "phone_verified": True,
                "created_at": now_iso(),
            })
            await db.users.insert_one(a)
            
        # Seed 6 Missions
        mission_templates = [
            {"title": "Faire inventaire complet de fin de mois", "type": "inventaire", "budget_min_fcfa": 5000, "budget_max_fcfa": 10000, "status": "ouverte"},
            {"title": "Tenue de journal de caisse hebdomadaire", "type": "caisse", "budget_min_fcfa": 3000, "budget_max_fcfa": 6000, "status": "en_discussion"},
            {"title": "Rapprochement et déclaration TPU OTR", "type": "fiscal", "budget_min_fcfa": 8000, "budget_max_fcfa": 15000, "status": "en_travail"},
            {"title": "Audit des stocks de marchandises", "type": "audit", "budget_min_fcfa": 10000, "budget_max_fcfa": 20000, "status": "terminee"},
            {"title": "Assistance bilan comptable annuel", "type": "fiscal", "budget_min_fcfa": 15000, "budget_max_fcfa": 30000, "status": "ouverte"},
            {"title": "Organisation des pièces comptables", "type": "autre", "budget_min_fcfa": 4000, "budget_max_fcfa": 8000, "status": "annulee"},
        ]
        
        missions = []
        for idx, t in enumerate(mission_templates):
            merchant = merchants[idx % len(merchants)]
            selected_assistant = None
            if t["status"] in ("en_travail", "terminee"):
                selected_assistant = assistants[0]["id"]
            elif t["status"] == "en_discussion":
                selected_assistant = assistants[1]["id"]
                
            mission_id = str(uuid.uuid4())
            m = {
                "id": mission_id,
                "merchant_id": merchant["id"],
                "merchant_name": merchant.get("display_name") or merchant.get("shop_name") or "Marchand",
                "merchant_shop": merchant.get("shop_name"),
                "merchant_city": merchant.get("city"),
                "slug": await ensure_unique_mission_slug(f"{t['title']} {merchant.get('shop_name') or merchant.get('display_name') or ''}", mission_id),
                "title": t["title"],
                "description": f"Besoin d'un assistant compétent pour : {t['title']}. Travail sérieux exigé.",
                "type": t["type"],
                "budget_min_fcfa": t["budget_min_fcfa"],
                "budget_max_fcfa": t["budget_max_fcfa"],
                "contract_type": "ponctuelle",
                "level": "intermediaire",
                "remote_ok": False,
                "location": merchant["city"],
                "start_date": "2026-06-01",
                "duration_hours": 4.0,
                "status": t["status"],
                "selected_assistant_id": selected_assistant,
                "selected_assistant_name": next((a["display_name"] for a in assistants if a["id"] == selected_assistant), None) if selected_assistant else None,
                "agreed_price_fcfa": t["budget_max_fcfa"] if selected_assistant else None,
                "created_at": now_iso(),
            }
            await db.missions.insert_one(m)
            missions.append(m)
            
        # Seed some Offers
        for m in missions:
            if m["status"] in ("ouverte", "en_discussion"):
                for a in assistants[:2]:
                    offer = {
                        "id": str(uuid.uuid4()),
                        "mission_id": m["id"],
                        "assistant_id": a["id"],
                        "assistant_name": a["display_name"],
                        "assistant_rating": a.get("rating_avg", 0),
                        "assistant_is_premium": a.get("is_premium", False),
                        "price_fcfa": float(m["budget_min_fcfa"] + 1000),
                        "delivery_days": 2,
                        "message": "Je suis très intéressé par votre mission et disponible rapidement.",
                        "status": "active",
                        "history": [],
                        "created_at": now_iso(),
                        "updated_at": now_iso(),
                    }
                    await db.offers.insert_one(offer)

        # Seed Forum
        questions = [
            {"title": "Quelle différence entre TPU et Taxe Professionnelle à Lomé ?", "tags": ["fiscalité", "tpu", "otr"]},
            {"title": "Comment enregistrer une perte de caisse en écriture comptable ?", "tags": ["comptabilité", "caisse", "perte"]},
            {"title": "Quelles pièces justificatives pour une dépense de transport ?", "tags": ["justificatifs", "dépenses"]},
            {"title": "Comment déclarer ses employés à la CNSS Togo ?", "tags": ["social", "cnss", "salariés"]},
        ]
        
        for idx, q in enumerate(questions):
            author = merchants[idx % len(merchants)]
            q_id = str(uuid.uuid4())
            question_doc = {
                "id": q_id,
                "author_id": author["id"],
                "author_name": author["display_name"],
                "author_role": author["role"],
                "slug": await ensure_unique_forum_slug(q["title"], q_id),
                "title": q["title"],
                "body": f"Bonjour la communauté, j'aimerais avoir des explications claires concernant : {q['title']}. Merci d'avance.",
                "tags": q["tags"],
                "votes": random.randint(1, 10),
                "voted_users": [],
                "answers_count": 0,
                "is_hidden": False,
                "created_at": now_iso(),
            }
            
            answers_count = 0
            for a_idx, assistant in enumerate(assistants[:2]):
                if random.choice([True, False]) or a_idx == 0:
                    answer_doc = {
                        "id": str(uuid.uuid4()),
                        "question_id": q_id,
                        "author_id": assistant["id"],
                        "author_name": assistant["display_name"],
                        "author_role": assistant["role"],
                        "body": f"Voici une réponse professionnelle pour votre question sur '{q['title']}'. En tant qu'assistant de gestion, je vous conseille de suivre les règles comptables standards applicables au Togo...",
                        "votes": random.randint(0, 5),
                        "voted_users": [],
                        "is_hidden": False,
                        "created_at": now_iso(),
                    }
                    await db.forum_answers.insert_one(answer_doc)
                    answers_count += 1
                    
            question_doc["answers_count"] = answers_count
            await db.forum_questions.insert_one(question_doc)

        from app.routers.config_routes import build_sitemap_xml

        sitemap_xml = await build_sitemap_xml()
        await db.app_settings.update_one(
            {"_id": "sitemap_cache"},
            {"$set": {"xml": sitemap_xml, "updated_at": now_iso()}},
            upsert=True,
        )

        logger.info(f"[DEV] Fake data generated successfully by admin={admin['id']}")
        return {
            "message": "Données de test générées avec succès ! Les anciennes données ont été nettoyées.",
            "sitemap_regenerated": True,
        }
    except Exception as e:
        logger.error(f"[DEV] generate-fake-data failed: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la génération: {str(e)}")


@router.post("/dev/reset-database")
async def admin_reset_database(admin: dict = Depends(require_admin)):
    try:
        # Keep admin users and platform settings, remove business/test data.
        await db.users.delete_many({"role": {"$ne": "admin"}})

        protected_collections = {"users", "app_settings"}
        collections = await db.list_collection_names()
        reset_collections = []
        for coll_name in collections:
            if coll_name in protected_collections:
                continue
            await db[coll_name].delete_many({})
            reset_collections.append(coll_name)

        logger.warning(
            f"[DEV] Database reset by admin={admin['id']} "
            f"(kept: users[admins], app_settings; cleared: {reset_collections})"
        )
        return {
            "message": "Base réinitialisée avec succès. Les comptes administrateurs et les paramètres plateforme ont été conservés.",
            "kept": ["admin_users", "app_settings"],
            "cleared_collections": reset_collections,
        }
    except Exception as e:
        logger.error(f"[DEV] reset-database failed: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la réinitialisation: {str(e)}")
