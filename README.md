# CalGen - Minimal Video Call App

A lightweight peer-to-peer video calling application with chat and screen sharing.

## Architecture

- **Frontend**: Static HTML/CSS/JS hosted on GitHub Pages (free)
- **Relay Server**: Minimal WebSocket signaling server on Railway (free tier)
- **P2P**: Video/audio streams flow directly between browsers (no media through server)

## Quick Start

### For Users
Just visit: `https://yourusername.github.io/callgen`

### For Developers

#### Deploy Frontend (GitHub Pages)
1. Enable GitHub Pages in repo settings
2. Set source to `/docs` folder
3. Done! Your app is live at `https://yourusername.github.io/callgen`

#### Deploy Relay Server (Railway)
1. Create new project on Railway
2. Connect your GitHub repo
3. Set root directory to `/relay-server`
4. Deploy!
5. Copy your Railway URL (e.g., `wss://your-app.up.railway.app`)

#### Configure Relay URL
Edit `docs/config.js`:
```javascript
const CONFIG = {
    RELAY_URL: 'wss://your-relay.up.railway.app',
    // ...
};
```

Or use URL parameter: `?relay=wss://your-relay.up.railway.app`

## Features

✅ HD video calls (720p with fallback)  
✅ Screen sharing  
✅ Real-time chat  
✅ Emoji reactions  
✅ Responsive design (mobile & desktop)  
✅ 100% free hosting  

## Cost

- **Frontend**: $0 (GitHub Pages)
- **Relay**: $0 (Railway free tier: 500 hours/month)
- **Total**: **$0/month** 🎉

## Development

```bash
# Test relay server locally
cd relay-server
npm install
npm start

# Open frontend
cd docs
python3 -m http.server 8000
# Visit http://localhost:8000?relay=ws://localhost:3000
```

## License

MIT
