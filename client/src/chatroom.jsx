
import { useEffect, useRef, useState } from "react";
import { useChat } from "./useChat";

export default function ChatRoom({ username }) {
  const { status, messages, users, error, sendMessage } =
    useChat(username);

  const [text, setText] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMentionOpen, setIsMentionOpen] = useState(false);

  const inputRef = useRef(null);
  const bottomRef = useRef(null);

  // Detect @mention being typed immediately before the cursor.
  const cursor = inputRef.current?.selectionStart ?? text.length;
  const textBeforeCursor = text.slice(0, cursor);
  const mentionMatch = textBeforeCursor.match(/@([^\s@]*)$/);
  const mentionQuery = mentionMatch?.[1] ?? null;

  const suggestions =
    mentionQuery === null
      ? []
      : users
          .filter(
            (user) =>
              user.toLowerCase() !== username.toLowerCase()
          )
          .filter((user) =>
            user.toLowerCase().startsWith(mentionQuery.toLowerCase())
          )
          .slice(0, 6);

  const showSuggestions =
    isMentionOpen &&
    mentionQuery !== null &&
    suggestions.length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function selectMention(selectedUser) {
    const input = inputRef.current;
    if (!input) return;

    const caret = input.selectionStart;
    const before = text.slice(0, caret);
    const after = text.slice(caret);
    const match = before.match(/@([^\s@]*)$/);

    if (!match) return;

    const start = before.length - match[0].length;
    const inserted = `@${selectedUser} `;

    const updated =
      text.slice(0, start) + inserted + after;

    setText(updated);
    setActiveIndex(0);
    setIsMentionOpen(false);

    requestAnimationFrame(() => {
      input.focus();
      const nextCaret = start + inserted.length;
      input.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function handleKeyDown(event) {
    if (showSuggestions) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex(
          (index) => (index + 1) % suggestions.length
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex(
          (index) =>
            (index - 1 + suggestions.length) % suggestions.length
        );
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setIsMentionOpen(false);
        return;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        selectMention(suggestions[activeIndex]);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  function handleSend(event) {
    event?.preventDefault();

    const message = text.trim();
    if (!message) return;

    const sent = sendMessage(message);

    if (sent) {
      setText("");
      setActiveIndex(0);
      setIsMentionOpen(false);
    }
  }

  function handleTextChange(event) {
    const value = event.target.value;
    const caret = event.target.selectionStart;
    const beforeCursor = value.slice(0, caret);
    const match = beforeCursor.match(/@([^\s@]*)$/);

    setText(value);
    setActiveIndex(0);

    // Open only when the user is actively typing an @mention.
    setIsMentionOpen(match !== null);
  }

  function renderMessageText(messageText) {
    const knownUsers = [...users, username].filter(
      (user, index, all) =>
        all.findIndex(
          (item) => item.toLowerCase() === user.toLowerCase()
        ) === index
    );

    if (!knownUsers.length) return messageText;

    const escapedUsers = knownUsers
      .sort((a, b) => b.length - a.length)
      .map((user) =>
        user.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      );

    const pattern = new RegExp(
      `(@(?:${escapedUsers.join("|")}))(?=$|[^\\w])`,
      "gi"
    );

    return messageText.split(pattern).map((part, index) => {
      const isMention = knownUsers.some(
        (user) =>
          part.toLowerCase() === `@${user}`.toLowerCase()
      );

      return isMention ? (
        <span className="chat-mention" key={index}>
          {part}
        </span>
      ) : (
        part
      );
    });
  }

  return (
    <main className="chat-screen">
      <section className="chat-panel">
        <header className="chat-header">
          <div className="chat-brand">
            <div className="chat-brand-icon">C</div>
            <div>
              <h1>Connect</h1>
              <p>Real-time chat room</p>
            </div>
          </div>

          <div className="connection-status">
            <span className={`status-dot ${status}`} />
            <span>{status}</span>
          </div>
        </header>

        {error && (
          <div className="chat-error" role="alert">
            {error}
          </div>
        )}

        <div className="chat-layout">
          <section className="messages-section">
            <div className="messages-heading">
              <h2>Conversation</h2>
              <span>
                {messages.filter((m) => m.type === "CHAT").length} messages
              </span>
            </div>

            <div className="messages-list" aria-live="polite">
              {messages.map((message, index) => {
                if (message.type === "SYSTEM") {
                  return (
                    <div
                      className="system-message"
                      key={message.id || index}
                    >
                      <span>{message.text}</span>
                    </div>
                  );
                }

                const isOwnMessage =
                  message.username?.toLowerCase() ===
                  username.toLowerCase();

                const isMentioned = (
                  message.mentionedUsers || []
                ).some(
                  (user) =>
                    user.toLowerCase() === username.toLowerCase()
                );

                return (
                  <article
                    className={`message-row ${
                      isOwnMessage ? "own-message" : ""
                    }`}
                    key={message.id || index}
                  >
                    <div className="message-avatar">
                      {message.username?.charAt(0).toUpperCase()}
                    </div>

                    <div className="message-content">
                      <div className="message-meta">
                        <strong>
                          {isOwnMessage ? "You" : message.username}
                        </strong>

                        <time>
                          {message.timestamp
                            ? new Date(
                                message.timestamp
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </time>

                        {isMentioned && (
                          <span className="mention-notification">
                            @ mentioned you
                          </span>
                        )}
                      </div>

                      <div className="message-bubble">
                        {renderMessageText(message.text)}
                      </div>
                    </div>
                  </article>
                );
              })}

              <div ref={bottomRef} />
            </div>

            <form
              className="message-composer"
              onSubmit={handleSend}
            >
              <div className="composer-input-wrap">
                {showSuggestions && (
                  <div
                    className="mention-suggestions"
                    role="listbox"
                  >
                    <div className="suggestion-heading">
                      MENTION SOMEONE
                    </div>

                    {suggestions.map((user, index) => (
                      <button
                        type="button"
                        role="option"
                        aria-selected={index === activeIndex}
                        className={`mention-option ${
                          index === activeIndex ? "active" : ""
                        }`}
                        key={user}
                        onMouseDown={(event) =>
                          event.preventDefault()
                        }
                        onClick={() => selectMention(user)}
                      >
                        <span className="suggestion-avatar">
                          {user.charAt(0).toUpperCase()}
                        </span>

                        <span className="suggestion-name">
                          {user}
                        </span>

                        <span className="suggestion-at">@</span>
                      </button>
                    ))}
                  </div>
                )}

                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Write a message... Type @ to mention someone"
                  rows={2}
                  maxLength={1000}
                  aria-label="Chat message"
                  disabled={status !== "connected"}
                />
              </div>

              <button
                type="submit"
                className="send-button"
                disabled={!text.trim() || status !== "connected"}
              >
                Send <span aria-hidden="true">↗</span>
              </button>

              <p className="composer-hint">
                Press Enter to send · Shift + Enter for a new line ·
                @ to mention
              </p>
            </form>
          </section>

          <aside className="users-sidebar">
            <div className="users-heading">
              <h2>People</h2>
              <span>{users.length}</span>
            </div>

            <div className="current-user-card">
              <span className="online-avatar">
                {username.charAt(0).toUpperCase()}
                <i />
              </span>

              <div>
                <strong>{username}</strong>
                <small>You · Online</small>
              </div>
            </div>

            <div className="users-list">
              {users
                .filter(
                  (user) =>
                    user.toLowerCase() !== username.toLowerCase()
                )
                .map((user) => (
                  <button
                    className="user-item"
                    type="button"
                    key={user}
                    onClick={() => {
                      setText((previous) =>
                        `${previous}${
                          previous &&
                          !previous.endsWith(" ")
                            ? " "
                            : ""
                        }@${user} `
                      );

                      setIsMentionOpen(false);
                      inputRef.current?.focus();
                    }}
                  >
                    <span className="online-avatar">
                      {user.charAt(0).toUpperCase()}
                      <i />
                    </span>

                    <span>{user}</span>
                    <span className="user-mention-action">@</span>
                  </button>
                ))}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
