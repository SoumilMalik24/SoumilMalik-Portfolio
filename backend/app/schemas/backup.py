"""Export/import schemas."""
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class ImportChange(BaseModel):
    section: str
    changed: bool


class ImportResult(BaseModel):
    dry_run: bool
    changes: List[ImportChange]
    errors: List[Dict[str, str]]


class ExportSection(BaseModel):
    draft: Optional[Dict[str, Any]]
    published: Optional[Dict[str, Any]]
