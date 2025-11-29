const localVideo = document.getElementById('localVideo');
const muteBtn = document.getElementById('muteBtn');
const videosDiv = document.getElementById('videos');

let localStream;
let ws;
let myId;
const peers = {}; // peerId -> { connection, videoEl }

const rtcConfig = {
    iceServers: CONFIG.STUN_SERVERS
};

async function start() {
    // 1. Initialize WebSocket (Signaling)
    try {
        // Get relay URL from config or URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const relayOverride = urlParams.get('relay');
        const wsUrl = relayOverride || CONFIG.RELAY_URL;

        console.log('Connecting to relay:', wsUrl);
        ws = new WebSocket(wsUrl);

        ws.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            handleSignalingData(data);
        };

        ws.onopen = () => {
            console.log('Connected to signaling server');
            // Don't send ready yet - wait for camera
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            alert('Failed to connect to relay server. Please check the relay URL.');
        };
    } catch (e) {
        console.error('WebSocket init failed:', e);
    }

    // 2. Initialize Camera
    try {
        // Mobile-friendly constraints
        const constraints = {
            audio: true,
            video: {
                facingMode: 'user', // Default to front camera
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };

        try {
            console.log('Requesting camera with constraints:', constraints);
            localStream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('Camera access granted, tracks:', localStream.getTracks().map(t => t.kind));
        } catch (e) {
            console.warn('HD/Front camera failed, falling back to basic constraints', e);
            // Try absolute minimum constraints
            localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            console.log('Fallback camera access granted');
        }

        // Show raw camera
        localVideo.srcObject = localStream;

        // Enable buttons
        muteBtn.disabled = false;
        cameraBtn.disabled = false;
        shareBtn.disabled = false;

        // NOW announce presence to existing peers (after camera is ready)
        console.log('Camera ready, announcing presence to peers');
        if (ws && ws.readyState === WebSocket.OPEN) {
            send({ type: 'ready' });
        } else {
            // If WebSocket isn't ready yet, wait for it
            ws.addEventListener('open', () => {
                send({ type: 'ready' });
            }, { once: true });
        }

    } catch (err) {
        console.error('Error starting video call:', err);
        console.error('Error name:', err.name);
        console.error('Error message:', err.message);

        // More specific error messages
        if (err.name === 'NotAllowedError') {
            alert('Camera/microphone permission denied. Please allow access and refresh.');
        } else if (err.name === 'NotFoundError') {
            alert('No camera/microphone found on this device.');
        } else if (err.name === 'NotReadableError') {
            alert('Camera is already in use by another app.');
        } else {
            alert('Could not access camera/microphone: ' + err.message);
        }
    }
}

async function handleSignalingData(data) {
    console.log('Received signaling data:', data.type, 'from:', data.sender);
    switch (data.type) {
        case 'welcome':
            myId = data.id;
            console.log('My ID:', myId);
            // Don't send ready here - it's sent after camera init
            break;

        case 'ready':
            // A new peer has joined. Initiate connection.
            console.log('Peer ready:', data.sender);
            if (data.sender !== myId) {
                initiateConnection(data.sender);
            }
            break;

        case 'offer':
            handleOffer(data.offer, data.sender);
            break;

        case 'answer':
            handleAnswer(data.answer, data.sender);
            break;

        case 'candidate':
            handleCandidate(data.candidate, data.sender);
            break;

        case 'peer-disconnected':
            removePeer(data.id);
            break;

        case 'chat':
            handleChat(data.text, data.sender);
            break;

        case 'emoji':
            handleEmoji(data.emoji);
            break;
    }
}

