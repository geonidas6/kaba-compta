import argparse
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

from app.config import logger
from app.database import client, db
from app.helpers import notify_user, now_iso, apply_notification_template, send_email_to_user
from app.routers.config_routes import build_sitemap_xml


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        if value.endswith("Z"):
            value = value[:-1] + "+00:00"
        dt = datetime.fromisoformat(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def fmt_title(value: Optional[str]) -> str:
    return (value or "Mission").strip() or "Mission"


async def create_notification_once(
    *,
    dedupe_key: str,
    user_id: str,
    notif_type: str,
    title: str,
    body: str,
    actor_id: Optional[str] = None,
    actor_name: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    link: Optional[str] = None,
    whatsapp_text: Optional[str] = None,
) -> bool:
    existing = await db.notifications.find_one({"dedupe_key": dedupe_key}, {"_id": 1})
    if existing:
        return False
    variables = {
        "actor_name": actor_name or "",
        "actor_id": actor_id or "",
        "entity_type": entity_type or "",
        "entity_id": entity_id or "",
        "link": link or "",
        "title": title,
        "body": body,
    }
    title, body, whatsapp_text, enabled = await apply_notification_template(notif_type, title, body, whatsapp_text, variables)
    if not enabled:
        return False
    doc = {
        "id": dedupe_key,
        "dedupe_key": dedupe_key,
        "user_id": user_id,
        "type": notif_type,
        "title": title,
        "body": body,
        "actor_id": actor_id,
        "actor_name": actor_name,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "link": link,
        "is_read": False,
        "created_at": now_iso(),
    }
    await db.notifications.insert_one(doc)
    if whatsapp_text:
        await notify_user(user_id, whatsapp_text)
    return True


async def notify_admins_once(dedupe_key: str, title: str, body: str, whatsapp_text: Optional[str] = None) -> int:
    admins = await db.users.find({"role": "admin", "banned": {"$ne": True}}, {"_id": 0, "id": 1}).to_list(100)
    count = 0
    for admin in admins:
        ok = await create_notification_once(
            dedupe_key=f"{dedupe_key}:{admin['id']}",
            user_id=admin["id"],
            notif_type="admin_digest",
            title=title,
            body=body,
            entity_type="admin",
            link="/admin/dashboard",
            whatsapp_text=whatsapp_text,
        )
        count += int(ok)
    return count


async def kyc_expiry() -> dict[str, Any]:
    today = utcnow().date().isoformat()
    checked = expired = notifications = 0
    cursor = db.users.find({"role": "assistant", "kyc_status": "approved"}, {"_id": 0})
    async for user in cursor:
        checked += 1
        docs = await db.kyc_documents.find(
            {"user_id": user["id"], "doc_type": {"$in": ["id_card", "passport"]}},
            {"_id": 0},
        ).to_list(100)
        expired_doc = None
        for doc in docs:
            exp = doc.get("expiry_date")
            if exp and exp < today:
                expired_doc = doc
                break
        if not expired_doc:
            continue
        expired += 1
        doc_type = expired_doc.get("doc_type")
        label = "carte d'identité" if doc_type == "id_card" else "passeport"
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"kyc_status": "expired", "kyc_expired_at": now_iso()}},
        )
        ok = await create_notification_once(
            dedupe_key=f"kyc_expired:{user['id']}:{expired_doc.get('id') or doc_type}:{expired_doc.get('expiry_date')}",
            user_id=user["id"],
            notif_type="kyc_expired",
            title="Document KYC expiré",
            body=f"Votre {label} est expiré. Veuillez soumettre une pièce valide pour réactiver votre vérification.",
            entity_type="kyc",
            entity_id=user["id"],
            link="/app/profile",
            whatsapp_text=(
                f"⚠️ Kaba-Compta : Votre {label} est expiré. "
                "Veuillez soumettre une pièce valide dans votre profil pour réactiver votre vérification KYC."
            ),
        )
        notifications += int(ok)
    return {"checked": checked, "expired": expired, "notifications": notifications}


