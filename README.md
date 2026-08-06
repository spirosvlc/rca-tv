# RCA Project

RCA Project is an open-source retro television appliance built with Python, FastAPI, SQLite, and a lightweight browser UI.

It is designed to run on a Raspberry Pi connected to an old CRT television through an HDMI-to-composite adapter.

## Features

- Local video folders as TV channels
- Native folder picker for local media
- Remote M3U playlists and HLS streams
- GitHub `blob` playlist URL conversion
- Full-screen retro TV player
- CRT scanlines and static channel transitions
- Three emergency alert levels
- Telegram bot alert publishing
- Weather configuration foundation
- SQLite persistence
- Class-based Python architecture
- Raspberry Pi systemd deployment files
- Docker support
- Tests and GitHub Actions workflow

## Alert levels

- `medium`: lower-third banner
- `serious`: dismissible modal
- `critical`: full-screen interruption with alert sound

## Project structure

```text
rca-project/
├── app/
│   ├── api/
│   │   ├── dependencies.py
│   │   └── routes/
│   ├── core/
│   │   ├── config.py
│   │   └── lifespan.py
│   ├── db/
│   │   ├── database.py
│   │   ├── models.py
│   │   └── repositories.py
│   ├── domain/
│   │   ├── enums.py
│   │   └── schemas.py
│   ├── integrations/
│   │   ├── telegram_bot.py
│   │   └── weather.py
│   ├── services/
│   │   ├── alert_service.py
│   │   ├── channel_service.py
│   │   ├── media_service.py
│   │   └── settings_service.py
│   ├── static/
│   ├── application.py
│   └── main.py
├── deploy/
├── docs/
├── tests/
├── .github/workflows/
├── Dockerfile
├── docker-compose.yml
├── pyproject.toml
└── requirements.txt
```

## Local setup

```bash
git clone https://github.com/spirosvlc/rca-tv
cd rca-tv

python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env

python -m app.main
```

Open:

- Player: http://localhost:8080
- Admin: http://localhost:8080/admin
- API docs: http://localhost:8080/docs

## Add a local video channel

Create a directory:

```text
/media/rca/cartoons/
├── episode-01.mp4
├── episode-02.mp4
└── episode-03.mp4
```

Then add it through the Admin UI as a `Local folder` source.

Supported local extensions:

- `.mp4`
- `.m4v`
- `.webm`
- `.mov`

## Add an M3U source

Use an HTTP or HTTPS M3U playlist URL.

The browser player directly supports common browser-compatible MP4, WebM, and HLS sources. A future MPV adapter will add broader IPTV codec compatibility.

## Telegram

Create a bot using BotFather and configure:

- Telegram enabled
- Bot token
- Allowed chat ID

Commands:

```text
/alert medium Weather will deteriorate later today.
/alert serious Avoid unnecessary travel.
/alert critical Emergency warning. Remain indoors.
```

Restart the RCA application after changing the Telegram configuration.

## Player controls

- `ArrowUp` or `PageUp`: next channel
- `ArrowDown` or `PageDown`: previous channel
- `Enter`, `Space`, or `Escape`: dismiss alert
- `M` or media mute key: mute
- `ArrowRight` or media volume-up key: volume up
- `ArrowLeft` or media volume-down key: volume down
- `F`: fullscreen

## Docker

```bash
docker compose up --build
```

## Tests

```bash
pytest
```

## Raspberry Pi

See `deploy/README_PI.md`.

## Copyright

Use only video files and streams you own or are authorized to access. Do not distribute copyrighted media with this repository.

### Smart TV remote behavior

The player supports standard browser keys and common Smart TV key codes for:

- Channel up/down
- OK/Enter to dismiss active alerts
- Volume up/down
- Mute/unmute
- Back/Return to dismiss active alerts

The green key diagnostic at the top displays the key value received from the TV browser. Some television operating systems may still reserve physical volume keys for the TV's global speaker volume before the browser receives them.
