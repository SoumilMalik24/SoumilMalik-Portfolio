"""Contact form and inbox schemas."""
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints
from typing_extensions import Annotated

Name = Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)]


class ContactRequest(BaseModel):
    name: Optional[Name] = None
    email: EmailStr
    subject: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
    message: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]
    website: Optional[str] = Field(None, max_length=200, description="Honeypot: must be empty")

    model_config = ConfigDict(extra="ignore")


class ContactResponse(BaseModel):
    status: str = "Message sent successfully"


class InboxItem(BaseModel):
    id: int
    name: Optional[str]
    email: str
    subject: str
    body: str
    read: bool
    created_at: Optional[str]


class InboxPage(BaseModel):
    items: List[InboxItem]
    total: int
    unread: int


class InboxUpdate(BaseModel):
    read: bool

    model_config = ConfigDict(extra="forbid")
