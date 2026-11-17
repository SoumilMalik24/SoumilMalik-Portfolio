"""Error classes, exception handlers, and API error formatting."""
import logging
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class ApiError(Exception):
    """Structured application error adhering to ARCHITECTURE.md conventions."""

    def __init__(
        self,
        status_code: int,
        detail: str,
        errors: Optional[List[Dict[str, str]]] = None,
        headers: Optional[Dict[str, str]] = None,
        extra: Optional[Dict[str, Any]] = None,
    ):
        self.status_code = status_code
        self.detail = detail
        self.errors = errors
        self.headers = headers
        self.extra = extra or {}
        super().__init__(detail)


def setup_exception_handlers(app: FastAPI) -> None:
    """Register uniform exception handlers for the FastAPI application."""

    @app.exception_handler(ApiError)
    async def api_error_handler(request: Request, exc: ApiError):
        body: Dict[str, Any] = {"detail": exc.detail}
        if exc.errors is not None:
            body["errors"] = exc.errors
        body.update(exc.extra)
        return JSONResponse(
            status_code=exc.status_code,
            content=body,
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError):
        formatted_errors = []
        for err in exc.errors():
            loc = err.get("loc", ())
            parts = [str(p) for p in loc if p != "body"]
            field = ".".join(parts) if parts else ""
            formatted_errors.append({"field": field, "msg": err.get("msg", "")})
        return JSONResponse(
            status_code=422,
            content={"detail": "Validation failed", "errors": formatted_errors},
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": detail},
            headers=exc.headers,
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(
            "Unhandled server exception on %s %s: %s",
            request.method,
            request.url.path,
            exc,
            exc_info=True,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
        )