async def mission_status_housekeeping() -> dict[str, Any]:
    now = utcnow()
    stale_cutoff = now - timedelta(days=45)
    closed = offers_synced = overdue_marked = 0

    cursor = db.missions.find(
        {
            "status": {"$in": ["ouverte", "en_discussion"]},
            "updated_at": {"$lt": stale_cutoff.isoformat()},
            "auto_closed_at": {"$exists": False},
        },
        {"_id": 0},
    )
    async for mission in cursor:
        await db.missions.update_one(
            {"id": mission["id"]},
            {"$set": {"status": "annulee", "auto_closed_at": now_iso(), "updated_at": now_iso()}},
        )
        await db.offers.update_many(
            {"mission_id": mission["id"], "status": "active"},
            {"$set": {"status": "not_selected", "updated_at": now_iso(), "closed_by_cron": True}},
        )
        closed += 1
        await create_notification_once(
            dedupe_key=f"mission_auto_closed:{mission['id']}",
            user_id=mission["merchant_id"],
            notif_type="mission_closed",
            title="Mission fermée automatiquement",
            body=f"La mission « {fmt_title(mission.get('title'))} » a été fermée car elle est restée inactive trop longtemps.",
            entity_type="mission",
            entity_id=mission["id"],
            link=f"/app/missions/{mission['id']}",
            whatsapp_text=f"Kaba-Compta : La mission « {fmt_title(mission.get('title'))} » a été fermée automatiquement après une longue période d'inactivité.",
        )

    closed_missions = await db.missions.find(
        {"status": {"$in": ["annulee", "terminee"]}},
        {"_id": 0, "id": 1, "selected_offer_id": 1},
    ).to_list(5000)
    for mission in closed_missions:
        flt = {"mission_id": mission["id"], "status": "active"}
        if mission.get("selected_offer_id"):
            flt["id"] = {"$ne": mission["selected_offer_id"]}
        result = await db.offers.update_many(
            flt,
            {"$set": {"status": "not_selected", "updated_at": now_iso(), "closed_by_cron": True}},
        )
        offers_synced += result.modified_count

    active = db.missions.find({"status": "en_travail", "deadline_overdue_at": {"$exists": False}}, {"_id": 0})
    async for mission in active:
        selected_at = parse_dt(mission.get("updated_at") or mission.get("created_at"))
        days = int(mission.get("agreed_delivery_days") or 0)
        if selected_at and days > 0 and selected_at + timedelta(days=days) < now:
            await db.missions.update_one(
                {"id": mission["id"]},
                {"$set": {"deadline_overdue_at": now_iso()}},
            )
            overdue_marked += 1

    return {"auto_closed": closed, "offers_checked": offers_synced, "overdue_marked": overdue_marked}


