from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.routes.alerts import router as alerts_router
from app.api.routes.channels import router as channels_router
from app.api.routes.pages import router as pages_router
from app.api.routes.settings import router as settings_router
from app.core.config import get_settings
from app.core.lifespan import application_lifespan


class ApplicationFactory:
    """Builds and configures the FastAPI application."""

    @staticmethod
    def create() -> FastAPI:
        settings = get_settings()

        application = FastAPI(
            title=settings.app_name,
            version="0.1.0",
            lifespan=application_lifespan,
        )

        application.mount(
            "/static",
            StaticFiles(directory="app/static"),
            name="static",
        )

        application.include_router(pages_router)
        application.include_router(channels_router, prefix="/api")
        application.include_router(alerts_router, prefix="/api")
        application.include_router(settings_router, prefix="/api")

        return application
