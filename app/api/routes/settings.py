from fastapi import APIRouter

from app.api.dependencies import DatabaseSession
from app.domain.schemas import SettingsUpdate
from app.services.settings_service import SettingsService

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("")
def get_settings(session: DatabaseSession):
    return SettingsService(session).get_public_settings()


@router.put("")
def update_settings(
    payload: SettingsUpdate,
    session: DatabaseSession,
):
    SettingsService(session).update(payload)
    return {"ok": True}
