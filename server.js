const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const helmet = require('helmet');

const app = express();
const server = http.createServer(app);

// Security Headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            connectSrc: ["'self'", "ws:", "wss:"], // Allow WebSocket connections
            scriptSrc: ["'self'"], // unsafe-inline no longer needed
            imgSrc: ["'self'", "data:", "blob:"],
            mediaSrc: ["'self'", "blob:"],
        },
    },
}));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket signaling with maxPayload limit (16KB)
const wss = new WebSocket.Server({ server, maxPayload: 16 * 1024 });

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 1000; // 1 second
const MAX_MESSAGES_PER_WINDOW = 20;

// WebSocket signaling
wss.on('connection', (ws) => {
    // Assign a random ID to the client
    ws.id = Math.random().toString(36).substring(2, 15);
    console.log(`Client connected: ${ws.id}`);

    // Rate limiting state
    ws.messageCount = 0;
    ws.lastMessageReset = Date.now();

    // Send the assigned ID back to the client
    ws.send(JSON.stringify({ type: 'welcome', id: ws.id }));

    ws.on('message', (message) => {
        // Rate limiting check
        const now = Date.now();
        if (now - ws.lastMessageReset > RATE_LIMIT_WINDOW) {
            ws.messageCount = 0;
            ws.lastMessageReset = now;
        }
        ws.messageCount++;

        if (ws.messageCount > MAX_MESSAGES_PER_WINDOW) {
            console.warn(`Rate limit exceeded for client ${ws.id}`);
            return; // Drop message
        }

        try {
            const data = JSON.parse(message);

            // Input Validation
            const allowedTypes = ['offer', 'answer', 'candidate', 'ready'];
            if (!data.type || typeof data.type !== 'string' || !allowedTypes.includes(data.type)) {
                console.warn(`Invalid message type from ${ws.id}: ${data.type}`);
                return;
            }

            // Broadcast to all other clients
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    // Attach sender ID so receiver knows who sent it
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
        // Notify others to remove this peer
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'peer-disconnected', id: ws.id }));
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
