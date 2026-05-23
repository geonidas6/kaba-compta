import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends

from app.database import db
from app.models import ForumQuestionCreate, ForumQuestionUpdate, ForumAnswerCreate, ForumAnswerUpdate, ForumReport, ForumReplyCreate, ForumReactRequest
from app.helpers import get_current_user, now_iso, notify_user

router = APIRouter(prefix="/forum", tags=["forum"])

@router.post("/questions")
async def forum_question_create(data: ForumQuestionCreate, user: dict = Depends(get_current_user)):
    if not data.title or len(data.title.strip()) < 5:
        raise HTTPException(status_code=400, detail="Titre trop court (min 5 caractères)")
    if not data.body or len(data.body.strip()) < 10:
        raise HTTPException(status_code=400, detail="Question trop courte (min 10 caractères)")
    q = {
        "id": str(uuid.uuid4()),
        "author_id": user["id"],
        "author_name": user.get("display_name"),
        "author_role": user["role"],
        "title": data.title.strip(),
        "body": data.body.strip(),
        "tags": [t.strip().lower() for t in (data.tags or []) if t.strip()][:6],
        "votes": 0,
        "voters": [],
        "answers_count": 0,
        "is_hidden": False,
        "report_count": 0,
        "accepted_answer_id": None,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.forum_questions.insert_one(q)
    q.pop("_id", None)
    return q

@router.get("/questions")
async def forum_question_list(
    _: dict = Depends(get_current_user),
    q: Optional[str] = None,
    tag: Optional[str] = None,
    sort: str = "recent",  # recent | top | unanswered
    skip: int = 0,
    limit: int = 30,
):
    flt: dict = {"is_hidden": False}
    if tag:
        flt["tags"] = tag.lower()
    if q:
        flt["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"body": {"$regex": q, "$options": "i"}},
        ]
    if sort == "unanswered":
        flt["answers_count"] = 0
    sort_field = [("votes", -1), ("created_at", -1)] if sort == "top" else [("created_at", -1)]
    items = await db.forum_questions.find(flt, {"_id": 0, "voters": 0}).sort(sort_field).skip(skip).limit(limit).to_list(limit)    # Resolve avatars, KYC and Premium statuses for listing
    author_ids = list({x["author_id"] for x in items})
    users = await db.users.find({"id": {"$in": author_ids}}, {"id": 1, "avatar_url": 1, "kyc_status": 1, "is_premium": 1}).to_list(len(author_ids))
    avatars = {u["id"]: u.get("avatar_url") for u in users}
    kycs = {u["id"]: u.get("kyc_status") for u in users}
    premiums = {u["id"]: u.get("is_premium", False) for u in users}
    for item in items:
        item["author_avatar"] = avatars.get(item["author_id"])
        item["author_kyc_status"] = kycs.get(item["author_id"])
        item["author_is_premium"] = premiums.get(item["author_id"])

    return items


@router.get("/questions/{q_id}")
async def forum_question_get(q_id: str, user: dict = Depends(get_current_user)):
    q = await db.forum_questions.find_one({"id": q_id}, {"_id": 0})
    if not q or (q.get("is_hidden") and user.get("role") != "admin"):
        raise HTTPException(status_code=404, detail="Question introuvable")
    answers = await db.forum_answers.find(
        {"question_id": q_id, "is_hidden": False},
        {"_id": 0, "voters": 0}
    ).sort([("is_accepted", -1), ("votes", -1), ("created_at", 1)]).to_list(500)

    # Resolve avatars, KYC and Premium statuses for question, answers and nested replies
    author_ids = {q["author_id"]}
    for a in answers:
        author_ids.add(a["author_id"])
        for r in a.get("replies") or []:
            author_ids.add(r["author_id"])
    users = await db.users.find({"id": {"$in": list(author_ids)}}, {"id": 1, "avatar_url": 1, "kyc_status": 1, "is_premium": 1}).to_list(len(author_ids))
    avatars = {u["id"]: u.get("avatar_url") for u in users}
    kycs = {u["id"]: u.get("kyc_status") for u in users}
    premiums = {u["id"]: u.get("is_premium", False) for u in users}

    q["author_avatar"] = avatars.get(q["author_id"])
    q["author_kyc_status"] = kycs.get(q["author_id"])
    q["author_is_premium"] = premiums.get(q["author_id"])
    for a in answers:
        a["author_avatar"] = avatars.get(a["author_id"])
        a["author_kyc_status"] = kycs.get(a["author_id"])
        a["author_is_premium"] = premiums.get(a["author_id"])
        replies = a.get("replies") or []
        for r in replies:
            r["author_avatar"] = avatars.get(r["author_id"])
            r["author_kyc_status"] = kycs.get(r["author_id"])
            r["author_is_premium"] = premiums.get(r["author_id"])
        a["replies"] = replies

    q["answers"] = answers
    q["user_vote"] = 1 if user["id"] in q.get("voters", []) else 0
    q.pop("voters", None)
    return q

@router.put("/questions/{q_id}")
async def forum_question_update(q_id: str, data: ForumQuestionUpdate, user: dict = Depends(get_current_user)):
    q = await db.forum_questions.find_one({"id": q_id}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="Introuvable")
    if q["author_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Non autorisé")
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if "tags" in update:
        update["tags"] = [t.strip().lower() for t in update["tags"] if t.strip()][:6]
    update["updated_at"] = now_iso()
    await db.forum_questions.update_one({"id": q_id}, {"$set": update})
    fresh = await db.forum_questions.find_one({"id": q_id}, {"_id": 0})
    return fresh

@router.delete("/questions/{q_id}")
async def forum_question_delete(q_id: str, user: dict = Depends(get_current_user)):
    q = await db.forum_questions.find_one({"id": q_id}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="Introuvable")
    if q["author_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Non autorisé")
    await db.forum_questions.delete_one({"id": q_id})
    await db.forum_answers.delete_many({"question_id": q_id})
    return {"deleted": True}

@router.post("/questions/{q_id}/vote")
async def forum_question_vote(q_id: str, user: dict = Depends(get_current_user)):
    q = await db.forum_questions.find_one({"id": q_id}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="Introuvable")
    if user["id"] in q.get("voters", []):
        # Toggle off
        await db.forum_questions.update_one(
            {"id": q_id},
            {"$pull": {"voters": user["id"]}, "$inc": {"votes": -1}}
        )
        return {"voted": False}
    await db.forum_questions.update_one(
        {"id": q_id},
        {"$addToSet": {"voters": user["id"]}, "$inc": {"votes": 1}}
    )
    return {"voted": True}

@router.post("/questions/{q_id}/report")
async def forum_question_report(q_id: str, data: ForumReport, user: dict = Depends(get_current_user)):
    q = await db.forum_questions.find_one({"id": q_id}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="Introuvable")
    report = {
        "id": str(uuid.uuid4()),
        "target_type": "question",
        "target_id": q_id,
        "reporter_id": user["id"],
        "reporter_name": user.get("display_name"),
        "reason": data.reason,
        "status": "open",
        "created_at": now_iso(),
    }
    await db.forum_reports.insert_one(report)
    await db.forum_questions.update_one({"id": q_id}, {"$inc": {"report_count": 1}})
    return {"reported": True}

@router.post("/questions/{q_id}/answers")
async def forum_answer_create(q_id: str, data: ForumAnswerCreate, user: dict = Depends(get_current_user)):
    q = await db.forum_questions.find_one({"id": q_id}, {"_id": 0})
    if not q or q.get("is_hidden"):
        raise HTTPException(status_code=404, detail="Question introuvable")
    if not data.body or len(data.body.strip()) < 5:
        raise HTTPException(status_code=400, detail="Réponse trop courte")
    ans = {
        "id": str(uuid.uuid4()),
        "question_id": q_id,
        "author_id": user["id"],
        "author_name": user.get("display_name"),
        "author_role": user["role"],
        "body": data.body.strip(),
        "votes": 0,
        "voters": [],
        "is_accepted": False,
        "is_hidden": False,
        "report_count": 0,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.forum_answers.insert_one(ans)
    await db.forum_questions.update_one(
        {"id": q_id},
        {"$inc": {"answers_count": 1}, "$set": {"updated_at": now_iso()}}
    )
    # Notify question author
    if q["author_id"] != user["id"]:
        await notify_user(
            q["author_id"],
            f"💡 Kaba-Compta : *{user.get('display_name')}* a répondu à votre question « {q['title']} »."
        )
    ans.pop("_id", None)
    return ans

@router.put("/answers/{a_id}")
async def forum_answer_update(a_id: str, data: ForumAnswerUpdate, user: dict = Depends(get_current_user)):
    a = await db.forum_answers.find_one({"id": a_id}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Introuvable")
    if a["author_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Non autorisé")
    await db.forum_answers.update_one(
        {"id": a_id},
        {"$set": {"body": data.body.strip(), "updated_at": now_iso()}}
    )
    fresh = await db.forum_answers.find_one({"id": a_id}, {"_id": 0})
    return fresh

@router.delete("/answers/{a_id}")
async def forum_answer_delete(a_id: str, user: dict = Depends(get_current_user)):
    a = await db.forum_answers.find_one({"id": a_id}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Introuvable")
    if a["author_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Non autorisé")
    await db.forum_answers.delete_one({"id": a_id})
    await db.forum_questions.update_one(
        {"id": a["question_id"]},
        {"$inc": {"answers_count": -1}}
    )
    return {"deleted": True}

@router.post("/answers/{a_id}/vote")
async def forum_answer_vote(a_id: str, user: dict = Depends(get_current_user)):
    a = await db.forum_answers.find_one({"id": a_id}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Introuvable")
    if user["id"] in a.get("voters", []):
        await db.forum_answers.update_one(
            {"id": a_id},
            {"$pull": {"voters": user["id"]}, "$inc": {"votes": -1}}
        )
        return {"voted": False}
    await db.forum_answers.update_one(
        {"id": a_id},
        {"$addToSet": {"voters": user["id"]}, "$inc": {"votes": 1}}
    )
    return {"voted": True}

@router.post("/answers/{a_id}/accept")
async def forum_answer_accept(a_id: str, user: dict = Depends(get_current_user)):
    a = await db.forum_answers.find_one({"id": a_id}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Introuvable")
    q = await db.forum_questions.find_one({"id": a["question_id"]}, {"_id": 0})
    if not q or q["author_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Seul l'auteur de la question peut accepter")
    # Reset previous accepted
    await db.forum_answers.update_many(
        {"question_id": a["question_id"]},
        {"$set": {"is_accepted": False}}
    )
    await db.forum_answers.update_one({"id": a_id}, {"$set": {"is_accepted": True}})
    await db.forum_questions.update_one({"id": q["id"]}, {"$set": {"accepted_answer_id": a_id}})
    if a["author_id"] != user["id"]:
        await notify_user(
            a["author_id"],
            f"🏆 Kaba-Compta : Votre réponse a été acceptée sur « {q['title']} » !"
        )
    return {"accepted": True}

@router.post("/answers/{a_id}/report")
async def forum_answer_report(a_id: str, data: ForumReport, user: dict = Depends(get_current_user)):
    a = await db.forum_answers.find_one({"id": a_id}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Introuvable")
    report = {
        "id": str(uuid.uuid4()),
        "target_type": "answer",
        "target_id": a_id,
        "reporter_id": user["id"],
        "reporter_name": user.get("display_name"),
        "reason": data.reason,
        "status": "open",
        "created_at": now_iso(),
    }
    await db.forum_reports.insert_one(report)
    await db.forum_answers.update_one({"id": a_id}, {"$inc": {"report_count": 1}})
    return {"reported": True}

@router.get("/tags")
async def forum_tags(_: dict = Depends(get_current_user)):
    """Top tags used in the forum."""
    pipeline = [
        {"$match": {"is_hidden": False}},
        {"$unwind": "$tags"},
        {"$group": {"_id": "$tags", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 30},
    ]
    items = await db.forum_questions.aggregate(pipeline).to_list(30)
    return [{"tag": i["_id"], "count": i["count"]} for i in items]

def toggle_reaction_dict(reactions_dict: dict, user_id: str, emoji: str) -> dict:
    if not reactions_dict:
        reactions_dict = {}
    # Remove user_id from all reaction categories (only one reaction per user)
    for em, users in list(reactions_dict.items()):
        if user_id in users:
            users.remove(user_id)
            if not users:
                reactions_dict.pop(em, None)
            if em == emoji:
                return reactions_dict
    
    if emoji not in reactions_dict:
        reactions_dict[emoji] = []
    reactions_dict[emoji].append(user_id)
    return reactions_dict

@router.post("/questions/{q_id}/react")
async def forum_question_react(q_id: str, data: ForumReactRequest, user: dict = Depends(get_current_user)):
    q = await db.forum_questions.find_one({"id": q_id})
    if not q:
        raise HTTPException(status_code=404, detail="Question introuvable")
    reactions = q.get("reactions") or {}
    reactions = toggle_reaction_dict(reactions, user["id"], data.emoji)
    await db.forum_questions.update_one({"id": q_id}, {"$set": {"reactions": reactions}})
    return {"reactions": reactions}

@router.post("/answers/{a_id}/react")
async def forum_answer_react(a_id: str, data: ForumReactRequest, user: dict = Depends(get_current_user)):
    a = await db.forum_answers.find_one({"id": a_id})
    if not a:
        raise HTTPException(status_code=404, detail="Réponse introuvable")
    reactions = a.get("reactions") or {}
    reactions = toggle_reaction_dict(reactions, user["id"], data.emoji)
    await db.forum_answers.update_one({"id": a_id}, {"$set": {"reactions": reactions}})
    return {"reactions": reactions}

@router.post("/answers/{a_id}/replies")
async def forum_answer_reply(a_id: str, data: ForumReplyCreate, user: dict = Depends(get_current_user)):
    if not data.body or len(data.body.strip()) < 2:
        raise HTTPException(status_code=400, detail="Commentaire trop court")
    a = await db.forum_answers.find_one({"id": a_id})
    if not a:
        raise HTTPException(status_code=404, detail="Réponse introuvable")
    
    reply = {
        "id": str(uuid.uuid4()),
        "author_id": user["id"],
        "author_name": user.get("display_name"),
        "author_role": user["role"],
        "body": data.body.strip(),
        "reactions": {},
        "created_at": now_iso()
    }
    
    await db.forum_answers.update_one(
        {"id": a_id},
        {"$push": {"replies": reply}}
    )
    if a["author_id"] != user["id"]:
        q = await db.forum_questions.find_one({"id": a["question_id"]})
        if q:
            await notify_user(
                a["author_id"],
                f"💬 Kaba-Compta : *{user.get('display_name')}* a répondu à votre commentaire sur la question « {q['title']} »."
            )
            
    reply["author_avatar"] = user.get("avatar_url")
    return reply

@router.post("/answers/{a_id}/replies/{reply_id}/react")
async def forum_subreply_react(a_id: str, reply_id: str, data: ForumReactRequest, user: dict = Depends(get_current_user)):
    a = await db.forum_answers.find_one({"id": a_id})
    if not a:
        raise HTTPException(status_code=404, detail="Réponse introuvable")
    
    replies = a.get("replies") or []
    target_idx = -1
    for idx, r in enumerate(replies):
        if r["id"] == reply_id:
            target_idx = idx
            break
            
    if target_idx == -1:
        raise HTTPException(status_code=404, detail="Commentaire introuvable")
        
    reply = replies[target_idx]
    reactions = reply.get("reactions") or {}
    reactions = toggle_reaction_dict(reactions, user["id"], data.emoji)
    
    await db.forum_answers.update_one(
        {"id": a_id, "replies.id": reply_id},
        {"$set": {"replies.$.reactions": reactions}}
    )
    return {"reactions": reactions}
