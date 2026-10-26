
const WebSocket = require("ws");
const crypto = require("crypto");
const PORT = process.env.PORT || 8080;

const server = new WebSocket.Server({
  port: PORT,
});

const clients = new Map();

function sendTo(socket, message) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function broadcast(message) {
  const data = JSON.stringify(message);

  for (const client of clients.keys()) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// Find usernames mentioned in a message.
function getMentionedUsers(text) {
  const usernames = [...clients.values()];

  return usernames.filter((username) => {
    const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `(^|[^\\w])@${escaped}(?=$|[^\\w])`,
      "i"
    );

    return pattern.test(text);
  });
}

server.on("connection", (socket) => {
  console.log("A client connected");

  socket.on("message", (rawData) => {
    console.log("Received from client:", rawData.toString());

    try {
      const message = JSON.parse(rawData.toString());

      // JOIN
      if (message.type === "JOIN") {
        const username = String(message.username || "")
          .trim()
          .slice(0, 30);

        if (!username) {
          sendTo(socket, {
            type: "JOIN_ERROR",
            text: "Please enter a valid username.",
          });
          return;
        }

        // Prevent duplicate usernames.
        const alreadyExists = [...clients.values()].some(
          (name) => name.toLowerCase() === username.toLowerCase()
        );

        if (alreadyExists) {
          sendTo(socket, {
            type: "JOIN_ERROR",
            text: "That username is already in use.",
          });
          return;
        }

        clients.set(socket, username);

        console.log("Sending JOINED to:", username);

        // IMPORTANT: Tell React that joining succeeded.
        sendTo(socket, {
          type: "JOINED",
          username,
        });

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

      // GROUP CHAT
      else if (message.type === "CHAT") {
        const username = clients.get(socket);
        if (!username) return;

        const text = String(message.text || "").trim();
        if (!text || text.length > 1000) return;

        broadcast({
          type: "CHAT",
          id: crypto.randomUUID(),
          username,
          text,
          mentionedUsers: getMentionedUsers(text),
          timestamp: new Date().toISOString(),
        });
      }

      // PRIVATE CHAT
      else if (message.type === "CHAT_PRIVATE") {
        const username = clients.get(socket);
        if (!username) return;

        const recipientName = String(message.to || "").trim();
        const text = String(message.text || "").trim();

        if (!recipientName || !text || text.length > 1000) return;

        const recipientEntry = [...clients.entries()].find(
          ([, name]) =>
            name.toLowerCase() === recipientName.toLowerCase()
        );

        if (!recipientEntry) {
          sendTo(socket, {
            type: "PRIVATE_ERROR",
            text: "This user is no longer online.",
          });
          return;
        }

        const [recipientSocket, recipientUsername] = recipientEntry;

        const privateMessage = {
          type: "CHAT_PRIVATE",
          id: crypto.randomUUID(),
          from: username,
          to: recipientUsername,
          text,
          timestamp: new Date().toISOString(),
        };

        sendTo(recipientSocket, privateMessage);

        // Echo to sender so their own message appears in the chat.
        if (recipientSocket !== socket) {
          sendTo(socket, privateMessage);
        }
      }
    } catch (error) {
      console.error("Invalid message received:", error.message);
    }
  });

  socket.on("close", (code, reason) => {
    console.log("Client disconnected:", {
      code,
      reason: reason.toString(),
    });

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
  });

  socket.on("error", (error) => {
    console.error("WebSocket error:", error.message);
  });
});

server.on("listening", () => {
  console.log(`WebSocket server listening on port ${PORT}`);
});
