const localVideo = document.getElementById('localVideo');
const muteBtn = document.getElementById('muteBtn');
const videosDiv = document.getElementById('videos');

let localStream;
let ws;
let myId;
const peers = {}; // peerId -> { connection, videoEl }

const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

async function start() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;

        // Determine protocol: ws for http, wss for https
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;

        ws = new WebSocket(wsUrl);

        ws.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            handleSignalingData(data);
        };

        ws.onopen = () => {
            console.log('Connected to signaling server');
        };

    } catch (err) {
        console.error('Error starting video call:', err);
        alert('Could not access camera/microphone. Please allow permissions.');
    }
}

async function handleSignalingData(data) {
    switch (data.type) {
        case 'welcome':
            myId = data.id;
            // Announce presence to existing peers
            send({ type: 'ready' });
            break;

        case 'ready':
            // A new peer has joined. Initiate connection.
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
    const pc = new RTCPeerConnection(rtcConfig);

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            send({ type: 'candidate', candidate: event.candidate, target: peerId });
        }
    };

    pc.ontrack = (event) => {
        if (!peers[peerId].videoEl) {
            const container = document.createElement('div');
            container.className = 'video-container';
            container.id = `container-${peerId}`;

            const vid = document.createElement('video');
            vid.autoplay = true;
            vid.playsInline = true;
            vid.srcObject = event.streams[0];

            const label = document.createElement('div');
            label.className = 'label';
            label.innerText = `User ${peerId.substr(0, 4)}`;

            container.appendChild(vid);
            container.appendChild(label);
            videosDiv.appendChild(container);

            peers[peerId].videoEl = container;
        }
    };

    localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
    });

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
    if (peers[peerId]) {
        peers[peerId].connection.close();
        if (peers[peerId].videoEl) {
            peers[peerId].videoEl.remove();
        }
        delete peers[peerId];
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
        appendMessage('You', text, 'local');
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

// Event Listeners
muteBtn.addEventListener('click', toggleMute);
cameraBtn.addEventListener('click', toggleCamera);
sendBtn.addEventListener('click', sendChat);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChat();
});

document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        sendEmoji(btn.dataset.emoji);
    });
});

// Start the app
start();
