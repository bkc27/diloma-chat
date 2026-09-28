const params = new URLSearchParams(window.location.search);
const username = (params.get('name') || '').trim();
const room = (params.get('room') || '').trim();
const roomName = document.getElementById('room-name');
document.getElementById('current-user-name').textContent = username;
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message');
const chatMessages = document.getElementById('chat-messages');
const status = document.getElementById('connection-status');
const sendButton = chatForm.querySelector('button');
let ready = false;
let sending = false;
function updateStatus(text) {
  status.textContent = text;
  sendButton.disabled = !ready || sending;
}
if (!username || username.length > 50 || !room || room.length > 100) {
  window.location.replace('/');
} else if (typeof io !== 'function') {
  updateStatus('Cannot connect. Open this page through the running chat server and reload.');
} else {
  const socket = io();
  roomName.textContent = room;
  updateStatus('Connecting...');
  socket.on('connect', () => {
    ready = false;
    updateStatus('Joining room...');
    socket.timeout(5000).emit('joinRoom', { username, room }, (error, result) => {
      ready = socket.connected && !error && result?.ok === true;
      updateStatus(ready ? 'Connected' : result?.error || 'Could not join room. Reload to retry.');
    });
  });
  socket.on('disconnect', () => {
    ready = false;
    updateStatus('Disconnected. Reconnecting... Messages sent while offline are not saved.');
  });
  socket.on('connect_error', () => {
    ready = false;
    updateStatus('Cannot reach the server. Retrying...');
  });
  socket.on('message', (data) => showMessage(data, data.senderId === socket.id));
  socket.on('presence', (data) => {
    const notice = document.createElement('div');
    notice.classList.add('presence-notice');
    notice.textContent = `${data.username} ${data.action === 'connected' ? 'connected' : 'left'}`;
    chatMessages.appendChild(notice);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
  chatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const message = messageInput.value.trim();
    if (!ready || !socket.connected || sending || !message) return;
    const draft = messageInput.value;
    sending = true;
    updateStatus('Sending...');
    socket.timeout(5000).emit('chatMessage', { message }, (error, result) => {
      sending = false;
      if (error || !result?.ok) {
        updateStatus(result?.error || 'Delivery not confirmed. Check the chat before retrying.');
        return;
      }
      if (messageInput.value === draft) messageInput.value = '';
      updateStatus(ready ? 'Connected' : 'Disconnected. Reconnecting...');
      messageInput.focus();
    });
  });
}
function showMessage(data, isOwnMessage) {
  const div = document.createElement('div');
  div.classList.add('message');
  div.classList.add(isOwnMessage ? 'message-sent' : 'message-received');
  const author = document.createElement('div');
  author.classList.add('username');
  author.textContent = isOwnMessage ? 'You' : data.username;
  const text = document.createElement('div');
  text.classList.add('text');
  text.textContent = data.message;
  div.append(author, text);
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
