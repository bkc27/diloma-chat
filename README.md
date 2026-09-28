# Diploma Group Chat

Run `npm install`, then `npm start`. Open http://localhost:3000 in two browser tabs, enter different names and the same room ID, and send messages in either direction. Room IDs are case-sensitive.

For two devices on the same Wi-Fi, open http://<server-computer-LAN-IP>:3000 on both devices. Allow the Node server through the local firewall if needed. Do not open chat.html directly or through a separate Live Server. On different networks, deploy the Node server to a host that supports Socket.IO and use its shared URL.

Run `npm test` for HTTP and multi-client messaging integration checks. Set PORT to override port 3000.

Messages are live only: there is no database, message history or offline delivery. Reconnecting clients rejoin their room. Display names are not authenticated and anyone who knows a room ID can join it.
