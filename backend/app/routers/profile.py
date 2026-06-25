from typing import Optional
import io
import os
import uuid
import base64
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Request
from fastapi.responses import StreamingResponse

from app.database import db
from app.models import ProfileUpdate, UserPublic
from app.helpers import get_current_user, encrypt_bytes, decrypt_bytes, now_iso, USER_PRIVATE_FIELDS, USER_PUBLIC_PRIVATE_FIELDS, ensure_unique_user_slug, public_profile_name, notify_admins_channels

router = APIRouter(tags=["profile"])

@router.post("/profile/avatar")
async def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    if file.content_type not in ("image/jpeg", "image/png", "image/jpg", "image/webp"):
        raise HTTPException(status_code=400, detail="Format d'image non supporté (JPG, PNG, WEBP uniquement)")
    
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Fichier vide")
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image trop volumineuse (max 5 Mo)")
    
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    
    os.makedirs("app/uploads", exist_ok=True)
    filepath = os.path.join("app/uploads", filename)
    with open(filepath, "wb") as f:
        f.write(data)
        
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or "localhost:8000"
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme or "http"
    if "://" in host:
        host = host.split("://")[-1]
    base_url = f"{proto}://{host}"
    avatar_url = f"{base_url}/uploads/{filename}"
    
    await db.users.update_one({"id": user["id"]}, {"$set": {"avatar_url": avatar_url}})
    return {"avatar_url": avatar_url}

@router.put("/profile", response_model=UserPublic)
async def update_profile(data: ProfileUpdate, user: dict = Depends(get_current_user)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    email = (update.get("email") or "").strip()
    if not email:
        raise HTTPException(status_code=400, detail="L'adresse email est obligatoire")
    update["email"] = email
    if update:
        if "display_name" in update or "shop_name" in update or not user.get("public_slug"):
            merged = {**user, **update}
            update["public_slug"] = await ensure_unique_user_slug(public_profile_name(merged), user["id"])
        update["updated_at"] = now_iso()
        await db.users.update_one({"id": user["id"]}, {"$set": update})
    fresh = await db.users.find_one({"id": user["id"]}, USER_PRIVATE_FIELDS)
    return fresh

@router.get("/users/{user_id}/public")
async def user_public(user_id: str, _: dict = Depends(get_current_user)):
    u = await db.users.find_one(
        {"id": user_id},
        USER_PUBLIC_PRIVATE_FIELDS
    )
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    return u

async def resolve_public_user(identifier: str):
    u = await db.users.find_one(
        {"$or": [{"public_slug": identifier}, {"id": identifier}]},
        USER_PUBLIC_PRIVATE_FIELDS
    )
    return u

@router.get("/users/{user_id}/public-profile")
async def user_public_profile(user_id: str):
    u = await resolve_public_user(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    
    resolved_user_id = u["id"]
    # Fetch user reviews
    user_reviews = await db.reviews.find({"to_user_id": resolved_user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Calculate average rating
    avg_rating = 0.0
    if user_reviews:
        avg_rating = sum(r["stars"] for r in user_reviews) / len(user_reviews)
    
    # Missions count (completed)
    missions_count = 0
    if u.get("role") == "merchant":
        missions_count = await db.missions.count_documents({"merchant_id": resolved_user_id, "status": "terminee"})
    else:
        missions_count = await db.missions.count_documents({"selected_assistant_id": resolved_user_id, "status": "terminee"})
        
    return {
        "user": u,
        "reviews": user_reviews,
        "avg_rating": round(avg_rating, 1),
        "reviews_count": len(user_reviews),
        "missions_count": missions_count,
    }


@router.post("/kyc/upload")
async def kyc_upload(
    doc_type: str = Form(...),
    file: UploadFile = File(...),
    expiry_date: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
):
    if user["role"] != "assistant":
        raise HTTPException(status_code=403, detail="Réservé aux comptables")
    if doc_type not in ("id_card", "passport", "diploma"):
        raise HTTPException(status_code=400, detail="Type de document invalide")
    if doc_type in ("id_card", "passport") and not expiry_date:
        raise HTTPException(status_code=400, detail="La date d'expiration est obligatoire pour les pièces d'identité")
    if file.content_type not in ("image/jpeg", "image/png", "image/jpg", "application/pdf"):
        raise HTTPException(status_code=400, detail="Format non supporté (JPG, PNG, PDF)")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Fichier vide")
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux (max 8 Mo)")
    ct, iv, tag = encrypt_bytes(data)
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "doc_type": doc_type,
        "filename": file.filename,
        "content_type": file.content_type,
        "ciphertext_b64": base64.b64encode(ct).decode("ascii"),
        "iv_b64": base64.b64encode(iv).decode("ascii"),
        "tag_b64": base64.b64encode(tag).decode("ascii"),
        "size": len(data),
        "uploaded_at": now_iso(),
    }
    if doc_type in ("id_card", "passport") and expiry_date:
        doc["expiry_date"] = expiry_date
    await db.kyc_documents.insert_one(doc)
    docs = await db.kyc_documents.find({"user_id": user["id"]}, {"doc_type": 1}).to_list(50)
    doc_types = {d.get("doc_type") for d in docs} | {doc_type}
    next_status = "pending" if (doc_types & {"id_card", "passport"}) and "diploma" in doc_types else "incomplete"
    await db.users.update_one({"id": user["id"]}, {"$set": {"kyc_status": next_status}})
    if next_status == "pending":
        await notify_admins_channels(
            notif_type="kyc_pending",
            title="Nouveau dossier KYC à valider",
            body=f"{user.get('display_name') or 'Un comptable'} a envoyé ses documents KYC et attend une validation.",
            whatsapp_text=f"Kaba-Compta Admin : {user.get('display_name') or 'Un comptable'} a envoyé ses documents KYC et attend une validation.",
            entity_type="kyc",
            entity_id=user["id"],
            link="/admin/kyc",
        )
    return {"id": doc["id"], "doc_type": doc_type, "size": doc["size"], "uploaded_at": doc["uploaded_at"], "kyc_status": next_status}

@router.get("/kyc/my")
async def kyc_my(user: dict = Depends(get_current_user)):
    docs = await db.kyc_documents.find(
        {"user_id": user["id"]},
        {"_id": 0, "ciphertext_b64": 0, "iv_b64": 0, "tag_b64": 0}
    ).to_list(50)
    return docs

@router.get("/kyc/{doc_id}/file")
async def kyc_download(doc_id: str, user: dict = Depends(get_current_user)):
    doc = await db.kyc_documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")
    if doc["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    plaintext = decrypt_bytes(
        base64.b64decode(doc["ciphertext_b64"]),
        base64.b64decode(doc["iv_b64"]),
        base64.b64decode(doc["tag_b64"]),
    )
    return StreamingResponse(io.BytesIO(plaintext), media_type=doc["content_type"])
