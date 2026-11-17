"""Public published content for the static site build (spec 7.4)."""
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.public_content import build_public_content

router = APIRouter(tags=["Content"])


@router.get("/api/content", summary="Published site content")
def get_content(request: Request, db: Session = Depends(get_db)) -> Response:
    payload = build_public_content(db)
    etag = f'W/"v{payload["version"]}"'
    headers = {"ETag": etag, "Cache-Control": "no-cache"}
    if etag in [t.strip() for t in request.headers.get("if-none-match", "").split(",")]:
        return Response(status_code=304, headers=headers)
    return JSONResponse(content=payload, headers=headers)
