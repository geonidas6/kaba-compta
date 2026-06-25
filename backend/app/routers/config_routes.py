from fastapi import APIRouter, Response, HTTPException
from app.helpers import get_platform_config, now_iso, public_profile_name, ensure_unique_user_slug, ensure_unique_forum_slug
from app.database import db
from datetime import datetime, timezone
import os


def _parse_iso_dt(value: str):
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed

router = APIRouter(tags=["config"])

@router.get("/public/config")
async def public_config():
    cfg = await get_platform_config()
    return {
        "premium_enabled": cfg["premium_enabled"],
        "premium_price_fcfa": cfg["premium_price_fcfa"],
        "premium_duration_days": cfg["premium_duration_days"],
    }


@router.get("/public/openwa/login-exchange")
async def public_openwa_login_exchange(ticket: str):
    ticket_doc = await db.openwa_login_tickets.find_one({"id": ticket})
    if not ticket_doc:
        raise HTTPException(status_code=404, detail="Ticket introuvable")
    if ticket_doc.get("used_at"):
        raise HTTPException(status_code=410, detail="Ticket déjà utilisé")
    expires_at = ticket_doc.get("expires_at")
    if not expires_at:
        raise HTTPException(status_code=410, detail="Ticket expiré")
    if _parse_iso_dt(expires_at) < datetime.now(timezone.utc):
        await db.openwa_login_tickets.update_one({"id": ticket}, {"$set": {"used_at": now_iso()}})
        raise HTTPException(status_code=410, detail="Ticket expiré")

    cfg = await get_platform_config()
    wa_key = cfg["whatsapp_api_key"]
    if not wa_key:
        raise HTTPException(status_code=400, detail="WhatsApp non configuré")

    await db.openwa_login_tickets.update_one({"id": ticket}, {"$set": {"used_at": now_iso()}})
    return {"api_key": wa_key}


def _frontend_url() -> str:
    return (os.environ.get("PUBLIC_FRONTEND_URL") or os.environ.get("FRONTEND_URL") or "https://kaba-compta.it-sefako.com").rstrip("/")

async def _public_backend_url() -> str:
    cfg = await get_platform_config()
    return (cfg.get("public_backend_url") or os.environ.get("PUBLIC_BACKEND_URL") or "https://api-kaba-compta.it-sefako.com").rstrip("/")

def _abs_url(url: str | None, base: str) -> str | None:
    if not url:
        return None
    if url.startswith(("http://", "https://")):
        return url
    if url.startswith("/"):
        return base + url
    return base + "/" + url

