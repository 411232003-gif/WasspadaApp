import { NewsFeed } from "@/components/news-feed";
import { Newspaper } from "lucide-react";

export const metadata = {
  title: "Berita & Laporan | WasspadaApp",
};

export default function NewsPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-fg">Berita & Laporan</h2>
          <p className="text-sm text-fg-muted">
            Laporan bencana real-time dari PetaBencana, Bluesky, GDACS, dan
            ReliefWeb.
          </p>
        </div>
        <Newspaper className="h-5 w-5 text-fg-muted" />
      </div>

      <NewsFeed />
    </div>
  );
}
