import SceneWrapper from "@/components/3d/scene-wrapper";

export const metadata = {
  title: "3D Hazard Zone | WasspadaApp",
};

export default function ThreeDHazardPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-fg">3D Hazard Zone</h2>
        <p className="text-sm text-fg-muted">
          radius KRB, gelombang gempa, dan awan abu.
        </p>
      </div>

      <SceneWrapper />
    </div>
  );
}
