import MonevMapWrapper from "@/components/monev/monev-map-wrapper";

export const metadata = {
  title: "Monev Map | WasspadaApp",
};

export default function MonevMapPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-fg">Monev Map</h2>
        <p className="text-sm text-fg-muted">
          Monitoring &amp; evaluasi real-time: gunung api (PVMBG), gempa (BMKG),
          aliran angin, zona KRB, sebaran abu vulkanik, dan jalur evakuasi.
        </p>
      </div>

      <MonevMapWrapper />
    </div>
  );
}
