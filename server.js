const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

// Track connected users
let waitingUser = null;
const partners = {}; // Maps socket.id => partner.socket.id

io.on('connection', (socket) => {
  console.log(`✅ User connected: ${socket.id}`);

  // Try to pair the new user
  if (waitingUser && waitingUser.id !== socket.id) {
    const partnerSocket = waitingUser;

    partners[socket.id] = partnerSocket.id;
    partners[partnerSocket.id] = socket.id;

    socket.emit('system', 'You are now connected to a stranger.');
    partnerSocket.emit('system', 'You are now connected to a stranger.');

    waitingUser = null;
  } else {
    waitingUser = socket;
    socket.emit('system', 'Waiting for a stranger to connect...');
  }

  // Text chat messaging
  socket.on('message', (msg) => {
    const partnerId = partners[socket.id];
    if (partnerId) {
      io.to(partnerId).emit('message', msg);
    }
  });

  // Skip button
  socket.on('skip', () => {
    const partnerId = partners[socket.id];
    if (partnerId) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('system', 'Stranger skipped the chat.');
        waitingUser = partnerSocket;
      }
      delete partners[partnerId];
    }

    delete partners[socket.id];

    // Reconnect to new stranger
    if (waitingUser && waitingUser.id !== socket.id) {
      const partnerSocket = waitingUser;

      partners[socket.id] = partnerSocket.id;
      partners[partnerSocket.id] = socket.id;

      socket.emit('system', 'You are now connected to a new stranger.');
      partnerSocket.emit('system', 'You are now connected to a new stranger.');

      waitingUser = null;
    } else {
      waitingUser = socket;
      socket.emit('system', 'Waiting for a new stranger...');
    }
  });

  // WebRTC signaling: offer
  socket.on('offer', (offer) => {
    const partnerId = partners[socket.id];
    if (partnerId) {
      io.to(partnerId).emit('offer', offer);
    }
  });

  // WebRTC signaling: answer
  socket.on('answer', (answer) => {
    const partnerId = partners[socket.id];
    if (partnerId) {
      io.to(partnerId).emit('answer', answer);
    }
  });

  // WebRTC signaling: ICE candidates
  socket.on('ice-candidate', (candidate) => {
    const partnerId = partners[socket.id];
    if (partnerId) {
      io.to(partnerId).emit('ice-candidate', candidate);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.id}`);

    const partnerId = partners[socket.id];
    if (partnerId) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('system', 'Stranger disconnected.');
        waitingUser = partnerSocket;
      }
      delete partners[partnerId];
    }

    if (waitingUser === socket) {
      waitingUser = null;
    }

    delete partners[socket.id];
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
