const http = require('http');
const WebSocket = require('ws');

const server = http.createServer();
const wss = new WebSocket.Server({ server, maxPayload: 16 * 1024 });

// Rate limiting (relaxed for WebRTC ICE candidates)
const RATE_LIMIT_WINDOW = 1000;
const MAX_MESSAGES_PER_WINDOW = 50;

wss.on('connection', (ws, req) => {
    // CORS - allow connections from GitHub Pages
    const origin = req.headers.origin;
    console.log(`Client connected from: ${origin}`);

    ws.id = Math.random().toString(36).substring(2, 15);
    ws.isAlive = true;
    ws.messageCount = 0;
    ws.lastMessageReset = Date.now();

    ws.send(JSON.stringify({ type: 'welcome', id: ws.id }));

    ws.on('message', (message) => {
        // Rate limiting
        const now = Date.now();
        if (now - ws.lastMessageReset > RATE_LIMIT_WINDOW) {
            ws.messageCount = 0;
            ws.lastMessageReset = now;
        }
        ws.messageCount++;

        if (ws.messageCount > MAX_MESSAGES_PER_WINDOW) {
            console.warn(`Rate limit exceeded for client ${ws.id}`);
            return;
        }

        try {
            const data = JSON.parse(message);

            // Validate message type
            const allowedTypes = ['offer', 'answer', 'candidate', 'ready', 'chat', 'emoji'];
            if (!data.type || !allowedTypes.includes(data.type)) {
                console.warn(`Invalid message type: ${data.type}`);
                return;
            }

            // Relay to all other clients
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    data.sender = ws.id;
                    client.send(JSON.stringify(data));
                }
            });
        } catch (e) {
            console.error('Error parsing message:', e);
        }
    });

    ws.on('close', () => {
        console.log(`Client disconnected: ${ws.id}`);
        broadcastDisconnect(ws);
    });

    ws.on('pong', () => {
        ws.isAlive = true;
    });
});

// Heartbeat to detect dead connections
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            console.log(`Client timed out: ${ws.id}`);
            broadcastDisconnect(ws);
            return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('close', () => {
    clearInterval(interval);
});

function broadcastDisconnect(ws) {
    wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'peer-disconnected', id: ws.id }));
        }
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Relay server running on port ${PORT}`);
    console.log('Version: 1.1.0 - Heartbeat + Disconnect broadcast');
});
