import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;
const supabaseBucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || "chat-images";

const nextConfig: NextConfig = {
  // izinkan akses dev dari perangkat lain di jaringan lokal (HP, dll.)
  allowedDevOrigins: ["192.168.100.31", "192.168.100.*", "localhost"],
  images: {
    remotePatterns: supabaseHost
      ? [
        {
          protocol: "https",
          hostname: supabaseHost,
          pathname: `/storage/v1/object/public/${supabaseBucket}/**`,
        },
      ]
      : [],
  },
};

export default nextConfig;