function createPeerConnection(peerId) {
    console.log(`Creating peer connection for ${peerId}`);
    const pc = new RTCPeerConnection(rtcConfig);

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            console.log(`Sending ICE candidate to ${peerId}`);
            send({ type: 'candidate', candidate: event.candidate, target: peerId });
        }
    };

    pc.oniceconnectionstatechange = () => {
        console.log(`ICE connection state for ${peerId}: ${pc.iceConnectionState}`);
    };

    pc.onconnectionstatechange = () => {
        console.log(`Connection state for ${peerId}: ${pc.connectionState}`);
    };

    pc.ontrack = (event) => {
        console.log(`Received track from ${peerId}:`, event.track.kind);

        // Prevent duplicate videos for the same peer
        if (peers[peerId] && peers[peerId].videoEl) {
            console.log(`Video element already exists for ${peerId}, updating stream`);
            const vid = peers[peerId].videoEl.querySelector('video');
            if (vid) {
                vid.srcObject = event.streams[0];
                // Try to play, but don't worry if it fails (user can click)
                vid.play().catch(e => console.log('Autoplay blocked, user must interact'));
            }
            return;
        }

        if (!peers[peerId].videoEl) {
            const container = document.createElement('div');
            container.className = 'video-container';
            container.id = `container-${peerId}`;

            const vid = document.createElement('video');
            vid.autoplay = true;
            vid.playsInline = true; // Critical for mobile
            vid.muted = false; // Remote video should not be muted

            // Important: Set srcObject first, then try to play
            vid.srcObject = event.streams[0];

            const label = document.createElement('div');
            label.className = 'label';
            label.innerText = `User ${peerId.substr(0, 4)}`;

            container.appendChild(vid);
            container.appendChild(label);
            videosDiv.appendChild(container);

            peers[peerId].videoEl = container;

            // Try to play, handle autoplay blocking gracefully
            const playPromise = vid.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.log('Autoplay blocked for peer video, adding click handler');
                    // Add a click-to-play overlay
                    container.style.cursor = 'pointer';
                    container.onclick = () => {
                        vid.play();
                        container.onclick = null;
                        container.style.cursor = 'default';
                    };
                });
            }
        }
    };

    // Only add local tracks if we have a local stream
    if (localStream) {
        localStream.getTracks().forEach(track => {
            console.log(`Adding ${track.kind} track to peer ${peerId}`);
            pc.addTrack(track, localStream);
        });
    } else {
        console.warn(`No local stream available when creating connection to ${peerId}`);
    }

    peers[peerId] = { connection: pc, videoEl: null };
    return pc;
}

async function initiateConnection(peerId) {
    console.log(`Initiating connection to ${peerId}`);
    const pc = createPeerConnection(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send({ type: 'offer', offer: offer, target: peerId });
}

async function handleOffer(offer, peerId) {
    console.log(`Received offer from ${peerId}`);
    const pc = createPeerConnection(peerId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    send({ type: 'answer', answer: answer, target: peerId });
}

async function handleAnswer(answer, peerId) {
    console.log(`Received answer from ${peerId}`);
    const pc = peers[peerId]?.connection;
    if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
}

async function handleCandidate(candidate, peerId) {
    const pc = peers[peerId]?.connection;
    if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
}

function removePeer(peerId) {
    console.log(`Removing peer ${peerId}`);
    if (peers[peerId]) {
        if (peers[peerId].connection) {
            peers[peerId].connection.close();
        }
        if (peers[peerId].videoEl) {
            peers[peerId].videoEl.remove();
        }
        // Double check DOM removal
        const el = document.getElementById(`container-${peerId}`);
        if (el) el.remove();

        delete peers[peerId];
    } else {
        // Even if peer object is gone, ensure UI is clean
        const el = document.getElementById(`container-${peerId}`);
        if (el) el.remove();
    }
}

function send(data) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

function toggleMute() {
    if (!localStream) {
        console.warn('Local stream not ready yet');
        return;
    }
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        muteBtn.innerText = audioTrack.enabled ? 'Mute Mic' : 'Unmute Mic';
        muteBtn.classList.toggle('muted', !audioTrack.enabled);
    } else {
        console.warn('No audio track found');
        alert('No microphone detected');
    }
}

const cameraBtn = document.getElementById('cameraBtn');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const chatMessages = document.getElementById('chat-messages');
const emojiOverlay = document.getElementById('emoji-overlay');

function toggleCamera() {
    if (!localStream) {
        console.warn('Local stream not ready yet');
        return;
    }
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        cameraBtn.innerText = videoTrack.enabled ? 'Stop Camera' : 'Start Camera';
        cameraBtn.classList.toggle('camera-off', !videoTrack.enabled);
    } else {
        console.warn('No video track found');
        alert('No camera detected');
    }
}

