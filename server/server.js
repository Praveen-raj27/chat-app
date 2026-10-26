
const WebSocket = require("ws");
const crypto = require("crypto");

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// Each socket maps to its connected user's information.
const clients = new Map();

// username (normalized) -> socket
const usernames = new Map();

function sendTo(socket, data) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
  }
}

function broadcast(data) {
  const payload = JSON.stringify(data);

  for (const socket of clients.keys()) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  }
}

function getOnlineUsers() {
  return Array.from(clients.values())
    .map((client) => client.username);
}

function broadcastUsers() {
  broadcast({
    type: "USERS",
    users: getOnlineUsers(),
  });
}

function broadcastSystem(text) {
  broadcast({
    type: "SYSTEM",
    id: crypto.randomUUID(),
    text,
    timestamp: new Date().toISOString(),
  });
}

function getMentionedUsers(text) {
  const mentioned = new Set();
  const matches = text.match(/@([a-zA-Z0-9_]+)/g) || [];

  for (const match of matches) {
    const name = match.slice(1).toLowerCase();
    const socket = usernames.get(name);

    if (socket && clients.has(socket)) {
      mentioned.add(clients.get(socket).username);
    }
  }

  return Array.from(mentioned);
}

function removeClient(socket) {
  const client = clients.get(socket);

  // Ignore repeated cleanup or unknown sockets.
  if (!client) return;

  clients.delete(socket);

  const normalizedName = client.username.toLowerCase();

  // Do not delete a newer connection for the same username.
  if (usernames.get(normalizedName) === socket) {
    usernames.delete(normalizedName);
  }

  console.log(`User disconnected: ${client.username}`);

  broadcastSystem(`${client.username} left the chat`);
  broadcastUsers();
}

wss.on("connection", (socket) => {
  socket.isAlive = true;

  console.log("New WebSocket connection");

  // A pong response means the connection is alive.
  socket.on("pong", () => {
    socket.isAlive = true;
  });

  socket.on("message", (rawMessage) => {
    let message;

    try {
      message = JSON.parse(rawMessage.toString());
    } catch {
      sendTo(socket, {
        type: "ERROR",
        message: "Invalid JSON message",
      });
      return;
    }

    // JOIN
    if (message.type === "JOIN") {
      const username = String(message.username || "").trim();

      if (!/^[a-zA-Z0-9_]{1,20}$/.test(username)) {
        sendTo(socket, {
          type: "JOIN_ERROR",
          message:
            "Username must contain 1–20 letters, numbers, or underscores.",
        });
        return;
      }

      const normalizedName = username.toLowerCase();
      const existingSocket = usernames.get(normalizedName);

      if (
        existingSocket &&
        existingSocket !== socket &&
        existingSocket.readyState === WebSocket.OPEN
      ) {
        sendTo(socket, {
          type: "JOIN_ERROR",
          message: "This username is already in use.",
        });
        return;
      }

      // Avoid registering one socket under multiple usernames.
      if (clients.has(socket)) {
        removeClient(socket);
      }

      clients.set(socket, { username });
      usernames.set(normalizedName, socket);

      console.log(`User joined: ${username}`);

      sendTo(socket, {
        type: "JOINED",
        username,
      });

      broadcastSystem(`${username} joined the chat`);
      broadcastUsers();

      return;
    }

    // All remaining message types require a joined user.
    const client = clients.get(socket);

    if (!client) {
      sendTo(socket, {
        type: "ERROR",
        message: "Join the chat before sending messages.",
      });
      return;
    }

    // GROUP CHAT
    if (message.type === "CHAT") {
      const text = String(message.text || "").trim();

      if (!text) return;

      if (text.length > 5000) {
        sendTo(socket, {
          type: "ERROR",
          message: "Message is too long.",
        });
        return;
      }

      broadcast({
        type: "CHAT",
        id: crypto.randomUUID(),
        username: client.username,
        text,
        mentionedUsers: getMentionedUsers(text),
        timestamp: new Date().toISOString(),
      });

      return;
    }

    // PRIVATE CHAT
    if (message.type === "CHAT_PRIVATE") {
      const text = String(message.text || "").trim();
      const recipientName = String(
        message.to || message.recipient || message.username || ""
      ).trim();

      if (!text || !recipientName) return;

      if (text.length > 5000) {
        sendTo(socket, {
          type: "PRIVATE_ERROR",
          message: "Message is too long.",
        });
        return;
      }

      const recipientSocket = usernames.get(
        recipientName.toLowerCase()
      );

      if (
        !recipientSocket ||
        !clients.has(recipientSocket) ||
        recipientSocket.readyState !== WebSocket.OPEN
      ) {
        sendTo(socket, {
          type: "PRIVATE_ERROR",
          message: `${recipientName} is not online.`,
        });
        return;
      }

      const privateMessage = {
        type: "CHAT_PRIVATE",
        id: crypto.randomUUID(),
        username: client.username,
        to: clients.get(recipientSocket).username,
        text,
        timestamp: new Date().toISOString(),
      };

      // Deliver to the recipient.
      sendTo(recipientSocket, privateMessage);

      // Echo to sender so their UI can display the sent message.
      if (recipientSocket !== socket) {
        sendTo(socket, privateMessage);
      }

      return;
    }
  });

  socket.on("close", () => {
    removeClient(socket);
  });

  socket.on("error", (error) => {
    console.error("WebSocket error:", error.message);
    removeClient(socket);
  });
});

// Heartbeat: detect dead or unreachable connections.
const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    if (socket.isAlive === false) {
      console.log("Terminating stale WebSocket connection");
      socket.terminate();
      continue;
    }

    if (socket.readyState === WebSocket.OPEN) {
      socket.isAlive = false;
      socket.ping();
    }
  }
}, 30000);

wss.on("close", () => {
  clearInterval(heartbeat);
});

wss.on("listening", () => {
  console.log(`WebSocket server listening on port ${PORT}`);
});

wss.on("error", (error) => {
  console.error("WebSocket server error:", error);
});

function shutdown() {
  clearInterval(heartbeat);

  for (const socket of wss.clients) {
    socket.terminate();
  }

  wss.close(() => {
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
