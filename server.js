const express = require('express');
const http = require('node:http');
const path = require('node:path');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, 'public')));
io.on('connection', (socket) => {
  socket.on('joinRoom', (data, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    const username = typeof data?.username === 'string' ? data.username.trim() : '';
    const room = typeof data?.room === 'string' ? data.room.trim() : '';
    if (!username || username.length > 50 || !room || room.length > 100) {
      return reply({ ok: false, error: 'Enter a name (1–50 characters) and room ID (1–100 characters).' });
    }
    if (socket.data.room === room && socket.data.username === username) return reply({ ok: true });
    if (socket.data.room) {
      socket.leave(`chat:${socket.data.room}`);
      io.to(`chat:${socket.data.room}`).emit('presence', { username: socket.data.username, action: 'left' });
    }
    socket.data = { username, room };
    socket.join(`chat:${room}`);
    io.to(`chat:${room}`).emit('presence', { username, action: 'connected' });
    reply({ ok: true });
  });
  socket.on('disconnect', () => {
    if (socket.data.room) {
      io.to(`chat:${socket.data.room}`).emit('presence', { username: socket.data.username, action: 'left' });
    }
  });
  socket.on('chatMessage', (data, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    if (!socket.data.room) return reply({ ok: false, error: 'Join a room first.' });
    const message = typeof data?.message === 'string' ? data.message.trim() : '';
    if (!message || message.length > 2000) return reply({ ok: false, error: 'Message must contain 1–2000 characters.' });
    io.to(`chat:${socket.data.room}`).emit('message', { senderId: socket.id, username: socket.data.username, message });
    reply({ ok: true });
  });
});
if (require.main === module) {
  const port = process.env.PORT || 3000;
  server.listen(port, () => console.log(`Server Running on http://localhost:${port}`));
}
module.exports = { app, server, io };
