import type { Metadata } from "next";
import { ChatPage } from "@/components/chat-page";

export const metadata: Metadata = {
  title: "Live Chat",
  description: "Join animeTVplus live rooms, chat with online users, follow usernames, and share what you are watching.",
};

export default function Page() {
  return <ChatPage />;
}