def _xml_escape(value: str) -> str:
    return (value or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")

async def build_sitemap_xml() -> str:
    front = _frontend_url()
    urls = [
        (front + "/", None, "daily", "1.0"),
        (front + "/forum", None, "hourly", "0.9"),
        (front + "/auth", None, "monthly", "0.3"),
    ]
    users = await db.users.find(
        {"role": {"$in": ["assistant", "merchant"]}, "banned": {"$ne": True}},
        {"_id": 0, "id": 1, "public_slug": 1, "display_name": 1, "shop_name": 1, "role": 1, "updated_at": 1, "created_at": 1},
    ).to_list(5000)
    for user in users:
        user_slug = user.get("public_slug")
        if not user_slug:
            user_slug = await ensure_unique_user_slug(public_profile_name(user), user.get("id"))
            await db.users.update_one({"id": user.get("id")}, {"$set": {"public_slug": user_slug, "updated_at": now_iso()}})
        urls.append((front + f"/u/{user_slug}", user.get("updated_at") or user.get("created_at"), "weekly", "0.8"))
    questions = await db.forum_questions.find(
        {"is_hidden": False},
        {"_id": 0, "id": 1, "slug": 1, "title": 1, "updated_at": 1, "created_at": 1},
    ).sort("updated_at", -1).to_list(10000)
    for q in questions:
        q_slug = q.get("slug")
        if not q_slug:
            q_slug = await ensure_unique_forum_slug(q.get("title") or "question", q.get("id"))
            await db.forum_questions.update_one({"id": q.get("id")}, {"$set": {"slug": q_slug, "updated_at": now_iso()}})
        urls.append((front + f"/forum/{q_slug}", q.get("updated_at") or q.get("created_at"), "daily", "0.7"))
    rows = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, lastmod, changefreq, priority in urls:
        rows.append("  <url>")
        rows.append(f"    <loc>{_xml_escape(loc)}</loc>")
        if lastmod:
            rows.append(f"    <lastmod>{_xml_escape(str(lastmod)[:10])}</lastmod>")
        rows.append(f"    <changefreq>{changefreq}</changefreq>")
        rows.append(f"    <priority>{priority}</priority>")
        rows.append("  </url>")
    rows.append("</urlset>")
    return "\n".join(rows) + "\n"

async def build_robots_txt() -> str:
    front = _frontend_url()
    return "\n".join([
        "User-agent: *",
        "Allow: /",
        "Disallow: /admin",
        "Disallow: /app/messages",
        "Disallow: /app/profile",
        "Disallow: /app/notifications",
        f"Sitemap: {front}/sitemap.xml",
        "",
    ])

@router.get("/public/meta")
async def public_meta(path: str = "/"):
    front = _frontend_url()
    backend = await _public_backend_url()
    clean = "/" + (path or "/").strip("/")
    default_image = front + "/kaba-compta-cover.svg"
    meta = {
        "title": "Kaba-Compta Togo",
        "description": "Plateforme de mise en relation comptable marchand au Togo.",
        "url": front + clean,
        "image": default_image,
        "type": "website",
    }
    parts = clean.strip("/").split("/") if clean.strip("/") else []
    if len(parts) == 2 and parts[0] == "u":
        user = await db.users.find_one({"$or": [{"public_slug": parts[1]}, {"id": parts[1]}], "banned": {"$ne": True}}, {"_id": 0, "id": 1, "public_slug": 1, "display_name": 1, "role": 1, "city": 1, "bio": 1, "avatar_url": 1, "education_level": 1})
        if user:
            canonical_slug = user.get("public_slug") or parts[1]
            meta["url"] = front + f"/u/{canonical_slug}"
            role = "Comptable" if user.get("role") == "assistant" else "Marchand"
            level = f" · Niveau {user.get('education_level')}" if user.get("role") == "assistant" and user.get("education_level") else ""
            meta.update({
                "title": f"{user.get('display_name') or 'Profil'} - Kaba-Compta",
                "description": (user.get("bio") or f"Profil {role}{level} sur Kaba-Compta.")[:220],
                "image": _abs_url(user.get("avatar_url"), backend) or default_image,
                "type": "profile",
            })
    if (len(parts) == 2 and parts[0] == "forum") or (len(parts) == 3 and parts[0] == "app" and parts[1] == "forum"):
        qid = parts[-1]
        q = await db.forum_questions.find_one({"$or": [{"id": qid}, {"slug": qid}], "is_hidden": False}, {"_id": 0, "id": 1, "slug": 1, "title": 1, "body": 1, "author_name": 1, "author_id": 1})
        if q:
            author = await db.users.find_one({"id": q.get("author_id")}, {"_id": 0, "avatar_url": 1})
            canonical_q_slug = q.get("slug") or q.get("id") or qid
            meta["url"] = front + f"/forum/{canonical_q_slug}"
            meta.update({
                "title": f"{q.get('title') or 'Question forum'} - Kaba-Compta",
                "description": (q.get("body") or "Question du forum Kaba-Compta.")[:220],
                "image": _abs_url(author.get("avatar_url") if author else None, backend) or default_image,
                "type": "article",
            })
    elif len(parts) == 1 and parts[0] in ("forum",):
        meta.update({"title": "Forum Kaba-Compta", "description": "Questions et réponses comptables pour marchands et comptables."})
    return meta

@router.get("/public/sitemap.xml")
async def public_sitemap_xml():
    cached = await db.app_settings.find_one({"_id": "sitemap_cache"})
    xml = cached.get("xml") if cached else None
    if not xml:
        xml = await build_sitemap_xml()
    return Response(content=xml, media_type="application/xml")

@router.get("/public/robots.txt")
async def public_robots_txt():
    return Response(content=await build_robots_txt(), media_type="text/plain")
