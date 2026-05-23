from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends

from app.database import db
from app.helpers import get_current_user, get_platform_config

router = APIRouter(tags=["premium"])

@router.post("/premium/subscribe")
async def premium_subscribe(user: dict = Depends(get_current_user)):
    if user["role"] != "assistant":
        raise HTTPException(status_code=403, detail="Réservé aux comptables")
    cfg = await get_platform_config()
    if not cfg["premium_enabled"]:
        raise HTTPException(
            status_code=400,
            detail="L'abonnement Premium n'est pas encore activé.",
        )
    expiry = (datetime.now(timezone.utc) + timedelta(days=int(cfg["premium_duration_days"]))).isoformat()
    await db.users.update_one({"id": user["id"]}, {"$set": {
        "is_premium": True,
        "premium_expires_at": expiry,
    }})
    return {
        "is_premium": True,
        "expires_at": expiry,
        "price_fcfa": cfg["premium_price_fcfa"],
        "duration_days": cfg["premium_duration_days"],
        "mock": True,
    }
