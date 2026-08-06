from fastapi import APIRouter, HTTPException, status

from app.api.dependencies import DatabaseSession
from app.domain.schemas import AlertCreate, AlertResponse
from app.services.alert_service import (
    AlertNotFoundError,
    AlertService,
)

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
)
def create_alert(
    payload: AlertCreate,
    session: DatabaseSession,
):
    alert = AlertService(session).create(payload)
    return {"id": alert.id}


@router.get("/latest", response_model=AlertResponse | None)
def latest_alert(
    session: DatabaseSession,
    after_id: int = 0,
):
    alert = AlertService(session).latest_after(after_id)
    if alert is None:
        return None

    return AlertResponse(
        id=alert.id,
        level=alert.level,
        message=alert.message,
        created_at=alert.created_at.isoformat(),
    )


@router.post("/{alert_id}/dismiss")
def dismiss_alert(
    alert_id: int,
    session: DatabaseSession,
):
    try:
        AlertService(session).dismiss(alert_id)
    except AlertNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc

    return {"ok": True}
