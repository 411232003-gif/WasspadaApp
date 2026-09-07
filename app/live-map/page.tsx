import MapWrapper from "@/components/map/map-wrapper";

export const metadata = {
  title: "Live Map | WasspadaApp",
};

export default function LiveMapPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-fg">Live Map</h2>
        <p className="text-sm text-fg-muted">
          potensi sebaran abu vulkanik dan radius dampak bencana.
        </p>
      </div>

      <MapWrapper />
    </div>
  );
}
