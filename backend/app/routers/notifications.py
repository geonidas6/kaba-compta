from fastapi import APIRouter, Depends, HTTPException

from app.database import db
from app.helpers import get_current_user, now_iso

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def notifications_list(user: dict = Depends(get_current_user), limit: int = 50):
    limit = max(1, min(limit, 200))
    items = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return items


@router.get("/unread-count")
async def notifications_unread_count(user: dict = Depends(get_current_user)):
    count = await db.notifications.count_documents({"user_id": user["id"], "is_read": False})
    return {"count": count}


@router.post("/{notification_id}/read")
async def notification_mark_read(notification_id: str, user: dict = Depends(get_current_user)):
    n = await db.notifications.find_one({"id": notification_id}, {"_id": 0, "user_id": 1})
    if not n:
        raise HTTPException(status_code=404, detail="Notification introuvable")
    if n["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Non autorisé")
    await db.notifications.update_one({"id": notification_id}, {"$set": {"is_read": True, "read_at": now_iso()}})
    return {"ok": True}


@router.post("/read-all")
async def notifications_read_all(user: dict = Depends(get_current_user)):
    result = await db.notifications.update_many(
        {"user_id": user["id"], "is_read": False},
        {"$set": {"is_read": True, "read_at": now_iso()}},
    )
    return {"updated": result.modified_count}
