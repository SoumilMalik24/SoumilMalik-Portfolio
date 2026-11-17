"""FastAPI application factory, middleware, and router registration."""
import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import get_settings
from app.constants import APP_VERSION
from app.errors import setup_exception_handlers
from app.routers.admin import (
    account_router,
    audit_router,
    auth_router,
    backup_router,
    chats_router,
    content_router,
    inbox_router,
    kirby_router,
    metrics_router,
    publish_router,
    system_router,
    uploads_router,
)
from app.routers.public import agent_router, contact_router, health_router, track_router
from app.routers.public import content_router as public_content_router
from app.services.kb import index as kb_index
from app.services.maintenance import maintenance_loop
from app.utils.time import utcnow

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("portfolio.api")


class PayloadLimitAndSecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Enforces 12MB body ceiling and adds required security response headers."""

    async def dispatch(self, request: Request, call_next):
        cl = request.headers.get("content-length")
        if cl:
            try:
                if int(cl) > 12 * 1024 * 1024:
                    return JSONResponse(status_code=413, content={"detail": "Payload too large"})
            except ValueError:
                pass

        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    settings = get_settings()
    app.state.booted_at = utcnow()
    logger.info("Portfolio API booting up (ENV=%s)...", settings.ENV)

    tasks = []
    if settings.BACKGROUND_TASKS:
        if settings.KIRBY_ENABLED and settings.OPENROUTER_API_KEY:
            tasks.append(asyncio.create_task(asyncio.to_thread(kb_index.warm_up)))
        tasks.append(asyncio.create_task(maintenance_loop()))
    try:
        yield
    finally:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        logger.info("Portfolio API shutting down...")


def create_app() -> FastAPI:
    """Factory creating and configuring the FastAPI instance."""
    settings = get_settings()

    app = FastAPI(
        title="Soumil Malik — Portfolio API",
        description="Portfolio backend API for content, auth, telemetry, and Kirby assistant.",
        version=APP_VERSION,
        lifespan=lifespan,
    )

    # 1. Global security & payload middleware
    app.add_middleware(PayloadLimitAndSecurityHeadersMiddleware)

    # 2. CORS middleware (no credentials, specific headers & exposed headers)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.frontend_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "If-None-Match"],
        expose_headers=["ETag", "Retry-After"],
    )

    # 3. Exception handlers
    setup_exception_handlers(app)

    # 4. Public routers
    app.include_router(health_router)
    app.include_router(public_content_router)
    app.include_router(track_router)
    app.include_router(agent_router)
    app.include_router(contact_router)

    # 5. Admin routers
    app.include_router(auth_router)
    app.include_router(account_router)
    app.include_router(audit_router)
    app.include_router(chats_router)
    app.include_router(metrics_router)
    app.include_router(content_router)
    app.include_router(publish_router)
    app.include_router(uploads_router)
    app.include_router(backup_router)
    app.include_router(kirby_router)
    app.include_router(inbox_router)
    app.include_router(system_router)

    # 6. Locally stored uploads
    if settings.STORAGE_BACKEND == "local":
        media_dir = Path(settings.MEDIA_DIR)
        media_dir.mkdir(parents=True, exist_ok=True)
        app.mount("/media", StaticFiles(directory=str(media_dir)), name="media")

    return app


app = create_app()
