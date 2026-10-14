import HazardMapWrapper from "@/components/hazard/hazard-map-wrapper";

export const metadata = {
  title: "Hazard Map | WasspadaApp",
};

export default function ThreeDHazardPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-fg">Hazard Map</h2>
        <p className="text-sm text-fg-muted">
          Indikator real-time: gunung aktif (PVMBG), gempa (BMKG), aliran angin,
          zona KRB, dan arah sebaran abu.
        </p>
      </div>

      <HazardMapWrapper />
    </div>
  );
}
