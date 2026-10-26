
const WebSocket = require("ws");

const server = new WebSocket.Server({ port: 8080 });

const clients = new Map();

function broadcast(message) {
  const data = JSON.stringify(message);

  for (const client of clients.keys()) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

server.on("connection", (socket) => {
  console.log("A client connected");

  socket.on("message", (rawData) => {
    try {
      const message = JSON.parse(rawData.toString());

      if (message.type === "JOIN") {
        const username = String(message.username || "")
          .trim()
          .slice(0, 30);

        if (!username) return;

        clients.set(socket, username);

        broadcast({
          type: "SYSTEM",
          text: `${username} joined the chat`,
          timestamp: new Date().toISOString(),
        });

        broadcast({
          type: "USERS",
          users: [...clients.values()],
        });
      }

      if (message.type === "CHAT") {
        const username = clients.get(socket);

        if (!username) return;

        const text = String(message.text || "").trim();

        if (!text || text.length > 1000) return;

        broadcast({
          type: "CHAT",
          id: crypto.randomUUID(),
          username,
          text,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Invalid message received");
    }
  });

  socket.on("close", () => {
    const username = clients.get(socket);

    clients.delete(socket);

    if (username) {
      broadcast({
        type: "SYSTEM",
        text: `${username} left the chat`,
        timestamp: new Date().toISOString(),
      });

      broadcast({
        type: "USERS",
        users: [...clients.values()],
      });
    }

    console.log("A client disconnected");
  });
});

console.log("WebSocket server running at ws://localhost:8080");
