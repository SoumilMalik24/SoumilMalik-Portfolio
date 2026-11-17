"""Admin account, session management, and audit log schemas."""
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UpdateAccountRequest(BaseModel):
    """Account profile update payload."""
    display_name: Optional[str] = Field(None, min_length=1, max_length=80)
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    current_password: Optional[str] = None

    model_config = ConfigDict(extra="ignore")


class ChangePasswordRequest(BaseModel):
    """Password change payload."""
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=1, max_length=128)

    model_config = ConfigDict(extra="ignore")


class SessionOut(BaseModel):
    """Admin active session representation."""
    id: str
    created_at: str
    last_used_at: str
    expires_at: str
    ip: Optional[str] = None
    user_agent: Optional[str] = None
    current: bool = False

    model_config = ConfigDict(extra="ignore")


class AuditLogOut(BaseModel):
    """Audit log entry representation."""
    id: int
    action: str
    target: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None
    ip: Optional[str] = None
    created_at: str

    model_config = ConfigDict(extra="ignore")
