"""Shared schema definitions and generic pagination containers."""
from typing import Generic, List, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    """Generic paginated response container."""
    items: List[T]
    total: int
