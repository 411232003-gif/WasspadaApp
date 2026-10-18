import { cachedJsonResponse } from "@/lib/api-cache";

export type NewsSource = "petabencana" | "bluesky" | "gdacs" | "reliefweb";

interface NewsItem {
  id: string;
  source: NewsSource;
  title: string;
  text: string;
  url: string;
  imageUrl?: string;
  author?: string;
  createdAt: string;
  meta?: string;
}

type SourceStatus = { ok: boolean; count: number; error?: string };

const DISASTER_LABELS: Record<string, string> = {
  flood: "Banjir",
  earthquake: "Gempa",
  haze: "Kabut Asap",
  volcano: "Gunung Api",
  wind: "Angin Kencang",
  fire: "Kebakaran",
  landslide: "Tanah Longsor",
  road: "Kerusakan Jalan",
  structure: "Kerusakan Bangunan",
};

const GDACS_TYPE_LABELS: Record<string, string> = {
  EQ: "Gempa",
  TS: "Tsunami",
  VO: "Gunung Api",
  FL: "Banjir",
  TC: "Siklon Tropis",
  DR: "Kekeringan",
  WF: "Kebakaran Hutan",
};

function decodeXml(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

function xmlTag(block: string, tag: string): string | undefined {
  const m = block.match(new RegExp(`<${tag}(\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
  return m ? decodeXml(m[2].trim()) : undefined;
}

function xmlAttr(block: string, tag: string, attr: string): string | undefined {
  const m = block.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`));
  return m ? decodeXml(m[1]) : undefined;
}

async function fetchPetaBencana(): Promise<NewsItem[]> {
  const res = await fetch(
    "https://api.petabencana.id/reports?timeperiod=86400&format=json",
    { next: { revalidate: 300 } }
  );
  if (!res.ok) throw new Error(`PetaBencana ${res.status}`);
  const data = await res.json();
  const geometries =
    data?.result?.objects?.output?.geometries ??
    data?.result?.features ??
    [];

  const items: NewsItem[] = [];
  for (const g of geometries) {
    const p = g?.properties ?? g;
    if (!p || !p.created_at) continue;
    const type = String(p.disaster_type || "other");
    const label = DISASTER_LABELS[type] || type;
    const city = p.tags?.city ? String(p.tags.city) : "";
    const coords = Array.isArray(g.coordinates) ? g.coordinates : null;
    items.push({
      id: `pb-${p.pkey || p.url || Math.random().toString(36).slice(2)}`,
      source: "petabencana",
      title: `${label}${city ? ` — ${city}` : ""}`,
      text: String(p.text || p.title || `Laporan ${label}`),
      url: p.url
        ? `https://cards.petabencana.id/cards/${p.url}`
        : "https://petabencana.id/map",
      imageUrl: p.image_url || undefined,
      author: p.source ? `via ${p.source}` : undefined,
      createdAt: p.created_at,
      meta: [
        label,
        city,
        coords ? `${coords[1].toFixed(2)}, ${coords[0].toFixed(2)}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }
  return items.slice(0, 40);
}

async function fetchGdacs(): Promise<NewsItem[]> {
  const res = await fetch("https://www.gdacs.org/xml/rss.xml", {
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`GDACS ${res.status}`);
  const xml = await res.text();

  const items: NewsItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const title = xmlTag(block, "title");
    const link = xmlTag(block, "link");
    const pubDate = xmlTag(block, "pubDate");
    const eventType = xmlTag(block, "gdacs:eventtype");
    const alertLevel = xmlTag(block, "gdacs:alertlevel");
    const severity = xmlTag(block, "gdacs:severity");
    const country = xmlTag(block, "gdacs:country");
    const desc = xmlTag(block, "description");
    if (!title || !link) continue;
    items.push({
      id: `gdacs-${xmlTag(block, "guid") || link}`,
      source: "gdacs",
      title,
      text: desc || severity || "",
      url: link,
      imageUrl: xmlAttr(block, "enclosure", "url"),
      author: "GDACS (UN/EU)",
      createdAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      meta: [
        eventType ? GDACS_TYPE_LABELS[eventType] || eventType : null,
        alertLevel ? `Alert ${alertLevel}` : null,
        country,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }
  return items.slice(0, 30);
}

const BSKY_QUERIES = ["gempa", "banjir", "tsunami", "gunung", "bencana"];

async function fetchBluesky(): Promise<NewsItem[]> {
  const results = await Promise.allSettled(
    BSKY_QUERIES.map((q) =>
      fetch(
        `https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(
          q
        )}&lang=id&limit=10&sort=latest`,
        { next: { revalidate: 300 } }
      ).then((r) => {
        if (!r.ok) throw new Error(`Bluesky ${r.status}`);
        return r.json();
      })
    )
  );

  const seen = new Set<string>();
  const items: NewsItem[] = [];
  let anyOk = false;

  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    anyOk = true;
    for (const post of r.value?.posts || []) {
      const uri: string = post.uri;
      if (!uri || seen.has(uri)) continue;
      seen.add(uri);
      const rec = post.record || {};
      const author = post.author || {};
      const rkey = uri.split("/").pop() || "";
      const images = post.embed?.images;
      items.push({
        id: `bsky-${rkey || uri}`,
        source: "bluesky",
        title: author.displayName || author.handle || "Pengguna Bluesky",
        text: String(rec.text || ""),
        url: `https://bsky.app/profile/${author.handle}/post/${rkey}`,
        imageUrl: images?.[0]?.thumb || undefined,
        author: author.handle ? `@${author.handle}` : undefined,
        createdAt: rec.createdAt || post.indexedAt || new Date().toISOString(),
        meta: post.likeCount ? `${post.likeCount} suka` : undefined,
      });
    }
  }

  if (!anyOk) throw new Error("Bluesky search gagal");
  return items.slice(0, 40);
}

