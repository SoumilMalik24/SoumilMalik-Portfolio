"""Publish and revision request/response schemas."""
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict


class PublishRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sections: Optional[List[str]] = None


class PublishOut(BaseModel):
    id: int
    sections: List[str]
    reindex_status: str
    deploy_status: str
    deploy_ref: Optional[str]
    error: Optional[str]
    created_at: Optional[str]
    finished_at: Optional[str]


class RevisionOut(BaseModel):
    id: int
    section_key: str
    kind: str
    publish_id: Optional[int]
    created_at: Optional[str]


class RevisionDetail(RevisionOut):
    data: Dict[str, Any]
