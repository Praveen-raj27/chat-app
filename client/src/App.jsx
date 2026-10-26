import { useState } from "react";
import ChatRoom from "./chatroom";
import "./App.css";

export default function App() {
  const [nameInput, setNameInput] = useState("");
  const [username, setUsername] = useState("");

  function joinChat(event) {
    event.preventDefault();

    const name = nameInput.trim().slice(0, 30);

    if (name) {
      setUsername(name);
    }
  }

  if (!username) {
    return (
      <main className="join-screen">
        <div className="join-glow join-glow-one" />
        <div className="join-glow join-glow-two" />

        <form className="join-card" onSubmit={joinChat}>
          <div className="brand-mark">
            <svg
              viewBox="0 0 24 24"
              width="30"
              height="30"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />
            </svg>
          </div>

          <span className="join-eyebrow">YOUR SPACE TO CONNECT</span>

          <h1>
            Good conversations
            <br />
            <span>start here.</span>
          </h1>

          <p className="join-description">
            Join the room, meet people, and share your thoughts in real time.
          </p>

          <div className="join-divider">
            <span />
            <span className="join-divider-dot" />
            <span />
          </div>

          <label className="username-label" htmlFor="username">
            YOUR DISPLAY NAME
          </label>

          <div className="username-field">
            <svg
              viewBox="0 0 24 24"
              width="21"
              height="21"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
            </svg>

            <input
              id="username"
              name="username"
              type="text"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              placeholder="Enter your name"
              maxLength={30}
              autoComplete="nickname"
              required
              autoFocus
            />
          </div>

          <button className="join-button" type="submit">
            <span>Enter the chat</span>
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>

          <div className="join-footer">
            <span className="online-indicator" />
            <span>Real-time conversations. One connected community.</span>
          </div>
        </form>

        <p className="join-copyright">CONNECT · CONVERSE · BELONG</p>
      </main>
    );
  }

  return <ChatRoom username={username} />;
}
