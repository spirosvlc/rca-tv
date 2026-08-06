# Raspberry Pi deployment

## Recommended hardware

- Raspberry Pi 4 or Raspberry Pi 5
- Raspberry Pi OS Lite 64-bit
- HDMI-to-composite converter
- Composite cable
- Bluetooth or USB remote

Verify that the converter supports PAL if the CRT television expects PAL.

## Install dependencies

```bash
sudo apt update
sudo apt install -y python3-venv chromium unclutter git
```

## Install RCA Project

```bash
sudo mkdir -p /opt/rca
sudo chown "$USER":"$USER" /opt/rca

git clone https://github.com/YOUR_USERNAME/rca-project.git /opt/rca
cd /opt/rca

python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

cp .env.example .env
```

## Services

Edit the `User=` fields in both service files, then run:

```bash
sudo cp deploy/rca.service /etc/systemd/system/
sudo cp deploy/rca-kiosk.service /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now rca.service
sudo systemctl enable --now rca-kiosk.service
```

## Remote mapping

Map your remote keys to:

- Channel up: `PageUp`
- Channel down: `PageDown`
- OK: `Enter`
- Back: `Escape`
- Mute: `M`
- Fullscreen: `F`
