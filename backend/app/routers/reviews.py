import uuid
from fastapi import APIRouter, HTTPException, Depends

from app.database import db
from app.models import ReviewCreate
from app.helpers import get_current_user, now_iso, notify_user, get_platform_config

router = APIRouter(tags=["reviews"])

@router.post("/reviews")
async def review_create(data: ReviewCreate, user: dict = Depends(get_current_user)):
    m = await db.missions.find_one({"id": data.mission_id}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Mission introuvable")
    if m["status"] != "terminee":
        raise HTTPException(status_code=400, detail="Mission non terminée")
    if user["id"] not in (m["merchant_id"], m.get("selected_assistant_id")):
        raise HTTPException(status_code=403, detail="Non autorisé")
    target_id = m["selected_assistant_id"] if user["id"] == m["merchant_id"] else m["merchant_id"]
    existing = await db.reviews.find_one({"mission_id": data.mission_id, "from_user_id": user["id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Déjà noté")
    stars = max(1, min(5, int(data.stars)))
    rev = {
        "id": str(uuid.uuid4()),
        "mission_id": data.mission_id,
        "from_user_id": user["id"],
        "from_user_name": user.get("display_name"),
        "to_user_id": target_id,
        "stars": stars,
        "comment": data.comment or "",
        "is_visible": True,
        "created_at": now_iso(),
    }
    await db.reviews.insert_one(rev)
    all_revs = await db.reviews.find({"to_user_id": target_id}, {"_id": 0}).to_list(5000)
    avg = sum(r["stars"] for r in all_revs) / len(all_revs)
    await db.users.update_one({"id": target_id}, {"$set": {
        "rating_avg": round(avg, 2),
        "rating_count": len(all_revs),
    }})
    await notify_user(
        target_id,
        f"⭐ Kaba-Compta : Nouvel avis ({stars}/5) de {user.get('display_name')}. Consultez votre profil."
    )
    rev.pop("_id", None)
    return rev

@router.get("/reviews/user/{user_id}")
async def reviews_user(user_id: str, _: dict = Depends(get_current_user)):
    cfg = await get_platform_config()
    flt: dict = {"to_user_id": user_id}
    if cfg.get("review_visibility_paywall"):
        # Only premium users have their reviews visible
        u = await db.users.find_one({"id": user_id}, {"_id": 0, "is_premium": 1})
        if not (u and u.get("is_premium")):
            flt["is_visible"] = True  # default to all visible at launch
    revs = await db.reviews.find(flt, {"_id": 0}).sort("created_at", -1).to_list(200)
    return revs
