"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  RefreshCw,
  Rss,
  Waves,
  CloudSun,
  Wind,
  Newspaper,
  type LucideIcon,
} from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import {
  fetchNews,
  NewsItem,
  NewsResponse,
  NewsSourceStatus,
} from "@/lib/live-api";

type SourceKey = NewsItem["source"];

const SOURCE_META: Record<
  SourceKey,
  { label: string; color: string; icon: LucideIcon }
> = {
  petabencana: { label: "PetaBencana", color: "#22d3ee", icon: Waves },
  bluesky: { label: "Bluesky", color: "#0085ff", icon: CloudSun },
  gdacs: { label: "GDACS", color: "#fb923c", icon: Wind },
  reliefweb: { label: "ReliefWeb", color: "#a78bfa", icon: Newspaper },
};

const SOURCE_ORDER: SourceKey[] = [
  "petabencana",
  "bluesky",
  "gdacs",
  "reliefweb",
];

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
}

export function NewsFeed() {
  const [data, setData] = useState<NewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SourceKey | "all">("all");

  const load = async () => {
    setLoading(true);
    try {
      setData(await fetchNews());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetchNews();
        if (!cancelled) setData(res);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    const interval = setInterval(run, 300000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const items = useMemo(() => data?.items ?? [], [data]);
  const sources: Record<string, NewsSourceStatus> = data?.sources || {};

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.source === filter)),
    [items, filter]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
            filter === "all"
              ? "bg-accent/20 text-accent"
              : "text-fg-muted hover:text-fg"
          }`}
        >
          Semua ({items.length})
        </button>
        {SOURCE_ORDER.map((key) => {
          const meta = SOURCE_META[key];
          const status = sources[key];
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                active ? "text-bg" : "text-fg-muted hover:text-fg"
              }`}
              style={active ? { backgroundColor: meta.color } : undefined}
              title={status?.error || meta.label}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: active ? "currentColor" : meta.color,
                  opacity: status && !status.ok ? 0.35 : 1,
                }}
              />
              {meta.label}
              {status?.ok ? ` (${status.count})` : status ? " (!)" : ""}
            </button>
          );
        })}
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading && items.length === 0 && (
        <div className="flex items-center justify-center py-12 text-fg-muted">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          Memuat berita & laporan real...
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <GlassCard className="p-6 text-center text-sm text-fg-muted">
          <Rss className="mx-auto mb-2 h-6 w-6 text-fg-muted" />
          {data?.error
            ? `Gagal memuat: ${data.error}`
            : "Belum ada laporan dari sumber ini."}
        </GlassCard>
      )}

      {Object.entries(sources).some(([, s]) => !s.ok) && (
        <p className="text-[11px] text-fg-muted">
          Sumber bermasalah:{" "}
          {SOURCE_ORDER.filter((k) => sources[k] && !sources[k].ok)
            .map((k) => SOURCE_META[k].label)
            .join(", ")}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((item) => {
          const meta = SOURCE_META[item.source];
          return (
            <GlassCard key={item.id} className="flex flex-col p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{
                    backgroundColor: `${meta.color}20`,
                    color: meta.color,
                  }}
                >
                  {meta.label}
                </span>
                <span className="shrink-0 text-[10px] text-fg-muted">
                  {formatTime(item.createdAt)}
                </span>
              </div>

              {item.imageUrl ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-3 block overflow-hidden rounded-xl border border-card-border"
                >
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    loading="lazy"
                    className="h-40 w-full object-cover transition-transform hover:scale-[1.02]"
                  />
                </a>
              ) : (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={item.title}
                  className="relative mb-3 flex h-24 items-center justify-center overflow-hidden rounded-xl border border-card-border transition-transform hover:scale-[1.01]"
                  style={{
                    background: `linear-gradient(135deg, ${meta.color}26 0%, rgba(0,0,0,0.35) 55%, ${meta.color}1a 100%)`,
                  }}
                >
                  <meta.icon
                    className="absolute -left-2 -bottom-3 h-24 w-24 opacity-[0.12]"
                    style={{ color: meta.color }}
                  />
                  <span
                    className="relative flex h-11 w-11 items-center justify-center rounded-2xl"
                    style={{
                      background: `linear-gradient(145deg, ${meta.color}33, ${meta.color}14)`,
                      boxShadow: `0 6px 16px ${meta.color}40, inset 0 1px 1px rgba(255,255,255,0.2)`,
                    }}
                  >
                    <meta.icon
                      className="h-5 w-5"
                      style={{ color: meta.color }}
                    />
                  </span>
                </a>
              )}

              <h3 className="text-sm font-semibold text-fg">{item.title}</h3>
              {item.author && (
                <p className="mt-0.5 text-[11px] font-medium text-accent">
                  {item.author}
                </p>
              )}
              {item.text && (
                <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-fg-muted">
                  {item.text}
                </p>
              )}
              {item.meta && (
                <p className="mt-2 text-[10px] text-fg-muted">{item.meta}</p>
              )}

              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 self-start rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Buka Sumber
              </a>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
