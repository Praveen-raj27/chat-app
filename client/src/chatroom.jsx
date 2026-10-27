
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

  // Unread private-message counts, keyed by normalized username.
  const [unreadCounts, setUnreadCounts] = useState({});

  const inputRef = useRef(null);

  // Prevent the same incoming message from being counted twice.
  const processedPrivateMessagesRef = useRef(new Set());

  const currentUsername = String(username ?? "").trim();
  const normalizedUsername = currentUsername.toLowerCase();

  // Normalize the online users list safely.
  const otherUsers = useMemo(() => {
    const safeUsers = Array.isArray(users) ? users : [];

    return [
      ...new Set(
        safeUsers
          .filter(
            (user) =>
              typeof user === "string" && user.trim().length > 0
          )
          .map((user) => user.trim())
          .filter(
            (user) => user.toLowerCase() !== normalizedUsername
          )
      ),
    ];
  }, [users, normalizedUsername]);

  // Count new private messages received while their conversation
  // is not currently open.
  useEffect(() => {
    const safeMessages = Array.isArray(messages) ? messages : [];
    const processed = processedPrivateMessagesRef.current;

    safeMessages.forEach((message) => {
      if (!message || message.type !== "CHAT_PRIVATE") return;

      const sender = String(
        message.from ?? message.username ?? message.sender ?? ""
      ).trim();

      const recipient = String(
        message.to ?? message.recipient ?? ""
      ).trim();

      if (!sender || !recipient) return;

      const senderKey = sender.toLowerCase();
      const recipientKey = recipient.toLowerCase();

      // Use the server message ID when available.
      // Fall back to a composite key for older server responses.
      const messageKey = String(
        message.id ??
          [
            message.timestamp ?? "",
            senderKey,
            recipientKey,
            message.text ?? "",
          ].join("|")
      );

      if (processed.has(messageKey)) return;

      // Mark it as processed before updating state.
      processed.add(messageKey);

      // Count only messages addressed to the current user.
      if (recipientKey !== normalizedUsername) return;

      // Never count messages sent by the current user.
      if (senderKey === normalizedUsername) return;

      // Messages in the currently open conversation are considered read.
      if (
        selectedUser &&
        selectedUser.trim().toLowerCase() === senderKey
      ) {
        return;
      }

      setUnreadCounts((previous) => ({
        ...previous,
        [senderKey]: (previous[senderKey] || 0) + 1,
      }));
    });
  }, [messages, normalizedUsername, selectedUser]);

  // Clear the unread badge when opening that user's conversation.
  useEffect(() => {
    if (!selectedUser) return;

    const selectedKey = selectedUser.trim().toLowerCase();

    setUnreadCounts((previous) => {
      if (!previous[selectedKey]) return previous;

      const next = { ...previous };
      delete next[selectedKey];

      return next;
    });
  }, [selectedUser]);

  // Detect an @mention immediately before the cursor.
  const mentionMatch = useMemo(() => {
    if (selectedUser || !suggestionsOpen) return null;

    const beforeCursor = text.slice(0, cursorPos);
    return beforeCursor.match(/(?:^|\s)@([^\s@]*)$/);
  }, [text, cursorPos, selectedUser, suggestionsOpen]);

  const mentionQuery = mentionMatch ? mentionMatch[1] : null;

  // Filter mention suggestions.
  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];

    const query = String(mentionQuery).toLowerCase();

    return otherUsers.filter((user) =>
      user.toLowerCase().startsWith(query)
    );
  }, [mentionQuery, otherUsers]);

  // Reset keyboard selection whenever the query changes.
  useEffect(() => {
    setActiveSuggestion(-1);
  }, [mentionQuery, selectedUser]);

  // Show messages belonging to the selected conversation.
  const conversationMessages = useMemo(() => {
    const safeMessages = Array.isArray(messages) ? messages : [];

    if (!selectedUser) {
      return safeMessages.filter(
        (message) =>
          message &&
          (message.type === "CHAT" || message.type === "SYSTEM")
      );
    }

    const recipient = selectedUser.trim().toLowerCase();

    return safeMessages.filter((message) => {
      if (!message || message.type !== "CHAT_PRIVATE") {
        return false;
      }

      const sender = String(
        message.from ?? message.username ?? message.sender ?? ""
      )
        .trim()
        .toLowerCase();

      const receiver = String(
        message.to ?? message.recipient ?? ""
      )
        .trim()
        .toLowerCase();

      if (!sender || !receiver) return false;

      return (
        (sender === normalizedUsername && receiver === recipient) ||
        (sender === recipient && receiver === normalizedUsername)
      );
    });
  }, [messages, normalizedUsername, selectedUser]);

  function openConversation(user) {
    setSelectedUser(user);
    setText("");
    setCursorPos(0);
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);

    // Clear this user's unread badge immediately.
    const userKey = user.toLowerCase();

    setUnreadCounts((previous) => {
      if (!previous[userKey]) return previous;

      const next = { ...previous };
      delete next[userKey];

      return next;
    });
  }

  function openGroupChat() {
    setSelectedUser(null);
    setText("");
    setCursorPos(0);
    setSuggestionsOpen(true);
    setActiveSuggestion(-1);
  }

  function selectMention(user) {
    if (!mentionMatch) return;

    const beforeCursor = text.slice(0, cursorPos);
    const afterCursor = text.slice(cursorPos);

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

  // Highlight usernames mentioned in group messages.
  function renderMessageText(message) {
    const messageText =
      typeof message?.text === "string" ? message.text : "";

    const mentionedUsers = Array.isArray(message?.mentionedUsers)
      ? message.mentionedUsers.filter(
          (name) => typeof name === "string" && name.length > 0
        )
      : [];

    if (message?.type !== "CHAT" || mentionedUsers.length === 0) {
      return messageText;
    }

    const escapedNames = mentionedUsers
      .slice()
      .sort((a, b) => b.length - a.length)
      .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

    const pattern = new RegExp(
      `(^|[^\\w])(@(?:${escapedNames.join("|")}))(?=$|[^\\w])`,
      "gi"
    );

    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(messageText)) !== null) {
      if (match.index > lastIndex) {
        parts.push(messageText.slice(lastIndex, match.index));
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

    if (lastIndex < messageText.length) {
      parts.push(messageText.slice(lastIndex));
    }

    return parts.length ? parts : messageText;
  }

  return (
    <main className="chat-screen">
      <aside className="users-sidebar">
        <div className="sidebar-heading">
          <div>
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
                  <stop offset="0" stopColor="#8b83f5" />
                  <stop offset="1" stopColor="#5b54e6" />
                </linearGradient>
              </defs>

              <g
                fill="none"
                stroke="url(#hb-grad)"
                strokeWidth="31"
                strokeLinejoin="miter"
                strokeLinecap="butt"
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
              Signed in as {currentUsername}
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
          onClick={openGroupChat}
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
          {otherUsers.map((user) => {
            const userKey = user.toLowerCase();
            const unreadCount = unreadCounts[userKey] || 0;

            return (
              <button
                type="button"
                key={userKey}
                className={`conversation-item ${
                  selectedUser === user ? "active" : ""
                }`}
                onClick={() => openConversation(user)}
              >
                <div className="avatar">
                  {user.charAt(0).toUpperCase()}
                </div>

                <div className="conversation-info">
                  <div className="conversation-name-row">
                    <strong>{user}</strong>

                    {unreadCount > 0 && (
                      <span
                        className="unread-badge"
                        aria-label={`${unreadCount} unread messages`}
                      >
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </div>

                  <span>
                    <i className="online-dot" />
                    Online
                  </span>
                </div>
              </button>
            );
          })}

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
                : `${(Array.isArray(users) ? users.length : 0)} user(s) connected`}
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
                  key={`${message.timestamp ?? "system"}-${index}`}
                >
                  {message.text}
                </div>
              );
            }

            const sender = String(
              message.type === "CHAT_PRIVATE"
                ? message.from ??
                    message.username ??
                    message.sender ??
                    ""
                : message.username ??
                    message.from ??
                    message.sender ??
                    ""
            ).trim();

            if (!sender) return null;

            const isOwnMessage =
              sender.toLowerCase() === normalizedUsername;

            return (
              <div
                className={`message-row ${
                  isOwnMessage ? "own-message" : ""
                }`}
                key={
                  message.id ||
                  `${message.timestamp ?? "message"}-${index}`
                }
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
                    {message.timestamp
                      ? new Date(
                          message.timestamp
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
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
                      key={user.toLowerCase()}
                      onMouseDown={(event) =>
                        event.preventDefault()
                      }
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
