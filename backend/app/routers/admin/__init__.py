"""Admin routers package."""
from app.routers.admin.account import router as account_router
from app.routers.admin.audit import router as audit_router
from app.routers.admin.auth import router as auth_router
from app.routers.admin.backup import router as backup_router
from app.routers.admin.chats import router as chats_router
from app.routers.admin.content import router as content_router
from app.routers.admin.inbox import router as inbox_router
from app.routers.admin.kirby import router as kirby_router
from app.routers.admin.metrics import router as metrics_router
from app.routers.admin.publish import router as publish_router
from app.routers.admin.system import router as system_router
from app.routers.admin.uploads import router as uploads_router

__all__ = [
    "account_router",
    "audit_router",
    "auth_router",
    "backup_router",
    "chats_router",
    "content_router",
    "inbox_router",
    "kirby_router",
    "metrics_router",
    "publish_router",
    "system_router",
    "uploads_router",
]
