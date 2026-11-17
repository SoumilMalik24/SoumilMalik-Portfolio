"""Upload (asset) schemas."""
from typing import List, Optional

from pydantic import BaseModel


class AssetOut(BaseModel):
    id: str
    kind: str
    url: str
    mime: str
    bytes: int
    width: Optional[int]
    height: Optional[int]
    original_name: str
    created_at: Optional[str]


class AssetWithUsage(AssetOut):
    in_use: List[str]
