// server/server.js
const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const MAX_PAYLOAD_BYTES = 3 * 1024 * 1024;
const MAX_TEXT_LENGTH = 1000;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const wss = new WebSocket.Server({
  port: PORT,
  maxPayload: MAX_PAYLOAD_BYTES,
});

const clients = new Map();
const usernames = new Map();

console.log(`WebSocket server running on port ${PORT}`);

function sendTo(socket, payload) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function broadcast(payload) {
  const serialized = JSON.stringify(payload);

  for (const socket of clients.keys()) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(serialized);
    }
  }
}

function getOnlineUsers() {
  return [...usernames.keys()];
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
    text,
    timestamp: new Date().toISOString(),
  });
}

function getMentionedUsers(text) {
  const onlineUsers = getOnlineUsers();

  return onlineUsers.filter((user) => {
    const escaped = user.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|[^\\w])@${escaped}(?=$|[^\\w])`, "i");

    return pattern.test(text);
  });
}

function validateAttachment(attachment) {
  if (!attachment || typeof attachment !== "object") {
    return "Invalid attachment.";
  }

  const { name, type, size, data } = attachment;

  if (typeof name !== "string" || !name.trim() || name.length > 255) {
    return "Attachment filename is invalid.";
  }

  if (typeof type !== "string" || !ALLOWED_TYPES.has(type)) {
    return "This file type is not supported.";
  }

  if (!Number.isInteger(size) || size < 1 || size > MAX_ATTACHMENT_BYTES) {
    return "Attachments must be smaller than 2 MB.";
  }

  if (typeof data !== "string") {
    return "Attachment data is invalid.";
  }

  const prefix = `data:${type};base64,`;

  if (!data.startsWith(prefix)) {
    return "Attachment data type does not match.";
  }

  const base64 = data.slice(prefix.length);

  // Reject malformed Base64 before decoding.
  if (
    !base64 ||
    base64.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      base64,
    )
  ) {
    return "Attachment data is invalid.";
  }

  const buffer = Buffer.from(base64, "base64");

  if (
    buffer.length !== size ||
    buffer.length > MAX_ATTACHMENT_BYTES ||
    buffer.length === 0
  ) {
    return "Attachment size validation failed.";
  }

  return null;
}

function removeClient(socket) {
  const client = clients.get(socket);
  if (!client) return;

  clients.delete(socket);

  const normalized = client.username.toLowerCase();

  if (usernames.get(normalized) === socket) {
    usernames.delete(normalized);
  }

  broadcastSystem(`${client.username} left the chat.`);
  broadcastUsers();
}

function sendChatError(socket, text) {
  sendTo(socket, {
    type: "ERROR",
    message: text,
  });
}

function handleGroupMessage(socket, client, message, isAttachment) {
  const text = typeof message.text === "string" ? message.text.trim() : "";

  if (text.length > MAX_TEXT_LENGTH) {
    sendChatError(socket, "Messages cannot exceed 1000 characters.");
    return;
  }

  if (!text && !isAttachment) return;

  if (isAttachment) {
    const attachmentError = validateAttachment(message.attachment);

    if (attachmentError) {
      sendChatError(socket, attachmentError);
      return;
    }
  }

  const payload = {
    type: isAttachment ? "CHAT_ATTACHMENT" : "CHAT",
    id: require("crypto").randomUUID(),
    username: client.username,
    text,
    timestamp: new Date().toISOString(),
    ...(isAttachment && { attachment: message.attachment }),
    ...(!isAttachment && { mentionedUsers: getMentionedUsers(text) }),
  };

  broadcast(payload);
}

function handlePrivateMessage(socket, client, message, isAttachment) {
  const recipient = String(message.to || "").trim();
  const text = typeof message.text === "string" ? message.text.trim() : "";

  if (!recipient) {
    sendTo(socket, {
      type: "PRIVATE_ERROR",
      message: "Please select a recipient.",
    });
    return;
  }

  if (recipient.toLowerCase() === client.username.toLowerCase()) {
    sendTo(socket, {
      type: "PRIVATE_ERROR",
      message: "You cannot send a private message to yourself.",
    });
    return;
  }

  if (text.length > MAX_TEXT_LENGTH) {
    sendTo(socket, {
      type: "PRIVATE_ERROR",
      message: "Messages cannot exceed 1000 characters.",
    });
    return;
  }

  if (!text && !isAttachment) return;

  if (isAttachment) {
    const attachmentError = validateAttachment(message.attachment);

    if (attachmentError) {
      sendTo(socket, {
        type: "PRIVATE_ERROR",
        message: attachmentError,
      });
      return;
    }
  }

  const recipientSocket = usernames.get(recipient.toLowerCase());

  if (!recipientSocket || recipientSocket.readyState !== WebSocket.OPEN) {
    sendTo(socket, {
      type: "PRIVATE_ERROR",
      message: `${recipient} is no longer online.`,
    });
    return;
  }

  const payload = {
    type: isAttachment ? "CHAT_PRIVATE_ATTACHMENT" : "CHAT_PRIVATE",
    id: require("crypto").randomUUID(),
    username: client.username,
    to: usernames.has(recipient.toLowerCase())
      ? clients.get(recipientSocket)?.username || recipient
      : recipient,
    text,
    timestamp: new Date().toISOString(),
    ...(isAttachment && { attachment: message.attachment }),
  };

  // Send to the recipient and echo to the sender.
  sendTo(recipientSocket, payload);
  sendTo(socket, payload);
}

wss.on("connection", (socket) => {
  socket.isAlive = true;

  socket.on("pong", () => {
    socket.isAlive = true;
  });

  socket.on("message", (rawData) => {
    let message;

    try {
      message = JSON.parse(rawData.toString());
    } catch {
      sendChatError(socket, "Invalid message format.");
      return;
    }

    if (!message || typeof message.type !== "string") return;

    if (message.type === "JOIN") {
      const username = String(message.username || "").trim();

      if (!/^[a-zA-Z0-9_]{1,20}$/.test(username)) {
        sendTo(socket, {
          type: "JOIN_ERROR",
          text: "Username must be 1–20 characters and contain only letters, numbers, and underscores.",
        });
        return;
      }

      const normalized = username.toLowerCase();

      if (usernames.has(normalized)) {
        sendTo(socket, {
          type: "JOIN_ERROR",
          text: "That username is already in use. Please choose another.",
        });
        return;
      }

      clients.set(socket, { username });
      usernames.set(normalized, socket);

      sendTo(socket, {
        type: "JOINED",
        username,
      });

      broadcastSystem(`${username} joined the chat.`);
      broadcastUsers();
      return;
    }

    const client = clients.get(socket);

    if (!client) {
      sendChatError(socket, "Join the chat before sending messages.");
      return;
    }

    switch (message.type) {
      case "CHAT":
        handleGroupMessage(socket, client, message, false);
        break;

      case "CHAT_ATTACHMENT":
        handleGroupMessage(socket, client, message, true);
        break;

      case "CHAT_PRIVATE":
        handlePrivateMessage(socket, client, message, false);
        break;

      case "CHAT_PRIVATE_ATTACHMENT":
        handlePrivateMessage(socket, client, message, true);
        break;

      default:
        break;
    }
  });

  socket.on("close", () => removeClient(socket));

  socket.on("error", (error) => {
    console.error("WebSocket client error:", error.message);
    removeClient(socket);
  });
});

const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    if (socket.isAlive === false) {
      socket.terminate();
      continue;
    }

    socket.isAlive = false;
    socket.ping();
  }
}, 30000);

wss.on("close", () => clearInterval(heartbeat));

function shutdown() {
  clearInterval(heartbeat);

  for (const socket of wss.clients) {
    socket.close(1001, "Server shutting down");
  }

  wss.close(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
