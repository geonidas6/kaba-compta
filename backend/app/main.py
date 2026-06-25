import os
import uuid
import jwt as pyjwt
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware

from app.config import JWT_SECRET, JWT_ALGORITHM, logger
from app.database import db, client
from app.helpers import hash_password, now_iso, normalize_phone, ensure_unique_user_slug, public_profile_name, ensure_unique_forum_slug, ensure_unique_mission_slug
from app.routers import auth, profile, missions, messages, reviews, forum, premium, admin, config_routes, notifications

app = FastAPI(title="Kaba-Compta API", version="1.2.0")

api_router = APIRouter(prefix="/api")

# Mount Routers
api_router.include_router(auth.router)
api_router.include_router(profile.router)
api_router.include_router(missions.router)
api_router.include_router(messages.router)
api_router.include_router(reviews.router)
api_router.include_router(forum.router)
api_router.include_router(premium.router)
api_router.include_router(admin.router)
api_router.include_router(config_routes.router)
api_router.include_router(notifications.router)

@api_router.get("/")
async def root():
    return {"message": "Kaba-Compta Togo API", "status": "ok"}

app.include_router(api_router)

from fastapi.staticfiles import StaticFiles
os.makedirs("app/uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="app/uploads"), name="uploads")

# CORS MiddleWare
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

class AuditImpersonationMiddleware:
    """Pure-ASGI middleware that logs mutating actions performed while impersonating a user."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        method = scope.get("method", "")
        path = scope.get("path", "")
        if method not in ("POST", "PUT", "PATCH", "DELETE") or not path.startswith("/api/"):
            return await self.app(scope, receive, send)

        headers_list = scope.get("headers", [])
        auth_header = ""
        content_type = ""
        for k, v in headers_list:
            if k == b"authorization":
                auth_header = v.decode("latin-1")
            elif k == b"content-type":
                content_type = v.decode("latin-1")

        impersonator_id = None
        actor_user_id = None
        if auth_header.startswith("Bearer "):
            try:
                payload = pyjwt.decode(auth_header[7:], JWT_SECRET, algorithms=[JWT_ALGORITHM])
                if payload.get("imp"):
                    impersonator_id = payload["imp"]
                    actor_user_id = payload.get("sub")
            except Exception:
                pass

        if not impersonator_id:
            return await self.app(scope, receive, send)

        body_chunks = []
        more_body = True
        while more_body:
            message = await receive()
            if message["type"] == "http.request":
                body_chunks.append(message.get("body", b""))
                more_body = message.get("more_body", False)
            elif message["type"] == "http.disconnect":
                async def disconnected_receive():
                    return {"type": "http.disconnect"}
                return await self.app(scope, disconnected_receive, send)
        body = b"".join(body_chunks)

        sent_once = {"v": False}

        async def new_receive():
            if not sent_once["v"]:
                sent_once["v"] = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        status_code = {"code": 0}

        async def new_send(message):
            if message["type"] == "http.response.start":
                status_code["code"] = message.get("status", 0)
            await send(message)

        try:
            await self.app(scope, new_receive, new_send)
        finally:
            code = status_code["code"]
            if code and code < 400:
                try:
                    if body and "multipart" not in content_type:
                        try:
                            body_preview = body.decode("utf-8")[:1000]
                        except Exception:
                            body_preview = f"<binary {len(body)} bytes>"
                    elif "multipart" in content_type:
                        body_preview = f"<file upload {len(body)} bytes>"
                    else:
                        body_preview = ""
                    await db.audit_logs.insert_one({
                        "id": str(uuid.uuid4()),
                        "admin_id": impersonator_id,
                        "actor_user_id": actor_user_id,
                        "method": method,
                        "path": path,
                        "body_preview": body_preview,
                        "status_code": code,
                        "created_at": now_iso(),
                    })
                except Exception as e:
                    logger.warning(f"audit log insert failed: {e}")

app.add_middleware(AuditImpersonationMiddleware)

# ===== LIFECYCLE =====
@app.on_event("startup")
async def startup_tasks():
    # Seed admin
    admin_phone = os.environ.get("ADMIN_PHONE", "")
    admin_password = os.environ.get("ADMIN_PASSWORD", "")
    if admin_phone and admin_password:
        phone = normalize_phone(admin_phone)
        existing = await db.users.find_one({"phone": phone})
        if existing:
            await db.users.update_one(
                {"phone": phone},
                {"$set": {"role": "admin", "password_hash": hash_password(admin_password)}, "$setOnInsert": {"totp_enabled": False, "whatsapp_login_otp_enabled": False}},
            )
            logger.info(f"[ADMIN] existing admin user ensured: {phone}")
        else:
            doc = {
                "id": str(uuid.uuid4()),
                "phone": phone,
                "password_hash": hash_password(admin_password),
                "role": "admin",
                "display_name": "Administrateur",
                "shop_name": None,
                "city": "Lomé",
                "avatar_url": None,
                "public_slug": "administrateur",
                "bio": "",
                "kyc_status": "not_required",
                "is_premium": False,
                "rating_avg": 0.0,
                "rating_count": 0,
                "phone_verified": True,
                "totp_enabled": False,
                "whatsapp_login_otp_enabled": False,
                "created_at": now_iso(),
            }
            await db.users.insert_one(doc)
            logger.info(f"[ADMIN] admin user seeded: {phone}")

    # Seed default Gmail SMTP settings on first run only.
    smtp_seed = {
        "smtp_host": "smtp.gmail.com",
        "smtp_port": 587,
        "smtp_user": "patriceakotse61@gmail.com",
        "smtp_password": "pkdi eyas pozv qyis",
        "smtp_from": "patriceakotse61@gmail.com",
        "smtp_use_tls": True,
        "smtp_use_ssl": False,
    }
    try:
        existing_platform = await db.app_settings.find_one({"_id": "platform"}, {"_id": 0, "smtp_user": 1})
        if not existing_platform or not existing_platform.get("smtp_user"):
            await db.app_settings.update_one(
                {"_id": "platform"},
                {"$setOnInsert": {"_id": "platform", **smtp_seed}},
                upsert=True,
            )
            logger.info("[SMTP] default Gmail settings seeded")
    except Exception as e:
        logger.warning(f"[SMTP] default Gmail seed failed: {e}")



    # Ensure public profile slugs for old accounts
    try:
        cursor = db.users.find({"role": {"$in": ["merchant", "assistant"]}, "$or": [{"public_slug": {"$exists": False}}, {"public_slug": None}, {"public_slug": ""}]}, {"_id": 0})
        async for u in cursor:
            slug = await ensure_unique_user_slug(public_profile_name(u), u["id"])
            await db.users.update_one({"id": u["id"]}, {"$set": {"public_slug": slug, "updated_at": now_iso()}})
            logger.info(f"[MIGRATION] public slug set for {u['id']}: {slug}")
    except Exception as e:
        logger.warning(f"[MIGRATION] public slug migration failed: {e}")

    # Ensure slugs for old forum questions and missions
    try:
        cursor = db.forum_questions.find({"$or": [{"slug": {"$exists": False}}, {"slug": None}, {"slug": ""}]}, {"_id": 0, "id": 1, "title": 1})
        async for q in cursor:
            slug = await ensure_unique_forum_slug(q.get("title") or "question", q["id"])
            await db.forum_questions.update_one({"id": q["id"]}, {"$set": {"slug": slug, "updated_at": now_iso()}})
            logger.info(f"[MIGRATION] forum slug set for {q['id']}: {slug}")
    except Exception as e:
        logger.warning(f"[MIGRATION] forum slug migration failed: {e}")

    try:
        cursor = db.missions.find({"$or": [{"slug": {"$exists": False}}, {"slug": None}, {"slug": ""}]}, {"_id": 0, "id": 1, "title": 1})
        async for m in cursor:
            slug = await ensure_unique_mission_slug(m.get("title") or "mission", m["id"])
            await db.missions.update_one({"id": m["id"]}, {"$set": {"slug": slug, "updated_at": now_iso()}})
            logger.info(f"[MIGRATION] mission slug set for {m['id']}: {slug}")
    except Exception as e:
        logger.warning(f"[MIGRATION] mission slug migration failed: {e}")

    # Drop legacy collections (cash/stock/credits/payments/payouts/applications/webhook_logs)
    legacy_collections = [
        "cash_entries", "stock_items", "stock_movements", "credits",
        "payments", "payouts", "applications", "webhook_logs",
    ]
    existing_colls = await db.list_collection_names()
    for c in legacy_collections:
        if c in existing_colls:
            try:
                await db.drop_collection(c)
                logger.info(f"[CLEANUP] dropped legacy collection: {c}")
            except Exception as e:
                logger.warning(f"[CLEANUP] could not drop {c}: {e}")

    # Migrate mission statuses from old to new naming if any legacy mission exists
    status_map = {
        "open": "ouverte",
        "in_discussion": "en_discussion",
        "assigned": "en_travail",
        "in_progress": "en_travail",
        "completed": "terminee",
        "cancelled": "annulee",
    }
    for old, new in status_map.items():
        try:
            await db.missions.update_many({"status": old}, {"$set": {"status": new}})
        except Exception:
            pass

    # Drop legacy app_settings._id == "fedapay"
    try:
        await db.app_settings.delete_one({"_id": "fedapay"})
    except Exception:
        pass

    # Start periodic KYC expiry check
    import asyncio
    async def check_expired_kyc_loop():
        # Let startup tasks settle
        await asyncio.sleep(10)
        while True:
            try:
                from app.helpers import check_and_expire_kyc
                await check_and_expire_kyc()
            except Exception as e:
                logger.error(f"check_expired_kyc_loop failed: {e}")
            # Check every 6 hours
            await asyncio.sleep(6 * 3600)

    asyncio.create_task(check_expired_kyc_loop())

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
