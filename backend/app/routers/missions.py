import uuid
import unicodedata
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends

from app.database import db
from app.models import MissionCreate, MissionUpdate, OfferCreate, MISSION_STATUSES
from app.helpers import get_current_user, now_iso, notify_user, notify_user_channels, ensure_unique_mission_slug

router = APIRouter(tags=["missions"])

MISSION_MATCH_KEYWORDS = {
    "caisse": ["caisse", "trésorerie", "encaissement", "cash"],
    "inventaire": ["inventaire", "stock", "stocks"],
    "audit": ["audit", "contrôle", "rapport"],
    "fiscal": ["fiscal", "tva", "taxe", "déclaration"],
    "paie": ["paie", "salaire", "salaires", "bulletin"],
    "creation_entreprise": ["création", "entreprise", "immatriculation", "statut"],
}


def _norm_text(value: str) -> str:
    value = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode("ascii")
    return " ".join(value.lower().split())


async def _match_assistants_for_mission(mission: dict) -> list[dict]:
    assistants = await db.users.find(
        {"role": "assistant", "kyc_status": "approved", "banned": {"$ne": True}},
        {"_id": 0, "id": 1, "display_name": 1, "shop_name": 1, "city": 1, "skills": 1, "email": 1, "phone": 1},
    ).to_list(2000)
    mission_text = _norm_text(" ".join([
        mission.get("title") or "",
        mission.get("description") or "",
        mission.get("type") or "",
        mission.get("location") or "",
    ]))
    mission_type = mission.get("type") or ""
    mission_location = _norm_text(mission.get("location") or "")
    keywords = set(MISSION_MATCH_KEYWORDS.get(mission_type, []))
    if mission_type:
        keywords.add(mission_type.replace("_", " "))
    matched = []
    for assistant in assistants:
        assistant_city = _norm_text(assistant.get("city") or "")
        location_match = bool(mission.get("remote_ok")) or (assistant_city and mission_location and assistant_city == mission_location)
        skills = [
            _norm_text(skill if isinstance(skill, str) else skill.get("name", ""))
            for skill in (assistant.get("skills") or [])
            if skill
        ]
        skill_match = any(skill and skill in mission_text for skill in skills)
        keyword_match = any(keyword in mission_text for keyword in keywords)
        if location_match or skill_match or keyword_match:
            matched.append(assistant)
    return matched


async def _notify_matching_assistants(mission: dict) -> int:
    matched = await _match_assistants_for_mission(mission)
    if not matched:
        return 0
    sent = 0
    title = "Nouvelle mission correspondant à votre profil"
    body = (
        f"La mission « {mission.get('title')} » à {mission.get('location')} correspond à votre profil. "
        "Ouvrez-la pour vérifier le détail et proposer votre offre."
    )
    whatsapp_text = (
        f"Kaba-Compta : une nouvelle mission « {mission.get('title')} » à {mission.get('location')} correspond à votre profil. "
        "Ouvrez l'application pour proposer votre offre."
    )
    for assistant in matched:
        await notify_user_channels(
            assistant["id"],
            notif_type="mission_match",
            title=title,
            body=body,
            whatsapp_text=whatsapp_text,
            entity_type="mission",
            entity_id=mission["id"],
            link=f"/app/missions/{mission['id']}",
        )
        sent += 1
    return sent

async def resolve_mission(identifier: str) -> dict | None:
    return await db.missions.find_one({"$or": [{"id": identifier}, {"slug": identifier}]}, {"_id": 0})

