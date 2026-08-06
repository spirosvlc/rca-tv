from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urljoin, urlparse

import httpx

VIDEO_EXTENSIONS = {".mp4", ".m4v", ".webm", ".mov"}


@dataclass(frozen=True, slots=True)
class PlaylistEntry:
    title: str
    media_url: str


class MediaScanner:
    """Discovers video files inside an approved channel directory."""

    def scan(self, source: str) -> list[Path]:
        folder = Path(source).expanduser().resolve()
        if not folder.exists():
            raise ValueError("The configured folder does not exist.")
        if not folder.is_dir():
            raise ValueError("The configured source is not a directory.")

        return sorted(
            path
            for path in folder.rglob("*")
            if path.is_file()
            and path.suffix.lower() in VIDEO_EXTENSIONS
        )


class M3UImporter:
    """
    Downloads and parses remote M3U playlists.

    HLS manifests are intentionally kept as one playable item. The browser's
    HLS player must receive the original manifest URL so it can follow variant,
    audio, subtitle, segment, and encryption-key references correctly.

    Traditional IPTV M3U playlists are expanded into individual channel items.
    Relative URLs are resolved against the playlist URL.
    """

    HLS_TAG_PREFIXES = (
        "#EXT-X-STREAM-INF",
        "#EXT-X-TARGETDURATION",
        "#EXT-X-MEDIA-SEQUENCE",
        "#EXT-X-PLAYLIST-TYPE",
        "#EXT-X-ENDLIST",
        "#EXT-X-I-FRAME-STREAM-INF",
        "#EXT-X-MEDIA:",
        "#EXT-X-KEY:",
        "#EXT-X-MAP:",
    )

    async def import_entries(self, source: str) -> list[PlaylistEntry]:
        self._validate_http_url(source)

        async with httpx.AsyncClient(
            timeout=20,
            follow_redirects=True,
        ) as client:
            response = await client.get(source)
            response.raise_for_status()

        content = response.text

        if self.is_hls_manifest(content, source):
            return [
                PlaylistEntry(
                    title=self._title_from_url(source),
                    media_url=str(response.url),
                )
            ]

        return self.parse(content, base_url=str(response.url))

    @classmethod
    def is_hls_manifest(cls, content: str, source: str = "") -> bool:
        parsed_path = urlparse(source).path.lower()
        if parsed_path.endswith(".m3u8"):
            return True

        return any(
            line.strip().startswith(cls.HLS_TAG_PREFIXES)
            for line in content.splitlines()
        )

    @staticmethod
    def parse(
        content: str,
        base_url: str | None = None,
    ) -> list[PlaylistEntry]:
        entries: list[PlaylistEntry] = []
        pending_title = ""

        for raw_line in content.splitlines():
            line = raw_line.strip()
            if not line:
                continue

            if line.startswith("#EXTINF:"):
                pending_title = (
                    line.split(",", 1)[1].strip()
                    if "," in line
                    else "Stream"
                )
                continue

            if line.startswith("#"):
                continue

            media_url = urljoin(base_url, line) if base_url else line
            title = pending_title or f"Stream {len(entries) + 1}"

            entries.append(
                PlaylistEntry(
                    title=title,
                    media_url=media_url,
                )
            )
            pending_title = ""

        return entries

    @staticmethod
    def _validate_http_url(source: str) -> None:
        parsed = urlparse(source)
        if parsed.scheme not in {"http", "https"}:
            raise ValueError("M3U source must use HTTP or HTTPS.")

    @staticmethod
    def _title_from_url(source: str) -> str:
        filename = Path(urlparse(source).path).name
        return filename or "HLS Stream"
