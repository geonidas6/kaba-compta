from pydantic import BaseModel, Field
from typing import List, Optional, Literal

Role = Literal["merchant", "assistant", "admin"]
MISSION_STATUSES = ("ouverte", "en_discussion", "en_travail", "terminee", "annulee")

class RegisterRequest(BaseModel):
    phone: str
    password: str
    role: Role
    display_name: str
    shop_name: Optional[str] = None
    city: Optional[str] = "Lomé"

class LoginRequest(BaseModel):
    phone: str
    password: str

class OTPSendRequest(BaseModel):
    phone: str

class OTPVerifyRequest(BaseModel):
    phone: str
    code: str

class UserPublic(BaseModel):
    id: str
    phone: str
    role: Role
    display_name: str
    shop_name: Optional[str] = None
    city: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    kyc_status: Optional[str] = None
    is_premium: bool = False
    rating_avg: float = 0.0
    rating_count: int = 0
    created_at: str

class AuthResponse(BaseModel):
    token: str
    user: UserPublic

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    shop_name: Optional[str] = None
    city: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None

class MissionCreate(BaseModel):
    title: str
    description: str
    type: Literal["inventaire", "caisse", "audit", "fiscal", "paie", "creation_entreprise", "autre"] = "autre"
    budget_min_fcfa: Optional[float] = None
    budget_max_fcfa: Optional[float] = None
    contract_type: Literal["saisonnier", "stage", "cdd", "cdi", "ponctuelle"] = "ponctuelle"
    level: Literal["junior", "intermediaire", "senior"] = "intermediaire"
    remote_ok: bool = False
    location: str = "Lomé"
    start_date: Optional[str] = None
    duration_hours: float = 2

class MissionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    budget_min_fcfa: Optional[float] = None
    budget_max_fcfa: Optional[float] = None
    contract_type: Optional[str] = None
    level: Optional[str] = None
    remote_ok: Optional[bool] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    duration_hours: Optional[float] = None

class OfferCreate(BaseModel):
    price_fcfa: float
    delivery_days: int
    message: str = ""

class MessageCreate(BaseModel):
    body: str

class ReviewCreate(BaseModel):
    mission_id: str
    stars: int
    comment: Optional[str] = ""

# Forum models
class ForumQuestionCreate(BaseModel):
    title: str
    body: str
    tags: List[str] = Field(default_factory=list)

class ForumQuestionUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    tags: Optional[List[str]] = None

class ForumAnswerCreate(BaseModel):
    body: str

class ForumAnswerUpdate(BaseModel):
    body: str

class ForumReplyCreate(BaseModel):
    body: str

class ForumReactRequest(BaseModel):
    emoji: str

class ForumReport(BaseModel):
    reason: str

# Admin models
class AdminUserUpdate(BaseModel):
    banned: Optional[bool] = None
    is_premium: Optional[bool] = None
    kyc_status: Optional[str] = None
    display_name: Optional[str] = None
    shop_name: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[Role] = None

class PlatformSettingsUpdate(BaseModel):
    premium_enabled: Optional[bool] = None
    premium_price_fcfa: Optional[float] = None
    premium_duration_days: Optional[int] = None
    public_backend_url: Optional[str] = None
    whatsapp_service_url: Optional[str] = None
    whatsapp_api_key: Optional[str] = None
    whatsapp_session_id: Optional[str] = None
    whatsapp_verify_ssl: Optional[bool] = None
    notifications_enabled: Optional[bool] = None
    review_visibility_paywall: Optional[bool] = None

class BroadcastRequest(BaseModel):
    audience: Literal["all_merchants", "all_assistants", "all_users", "user"]
    user_id: Optional[str] = None
    message: str

class WhatsAppTestRequest(BaseModel):
    phone: str
    message: Optional[str] = None
