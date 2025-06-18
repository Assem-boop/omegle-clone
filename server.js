const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const PORT = process.env.PORT || 8080;

let waitingUser = null;
const partners = {};

io.on('connection', (socket) => {
  console.log(`✅ User connected: ${socket.id}`);

  // Emit current online count
  function updateUserCount() {
    const count = io.engine.clientsCount;
    io.emit('online-count', count);
  }
  updateUserCount();

  // Pairing logic
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

  // Text message
  socket.on('message', (msg) => {
    const partnerId = partners[socket.id];
    if (partnerId) {
      io.to(partnerId).emit('message', msg);
    }
  });

  // Skip logic
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

  // WebRTC signaling
  socket.on('offer', (offer) => {
    const partnerId = partners[socket.id];
    if (partnerId) {
      io.to(partnerId).emit('offer', offer);
    }
  });

  socket.on('answer', (answer) => {
    const partnerId = partners[socket.id];
    if (partnerId) {
      io.to(partnerId).emit('answer', answer);
    }
  });

  socket.on('ice-candidate', (candidate) => {
    const partnerId = partners[socket.id];
    if (partnerId) {
      io.to(partnerId).emit('ice-candidate', candidate);
    }
  });

  // Disconnect
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
    updateUserCount(); // 👥 Update online user count
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
