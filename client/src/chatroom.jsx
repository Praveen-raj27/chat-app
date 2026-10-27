
import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "./useChat";
import "./App.css";

const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

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

const ACCEPTED_FILES = [
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
  ".pdf", ".txt", ".doc", ".docx",
].join(",");

const EMOJI_CATEGORIES = {
  Smileys: [
    "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣",
    "🥹", "😊", "😇", "🙂", "🙃", "😉", "😍", "🥰",
    "😘", "😗", "😙", "😚", "😋", "😛", "😜", "🤪",
    "😎", "🥳", "😭", "😢", "😡", "🤔", "🫡", "🤗",
    "😴", "🤯", "🥺", "😏", "😬", "🤭", "🫠", "😱",
  ],
  People: [
    "👋", "🤚", "✋", "🖐️", "👌", "🤌", "🤏", "✌️",
    "🤞", "🫰", "🤟", "🤘", "🤙", "👈", "👉", "👆",
    "👇", "👍", "👎", "✊", "👊", "👏", "🙌", "🫶",
    "🤝", "🙏", "💪", "🫂", "👀", "💋", "👶", "🧑",
  ],
  Nature: [
    "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼",
    "🐨", "🐯", "🦁", "🐸", "🐵", "🐔", "🐧", "🐦",
    "🦋", "🐢", "🐬", "🐳", "🦄", "🌸", "🌹", "🌻",
    "🌈", "☀️", "🌙", "⭐", "⚡", "🔥", "🌊", "🍀",
  ],
  Food: [
    "🍎", "🍉", "🍇", "🍓", "🍒", "🍍", "🥭", "🍌",
    "🍕", "🍔", "🍟", "🌭", "🍿", "🍩", "🎂", "🍪",
    "🍫", "🍭", "☕", "🧋", "🥤", "🍜", "🍰", "🍦",
  ],
  Activities: [
    "⚽", "🏀", "🏈", "🎾", "🏏", "🏆", "🥇", "🎯",
    "🎮", "🎲", "🎸", "🎤", "🎧", "🎬", "🎨", "🎉",
    "🎊", "🎁", "🎈", "🚀", "✈️", "🚗", "🏍️", "💻",
  ],
  Symbols: [
    "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
    "💔", "💕", "💞", "💖", "💗", "💘", "💯", "💢",
    "💥", "💫", "💦", "💤", "✅", "❌", "❓", "❗",
    "✨", "💎", "♻️", "🔔", "🔒", "💬", "➕", "♾️",
  ],
};

const EMOJI_CATEGORY_ICONS = {
  Smileys: "😀",
  People: "👋",
  Nature: "🐻",
  Food: "🍕",
  Activities: "⚽",
  Symbols: "❤️",
};