@router.post("/missions")
async def mission_create(data: MissionCreate, user: dict = Depends(get_current_user)):
    if user["role"] != "merchant":
        raise HTTPException(status_code=403, detail="Réservé aux marchands")
    m = {
        "id": str(uuid.uuid4()),
        "slug": await ensure_unique_mission_slug(data.title.strip()),
        "merchant_id": user["id"],
        "merchant_name": user.get("display_name") or user.get("shop_name") or "Marchand",
        "merchant_shop": user.get("shop_name"),
        "merchant_city": user.get("city"),
        **data.model_dump(),
        "status": "ouverte",
        "selected_offer_id": None,
        "selected_assistant_id": None,
        "selected_assistant_name": None,
        "offers_count": 0,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.missions.insert_one(m)
    await _notify_matching_assistants(m)
    m.pop("_id", None)
    return m

@router.get("/missions")
async def mission_list(
    user: dict = Depends(get_current_user),
    scope: str = "feed",
    status_f: Optional[str] = None,
    type_f: Optional[str] = None,
    q: Optional[str] = None,
):
    flt: dict = {}
    if scope == "mine":
        if user["role"] == "merchant":
            flt["merchant_id"] = user["id"]
        else:
            flt["$or"] = [
                {"selected_assistant_id": user["id"]},
                {"offer_assistant_ids": user["id"]},
            ]
    elif scope == "feed":
        flt["status"] = {"$in": ["ouverte", "en_discussion"]}
    if status_f and status_f in MISSION_STATUSES:
        flt["status"] = status_f
    if type_f:
        flt["type"] = type_f
    if q:
        flt["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
        ]
    items = await db.missions.find(flt, {"_id": 0}).sort("created_at", -1).to_list(500)
    if user["role"] == "assistant" and items:
        mission_ids = [item["id"] for item in items]
        offers = await db.offers.find(
            {"assistant_id": user["id"], "mission_id": {"$in": mission_ids}},
            {"_id": 0, "mission_id": 1},
        ).to_list(500)
        offered_ids = {offer["mission_id"] for offer in offers}
        for item in items:
            item["has_my_offer"] = (
                item["id"] in offered_ids
                or user["id"] in (item.get("offer_assistant_ids") or [])
            )
    return items

@router.get("/missions/{mission_id}")
async def mission_get(mission_id: str, user: dict = Depends(get_current_user)):
    m = await resolve_mission(mission_id)
    if not m:
        raise HTTPException(status_code=404, detail="Mission introuvable")
    resolved_mission_id = m["id"]
    # Attach own offer if assistant
    if user["role"] == "assistant":
        own = await db.offers.find_one(
            {"mission_id": resolved_mission_id, "assistant_id": user["id"]},
            {"_id": 0}
        )
        m["my_offer"] = own
    
    # Check if user has already reviewed
    rev = await db.reviews.find_one({"mission_id": resolved_mission_id, "from_user_id": user["id"]})
    m["user_has_reviewed"] = True if rev else False
    return m

@router.put("/missions/{mission_id}")
async def mission_update(mission_id: str, data: MissionUpdate, user: dict = Depends(get_current_user)):
    m = await resolve_mission(mission_id)
    if not m:
        raise HTTPException(status_code=404, detail="Mission introuvable")
    resolved_mission_id = m["id"]
    if m["merchant_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Non autorisé")
    if m["status"] not in ("ouverte", "en_discussion"):
        raise HTTPException(status_code=400, detail="Mission non modifiable")
    update = data.model_dump(exclude_unset=True)
    if "title" in update:
        update["slug"] = await ensure_unique_mission_slug(update["title"], resolved_mission_id)
    update["updated_at"] = now_iso()
    await db.missions.update_one({"id": resolved_mission_id}, {"$set": update})
    fresh = await db.missions.find_one({"id": resolved_mission_id}, {"_id": 0})
    return fresh

@router.delete("/missions/{mission_id}")
async def mission_delete(mission_id: str, user: dict = Depends(get_current_user)):
    m = await resolve_mission(mission_id)
    if not m or m["merchant_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Non autorisé")
    resolved_mission_id = m["id"]
    if m["status"] not in ("ouverte", "en_discussion", "annulee"):
        raise HTTPException(status_code=400, detail="Mission non supprimable")
    await db.missions.delete_one({"id": resolved_mission_id})
    await db.offers.delete_many({"mission_id": resolved_mission_id})
    await db.messages.delete_many({"mission_id": resolved_mission_id})
    return {"deleted": True}

@router.post("/missions/{mission_id}/cancel")
async def mission_cancel(mission_id: str, user: dict = Depends(get_current_user)):
    m = await resolve_mission(mission_id)
    if not m or m["merchant_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Non autorisé")
    resolved_mission_id = m["id"]
    if m["status"] in ("terminee", "annulee"):
        raise HTTPException(status_code=400, detail="Mission déjà clôturée")
    await db.missions.update_one(
        {"id": resolved_mission_id},
        {"$set": {"status": "annulee", "updated_at": now_iso()}}
    )
    # Notify selected assistant if any
    if m.get("selected_assistant_id"):
        await notify_user(
            m["selected_assistant_id"],
            f"⚠️ Kaba-Compta : La mission « {m['title']} » a été fermée par le marchand."
        )
    return {"cancelled": True}

@router.post("/missions/{mission_id}/complete")
async def mission_complete(mission_id: str, user: dict = Depends(get_current_user)):
    m = await resolve_mission(mission_id)
    if not m or m["merchant_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Non autorisé")
    resolved_mission_id = m["id"]
    if m["status"] != "en_travail":
        raise HTTPException(status_code=400, detail="La mission doit être en cours")
    await db.missions.update_one(
        {"id": resolved_mission_id},
        {"$set": {"status": "terminee", "completed_at": now_iso(), "updated_at": now_iso()}}
    )
    if m.get("selected_assistant_id"):
        await notify_user(
            m["selected_assistant_id"],
            f"✅ Kaba-Compta : Mission « {m['title']} » marquée terminée. "
            f"N'hésitez pas à laisser un avis sur le marchand."
        )
    return {"completed": True}

@router.post("/missions/{mission_id}/offers")
async def offer_create_or_update(mission_id: str, data: OfferCreate, user: dict = Depends(get_current_user)):
    """Create or update the assistant's unique offer for this mission. Versions are kept."""
    if user["role"] != "assistant":
        raise HTTPException(status_code=403, detail="Réservé aux comptables")
    if user.get("kyc_status") != "approved":
        raise HTTPException(
            status_code=403,
            detail="Vous devez obligatoirement valider votre KYC (identité et diplôme) avant de pouvoir proposer vos services."
        )
    m = await resolve_mission(mission_id)
    if not m:
        raise HTTPException(status_code=404, detail="Mission introuvable")
    resolved_mission_id = m["id"]
    if m["status"] not in ("ouverte", "en_discussion"):
        raise HTTPException(status_code=400, detail="Mission non ouverte aux offres")
    if user["id"] == m["merchant_id"]:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas proposer une offre sur votre propre mission")

    existing = await db.offers.find_one({"mission_id": resolved_mission_id, "assistant_id": user["id"]}, {"_id": 0})

    if existing:
        # Push current values to history then update
        await db.offers.update_one(
            {"id": existing["id"]},
            {
                "$push": {"history": {
                    "price_fcfa": existing["price_fcfa"],
                    "delivery_days": existing["delivery_days"],
                    "message": existing["message"],
                    "updated_at": existing.get("updated_at"),
                }},
                "$set": {
                    "price_fcfa": float(data.price_fcfa),
                    "delivery_days": int(data.delivery_days),
                    "message": data.message,
                    "updated_at": now_iso(),
                }
            }
        )
        fresh = await db.offers.find_one({"id": existing["id"]}, {"_id": 0})
        await notify_user(
            m["merchant_id"],
            f"🔄 Kaba-Compta : *{user.get('display_name')}* a modifié son offre sur « {m['title']} »."
        )
        return fresh

    # New offer
    offer = {
        "id": str(uuid.uuid4()),
        "mission_id": resolved_mission_id,
        "assistant_id": user["id"],
        "assistant_name": user.get("display_name"),
        "assistant_rating": user.get("rating_avg", 0),
        "assistant_is_premium": user.get("is_premium", False),
        "price_fcfa": float(data.price_fcfa),
        "delivery_days": int(data.delivery_days),
        "message": data.message,
        "status": "active",
        "history": [],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.offers.insert_one(offer)
    update_doc: dict = {"$inc": {"offers_count": 1}, "$set": {"updated_at": now_iso()}}
    if m["status"] == "ouverte":
        update_doc["$set"]["status"] = "en_discussion"
    await db.missions.update_one({"id": resolved_mission_id}, update_doc)
    await db.missions.update_one(
        {"id": resolved_mission_id},
        {"$addToSet": {"offer_assistant_ids": user["id"]}}
    )
    await notify_user(
        m["merchant_id"],
        f"💬 Kaba-Compta : Nouvelle offre de *{user.get('display_name')}* "
        f"({int(data.price_fcfa)} FCFA, {data.delivery_days}j) sur « {m['title']} »."
    )
    offer.pop("_id", None)
    return offer

@router.get("/missions/{mission_id}/offers")
async def offer_list(mission_id: str, user: dict = Depends(get_current_user)):
    m = await resolve_mission(mission_id)
    if not m:
        raise HTTPException(status_code=404, detail="Mission introuvable")
    resolved_mission_id = m["id"]
    if user["role"] == "merchant" and m["merchant_id"] == user["id"]:
        offers = await db.offers.find({"mission_id": resolved_mission_id}, {"_id": 0}).sort([
            ("assistant_is_premium", -1),
            ("assistant_rating", -1),
            ("created_at", 1),
        ]).to_list(500)
        return offers
    # Assistants only see their own offer; admins see all
    if user["role"] == "admin":
        offers = await db.offers.find({"mission_id": resolved_mission_id}, {"_id": 0}).to_list(500)
        return offers
    own = await db.offers.find_one(
        {"mission_id": resolved_mission_id, "assistant_id": user["id"]},
        {"_id": 0}
    )
    return [own] if own else []

@router.get("/offers/my")
async def my_offers(user: dict = Depends(get_current_user)):
    if user["role"] != "assistant":
        return []
    offers = await db.offers.find({"assistant_id": user["id"]}, {"_id": 0}).sort("updated_at", -1).to_list(500)
    # Enrich with mission info
    ids = list({o["mission_id"] for o in offers})
    missions = await db.missions.find({"id": {"$in": ids}}, {"_id": 0}).to_list(500)
    by_id = {m["id"]: m for m in missions}
    for o in offers:
        o["mission"] = by_id.get(o["mission_id"])
    return offers

@router.delete("/offers/{offer_id}")
async def offer_withdraw(offer_id: str, user: dict = Depends(get_current_user)):
    o = await db.offers.find_one({"id": offer_id}, {"_id": 0})
    if not o or o["assistant_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Non autorisé")
    m = await db.missions.find_one({"id": o["mission_id"]}, {"_id": 0})
    if m and m.get("selected_offer_id") == offer_id:
        raise HTTPException(status_code=400, detail="Impossible de retirer une offre acceptée")
    await db.offers.delete_one({"id": offer_id})
    await db.missions.update_one(
        {"id": o["mission_id"]},
        {"$inc": {"offers_count": -1}, "$pull": {"offer_assistant_ids": user["id"]}}
    )
    return {"withdrawn": True}

@router.post("/missions/{mission_id}/select-offer/{offer_id}")
async def mission_select_offer(mission_id: str, offer_id: str, user: dict = Depends(get_current_user)):
    m = await resolve_mission(mission_id)
    if not m or m["merchant_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Non autorisé")
    resolved_mission_id = m["id"]
    if m["status"] not in ("ouverte", "en_discussion"):
        raise HTTPException(status_code=400, detail="Mission déjà attribuée")
    o = await db.offers.find_one({"id": offer_id, "mission_id": resolved_mission_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Offre introuvable")

    await db.missions.update_one({"id": resolved_mission_id}, {"$set": {
        "status": "en_travail",
        "selected_offer_id": offer_id,
        "selected_assistant_id": o["assistant_id"],
        "selected_assistant_name": o["assistant_name"],
        "agreed_price_fcfa": o["price_fcfa"],
        "agreed_delivery_days": o["delivery_days"],
        "updated_at": now_iso(),
    }})
    await db.offers.update_one({"id": offer_id}, {"$set": {"status": "selected"}})
    await db.offers.update_many(
        {"mission_id": resolved_mission_id, "id": {"$ne": offer_id}},
        {"$set": {"status": "not_selected"}}
    )
    await notify_user(
        o["assistant_id"],
        f"🎉 Kaba-Compta : Votre offre sur « {m['title']} » a été *retenue* !\n\n"
        f"Discutez avec le marchand directement dans l'app. Le paiement se fait hors plateforme."
    )
    return {"selected": True}

@router.get("/public/landing-data")
async def public_landing_data():
    freelance_count = await db.users.count_documents({"role": "assistant"})
    merchant_count = await db.users.count_documents({"role": "merchant"})
    question_count = await db.forum_questions.count_documents({})
    latest_questions = await db.forum_questions.find(
        {"is_hidden": False},
        {"_id": 0, "id": 1, "slug": 1, "title": 1, "answers_count": 1, "votes": 1}
    ).sort("created_at", -1).limit(4).to_list(4)

    # 6 latest missions with status="ouverte", sorted by created_at desc
    latest_missions = await db.missions.find(
        {"status": "ouverte"},
        {"_id": 0}
    ).sort("created_at", -1).limit(6).to_list(6)

    return {
        "freelance_count": freelance_count,
        "merchant_count": merchant_count,
        "question_count": question_count,
        "latest_questions": latest_questions,
        "latest_missions": latest_missions
    }

