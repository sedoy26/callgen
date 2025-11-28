// Configuration for the video call app
const CONFIG = {
    // WebSocket relay server URL
    // You can override this with ?relay=wss://your-server.com URL parameter
    RELAY_URL: 'wss://callgen-relay.up.railway.app',

    // STUN servers for NAT traversal
    STUN_SERVERS: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};
