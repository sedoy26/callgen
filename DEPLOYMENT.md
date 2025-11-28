# Deployment Guide

This app is designed to be easily deployable on free tier hosting services.

## Recommended: Single Service (Simplest)

The simplest way to deploy is to run the Node.js server, which serves both the signaling WebSocket and the static frontend files.

### Option 1: Render (Free Tier)
1.  **Sign up** at [render.com](https://render.com/).
2.  **Create New Web Service**.
3.  **Connect GitHub**: Select this repository.
4.  **Settings**:
    -   **Runtime**: Node
    -   **Build Command**: `npm install`
    -   **Start Command**: `npm start`
5.  **Deploy**: Render will automatically provision HTTPS.

### Option 2: Railway (Free Trial / Hobby)
1.  **Sign up** at [railway.app](https://railway.app/).
2.  **New Project** -> **Deploy from GitHub repo**.
3.  Railway automatically detects `package.json` and sets up the build.
4.  It will provide a default domain (HTTPS).

### Option 3: Fly.io (Free Allowance)
1.  **Install CLI**: [Follow instructions](https://fly.io/docs/hands-on/install-flyctl/).
2.  **Login**: `fly auth login`.
3.  **Launch**: Run `fly launch` in the project root.
    -   It will generate a `fly.toml`.
    -   Say "Yes" to copying configuration.
4.  **Deploy**: `fly deploy`.

---

## Advanced: Split Deployment (Frontend + Backend)

If you prefer to host the frontend separately (e.g., GitHub Pages) and only use Render for the signaling server.

### 1. Deploy Backend (Render)
Follow "Option 1" above, but you only need the WebSocket URL.
*Note: You might need to adjust CORS settings in `server.js` if you encounter issues, but the current Helmet configuration allows `ws:`/`wss:` connections.*

### 2. Deploy Frontend (GitHub Pages)
1.  **Edit `public/main.js`**:
    -   Find the line: `const wsUrl = \`\${protocol}//\${window.location.host}\`;`
    -   Change it to your Render backend URL: `const wsUrl = 'wss://your-app-name.onrender.com';`
2.  **Push to GitHub**.
3.  **Enable GitHub Pages**:
    -   Go to Repo Settings -> Pages.
    -   Source: `main` branch, `/public` folder (if possible, or move files to root).
    *Note: GitHub Pages usually serves from root or `/docs`. You might need to move `public/*` to root or use a build step.*

**Recommendation**: Stick to the "Single Service" deployment for simplicity. It avoids CORS issues and keeps frontend/backend in sync.