async def mission_notifications() -> dict[str, Any]:
    now = utcnow()
    sent = 0

    for hours in (24, 72):
        cutoff = now - timedelta(hours=hours)
        cursor = db.missions.find(
            {
                "status": "ouverte",
                "offers_count": 0,
                "created_at": {"$lt": cutoff.isoformat()},
            },
            {"_id": 0},
        )
        async for mission in cursor:
            ok = await create_notification_once(
                dedupe_key=f"mission_no_offer:{hours}h:{mission['id']}",
                user_id=mission["merchant_id"],
                notif_type="mission_no_offer",
                title="Aucune offre reçue",
                body=f"Votre mission « {fmt_title(mission.get('title'))} » n'a pas encore reçu d'offre.",
                entity_type="mission",
                entity_id=mission["id"],
                link=f"/app/missions/{mission['id']}",
                whatsapp_text=f"Kaba-Compta : Votre mission « {fmt_title(mission.get('title'))} » n'a pas encore reçu d'offre. Vous pouvez ajuster le budget ou préciser la description.",
            )
            sent += int(ok)

    cutoff = now - timedelta(hours=24)
    cursor = db.missions.find(
        {"status": "en_discussion", "offers_count": {"$gt": 0}, "updated_at": {"$lt": cutoff.isoformat()}},
        {"_id": 0},
    )
    async for mission in cursor:
        ok = await create_notification_once(
            dedupe_key=f"mission_pending_selection:24h:{mission['id']}",
            user_id=mission["merchant_id"],
            notif_type="mission_pending_selection",
            title="Des offres attendent votre décision",
            body=f"Vous avez reçu des offres pour « {fmt_title(mission.get('title'))} ». Choisissez un comptable ou discutez avec les candidats.",
            entity_type="mission",
            entity_id=mission["id"],
            link=f"/app/missions/{mission['id']}",
            whatsapp_text=f"Kaba-Compta : Des offres attendent votre décision pour « {fmt_title(mission.get('title'))} ». Consultez la mission pour choisir un comptable.",
        )
        sent += int(ok)

    active = db.missions.find({"status": "en_travail", "selected_assistant_id": {"$ne": None}}, {"_id": 0})
    async for mission in active:
        selected_at = parse_dt(mission.get("updated_at") or mission.get("created_at"))
        days = int(mission.get("agreed_delivery_days") or 0)
        if not selected_at or days <= 0:
            continue
        deadline = selected_at + timedelta(days=days)
        if now <= deadline <= now + timedelta(hours=24):
            ok = await create_notification_once(
                dedupe_key=f"mission_deadline_soon:{mission['id']}",
                user_id=mission["selected_assistant_id"],
                notif_type="mission_deadline",
                title="Mission bientôt à échéance",
                body=f"La mission « {fmt_title(mission.get('title'))} » arrive bientôt à échéance.",
                entity_type="mission",
                entity_id=mission["id"],
                link=f"/app/missions/{mission['id']}",
                whatsapp_text=f"Kaba-Compta : La mission « {fmt_title(mission.get('title'))} » arrive bientôt à échéance. Pensez à finaliser ou à échanger avec le marchand.",
            )
            sent += int(ok)
        if deadline < now:
            ok1 = await create_notification_once(
                dedupe_key=f"mission_overdue_assistant:{mission['id']}",
                user_id=mission["selected_assistant_id"],
                notif_type="mission_overdue",
                title="Mission en retard",
                body=f"La mission « {fmt_title(mission.get('title'))} » a dépassé le délai prévu.",
                entity_type="mission",
                entity_id=mission["id"],
                link=f"/app/missions/{mission['id']}",
                whatsapp_text=f"Kaba-Compta : La mission « {fmt_title(mission.get('title'))} » a dépassé le délai prévu. Merci de faire le point avec le marchand.",
            )
            ok2 = await create_notification_once(
                dedupe_key=f"mission_overdue_merchant:{mission['id']}",
                user_id=mission["merchant_id"],
                notif_type="mission_overdue",
                title="Mission à vérifier",
                body=f"La mission « {fmt_title(mission.get('title'))} » a dépassé le délai prévu. Vérifiez l'avancement ou clôturez-la si elle est terminée.",
                entity_type="mission",
                entity_id=mission["id"],
                link=f"/app/missions/{mission['id']}",
                whatsapp_text=f"Kaba-Compta : La mission « {fmt_title(mission.get('title'))} » a dépassé le délai prévu. Vérifiez l'avancement ou marquez-la terminée si nécessaire.",
            )
            sent += int(ok1) + int(ok2)

    return {"notifications": sent}


async def forum_notifications() -> dict[str, Any]:
    now = utcnow()
    sent = 0
    cutoff = now - timedelta(hours=48)
    cursor = db.forum_questions.find(
        {"is_hidden": False, "answers_count": 0, "created_at": {"$lt": cutoff.isoformat()}},
        {"_id": 0},
    )
    async for q in cursor:
        ok = await create_notification_once(
            dedupe_key=f"forum_unanswered_author:48h:{q['id']}",
            user_id=q["author_id"],
            notif_type="forum_unanswered",
            title="Votre question attend une réponse",
            body=f"Votre question « {q.get('title')} » n'a pas encore reçu de réponse.",
            entity_type="forum_question",
            entity_id=q["id"],
            link=f"/app/forum/{q['id']}",
            whatsapp_text=f"Kaba-Compta : Votre question « {q.get('title')} » n'a pas encore reçu de réponse. Vous pouvez préciser votre demande pour aider la communauté.",
        )
        sent += int(ok)

    unanswered_count = await db.forum_questions.count_documents({"is_hidden": False, "answers_count": 0})
    if unanswered_count:
        assistants = await db.users.find({"role": "assistant", "banned": {"$ne": True}}, {"_id": 0, "id": 1}).to_list(1000)
        digest_key = utcnow().date().isoformat()
        for assistant in assistants:
            ok = await create_notification_once(
                dedupe_key=f"forum_unanswered_digest:{digest_key}:{assistant['id']}",
                user_id=assistant["id"],
                notif_type="forum_digest",
                title="Questions forum à aider",
                body=f"{unanswered_count} question(s) du forum attendent une réponse.",
                entity_type="forum",
                link="/app/forum",
                whatsapp_text=f"Kaba-Compta : {unanswered_count} question(s) du forum attendent une réponse. Votre expertise peut aider un marchand ou un comptable.",
            )
            sent += int(ok)

    old_reports = await db.forum_reports.count_documents({"status": "open", "created_at": {"$lt": (now - timedelta(hours=24)).isoformat()}})
    if old_reports:
        sent += await notify_admins_once(
            f"forum_reports_open:{utcnow().date().isoformat()}",
            "Signalements forum à traiter",
            f"{old_reports} signalement(s) forum sont ouverts depuis plus de 24h.",
            whatsapp_text=f"Kaba-Compta Admin : {old_reports} signalement(s) forum sont ouverts depuis plus de 24h.",
        )
    return {"notifications": sent, "unanswered_questions": unanswered_count, "old_reports": old_reports}


