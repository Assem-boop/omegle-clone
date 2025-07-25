const socket = io();

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const messagesDiv = document.getElementById('messages');
const input = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const skipBtn = document.getElementById('skipBtn');
const reportBtn = document.getElementById('reportBtn');
const onlineUsersDiv = document.getElementById('onlineUsers');
const typingStatus = document.getElementById('typingStatus');

let localStream = null;
let peerConnection = null;
const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

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

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(config);
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", event.candidate);
    }
  };
}

socket.on('connect', () => {
  console.log("🔌 Connected to server");
  startLocalVideo();
});

socket.on('system', (msg) => {
  appendMessage("🔔 " + msg, 'system');
  if (msg.includes("connected to a stranger")) {
    createPeerConnection();
    createOffer();
  }
});

socket.on('offer', async (offer) => {
  createPeerConnection();
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('answer', answer);
});

socket.on('answer', async (answer) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', async (candidate) => {
  try {
    await peerConnection.addIceCandidate(candidate);
  } catch (e) {
    console.error("ICE error:", e);
  }
});

async function createOffer() {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("offer", offer);
}

sendBtn.addEventListener('click', () => {
  const msg = input.value.trim();
  if (msg !== '') {
    socket.emit('message', msg);
    appendMessage(`You: ${msg}`);
    input.value = '';
  }
});

let typingTimeout;
input.addEventListener('input', () => {
  socket.emit('typing');
});

socket.on('partner-typing', () => {
  typingStatus.textContent = 'Stranger is typing...';
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    typingStatus.textContent = '';
  }, 1500);
});

skipBtn.addEventListener('click', () => {
  socket.emit('skip');
  messagesDiv.innerHTML = '';
  typingStatus.textContent = '';
  appendMessage('🔄 Searching for a new stranger...', 'system');
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  remoteVideo.srcObject = null;
});

reportBtn.addEventListener('click', () => {
  socket.emit('report');
  appendMessage('🚨 You reported the stranger.', 'system');
  socket.emit('skip');
});

socket.on('message', (msg) => {
  appendMessage(`Stranger: ${msg}`);
});

socket.on('online-count', (count) => {
  onlineUsersDiv.textContent = `Users online: ${count}`;
});

function appendMessage(msg, className = '') {
  const div = document.createElement('div');
  div.textContent = msg;
  if (className) div.classList.add(className);
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
