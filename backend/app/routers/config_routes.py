from fastapi import APIRouter
from app.helpers import get_platform_config

router = APIRouter(tags=["config"])

@router.get("/public/config")
async def public_config():
    cfg = await get_platform_config()
    return {
        "premium_enabled": cfg["premium_enabled"],
        "premium_price_fcfa": cfg["premium_price_fcfa"],
        "premium_duration_days": cfg["premium_duration_days"],
    }
