
import { useEffect, useRef, useState } from "react";

const WS_URL = "ws://localhost:8080";

export function useChat(username) {
  const socketRef = useRef(null);

  const [status, setStatus] = useState("connecting");
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!username.trim()) return;

    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;
    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: "JOIN",
          username: username.trim(),
        })
      );
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case "JOINED":
            setStatus("connected");
            setError("");
            break;

          case "JOIN_ERROR":
            setError(message.text);
            setStatus("error");
            break;

          case "CHAT":
          case "SYSTEM":
            setMessages((previous) => [
              ...previous,
              message,
            ]);
            break;

          case "USERS":
            setUsers(message.users || []);
            break;

          default:
            break;
        }
      } catch {
        console.error("Could not parse server message");
      }
    };

    socket.onerror = () => {
      setStatus("error");
      setError("Unable to connect to the chat server.");
    };

    socket.onclose = () => {
      setStatus("disconnected");
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [username]);

  function sendMessage(text) {
    const socket = socketRef.current;

    if (socket?.readyState !== WebSocket.OPEN) {
      return false;
    }

    socket.send(
      JSON.stringify({
        type: "CHAT",
        text,
      })
    );

    return true;
  }
  

  return {
    status,
    messages,
    users,
    error,
    sendMessage,
  };
}
