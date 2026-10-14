import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { useAppStore } from "./state/store";
import { sip } from "./state/phoneService";
import { chatClient } from "./state/chatService";
import "./styles/index.scss";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

if (import.meta.env.DEV) {
  // Dev aid: drive/inspect the store and phone service from the console or tests.
  (window as unknown as { store: typeof useAppStore }).store = useAppStore;
  (window as unknown as { sip: typeof sip }).sip = sip;
  (window as unknown as { chat: typeof chatClient }).chat = chatClient;
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
