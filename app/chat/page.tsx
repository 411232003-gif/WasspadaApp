import { CommunityChat } from "@/components/chat/community-chat";

export const metadata = {
  title: "Chat & Grup | WasspadaApp",
};

export default function ChatPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-fg">Chat & Grup</h2>
        <p className="text-sm text-fg-muted">
          Ruang diskusi terbuka plus grup privat ala WhatsApp — buat grup,
          atur admin, dan koreksi pesanmu sendiri.
        </p>
      </div>

      <CommunityChat />
    </div>
  );
}
