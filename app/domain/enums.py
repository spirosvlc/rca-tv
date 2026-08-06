from enum import StrEnum


class ChannelSourceType(StrEnum):
    FOLDER = "folder"
    M3U = "m3u"


class AlertLevel(StrEnum):
    MEDIUM = "medium"
    SERIOUS = "serious"
    CRITICAL = "critical"
