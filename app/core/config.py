from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class ApplicationSettings(BaseSettings):
    app_name: str = "RCA Project"
    host: str = "0.0.0.0"
    port: int = 8080
    database_url: str = "sqlite:///./data/rca.db"
    log_level: str = "INFO"
    alert_poll_seconds: int = 2

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="RCA_",
        extra="ignore",
    )

    def ensure_directories(self) -> None:
        Path("data").mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> ApplicationSettings:
    settings = ApplicationSettings()
    settings.ensure_directories()
    return settings
