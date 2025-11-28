# Minimal Video Call App

A simple, secure, and deployable video-call web app. No login, no rooms, just open the link and join.

## Features
- **Instant Join**: Auto-joins the call on page load.
- **Mesh Topology**: Supports small group calls (everyone connects to everyone).
- **Secure**: Uses HTTPS and random ephemeral peer IDs.
- **Privacy**: No data logging, no analytics.

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Open `http://localhost:3000` in multiple browser tabs/windows.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

### Quick Start (Render)

### Option A: Render (Recommended)
1. Create a new **Web Service** on [Render](https://render.com/).
2. Connect your GitHub repository.
3. Use the following settings:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Deploy! Render provides free HTTPS automatically.

### Option B: Railway
1. Create a new project on [Railway](https://railway.app/).
2. Deploy from GitHub repo.
3. Railway will auto-detect Node.js and `package.json`.
4. It will just work.

### Option C: Fly.io
1. Install `flyctl`.
2. Run `fly launch`.
3. Follow the prompts (it will generate a `Dockerfile` or use a builder).
4. `fly deploy`.

## Architecture
- **Frontend**: Vanilla HTML/CSS/JS. Uses `RTCPeerConnection` for video and `WebSocket` for signaling.
- **Backend**: Node.js + Express + `ws`. Serves static files and relays signaling messages between peers.
