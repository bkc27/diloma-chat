const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { io: connect } = require('socket.io-client');
const { server, io } = require('../server');
let url;
const clients = [];
before(async () => {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  url = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  clients.forEach(client => client.disconnect());
  await new Promise(resolve => io.close(resolve));
});
async function client() {
  const socket = connect(url, { autoConnect: false, reconnection: false });
  clients.push(socket);
  const connected = once(socket, 'connect');
  socket.connect();
  await connected;
  return socket;
}
const emit = (socket, event, data) => socket.timeout(2000).emitWithAck(event, data);
const join = (socket, username, room) => emit(socket, 'joinRoom', { username, room });
test('serves all pages, styles, scripts and Socket.IO client', async () => {
  for (const path of ['/', '/chat.html', '/chat.js', '/style.css', '/socket.io/socket.io.js']) {
    const response = await fetch(url + path);
    assert.equal(response.status, 200, path);
    assert.ok((await response.text()).length);
  }
});
test('bidirectional delivery, sender echo, room isolation, and trusted identity', { timeout: 5000 }, async () => {
  const [alice, bob, outsider] = await Promise.all([client(), client(), client()]);
  await Promise.all([join(alice, ' Alice ', ' room-a '), join(bob, 'Bob', 'room-a'), join(outsider, 'Other', 'room-b')]);
  const leaked = [];
  outsider.on('message', data => leaked.push(data));
  const received = once(bob, 'message');
  const echoed = once(alice, 'message');
  assert.deepEqual(await emit(alice, 'chatMessage', { username: 'Imposter', room: 'room-b', message: ' Hello ' }), { ok: true });
  assert.deepEqual((await received)[0], { senderId: alice.id, username: 'Alice', message: 'Hello' });
  assert.deepEqual((await echoed)[0], { senderId: alice.id, username: 'Alice', message: 'Hello' });
  const reply = once(alice, 'message');
  await emit(bob, 'chatMessage', { message: 'Hi Alice' });
  assert.equal((await reply)[0].message, 'Hi Alice');
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.deepEqual(leaked, []);
});
test('rejects malformed joins, unjoined sends, blank and oversized messages', async () => {
  const socket = await client();
  assert.equal((await emit(socket, 'chatMessage', { message: 'Hi' })).ok, false);
  for (const data of [null, {}, { username: ' ', room: 'x' }, { username: 'A', room: '' }, { username: 'A'.repeat(51), room: 'x' }]) {
    assert.equal((await emit(socket, 'joinRoom', data)).ok, false);
  }
  await join(socket, 'Valid', 'validation');
  for (const data of [null, {}, { message: ' ' }, { message: 42 }, { message: 'x'.repeat(2001) }]) {
    assert.equal((await emit(socket, 'chatMessage', data)).ok, false);
  }
  assert.equal((await emit(socket, 'chatMessage', { message: 'x'.repeat(2000) })).ok, true);
});
test('rejoins after reconnect and stops receiving the previous room after switching', { timeout: 5000 }, async () => {
  const [alice, bob] = await Promise.all([client(), client()]);
  await Promise.all([join(alice, 'Alice', 'reconnect'), join(bob, 'Bob', 'reconnect')]);
  alice.disconnect();
  const connected = once(alice, 'connect');
  alice.connect();
  await connected;
  await join(alice, 'Alice', 'reconnect');
  const received = once(alice, 'message');
  await emit(bob, 'chatMessage', { message: 'Welcome back' });
  assert.equal((await received)[0].message, 'Welcome back');
  await join(alice, 'Alice', 'new-room');
  const unexpected = [];
  alice.on('message', message => unexpected.push(message));
  await emit(bob, 'chatMessage', { message: 'Old room only' });
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.deepEqual(unexpected, []);
});

test('room presence announces joins and departures without duplicate joins or cross-room leaks', { timeout: 5000 }, async () => {
  const [observer, newcomer, outsider] = await Promise.all([client(), client(), client()]);
  await Promise.all([join(observer, 'Observer', 'presence-room'), join(outsider, 'Outside', 'presence-other')]);
  const notices = [];
  const leaks = [];
  observer.on('presence', data => notices.push(data));
  outsider.on('presence', data => leaks.push(data));
  const connected = once(observer, 'presence');
  const ownNotice = once(newcomer, 'presence');
  await join(newcomer, 'New User', 'presence-room');
  assert.deepEqual((await connected)[0], { username: 'New User', action: 'connected' });
  assert.deepEqual((await ownNotice)[0], { username: 'New User', action: 'connected' });
  await join(newcomer, 'New User', 'presence-room');
  const departed = once(observer, 'presence');
  newcomer.disconnect();
  assert.deepEqual((await departed)[0], { username: 'New User', action: 'left' });
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(notices.length, 2);
  assert.deepEqual(leaks, []);
});
