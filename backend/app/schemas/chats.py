"""Conversation and chat schemas for the admin panel."""
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class MessageOut(BaseModel):
    """Single message within a conversation."""
    role: str
    content: str
    at: str
    section: Optional[str] = None
    mood: Optional[str] = None
    unanswered: bool = False

    model_config = ConfigDict(extra="ignore")


class ConversationOut(BaseModel):
    """Conversation summary item for paginated list view."""
    id: str
    preview: str
    started_at: str
    last_at: str
    messages: int
    starred: bool = False
    archived: bool = False
    note: Optional[str] = None
    has_unanswered: bool = False

    model_config = ConfigDict(extra="ignore")


class ConversationDetail(BaseModel):
    """Full conversation detail with all messages."""
    id: str
    preview: str
    started_at: str
    last_at: str
    starred: bool = False
    archived: bool = False
    note: Optional[str] = None
    has_unanswered: bool = False
    messages: List[MessageOut]

    model_config = ConfigDict(extra="ignore")


class ConversationUpdate(BaseModel):
    """PATCH body; omitted fields are left unchanged, note=null clears the note."""
    starred: Optional[bool] = None
    archived: Optional[bool] = None
    note: Optional[str] = Field(None, max_length=1000)

    model_config = ConfigDict(extra="forbid")


class AnswerRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=300)
    answer: str = Field(..., min_length=1, max_length=1000)

    model_config = ConfigDict(extra="forbid")
