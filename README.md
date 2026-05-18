# WarLand

Realtime multiplayer property-trading board game with room creation, invite links, auctions, trades, chat, city-name properties, and persistent room state.

## Run Locally

```sh
node server.js
```

Open `http://127.0.0.1:3000`.

## Production

Set these environment variables as needed:

```sh
HOST=0.0.0.0
PORT=3000
DATA_DIR=/var/lib/warland
ROOM_TTL_MS=86400000
node server.js
```

The app exposes `GET /api/health` for load balancers and writes room state to `DATA_DIR/rooms.json` so games survive server restarts.

## Multiplayer Flow

Players can create and automatically join a room, open a room from the lobby, or paste a room code/invite link. Room links use `?room=<room-id>`.
