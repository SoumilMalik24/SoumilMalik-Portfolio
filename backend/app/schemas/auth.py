"""Authentication request and response schemas."""
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class AdminOut(BaseModel):
    """Public representation of an admin user."""
    id: int
    email: str
    phone: Optional[str] = None
    display_name: str
    last_login_at: Optional[str] = None
    created_at: str

    model_config = ConfigDict(extra="ignore")


class LoginRequest(BaseModel):
    """Admin login request payload."""
    identifier: str = Field(..., min_length=1, max_length=254)
    password: str = Field(..., min_length=1, max_length=128)

    model_config = ConfigDict(extra="ignore")


class LoginResponse(BaseModel):
    """Admin login response payload."""
    token: str
    expires_at: str
    admin: AdminOut


class ForgotPasswordRequest(BaseModel):
    """Password reset request payload."""
    email: EmailStr

    model_config = ConfigDict(extra="ignore")


class ResetPasswordRequest(BaseModel):
    """Password reset completion payload."""
    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=1, max_length=128)

    model_config = ConfigDict(extra="ignore")
