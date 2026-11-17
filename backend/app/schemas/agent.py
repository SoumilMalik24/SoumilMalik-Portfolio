"""Kirby agent request/response schemas (contract unchanged from the original endpoint)."""
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ChatMessage(BaseModel):
    role: str = Field(..., description="user or assistant")
    content: str = Field(..., min_length=1)

    model_config = ConfigDict(extra="ignore")


class AgentRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., min_length=1, max_length=20)
    conversation_id: Optional[str] = None
    visitor_id: Optional[str] = None
    current_section: Optional[str] = Field(None, max_length=32)

    model_config = ConfigDict(extra="ignore")

    @field_validator("messages")
    @classmethod
    def _lengths(cls, v: List[ChatMessage]) -> List[ChatMessage]:
        if any(len(m.content) > 1000 for m in v):
            raise ValueError("Message content must not exceed 1000 characters")
        return v


class AgentResponse(BaseModel):
    reply: str
    conversation_id: str
    section: Optional[str] = None
    mood: Optional[str] = None


class PlaygroundRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., min_length=1, max_length=20)
    current_section: Optional[str] = Field(None, max_length=32)
    use_draft: bool = True

    model_config = ConfigDict(extra="forbid")
