
import { useCallback, useEffect, useRef, useState } from "react";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8080";
const MAX_MESSAGE_LENGTH = 1000;

export function useChat(username) {
  const socketRef = useRef(null);

  const [status, setStatus] = useState("connecting");
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const cleanUsername = String(username || "").trim();

    if (!cleanUsername) {
      setStatus("disconnected");
      setMessages([]);
      setUsers([]);
      setError("");
      return;
    }

    let active = true;
    let socket = null;

    setStatus("connecting");
    setMessages([]);
    setUsers([]);
    setError("");

    const isCurrent = () =>
      active && socketRef.current === socket;

    function handleOpen() {
      if (!isCurrent()) {
        socket?.close();
        return;
      }

      socket.send(
        JSON.stringify({
          type: "JOIN",
          username: cleanUsername,
        })
      );
    }

    function handleMessage(event) {
      if (!isCurrent()) return;

      let message;

      try {
        message = JSON.parse(event.data);
      } catch {
        console.error("Could not parse server message");
        return;
      }

      if (!message || typeof message.type !== "string") return;

      switch (message.type) {
        case "JOINED":
          setStatus("connected");
          setError("");
          break;

        case "JOIN_ERROR":
          setStatus("error");
          setError(
            message.text || "Unable to join. Try another username."
          );
          break;

        case "CHAT":
        case "CHAT_PRIVATE":
        case "SYSTEM":
          if (
            typeof message.text === "string" &&
            typeof message.timestamp === "string"
          ) {
            setMessages((previous) => [...previous, message]);
          }
          break;

        case "USERS":
          setUsers(
            Array.isArray(message.users)
              ? message.users.filter(
                  (user) => typeof user === "string"
                )
              : []
          );
          break;

        case "PRIVATE_ERROR":
          setError(
            message.text || "Unable to send the private message."
          );
          break;

        default:
          break;
      }
    }

    function handleError() {
      if (!isCurrent()) return;

      setStatus("error");
      setError("Unable to connect to the chat server.");
    }

    function handleClose(event) {
      if (!isCurrent()) return;

      setStatus("disconnected");
      setUsers([]);

      console.log("WebSocket closed:", {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
    }

    const connectTimer = setTimeout(() => {
      if (!active) return;

      socket = new WebSocket(WS_URL);
      socketRef.current = socket;

      socket.addEventListener("open", handleOpen);
      socket.addEventListener("message", handleMessage);
      socket.addEventListener("error", handleError);
      socket.addEventListener("close", handleClose);
    }, 0);

    return () => {
      active = false;
      clearTimeout(connectTimer);

      if (!socket) return;

      socket.removeEventListener("open", handleOpen);
      socket.removeEventListener("message", handleMessage);
      socket.removeEventListener("error", handleError);
      socket.removeEventListener("close", handleClose);

      if (socketRef.current === socket) {
        socketRef.current = null;
      }

      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      } else if (socket.readyState === WebSocket.CONNECTING) {
        socket.addEventListener(
          "open",
          () => socket.close(),
          { once: true }
        );
      }
    };
  }, [username]);

  const sendEvent = useCallback((payload) => {
    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError("Not connected to the chat server.");
      return false;
    }

    try {
      socket.send(JSON.stringify(payload));
      setError("");
      return true;
    } catch {
      setError("Failed to send the message. Please try again.");
      return false;
    }
  }, []);

  const sendMessage = useCallback(
    (text) => {
      const cleanText = String(text || "").trim();

      if (!cleanText) return false;

      if (cleanText.length > MAX_MESSAGE_LENGTH) {
        setError("Messages cannot exceed 1000 characters.");
        return false;
      }

      if (status !== "connected") {
        setError("Please wait until you are connected.");
        return false;
      }

      return sendEvent({
        type: "CHAT",
        text: cleanText,
      });
    },
    [sendEvent, status]
  );

  const sendPrivateMessage = useCallback(
    (to, text) => {
      const recipient = String(to || "").trim();
      const cleanText = String(text || "").trim();

      if (!recipient || !cleanText) return false;

      if (cleanText.length > MAX_MESSAGE_LENGTH) {
        setError("Messages cannot exceed 1000 characters.");
        return false;
      }

      if (
        recipient.toLowerCase() ===
        String(username || "").trim().toLowerCase()
      ) {
        setError("You cannot send a private message to yourself.");
        return false;
      }

      if (status !== "connected") {
        setError("Please wait until you are connected.");
        return false;
      }

      return sendEvent({
        type: "CHAT_PRIVATE",
        to: recipient,
        text: cleanText,
      });
    },
    [sendEvent, status, username]
  );

  const clearError = useCallback(() => {
    setError("");
  }, []);

  return {
    status,
    messages,
    users,
    error,
    sendMessage,
    sendPrivateMessage,
    clearError,
  };
}
