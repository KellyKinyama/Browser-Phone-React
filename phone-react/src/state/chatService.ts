import { ChatClient } from "../services/chat/ChatClient";

// Single chat client instance (XMPP-over-WS to chatstub-server), shared by the chat slice.
export const chatClient = new ChatClient();
