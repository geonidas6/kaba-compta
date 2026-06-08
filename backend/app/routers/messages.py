import uuid
from fastapi import APIRouter, HTTPException, Depends

from app.database import db
from app.models import MessageCreate
from app.helpers import get_current_user, now_iso, notify_user

router = APIRouter(tags=["messages"])

@router.post("/offers/{offer_id}/messages")
async def offer_message_send(offer_id: str, data: MessageCreate, user: dict = Depends(get_current_user)):
    o = await db.offers.find_one({"id": offer_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Offre introuvable")
    m = await db.missions.find_one({"id": o["mission_id"]}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Mission introuvable")
    if user["id"] not in (m["merchant_id"], o["assistant_id"]):
        raise HTTPException(status_code=403, detail="Non autorisé")
    msg = {
        "id": str(uuid.uuid4()),
        "offer_id": offer_id,
        "mission_id": o["mission_id"],
        "sender_id": user["id"],
        "sender_name": user.get("display_name"),
        "body": data.body,
        "created_at": now_iso(),
    }
    await db.messages.insert_one(msg)
    msg.pop("_id", None)
    # Notify the other party
    other = m["merchant_id"] if user["id"] == o["assistant_id"] else o["assistant_id"]
    snippet = (data.body[:80] + "…") if len(data.body) > 80 else data.body
    await notify_user(
        other,
        f"💬 Kaba-Compta : Nouveau message de *{user.get('display_name')}* sur « {m['title']} »\n\n{snippet}"
    )
    return msg

@router.get("/offers/{offer_id}/messages")
async def offer_messages_get(offer_id: str, user: dict = Depends(get_current_user)):
    o = await db.offers.find_one({"id": offer_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Offre introuvable")
    m = await db.missions.find_one({"id": o["mission_id"]}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Mission introuvable")
    if user["id"] not in (m["merchant_id"], o["assistant_id"]) and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Non autorisé")
    msgs = await db.messages.find({"offer_id": offer_id}, {"_id": 0}).sort("created_at", 1).to_list(2000)
    return msgs

@router.get("/conversations")
async def conversations(user: dict = Depends(get_current_user)):
    """List active offer-based chat threads for current user."""
    if user["role"] == "merchant":
        # All offers on user's missions
        missions = await db.missions.find({"merchant_id": user["id"]}, {"_id": 0}).to_list(500)
        mission_ids = [m["id"] for m in missions]
        offers = await db.offers.find({"mission_id": {"$in": mission_ids}}, {"_id": 0}).to_list(2000)
    elif user["role"] == "assistant":
        offers = await db.offers.find({"assistant_id": user["id"]}, {"_id": 0}).to_list(2000)
        mission_ids = list({o["mission_id"] for o in offers})
        missions = await db.missions.find({"id": {"$in": mission_ids}}, {"_id": 0}).to_list(500)
    else:
        return []

    # Query real display names to prevent null names
    user_ids = set()
    for o in offers:
        user_ids.add(o["assistant_id"])
    for m in missions:
        user_ids.add(m["merchant_id"])

    users_data = await db.users.find({"id": {"$in": list(user_ids)}}, {"id": 1, "display_name": 1, "shop_name": 1}).to_list(2000)
    user_names = {u["id"]: (u.get("shop_name") or u.get("display_name") or "Utilisateur") for u in users_data}

    by_id = {m["id"]: m for m in missions}
    out = []
    for o in offers:
        last = await db.messages.find({"offer_id": o["id"]}, {"_id": 0}).sort("created_at", -1).limit(1).to_list(1)
        m = by_id.get(o["mission_id"])
        if not m:
            continue
        out.append({
            "offer_id": o["id"],
            "mission_id": o["mission_id"],
            "mission_slug": m.get("slug"),
            "mission_title": m.get("title"),
            "mission_status": m.get("status"),
            "merchant_name": user_names.get(m["merchant_id"], m.get("merchant_name") or "Marchand"),
            "assistant_name": user_names.get(o["assistant_id"], o.get("assistant_name") or "Assistant"),
            "offer_status": o.get("status"),
            "price_fcfa": o.get("price_fcfa"),
            "last_message": last[0] if last else None,
            "updated_at": (last[0]["created_at"] if last else o.get("updated_at")),
        })
    out.sort(key=lambda x: x.get("updated_at") or "", reverse=True)
    return out
