"""FastAPI application factory.

Serves the JSON API only. In prod the React build is a separate static
deploy; setting SERVE_STATIC=1 with a built frontend/dist mounts it here
for prod-like single-origin smoke tests.
"""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth import install_exception_handlers
from .config import get_settings
from .db import init_db
from .middleware import BodySizeLimitMiddleware
from .routes import auth as auth_routes
from .routes import data as data_routes


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Momentum API", version="2.0.0", lifespan=lifespan)
    install_exception_handlers(app)

    # Order matters: add_middleware wraps outside-in, so the body-cap goes
    # first (inner) and CORS second (outer) - a 413 must still carry CORS
    # headers or the browser reports it as an opaque network error.
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.max_body_bytes)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,  # Bearer auth, not cookies
        allow_methods=["GET", "POST", "PUT", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        # Deliberately DB-free: the uptime pinger keeps Render warm without
        # burning Neon compute hours.
        return {"status": "ok"}

    app.include_router(auth_routes.router)
    app.include_router(data_routes.router)

    if settings.serve_static:
        dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
        if dist.is_dir():
            from fastapi.staticfiles import StaticFiles

            app.mount("/", StaticFiles(directory=dist, html=True), name="static")

    return app


app = create_app()
