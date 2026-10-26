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
          <div className="logo">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="90 90 475 435"
              width="64"
              height="59"
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