function sendChat() {
    const text = chatInput.value.trim();
    if (text) {
        const message = { type: 'chat', text: text };
        send(message);
        // User requested NOT to see their own messages
        // appendMessage('You', text, 'local'); 
        chatInput.value = '';
    }
}

function handleChat(text, senderId) {
    appendMessage(`User ${senderId.substr(0, 4)}`, text, 'remote');
}

function appendMessage(sender, text, type) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;
    msgDiv.innerText = `${sender}: ${text}`;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendEmoji(emoji) {
    send({ type: 'emoji', emoji: emoji });
    showFloatingEmoji(emoji);
}

function handleEmoji(emoji) {
    showFloatingEmoji(emoji);
}

function showFloatingEmoji(emoji) {
    const el = document.createElement('div');
    el.className = 'floating-emoji';
    el.innerText = emoji;
    el.style.left = Math.random() * 80 + 10 + '%'; // Random horizontal position
    emojiOverlay.appendChild(el);

    // Remove after animation
    setTimeout(() => {
        el.remove();
    }, 3000);
}

// Screen Sharing Logic
const shareBtn = document.getElementById('shareBtn');
let isSharing = false;
let screenStream;

async function toggleScreenShare() {
    if (isSharing) {
        stopScreenShare();
    } else {
        startScreenShare();
    }
}

async function startScreenShare() {
    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        // Handle user clicking "Stop sharing" in browser UI
        screenTrack.onended = () => {
            stopScreenShare();
        };

        // Replace track in local stream
        const videoSender = localStream.getVideoTracks()[0];
        localStream.removeTrack(videoSender);
        localStream.addTrack(screenTrack);
        localVideo.srcObject = localStream;

        // Replace track for all peers
        updatePeerTracks(screenTrack);

        isSharing = true;
        shareBtn.innerText = 'Stop Sharing';
        shareBtn.classList.add('active');
    } catch (err) {
        console.error('Error sharing screen:', err);
    }
}

function stopScreenShare() {
    if (!isSharing) return;

    // Stop screen stream
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
    }

    // Get camera track again
    navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } })
        .then(camStream => {
            const camTrack = camStream.getVideoTracks()[0];

            // Replace track in local stream
            const currentTrack = localStream.getVideoTracks()[0];
            localStream.removeTrack(currentTrack);
            localStream.addTrack(camTrack);
            localVideo.srcObject = localStream;

            // Replace track for all peers
            updatePeerTracks(camTrack);

            isSharing = false;
            shareBtn.innerText = 'Share Screen';
            shareBtn.classList.remove('active');
        })
        .catch(err => {
            console.error('Error reverting to camera:', err);
            alert('Could not revert to camera. Please refresh.');
        });
}

function updatePeerTracks(newTrack) {
    Object.values(peers).forEach(peer => {
        const sender = peer.connection.getSenders().find(s => s.track.kind === 'video');
        if (sender) {
            sender.replaceTrack(newTrack);
        }
    });
}

// Mobile Chat Toggle
const chatToggleBtn = document.getElementById('chatToggleBtn');
const chatContainer = document.getElementById('chat-container');

if (chatToggleBtn) {
    chatToggleBtn.addEventListener('click', () => {
        chatContainer.classList.toggle('visible');
        chatToggleBtn.classList.toggle('active');
    });
}

// Event Listeners
muteBtn.addEventListener('click', toggleMute);
cameraBtn.addEventListener('click', toggleCamera);
shareBtn.addEventListener('click', toggleScreenShare);
sendBtn.addEventListener('click', sendChat);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChat();
});

document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        sendEmoji(btn.dataset.emoji);
    });
});

// Handle window close/refresh (multiple events for better coverage)
window.addEventListener('beforeunload', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
});

// Mobile-friendly cleanup (iOS Safari doesn't always fire beforeunload)
window.addEventListener('pagehide', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
});

// Start the app
start();