async def cleanup() -> dict[str, Any]:
    now = utcnow()
    expired_otps = await db.otps.delete_many({"expires_at": {"$lt": now.isoformat()}})
    old_read_notifications = await db.notifications.delete_many({
        "is_read": True,
        "read_at": {"$lt": (now - timedelta(days=90)).isoformat()},
    })
    old_audit_logs = await db.audit_logs.delete_many({
        "created_at": {"$lt": (now - timedelta(days=180)).isoformat()},
    })
    return {
        "expired_otps_deleted": expired_otps.deleted_count,
        "read_notifications_deleted": old_read_notifications.deleted_count,
        "audit_logs_deleted": old_audit_logs.deleted_count,
    }


async def daily_digest() -> dict[str, Any]:
    today_key = utcnow().date().isoformat()
    sent = 0

    merchants = await db.users.find({"role": "merchant", "banned": {"$ne": True}}, {"_id": 0, "id": 1}).to_list(2000)
    for merchant in merchants:
        missions = await db.missions.find({"merchant_id": merchant["id"], "status": {"$in": ["ouverte", "en_discussion", "en_travail"]}}, {"_id": 0}).to_list(500)
        offers_waiting = sum(1 for m in missions if m.get("status") == "en_discussion" and int(m.get("offers_count") or 0) > 0)
        in_progress = sum(1 for m in missions if m.get("status") == "en_travail")
        if not missions and not offers_waiting and not in_progress:
            continue
        ok = await create_notification_once(
            dedupe_key=f"merchant_daily_digest:{today_key}:{merchant['id']}",
            user_id=merchant["id"],
            notif_type="daily_digest",
            title="Résumé de vos missions",
            body=f"Vous avez {len(missions)} mission(s) active(s), {offers_waiting} avec offres à décider, {in_progress} en cours.",
            entity_type="mission",
            link="/app/missions",
        )
        sent += int(ok)

    assistants = await db.users.find({"role": "assistant", "banned": {"$ne": True}}, {"_id": 0, "id": 1}).to_list(2000)
    available = await db.missions.count_documents({"status": {"$in": ["ouverte", "en_discussion"]}})
    unanswered = await db.forum_questions.count_documents({"is_hidden": False, "answers_count": 0})
    for assistant in assistants:
        offers = await db.offers.count_documents({"assistant_id": assistant["id"], "status": "active"})
        won = await db.offers.count_documents({"assistant_id": assistant["id"], "status": "selected"})
        ok = await create_notification_once(
            dedupe_key=f"assistant_daily_digest:{today_key}:{assistant['id']}",
            user_id=assistant["id"],
            notif_type="daily_digest",
            title="Résumé comptable",
            body=f"{available} mission(s) disponibles, {offers} offre(s) en attente, {won} mission(s) gagnée(s), {unanswered} question(s) forum sans réponse.",
            entity_type="dashboard",
            link="/app/assistant",
        )
        sent += int(ok)

    open_reports = await db.forum_reports.count_documents({"status": "open"})
    kyc_pending = await db.users.count_documents({"role": "assistant", "kyc_status": "pending"})
    users_today = await db.users.count_documents({"created_at": {"$gte": utcnow().date().isoformat()}})
    sent += await notify_admins_once(
        f"admin_daily_digest:{today_key}",
        "Résumé admin Kaba-Compta",
        f"{users_today} nouvel utilisateur aujourd'hui, {kyc_pending} KYC en attente, {open_reports} signalement(s) forum ouverts.",
    )
    return {"notifications": sent}