export default function ChatRoom({ username }) {
  const {
    status,
    messages,
    users,
    error,
    sendMessage,
    sendPrivateMessage,
    sendAttachment,
    clearError,
  } = useChat(username);

  const [selectedUser, setSelectedUser] = useState(null);
  const [text, setText] = useState("");
  const [cursorPos, setCursorPos] = useState(0);
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState("");

  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] =
    useState("Smileys");

  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const processedPrivateMessagesRef = useRef(new Set());

  const currentUsername = String(username ?? "").trim();
  const normalizedUsername = currentUsername.toLowerCase();

  const otherUsers = useMemo(() => {
    const safeUsers = Array.isArray(users) ? users : [];

    return [
      ...new Set(
        safeUsers
          .filter(
            (user) => typeof user === "string" && user.trim().length > 0,
          )
          .map((user) => user.trim())
          .filter((user) => user.toLowerCase() !== normalizedUsername),
      ),
    ];
  }, [users, normalizedUsername]);

  // Count unread group and private messages, including attachments.
  useEffect(() => {
    const safeMessages = Array.isArray(messages) ? messages : [];
    const processed = processedPrivateMessagesRef.current;

    safeMessages.forEach((message) => {
      if (!message) return;

      const isGroupMessage = [
        "CHAT",
        "CHAT_ATTACHMENT",
      ].includes(message.type);

      const isPrivateMessage = [
        "CHAT_PRIVATE",
        "CHAT_PRIVATE_ATTACHMENT",
      ].includes(message.type);

      if (!isGroupMessage && !isPrivateMessage) return;

      const sender = String(
        message.from ?? message.username ?? message.sender ?? "",
      ).trim();

      if (!sender) return;

      const senderKey = sender.toLowerCase();
      const recipient = String(
        message.to ?? message.recipient ?? "",
      ).trim();
      const recipientKey = recipient.toLowerCase();

      const messageKey = String(
        message.id ??
          [
            message.type,
            message.timestamp ?? "",
            senderKey,
            recipientKey,
            message.text ?? "",
            message.attachment?.name ?? "",
          ].join("|"),
      );

      if (processed.has(messageKey)) return;
      processed.add(messageKey);

      if (senderKey === normalizedUsername) return;

      if (isGroupMessage) {
        if (!selectedUser) return;

        setUnreadCounts((previous) => ({
          ...previous,
          group: (previous.group || 0) + 1,
        }));

        return;
      }

      if (!recipient || recipientKey !== normalizedUsername) return;

      if (selectedUser?.trim().toLowerCase() === senderKey) return;

      setUnreadCounts((previous) => ({
        ...previous,
        [senderKey]: (previous[senderKey] || 0) + 1,
      }));
    });
  }, [messages, normalizedUsername, selectedUser]);

  // Clear unread badges when opening a conversation.
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

  // Close the action menu and emoji picker when clicking outside.
  useEffect(() => {
    if (!actionMenuOpen && !emojiPickerOpen) return;

    function handleOutsideClick(event) {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target)
      ) {
        setActionMenuOpen(false);
        setEmojiPickerOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [actionMenuOpen, emojiPickerOpen]);

  // Detect an @mention immediately before the cursor.
  const mentionMatch = useMemo(() => {
    if (selectedUser || !suggestionsOpen) return null;

    const beforeCursor = text.slice(0, cursorPos);
    return beforeCursor.match(/(?:^|\s)@([^\s@]*)$/);
  }, [text, cursorPos, selectedUser, suggestionsOpen]);

  const mentionQuery = mentionMatch ? mentionMatch[1] : null;

  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];

    const query = mentionQuery.toLowerCase();

    return otherUsers.filter((user) =>
      user.toLowerCase().startsWith(query),
    );
  }, [mentionQuery, otherUsers]);

  useEffect(() => {
    setActiveSuggestion(-1);
  }, [mentionQuery, selectedUser]);

  // Filter messages for the active conversation.
  const conversationMessages = useMemo(() => {
    const safeMessages = Array.isArray(messages) ? messages : [];

    if (!selectedUser) {
      return safeMessages.filter(
        (message) =>
          message &&
          ["CHAT", "CHAT_ATTACHMENT", "SYSTEM"].includes(message.type),
      );
    }

    const recipient = selectedUser.trim().toLowerCase();

    return safeMessages.filter((message) => {
      if (
        !message ||
        ![
          "CHAT_PRIVATE",
          "CHAT_PRIVATE_ATTACHMENT",
        ].includes(message.type)
      ) {
        return false;
      }

      const sender = String(
        message.from ?? message.username ?? message.sender ?? "",
      ).trim().toLowerCase();

      const receiver = String(
        message.to ?? message.recipient ?? "",
      ).trim().toLowerCase();

      if (!sender || !receiver) return false;

      return (
        (sender === normalizedUsername && receiver === recipient) ||
        (sender === recipient && receiver === normalizedUsername)
      );
    });
  }, [messages, normalizedUsername, selectedUser]);

  function removeSelectedFile() {
    setSelectedFile(null);
    setFilePreview("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function openConversation(user) {
    setSelectedUser(user);
    setText("");
    setCursorPos(0);
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
    setActionMenuOpen(false);
    setEmojiPickerOpen(false);
    removeSelectedFile();

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
    setActionMenuOpen(false);
    setEmojiPickerOpen(false);
    removeSelectedFile();

    setUnreadCounts((previous) => {
      if (!previous.group) return previous;

      const next = { ...previous };
      delete next.group;
      return next;
    });
  }

  function handleFileSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.has(file.type)) {
      clearError?.();
      alert(
        "Unsupported file type. Please select an image, PDF, TXT, DOC, or DOCX file.",
      );
      event.target.value = "";
      return;
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      alert("The maximum attachment size is 2 MB.");
      event.target.value = "";
      return;
    }

    if (file.size === 0) {
      alert("The selected file is empty.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        alert("Unable to read this file. Please try again.");
        return;
      }

      setSelectedFile({
        name: file.name,
        type: file.type,
        size: file.size,
        data: reader.result,
      });

      setFilePreview(
        file.type.startsWith("image/") ? reader.result : "",
      );

      clearError?.();
    };

    reader.onerror = () => {
      alert("Unable to read this file. Please try again.");
    };

    reader.readAsDataURL(file);
  }

  function selectMention(user) {
    if (!mentionMatch) return;

    const beforeCursor = text.slice(0, cursorPos);
    const afterCursor = text.slice(cursorPos);

    const replacement = beforeCursor.replace(
      /(^|\s)@([^\s@]*)$/,
      (_, whitespace) => `${whitespace}@${user} `,
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

  function insertEmoji(emoji) {
    const input = inputRef.current;
    const start = input?.selectionStart ?? text.length;
    const end = input?.selectionEnd ?? text.length;

    const nextText = text.slice(0, start) + emoji + text.slice(end);
    const nextCursor = start + emoji.length;

    setText(nextText);
    setCursorPos(nextCursor);
    setEmojiPickerOpen(false);
    setActionMenuOpen(false);
    setSuggestionsOpen(true);

    requestAnimationFrame(() => {
      if (!inputRef.current) return;

      inputRef.current.focus();
      inputRef.current.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function handleInputChange(event) {
    setText(event.target.value);
    setCursorPos(
      event.target.selectionStart ?? event.target.value.length,
    );
    setSuggestionsOpen(true);
    setActiveSuggestion(-1);

    if (error) clearError?.();
  }

  function updateCursor(event) {
    setCursorPos(
      event.target.selectionStart ?? event.target.value.length,
    );
  }

  function handleKeyDown(event) {
    if (event.key === "Escape" && emojiPickerOpen) {
      setEmojiPickerOpen(false);
      return;
    }

    if (event.key === "Escape" && actionMenuOpen) {
      setActionMenuOpen(false);
      return;
    }

    if (suggestionsOpen && suggestions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveSuggestion((index) =>
          index < suggestions.length - 1 ? index + 1 : 0,
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveSuggestion((index) =>
          index <= 0 ? suggestions.length - 1 : index - 1,
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

    if (!trimmedText && !selectedFile) return;

    let sent = false;

    if (selectedFile) {
      sent = sendAttachment(
        selectedUser,
        selectedFile,
        trimmedText,
      );
    } else {
      sent = selectedUser
        ? sendPrivateMessage(selectedUser, trimmedText)
        : sendMessage(trimmedText);
    }

    if (sent) {
      setText("");
      setCursorPos(0);
      setSuggestionsOpen(true);
      setActiveSuggestion(-1);
      setActionMenuOpen(false);
      setEmojiPickerOpen(false);
      removeSelectedFile();
    }
  }

  function renderMessageText(message) {
    const messageText =
      typeof message?.text === "string" ? message.text : "";

    const mentionedUsers = Array.isArray(message?.mentionedUsers)
      ? message.mentionedUsers.filter(
          (name) => typeof name === "string" && name.length > 0,
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
      "gi",
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
        </span>,
      );

      lastIndex = pattern.lastIndex;
    }

    if (lastIndex < messageText.length) {
      parts.push(messageText.slice(lastIndex));
    }

    return parts.length ? parts : messageText;
  }

  function renderAttachment(attachment) {
    if (!attachment?.data || !attachment?.name) return null;

    const isImage = attachment.type?.startsWith("image/");

    if (isImage) {
      return (
        <a
          href={attachment.data}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open image ${attachment.name} in a new tab`}
          className="chat-attachment-image-link"
        >
          <img
            src={attachment.data}
            alt={attachment.name}
            loading="lazy"
            className="chat-attachment-image"
          />
        </a>
      );
    }

    return (
      <a
        href={attachment.data}
        download={attachment.name}
        className="chat-attachment-file-link"
      >
        <span aria-hidden="true">📎</span>
        <span className="chat-attachment-file-name">
          {attachment.name}
        </span>
        <span aria-hidden="true">↓</span>
      </a>
    );
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  const visibleEmojis = useMemo(
    () => EMOJI_CATEGORIES[activeEmojiCategory] || [],
    [activeEmojiCategory],
  );

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

        <div className="sidebar-section-label">CONVERSATIONS</div>

        <button
          type="button"
          className={`conversation-item ${!selectedUser ? "active" : ""}`}
          onClick={openGroupChat}
        >
          <div className="avatar group-avatar">#</div>

          <div className="conversation-info">
            <div className="conversation-name-row">
              <strong>Group Chat</strong>

              {(unreadCounts.group || 0) > 0 && (
                <span
                  className="unread-badge"
                  aria-label={`${unreadCounts.group} unread group messages`}
                >
                  {unreadCounts.group > 99 ? "99+" : unreadCounts.group}
                </span>
              )}
            </div>

            <span>Everyone online</span>
          </div>
        </button>

        <div className="sidebar-section-label">DIRECT MESSAGES</div>

        <div className="users-list">
          {otherUsers.map((user) => {
            const userKey = user.toLowerCase();
            const unreadCount = unreadCounts[userKey] || 0;

            return (
              <button
                type="button"
                key={userKey}
                className={`conversation-item ${
                  selectedUser?.toLowerCase() === userKey ? "active" : ""
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
            <p className="empty-users">No other users online yet.</p>
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
            {selectedUser ? selectedUser.charAt(0).toUpperCase() : "#"}
          </div>

          <div>
            <h2>{selectedUser || "Group Chat"}</h2>
            <p>
              {selectedUser
                ? "Private conversation"
                : `${Array.isArray(users) ? users.length : 0} user(s) connected`}
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
            <div className="intro-icon">{selectedUser ? "✉" : "#"}</div>

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

            const isPrivate = [
              "CHAT_PRIVATE",
              "CHAT_PRIVATE_ATTACHMENT",
            ].includes(message.type);

            const sender = String(
              isPrivate
                ? message.from ?? message.username ?? message.sender ?? ""
                : message.username ?? message.from ?? message.sender ?? "",
            ).trim();

            if (!sender) return null;

            const isOwnMessage =
              sender.toLowerCase() === normalizedUsername;

            return (
              <div
                className={`message-row ${
                  isOwnMessage ? "own-message" : ""
                }`}
                key={message.id || `${message.timestamp ?? "message"}-${index}`}
              >
                {!isOwnMessage && (
                  <div className="avatar message-avatar">
                    {sender.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="message-content">
                  {!isOwnMessage && (
                    <span className="message-sender">{sender}</span>
                  )}

                  <div className="message-bubble">
                    {message.attachment &&
                      renderAttachment(message.attachment)}
                    {renderMessageText(message)}
                  </div>

                  <time className="message-time">
                    {message.timestamp
                      ? new Date(message.timestamp).toLocaleTimeString([], {
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
                  <div className="mention-heading">MENTION SOMEONE</div>

                  {suggestions.map((user, index) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === activeSuggestion}
                      className={`mention-option ${
                        index === activeSuggestion ? "selected" : ""
                      }`}
                      key={user.toLowerCase()}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectMention(user)}
                    >
                      <span className="avatar mention-avatar">
                        {user.charAt(0).toUpperCase()}
                      </span>
                      <span className="mention-user-name">{user}</span>
                      <span className="mention-at">@</span>
                    </button>
                  ))}
                </div>
              )}

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FILES}
              onChange={handleFileSelect}
              style={{ display: "none" }}
              aria-label="Choose attachment"
            />

            {selectedFile && (
              <div className="attachment-preview">
                <div className="attachment-preview-icon">
                  {filePreview ? (
                    <img
                      src={filePreview}
                      alt={selectedFile.name}
                      className="attachment-thumbnail"
                    />
                  ) : (
                    <span className="attachment-file-icon">
                      {selectedFile.type === "application/pdf"
                        ? "PDF"
                        : selectedFile.type.includes("word") ||
                            selectedFile.type === "application/msword"
                          ? "DOC"
                          : "TXT"}
                    </span>
                  )}
                </div>

                <div className="attachment-preview-details">
                  <span
                    className="attachment-preview-name"
                    title={selectedFile.name}
                  >
                    {selectedFile.name}
                  </span>

                  <span className="attachment-preview-size">
                    {formatFileSize(selectedFile.size)} · Ready to send
                  </span>
                </div>

                <button
                  type="button"
                  className="attachment-remove-btn"
                  onClick={removeSelectedFile}
                  aria-label="Remove attachment"
                  title="Remove attachment"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            )}

            <div className="message-input-container">
              <input
                ref={inputRef}
                className="chat-message-input"
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

              <div className="emoji-control" ref={emojiPickerRef}>
                {/* Main action button: smiley with a plus badge */}
                <button
                  type="button"
                  className="emoji-input-trigger action-menu-trigger"
                  onClick={() => {
                    setEmojiPickerOpen(false);
                    setActionMenuOpen((open) => !open);
                  }}
                  disabled={status !== "connected"}
                  aria-label="Open chat actions"
                  aria-expanded={actionMenuOpen}
                  title="Chat actions"
                >
                  <span className="action-trigger-smiley" aria-hidden="true">
                    ☺
                  </span>
                  <span className="action-trigger-plus" aria-hidden="true">
                    +
                  </span>
                </button>

                {/* Only two options: smiley and attachment */}
                {actionMenuOpen && (
                  <div className="chat-action-menu">
                    <button
                      type="button"
                      onClick={() => {
                        setActionMenuOpen(false);
                        setEmojiPickerOpen(true);
                      }}
                      aria-label="Open emoji picker"
                      title="Emoji"
                    >
                      <span className="action-menu-emoji" aria-hidden="true">
                        ☺
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActionMenuOpen(false);
                        fileInputRef.current?.click();
                      }}
                      aria-label="Attach file"
                      title="Attach file"
                    >
                      <span className="action-menu-emoji" aria-hidden="true">
                        📎
                      </span>
                    </button>
                  </div>
                )}

                {/* Emoji picker */}
                {emojiPickerOpen && (
                  <div className="whatsapp-emoji-picker">
                    <div className="emoji-picker-title">
                      <strong>Emojis</strong>

                      <button
                        type="button"
                        className="emoji-picker-close"
                        onClick={() => setEmojiPickerOpen(false)}
                        aria-label="Close emoji picker"
                      >
                        ×
                      </button>
                    </div>

                    <div className="emoji-category-tabs">
                      {Object.keys(EMOJI_CATEGORIES).map((category) => (
                        <button
                          type="button"
                          key={category}
                          className={`emoji-category ${
                            activeEmojiCategory === category ? "active" : ""
                          }`}
                          onClick={() => setActiveEmojiCategory(category)}
                          title={category}
                          aria-label={category}
                        >
                          {EMOJI_CATEGORY_ICONS[category]}
                        </button>
                      ))}
                    </div>

                    <div className="emoji-picker-section-title">
                      {activeEmojiCategory}
                    </div>

                    <div className="whatsapp-emoji-grid">
                      {visibleEmojis.map((emoji, index) => (
                        <button
                          type="button"
                          key={`${emoji}-${index}`}
                          className="whatsapp-emoji-option"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => insertEmoji(emoji)}
                          aria-label={`Insert ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Send button stays separate */}
          <button
            type="submit"
            className="send-button"
            disabled={
              status !== "connected" || (!text.trim() && !selectedFile)
            }
            aria-label="Send message"
            title="Send message"
          >
            <span className="send-button-text">Send</span>
            <span className="send-button-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </svg>
            </span>
          </button>
        </form>
      </section>
    </main>
  );
}
