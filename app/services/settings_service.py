from sqlalchemy.orm import Session

from app.db.repositories import SettingsRepository
from app.domain.schemas import SettingsUpdate


class SettingsService:
    SECRET_KEYS = {"telegram_token"}

    def __init__(self, session: Session) -> None:
        self.repository = SettingsRepository(session)

    def get_public_settings(self) -> dict[str, str]:
        values = self.repository.get_all()
        for key in self.SECRET_KEYS:
            if key in values:
                values[key] = ""
        return values

    def get_value(self, key: str, default: str = "") -> str:
        return self.repository.get(key, default)

    def update(self, payload: SettingsUpdate) -> None:
        for key, value in payload.model_dump().items():
            if key in self.SECRET_KEYS and value == "":
                continue

            serialized = (
                str(value).lower()
                if isinstance(value, bool)
                else str(value)
            )
            self.repository.set(key, serialized)

        self.repository.save()
