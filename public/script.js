const socket = io();

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const messagesDiv = document.getElementById('messages');
const input = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const skipBtn = document.getElementById('skipBtn');

let localStream = null;
let peerConnection = null;
const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

// STEP 1: Access local camera & mic
async function startLocalVideo() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });
    localVideo.srcObject = localStream;
    console.log("✅ Local stream started");
  } catch (err) {
    console.error("Camera error:", err);
    alert("Please allow camera and microphone access.");
  }
}

// STEP 2: Create WebRTC Peer Connection
function createPeerConnection() {
  peerConnection = new RTCPeerConnection(config);

  // Add local stream tracks to connection
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // Show remote stream
  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  // Send ICE candidates to partner
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", event.candidate);
    }
  };
}

// STEP 3: Setup Socket.IO event handlers

socket.on('connect', () => {
  console.log("🔌 Connected to server");
  startLocalVideo();
});

socket.on('system', (msg) => {
  appendMessage("🔔 " + msg, 'system');

  if (msg.includes("connected to a stranger")) {
    // Ready to connect!
    createPeerConnection();
    createOffer(); // Act as caller
  }
});

socket.on('offer', async (offer) => {
  console.log("📨 Received offer");
  createPeerConnection(); // Act as callee
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('answer', answer);
});

socket.on('answer', async (answer) => {
  console.log("📨 Received answer");
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', async (candidate) => {
  console.log("📨 Received ICE candidate");
  try {
    await peerConnection.addIceCandidate(candidate);
  } catch (e) {
    console.error("❌ Failed to add ICE:", e);
  }
});

// STEP 4: Emit Offer to Stranger
async function createOffer() {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("offer", offer);
}

// STEP 5: Chat functionality
sendBtn.addEventListener('click', () => {
  const msg = input.value.trim();
  if (msg !== '') {
    socket.emit('message', msg);
    appendMessage(`You: ${msg}`);
    input.value = '';
  }
});

skipBtn.addEventListener('click', () => {
  socket.emit('skip');
  messagesDiv.innerHTML = '';
  appendMessage('🔄 Searching for a new stranger...', 'system');
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  remoteVideo.srcObject = null;
});

socket.on('message', (msg) => {
  appendMessage(`Stranger: ${msg}`);
});

function appendMessage(msg, className = '') {
  const div = document.createElement('div');
  div.textContent = msg;
  if (className) div.classList.add(className);
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
