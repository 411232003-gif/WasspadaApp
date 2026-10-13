import { CommunityChat } from "@/components/chat/community-chat";

export const metadata = {
  title: "Chat Publik | WasspadaApp",
};

export default function ChatPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-fg">Chat Publik</h2>
        <p className="text-sm text-fg-muted">
          Ruang diskusi terbuka — semua pengguna WasspadaApp bisa berbagi info
          dan berkoordinasi di sini.
        </p>
      </div>

      <CommunityChat />
    </div>
  );
}