async def review_reminders() -> dict[str, Any]:
    now = utcnow()
    cutoff = now - timedelta(hours=24)
    sent = 0
    missions = await db.missions.find(
        {
            "status": "terminee",
            "$or": [
                {"completed_at": {"$lt": cutoff.isoformat()}},
                {"updated_at": {"$lt": cutoff.isoformat()}},
            ],
        },
        {"_id": 0},
    ).to_list(5000)
    for mission in missions:
        merchant_id = mission.get("merchant_id")
        assistant_id = mission.get("selected_assistant_id")
        if not merchant_id or not assistant_id:
            continue

        merchant_review = await db.reviews.find_one({"mission_id": mission["id"], "from_user_id": merchant_id}, {"_id": 1})
        if not merchant_review:
            title = "Laissez un avis"
            body = f"Votre mission « {fmt_title(mission.get('title'))} » est terminée. Donnez votre avis sur le comptable pour aider la communauté."
            ok = await create_notification_once(
                dedupe_key=f"review_reminder:merchant:{mission['id']}:{merchant_id}",
                user_id=merchant_id,
                notif_type="review_reminder",
                title=title,
                body=body,
                entity_type="mission",
                entity_id=mission["id"],
                link=f"/app/missions/{mission['id']}",
                whatsapp_text=f"Kaba-Compta : Votre mission « {fmt_title(mission.get('title'))} » est terminée. Donnez votre avis sur le comptable.",
            )
            if ok:
                await send_email_to_user(merchant_id, title, body)
                sent += 1

        assistant_review = await db.reviews.find_one({"mission_id": mission["id"], "from_user_id": assistant_id}, {"_id": 1})
        if not assistant_review:
            title = "Laissez un avis"
            body = f"Votre mission « {fmt_title(mission.get('title'))} » est terminée. Donnez votre avis sur le marchand pour compléter votre historique."
            ok = await create_notification_once(
                dedupe_key=f"review_reminder:assistant:{mission['id']}:{assistant_id}",
                user_id=assistant_id,
                notif_type="review_reminder",
                title=title,
                body=body,
                entity_type="mission",
                entity_id=mission["id"],
                link=f"/app/missions/{mission['id']}",
                whatsapp_text=f"Kaba-Compta : Votre mission « {fmt_title(mission.get('title'))} » est terminée. Donnez votre avis sur le marchand.",
            )
            if ok:
                await send_email_to_user(assistant_id, title, body)
                sent += 1
    return {"notifications": sent}


async def sitemap_generate() -> dict[str, Any]:
    xml = await build_sitemap_xml()
    await db.app_settings.update_one(
        {"_id": "sitemap_cache"},
        {"$set": {"xml": xml, "updated_at": now_iso()}},
        upsert=True,
    )
    return {"bytes": len(xml.encode("utf-8")), "updated_at": now_iso()}


TASKS = {
    "kyc_expiry": kyc_expiry,
    "mission_status_housekeeping": mission_status_housekeeping,
    "mission_notifications": mission_notifications,
    "forum_notifications": forum_notifications,
    "review_reminders": review_reminders,
    "cleanup": cleanup,
    "daily_digest": daily_digest,
    "sitemap_generate": sitemap_generate,
}


async def run_task(name: str) -> None:
    if name == "all":
        results = {}
        for task_name, fn in TASKS.items():
            results[task_name] = await fn()
        print(results)
        return
    fn = TASKS.get(name)
    if not fn:
        raise SystemExit(f"Tâche inconnue: {name}. Tâches disponibles: {', '.join(sorted(TASKS))}, all")
    result = await fn()
    print({name: result})


def main() -> None:
    parser = argparse.ArgumentParser(description="Kaba-Compta scheduled jobs")
    parser.add_argument("task", choices=sorted(TASKS.keys()) + ["all"])
    args = parser.parse_args()
    try:
        asyncio.run(run_task(args.task))
    finally:
        client.close()


if __name__ == "__main__":
    main()
