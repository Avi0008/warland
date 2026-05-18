# WarLand Deployment

WarLand is a single Node.js web service. It serves the frontend, multiplayer API, and live room updates from `server.js`.

## Fastest Go-Live Path: Render

1. Create a GitHub repository and push this project.
2. In Render, choose **New +** -> **Blueprint**.
3. Connect the GitHub repository.
4. Render will read `render.yaml`.
5. Create the service.
6. After deploy, open the Render URL and create a room.

The included `render.yaml` configures:

- Node 20
- `npm install`
- `npm start`
- `/api/health` health checks
- `HOST=0.0.0.0`
- `DATA_DIR=/var/data`
- a 1 GB persistent disk for saved rooms

## Docker Deploy

Build and run locally:

```bash
docker build -t warland .
docker run --rm -p 3000:3000 -v warland-data:/app/data warland
```

Then open:

```text
http://localhost:3000
```

## Generic Node Host

Use these settings on Railway, Fly.io, Heroku-style hosts, or a VPS:

```bash
npm install
npm start
```

Environment:

```bash
NODE_ENV=production
HOST=0.0.0.0
PORT=<your host provided port>
DATA_DIR=<persistent writable folder>
```

## Production Note

The current app stores rooms in a JSON file, which is fine for one server with a persistent disk. For multi-server scaling, move room state to Redis or Postgres so every instance sees the same live game data.
