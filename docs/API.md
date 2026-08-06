# API

Interactive documentation:

```text
http://localhost:8080/docs
```

## Channels

- `GET /api/channels`
- `POST /api/channels`
- `POST /api/channels/{channel_id}/scan`
- `DELETE /api/channels/{channel_id}`
- `GET /api/channels/media/{channel_id}/{position}`

## Alerts

- `POST /api/alerts`
- `GET /api/alerts/latest?after_id=0`
- `POST /api/alerts/{alert_id}/dismiss`

## Settings

- `GET /api/settings`
- `PUT /api/settings`
