from pydantic import BaseModel, ConfigDict, Field

from app.domain.enums import AlertLevel, ChannelSourceType


class ChannelCreate(BaseModel):
    number: int = Field(ge=1, le=999)
    name: str = Field(min_length=1, max_length=120)
    source_type: ChannelSourceType
    source: str = Field(min_length=1)
    logo_url: str | None = None
    enabled: bool = True


class ChannelItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    media_url: str
    position: int


class ChannelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    number: int
    name: str
    source_type: ChannelSourceType
    source: str
    logo_url: str | None
    enabled: bool
    items: list[ChannelItemResponse]


class ChannelCreatedResponse(BaseModel):
    id: int
    items_imported: int


class AlertCreate(BaseModel):
    level: AlertLevel
    message: str = Field(min_length=1, max_length=2000)


class AlertResponse(BaseModel):
    id: int
    level: AlertLevel
    message: str
    created_at: str


class SettingsUpdate(BaseModel):
    telegram_enabled: bool = False
    telegram_token: str = ""
    telegram_chat_id: str = ""
    weather_provider: str = "open-meteo"
    weather_latitude: str = ""
    weather_longitude: str = ""
    weather_refresh_minutes: int = Field(default=15, ge=5, le=1440)
