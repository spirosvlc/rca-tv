from pathlib import Path

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import ChannelItemModel, ChannelModel
from app.db.repositories import ChannelRepository
from app.domain.enums import ChannelSourceType
from app.domain.schemas import ChannelCreate
from app.services.media_service import M3UImporter, MediaScanner


class DuplicateChannelNumberError(ValueError):
    pass


class ChannelNotFoundError(ValueError):
    pass


class ChannelService:
    def __init__(
        self,
        session: Session,
        media_scanner: MediaScanner | None = None,
        m3u_importer: M3UImporter | None = None,
    ) -> None:
        self.repository = ChannelRepository(session)
        self.media_scanner = media_scanner or MediaScanner()
        self.m3u_importer = m3u_importer or M3UImporter()

    def list_channels(self) -> list[ChannelModel]:
        return self.repository.list_enabled()

    async def create_channel(
        self,
        payload: ChannelCreate,
    ) -> tuple[ChannelModel, int]:
        channel = ChannelModel(
            number=payload.number,
            name=payload.name,
            source_type=payload.source_type.value,
            source=payload.source,
            logo_url=payload.logo_url,
            enabled=payload.enabled,
        )

        try:
            self.repository.add(channel)
        except IntegrityError as exc:
            self.repository.session.rollback()
            raise DuplicateChannelNumberError(
                "A channel with this number already exists."
            ) from exc

        try:
            item_count = await self.scan_channel(channel.id)
        except Exception:
            self.repository.delete(channel)
            raise

        return channel, item_count

    async def scan_channel(self, channel_id: int) -> int:
        channel = self.repository.get(channel_id)
        if channel is None:
            raise ChannelNotFoundError("Channel not found.")

        channel.items.clear()

        if channel.source_type == ChannelSourceType.FOLDER.value:
            files = self.media_scanner.scan(channel.source)
            for position, media_file in enumerate(files):
                channel.items.append(
                    ChannelItemModel(
                        title=media_file.stem,
                        media_url=f"/api/channels/media/{channel.id}/{position}",
                        position=position,
                    )
                )
        elif channel.source_type == ChannelSourceType.M3U.value:
            entries = await self.m3u_importer.import_entries(channel.source)
            for position, entry in enumerate(entries):
                channel.items.append(
                    ChannelItemModel(
                        title=entry.title,
                        media_url=entry.media_url,
                        position=position,
                    )
                )
        else:
            raise ValueError("Unsupported channel source type.")

        self.repository.save()
        return len(channel.items)

    def delete_channel(self, channel_id: int) -> None:
        channel = self.repository.get(channel_id)
        if channel is None:
            raise ChannelNotFoundError("Channel not found.")
        self.repository.delete(channel)

    def resolve_local_media(
        self,
        channel_id: int,
        position: int,
    ) -> Path:
        channel = self.repository.get(channel_id)
        if (
            channel is None
            or channel.source_type != ChannelSourceType.FOLDER.value
        ):
            raise ChannelNotFoundError("Media not found.")

        files = self.media_scanner.scan(channel.source)
        if position < 0 or position >= len(files):
            raise ChannelNotFoundError("Media not found.")

        folder = Path(channel.source).expanduser().resolve()
        media_file = files[position].resolve()

        if folder not in media_file.parents:
            raise PermissionError("Invalid media path.")

        return media_file
