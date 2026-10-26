
import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "./useChat";
import "./App.css";

export default function ChatRoom({ username }) {
  const {
    status,
    messages,
    users,
    error,
    sendMessage,
    sendPrivateMessage,
    clearError,
  } = useChat(username);

  const [selectedUser, setSelectedUser] = useState(null);
  const [text, setText] = useState("");
  const [cursorPos, setCursorPos] = useState(0);
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);

  const inputRef = useRef(null);

  const otherUsers = users.filter(
    (user) => user.toLowerCase() !== username.toLowerCase()
  );

  // Detect an @mention immediately before the cursor.
  const mentionMatch = useMemo(() => {
    if (selectedUser || !suggestionsOpen) return null;

    const beforeCursor = text.slice(0, cursorPos);
    return beforeCursor.match(/(?:^|\s)@([^\s@]*)$/);
  }, [text, cursorPos, selectedUser, suggestionsOpen]);

  const mentionQuery = mentionMatch ? mentionMatch[1] : null;

  // Filter suggestions based on the text after @.
  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];

    return otherUsers.filter((user) =>
      user.toLowerCase().startsWith(mentionQuery.toLowerCase())
    );
  }, [mentionQuery, otherUsers]);

  // Reset keyboard selection whenever the query changes.
  useEffect(() => {
    setActiveSuggestion(-1);
  }, [mentionQuery, selectedUser]);

  const conversationMessages = useMemo(() => {
    if (!selectedUser) {
      return messages.filter(
        (message) =>
          message.type === "CHAT" || message.type === "SYSTEM"
      );
    }

    return messages.filter(
      (message) =>
        message.type === "CHAT_PRIVATE" &&
        (
          (
            message.from.toLowerCase() === username.toLowerCase() &&
            message.to.toLowerCase() === selectedUser.toLowerCase()
          ) ||
          (
            message.from.toLowerCase() === selectedUser.toLowerCase() &&
            message.to.toLowerCase() === username.toLowerCase()
          )
        )
    );
  }, [messages, selectedUser, username]);

  function selectMention(user) {
    if (!mentionMatch) return;

    const beforeCursor = text.slice(0, cursorPos);
    const afterCursor = text.slice(cursorPos);

    // Replace the current @query with the selected username.
    const replacement = beforeCursor.replace(
      /(^|\s)@([^\s@]*)$/,
      (_, whitespace) => `${whitespace}@${user} `
    );

    const nextText = replacement + afterCursor;
    const nextCursor = replacement.length;

    setText(nextText);
    setCursorPos(nextCursor);
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);

    requestAnimationFrame(() => {
      if (!inputRef.current) return;

      inputRef.current.focus();
      inputRef.current.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function handleInputChange(event) {
    setText(event.target.value);
    setCursorPos(
      event.target.selectionStart ?? event.target.value.length
    );
    setSuggestionsOpen(true);
    setActiveSuggestion(-1);

    if (error) clearError?.();
  }

  function updateCursor(event) {
    setCursorPos(
      event.target.selectionStart ?? event.target.value.length
    );
  }

  function handleKeyDown(event) {
    if (suggestionsOpen && suggestions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();

        setActiveSuggestion((index) =>
          index < suggestions.length - 1 ? index + 1 : 0
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();

        setActiveSuggestion((index) =>
          index <= 0 ? suggestions.length - 1 : index - 1
        );
        return;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        // Select only if the user has highlighted an option.
        if (activeSuggestion >= 0) {
          event.preventDefault();
          selectMention(suggestions[activeSuggestion]);
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setSuggestionsOpen(false);
        setActiveSuggestion(-1);
        return;
      }
    }

    if (event.key === "Escape") {
      setSuggestionsOpen(false);
      setActiveSuggestion(-1);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();

    const trimmedText = text.trim();
    if (!trimmedText) return;

    const sent = selectedUser
      ? sendPrivateMessage(selectedUser, trimmedText)
      : sendMessage(trimmedText);

    if (sent) {
      setText("");
      setCursorPos(0);
      setSuggestionsOpen(true);
      setActiveSuggestion(-1);
    }
  }

  // Highlight usernames identified by the server.
  function renderMessageText(message) {
    const mentionedUsers = Array.isArray(message.mentionedUsers)
      ? message.mentionedUsers
      : [];

    if (message.type !== "CHAT" || mentionedUsers.length === 0) {
      return message.text;
    }

    const escapedNames = mentionedUsers
      .slice()
      .sort((a, b) => b.length - a.length)
      .map((name) =>
        name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      );

    const pattern = new RegExp(
      `(^|[^\\w])(@(?:${escapedNames.join("|")}))(?=$|[^\\w])`,
      "gi"
    );

    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(message.text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(message.text.slice(lastIndex, match.index));
      }

      if (match[1]) parts.push(match[1]);

      parts.push(
        <span
          className="message-mention"
          key={`mention-${match.index}`}
        >
          {match[2]}
        </span>
      );

      lastIndex = pattern.lastIndex;
    }

    if (lastIndex < message.text.length) {
      parts.push(message.text.slice(lastIndex));
    }

    return parts.length ? parts : message.text;
  }

  return (
    <main className="chat-screen">
      <aside className="users-sidebar">
        <div className="sidebar-heading">
         <div className="">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="90 90 475 435"
              width="24"
              height="24"
              role="img"
              aria-label="HB logo"
            >
              <defs>
                <linearGradient
                  id="hb-grad"
                  gradientUnits="userSpaceOnUse"
                  x1="100"
                  y1="100"
                  x2="550"
                  y2="510"
                >
                  <stop offset="0" stop-color="#8b83f5" />
                  <stop offset="1" stop-color="#5b54e6" />
                </linearGradient>
              </defs>
              <g
                fill="none"
                stroke="url(#hb-grad)"
                stroke-width="31"
                stroke-linejoin="miter"
                stroke-linecap="butt"
              >
                <path d="M113 113 H430 A111 111 0 0 1 430 335 A105 82.5 0 0 1 430 500 H303 V398" />
                <path d="M303 113 V255 H228" />
                <path d="M228 113 V500" />
                <path d="M228 335 H430" />
                <path d="M129 158 V500 H228" />
              </g>
            </svg>
          </div>
          <div>
            <h2>Hey Buddies</h2>
            <span className="sidebar-subtitle">
              Signed in as {username}
            </span>
          </div>
        </div>

        <div className="sidebar-section-label">
          CONVERSATIONS
        </div>

        <button
          type="button"
          className={`conversation-item ${
            !selectedUser ? "active" : ""
          }`}
          onClick={() => {
            setSelectedUser(null);
            setText("");
            setCursorPos(0);
            setSuggestionsOpen(true);
            setActiveSuggestion(-1);
          }}
        >
          <div className="avatar group-avatar">#</div>

          <div className="conversation-info">
            <strong>Group Chat</strong>
            <span>Everyone online</span>
          </div>
        </button>

        <div className="sidebar-section-label">
          DIRECT MESSAGES
          <span>{otherUsers.length}</span>
        </div>

        <div className="users-list">
          {otherUsers.map((user) => (
            <button
              type="button"
              key={user}
              className={`conversation-item ${
                selectedUser === user ? "active" : ""
              }`}
              onClick={() => {
                setSelectedUser(user);
                setText("");
                setCursorPos(0);
                setSuggestionsOpen(false);
                setActiveSuggestion(-1);
              }}
            >
              <div className="avatar">
                {user.charAt(0).toUpperCase()}
              </div>

              <div className="conversation-info">
                <strong>{user}</strong>
                <span>
                  <i className="online-dot" />
                  Online
                </span>
              </div>
            </button>
          ))}

          {otherUsers.length === 0 && (
            <p className="empty-users">
              No other users online yet.
            </p>
          )}
        </div>

        <div className="sidebar-footer">
          <span
            className={`status-dot ${
              status === "connected" ? "connected" : ""
            }`}
          />

          {status === "connected"
            ? "Connected"
            : status === "connecting"
            ? "Connecting..."
            : status === "error"
            ? "Connection error"
            : "Disconnected"}
        </div>
      </aside>

      <section className="messages-section">
        <header className="conversation-header">
          <div className="avatar header-avatar">
            {selectedUser
              ? selectedUser.charAt(0).toUpperCase()
              : "#"}
          </div>

          <div>
            <h2>{selectedUser || "Group Chat"}</h2>
            <p>
              {selectedUser
                ? "Private conversation"
                : `${users.length} user(s) connected`}
            </p>
          </div>

          <span className="header-status">
            {status === "connected" ? "● Online" : status}
          </span>
        </header>

        {error && (
          <div className="chat-error" role="alert">
            {error}
            <button
              type="button"
              onClick={() => clearError?.()}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        <div className="messages">
          <div className="conversation-intro">
            <div className="intro-icon">
              {selectedUser ? "✉" : "#"}
            </div>

            <h3>
              {selectedUser
                ? `Chat with ${selectedUser}`
                : "Welcome to Group Chat"}
            </h3>

            <p>
              {selectedUser
                ? "Messages here are private to this conversation."
                : "Type @ to mention someone who is online."}
            </p>
          </div>

          {conversationMessages.map((message, index) => {
            if (message.type === "SYSTEM") {
              return (
                <div
                  className="system-message"
                  key={`${message.timestamp}-${message.text}-${index}`}
                >
                  {message.text}
                </div>
              );
            }

            const sender =
              message.type === "CHAT_PRIVATE"
                ? message.from
                : message.username;

            const isOwnMessage =
              sender.toLowerCase() === username.toLowerCase();

            return (
              <div
                className={`message-row ${
                  isOwnMessage ? "own-message" : ""
                }`}
                key={message.id || `${message.timestamp}-${index}`}
              >
                {!isOwnMessage && (
                  <div className="avatar message-avatar">
                    {sender.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="message-content">
                  {!isOwnMessage && (
                    <span className="message-sender">
                      {sender}
                    </span>
                  )}

                  <div className="message-bubble">
                    {renderMessageText(message)}
                  </div>

                  <time className="message-time">
                    {new Date(message.timestamp).toLocaleTimeString(
                      [],
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                  </time>
                </div>
              </div>
            );
          })}
        </div>

        <form className="message-form" onSubmit={handleSubmit}>
          <div className="composer-input-wrap">
            {suggestionsOpen &&
              !selectedUser &&
              mentionQuery !== null &&
              suggestions.length > 0 && (
                <div
                  className="mention-suggestions"
                  role="listbox"
                  aria-label="Mention suggestions"
                >
                  <div className="mention-heading">
                    MENTION SOMEONE
                  </div>

                  {suggestions.map((user, index) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === activeSuggestion}
                      className={`mention-option ${
                        index === activeSuggestion ? "selected" : ""
                      }`}
                      key={user}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectMention(user)}
                    >
                      <span className="avatar mention-avatar">
                        {user.charAt(0).toUpperCase()}
                      </span>

                      <span className="mention-user-name">
                        {user}
                      </span>

                      <span className="mention-at">@</span>
                    </button>
                  ))}
                </div>
              )}

            <input
              ref={inputRef}
              value={text}
              onChange={handleInputChange}
              onClick={updateCursor}
              onKeyUp={updateCursor}
              onKeyDown={handleKeyDown}
              onFocus={() => setSuggestionsOpen(true)}
              placeholder={
                selectedUser
                  ? `Message ${selectedUser} privately...`
                  : "Message everyone... Type @ to mention"
              }
              maxLength={1000}
              disabled={status !== "connected"}
              aria-label="Chat message"
              autoComplete="off"
            />
          </div>

          <button
            type="submit"
            disabled={status !== "connected" || !text.trim()}
          >
            Send <span>➤</span>
          </button>
        </form>
      </section>
    </main>
  );
}
