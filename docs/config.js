// Configuration for the video call app
const CONFIG = {
    // WebSocket relay server URL
    // You can override this with ?relay=wss://your-server.com URL parameter
    RELAY_URL: 'wss://callgen-production.up.railway.app',

    // STUN/TURN servers for NAT traversal
    STUN_SERVERS: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
    ]
};
