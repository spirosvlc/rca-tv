import json
from datetime import datetime
from pathlib import Path
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.db.models import ChannelItemModel, ChannelModel
from app.db.repositories import ChannelRepository
from app.domain.enums import ChannelSourceType
from app.domain.schemas import ChannelCreate
from app.services.media_service import M3UImporter, MediaScanner
from app.services.media_probe import MediaProbe
from app.integrations.youtube import YouTubeClient

class DuplicateChannelNumberError(ValueError): pass
class ChannelNotFoundError(ValueError): pass

class ChannelService:
    def __init__(self,session:Session,media_scanner=None,m3u_importer=None):
        self.repository=ChannelRepository(session); self.media_scanner=media_scanner or MediaScanner(); self.m3u_importer=m3u_importer or M3UImporter(); self.probe=MediaProbe(); self.session=session
    def list_channels(self): return self.repository.list_enabled()
    async def create_channel(self,payload):
        channel=ChannelModel(number=payload.number,name=payload.name,source_type=payload.source_type.value,source=payload.source,logo_url=payload.logo_url,enabled=payload.enabled,broadcast_epoch=datetime.utcnow())
        try:self.repository.add(channel)
        except IntegrityError as exc:
            self.repository.session.rollback(); raise DuplicateChannelNumberError('A channel with this number already exists.') from exc
        try: count=await self.scan_channel(channel.id)
        except Exception:
            self.repository.delete(channel); raise
        return channel,count
    async def scan_channel(self,channel_id):
        channel=self.repository.get(channel_id)
        if channel is None: raise ChannelNotFoundError('Channel not found.')
        channel.items.clear()
        if channel.source_type==ChannelSourceType.FOLDER.value:
            files=self.media_scanner.scan(channel.source)
            for pos,f in enumerate(files):
                channel.items.append(ChannelItemModel(title=f.stem,media_url=f'/api/channels/media/{channel.id}/{pos}',position=pos,duration_seconds=self.probe.duration(f),media_kind='video'))
        elif channel.source_type==ChannelSourceType.M3U.value:
            entries=await self.m3u_importer.import_entries(channel.source)
            for pos,e in enumerate(entries): channel.items.append(ChannelItemModel(title=e.title,media_url=e.media_url,position=pos,duration_seconds=0,media_kind='hls'))
        elif channel.source_type==ChannelSourceType.YOUTUBE.value:
            try: channel_ids=json.loads(channel.source)
            except json.JSONDecodeError: channel_ids=[x.strip() for x in channel.source.split(',') if x.strip()]
            per=int(__import__('app.services.settings_service',fromlist=['SettingsService']).SettingsService(self.session).get_value('youtube_videos_per_creator','3'))
            videos=await YouTubeClient(self.session).latest_videos(channel_ids,per)
            for pos,v in enumerate(videos):
                channel.items.append(ChannelItemModel(title=f"{v['creator']} — {v['title']}",media_url=f"youtube:{v['video_id']}",position=pos,duration_seconds=float(v.get('duration_seconds',0)),media_kind='youtube',provider_id=v['video_id'],thumbnail_url=v.get('thumbnail')))
        else: raise ValueError('Unsupported channel source type.')
        channel.broadcast_epoch=datetime.utcnow(); self.repository.save(); return len(channel.items)
    def delete_channel(self,channel_id):
        c=self.repository.get(channel_id)
        if c is None: raise ChannelNotFoundError('Channel not found.')
        self.repository.delete(c)
    def resolve_local_media(self,channel_id,position):
        c=self.repository.get(channel_id)
        if c is None or c.source_type!=ChannelSourceType.FOLDER.value: raise ChannelNotFoundError('Media not found.')
        files=self.media_scanner.scan(c.source)
        if position<0 or position>=len(files): raise ChannelNotFoundError('Media not found.')
        folder=Path(c.source).expanduser().resolve(); f=files[position].resolve()
        if folder not in f.parents: raise PermissionError('Invalid media path.')
        return f
