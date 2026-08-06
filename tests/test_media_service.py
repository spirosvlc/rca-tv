from app.services.media_service import M3UImporter, PlaylistEntry


def test_parse_m3u_playlist():
    content = """
#EXTM3U
#EXTINF:-1,Retro Cartoons
https://example.com/cartoons.m3u8
#EXTINF:-1,Retro Comedy
videos/comedy.mp4
"""

    entries = M3UImporter.parse(
        content,
        base_url="https://example.com/lists/main.m3u",
    )

    assert entries == [
        PlaylistEntry(
            "Retro Cartoons",
            "https://example.com/cartoons.m3u8",
        ),
        PlaylistEntry(
            "Retro Comedy",
            "https://example.com/lists/videos/comedy.mp4",
        ),
    ]


def test_hls_manifest_is_detected_by_extension():
    assert M3UImporter.is_hls_manifest(
        "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=3200000\nchunk.m3u8",
        "https://cdn.example.com/live/playlist.m3u8",
    )


def test_hls_manifest_is_detected_by_tags():
    assert M3UImporter.is_hls_manifest(
        "#EXTM3U\n#EXT-X-TARGETDURATION:6\nsegment-1.ts",
        "https://cdn.example.com/live/manifest",
    )