interface ReliefWebDoc {
  id: string | number;
  fields?: {
    title?: string;
    url?: string;
    url_alias?: string;
    date?: { created?: string };
    source?: { name?: string }[];
    primary_country?: { name?: string };
  };
}

async function fetchReliefWeb(): Promise<NewsItem[]> {
  const appname = process.env.RELIEFWEB_APPNAME || "wasspada";
  const res = await fetch(
    `https://api.reliefweb.int/v2/reports?appname=${encodeURIComponent(
      appname
    )}&limit=15&preset=latest&profile=list&query[value]=${encodeURIComponent(
      "disaster Indonesia"
    )}`,
    { next: { revalidate: 300 } }
  );
  if (!res.ok) throw new Error(`ReliefWeb ${res.status}`);
  const data = await res.json();
  if (data?.error) throw new Error(data.error.message || "ReliefWeb error");

  return (data.data || []).map((r: ReliefWebDoc) => {
    const f = r.fields || {};
    return {
      id: `rw-${r.id}`,
      source: "reliefweb" as const,
      title: String(f.title || "ReliefWeb Report"),
      text: f.source?.length
        ? `Sumber: ${f.source.map((s) => s.name).join(", ")}`
        : "",
      url: f.url_alias || f.url || "https://reliefweb.int",
      author: f.source?.[0]?.name,
      createdAt: f.date?.created || new Date().toISOString(),
      meta: f.primary_country?.name || undefined,
    };
  });
}

export async function GET(request: Request) {
  const settled = await Promise.allSettled([
    fetchPetaBencana(),
    fetchGdacs(),
    fetchBluesky(),
    fetchReliefWeb(),
  ]);

  const names: NewsSource[] = [
    "petabencana",
    "gdacs",
    "bluesky",
    "reliefweb",
  ];
  const sources: Record<NewsSource, SourceStatus> = {} as Record<
    NewsSource,
    SourceStatus
  >;
  const items: NewsItem[] = [];

  settled.forEach((r, i) => {
    const name = names[i];
    if (r.status === "fulfilled") {
      sources[name] = { ok: true, count: r.value.length };
      items.push(...r.value);
    } else {
      sources[name] = {
        ok: false,
        count: 0,
        error:
          r.reason instanceof Error ? r.reason.message : String(r.reason),
      };
    }
  });

  items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const payload = {
    items,
    sources,
    updatedAt: new Date().toISOString(),
  };

  return cachedJsonResponse(request, "news", payload, { items, sources });
}
