from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional, Literal

Role = Literal["merchant", "assistant", "admin"]
MISSION_STATUSES = ("ouverte", "en_discussion", "en_travail", "terminee", "annulee")

class RegisterRequest(BaseModel):
    phone: str
    password: str
    role: Role
    display_name: str
    email: Optional[str] = None
    shop_name: Optional[str] = None
    city: Optional[str] = "Lomé"

class LoginRequest(BaseModel):
    phone: str
    password: str

class LoginVerifyRequest(BaseModel):
    challenge_id: str
    code: str
    method: Literal["totp", "whatsapp_otp"]

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
    email: Optional[str] = None
    shop_name: Optional[str] = None
    city: Optional[str] = None
    avatar_url: Optional[str] = None
    public_slug: Optional[str] = None
    bio: Optional[str] = None
    education_level: Optional[str] = "Licence"
    skills: List[str] = Field(default_factory=list)
    languages: List[Any] = Field(default_factory=list)
    experiences: List[Dict[str, Any]] = Field(default_factory=list)
    formations: List[Dict[str, Any]] = Field(default_factory=list)
    references: List[Dict[str, Any]] = Field(default_factory=list)
    kyc_status: Optional[str] = None
    is_premium: bool = False
    rating_avg: float = 0.0
    rating_count: int = 0
    totp_enabled: bool = False
    whatsapp_login_otp_enabled: bool = False
    created_at: str

class AuthResponse(BaseModel):
    token: Optional[str] = None
    user: Optional[UserPublic] = None
    requires_2fa: bool = False
    challenge_id: Optional[str] = None
    methods: List[str] = Field(default_factory=list)
    phone: Optional[str] = None
    dev_code: Optional[str] = None
    channel: Optional[str] = None

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    shop_name: Optional[str] = None
    city: Optional[str] = None
    bio: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    education_level: Optional[str] = None
    skills: Optional[List[str]] = None
    languages: Optional[List[Any]] = None
    experiences: Optional[List[Dict[str, Any]]] = None
    formations: Optional[List[Dict[str, Any]]] = None
    references: Optional[List[Dict[str, Any]]] = None

class TwoFactorCodeRequest(BaseModel):
    code: str

class SecuritySettingsUpdate(BaseModel):
    whatsapp_login_otp_enabled: Optional[bool] = None

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

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
    email: Optional[str] = None
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
    cronicle_url: Optional[str] = None
    cronicle_api_key: Optional[str] = None

class BroadcastRequest(BaseModel):
    audience: Literal["all_merchants", "all_assistants", "all_users", "user"]
    user_id: Optional[str] = None
    message: str

class WhatsAppTestRequest(BaseModel):
    phone: str
    message: Optional[str] = None

class NotificationTemplateUpdate(BaseModel):
    title_template: Optional[str] = None
    body_template: Optional[str] = None
    whatsapp_template: Optional[str] = None
    enabled: Optional[bool] = None
