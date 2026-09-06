"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";
import { Flame, Waves, Cloud, RotateCcw, Layers, Eye, X, SlidersHorizontal } from "lucide-react";

type ViewMode = "volcano" | "earthquake" | "ash";

interface LayersState {
  terrain: boolean;
  volcano: boolean;
  rings: boolean;
  particles: boolean;
}

const KRB_RINGS = [
  {
    radius: 3,
    color: "#ef4444",
    glow: "#ef4444",
    label: "KRB III - 3km",
    desc: "Piroklastik & Lava",
  },
  {
    radius: 5,
    color: "#f97316",
    glow: "#f97316",
    label: "KRB II - 5km",
    desc: "Batu Pijar & Abu Tebal",
  },
  {
    radius: 8,
    color: "#eab308",
    glow: "#22d3ee",
    label: "KRB I - 8km",
    desc: "Hujan Abu & Lahar",
  },
];

const EPICENTER_POS: [number, number, number] = [-4, 0.1, -4];

function Terrain({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <>
      <Grid
        position={[0, -0.02, 0]}
        args={[80, 80]}
        cellSize={1}
        cellThickness={0.4}
        cellColor="#64748b"
        sectionSize={5}
        sectionThickness={1.2}
        sectionColor="#94a3b8"
        fadeDistance={50}
        fadeStrength={1}
        infiniteGrid
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#0f172a" transparent opacity={0.4} />
      </mesh>
    </>
  );
}

function VolcanoCone({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 1.5, 0]} castShadow>
        <coneGeometry args={[1.5, 3, 32]} />
        <meshStandardMaterial
          color="#7f1d1d"
          emissive="#f97316"
          emissiveIntensity={0.5}
          roughness={0.8}
        />
      </mesh>
      <pointLight position={[0, 3.2, 0]} color="#f97316" intensity={4} distance={10} />
      <mesh position={[0, 3, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color="#fbbf24" />
      </mesh>
    </group>
  );
}

function SmokeParticles({ count = 180, spread = 0.7, visible }: { count?: number; spread?: number; visible: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;
      arr[i3] = Math.cos(angle) * r;
      arr[i3 + 1] = 3 + Math.random() * 1.2;
      arr[i3 + 2] = Math.sin(angle) * r;
    }
    return arr;
  }, [count, spread]);

  const speeds = useMemo(() => {
    return new Float32Array(count).fill(0).map(() => 0.4 + Math.random() * 0.8);
  }, [count]);

  const drifts = useMemo(() => {
    return new Float32Array(count * 2).fill(0).map(() => (Math.random() - 0.5) * 0.3);
  }, [count]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      pos[i3 + 1] += speeds[i] * delta;
      pos[i3] += drifts[i * 2] * delta;
      pos[i3 + 2] += drifts[i * 2 + 1] * delta;
      if (pos[i3 + 1] > 6.5) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * spread;
        pos[i3] = Math.cos(angle) * r;
        pos[i3 + 1] = 3 + Math.random() * 0.5;
        pos[i3 + 2] = Math.sin(angle) * r;
      }
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  if (!visible) return null;
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#9ca3af"
        size={0.08}
        transparent
        opacity={0.75}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function HazardRings({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <group>
      {KRB_RINGS.map((ring) => (
        <mesh
          key={ring.radius}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.05, 0]}
        >
          <torusGeometry args={[ring.radius, 0.06, 16, 100]} />
          <meshBasicMaterial
            color={ring.color}
            transparent
            opacity={0.35}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function EpicenterMarker() {
  return (
    <mesh position={EPICENTER_POS}>
      <sphereGeometry args={[0.4, 24, 24]} />
      <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.6} />
    </mesh>
  );
}

function RippleEffect() {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);
  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta;
    const period = 2.5;
    const progress = (timeRef.current % period) / period;
    const scale = 1 + progress * 8;
    meshRef.current.scale.setScalar(scale);
    (meshRef.current.material as THREE.MeshBasicMaterial).opacity = 1 - progress;
  });

  return (
    <mesh ref={meshRef} position={EPICENTER_POS} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.85, 1, 64]} />
      <meshBasicMaterial
        color="#ef4444"
        transparent
        opacity={1}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function AshCloud({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <group>
      <mesh position={[0, 4, 0]}>
        <sphereGeometry args={[2.8, 32, 32]} />
        <meshStandardMaterial
          color="#6b7280"
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </mesh>
      <SmokeParticles count={260} spread={1.8} visible />
    </group>
  );
}

export default function SceneClient() {
  const [view, setView] = useState<ViewMode>("volcano");
  const [layers, setLayers] = useState<LayersState>({
    terrain: true,
    volcano: true,
    rings: true,
    particles: true,
  });
  const [panelOpen, setPanelOpen] = useState(true);
  const controlsRef = useRef<any>(null);

  const isVolcano = view === "volcano";
  const isEarthquake = view === "earthquake";
  const isAsh = view === "ash";

  const resetView = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  useEffect(() => {
    resetView();
  }, [view]);

  return (
    <div className="relative h-[60vh] md:h-[calc(100vh-7rem)] min-h-[420px] w-full rounded-2xl overflow-hidden glass-panel">
      <Canvas
        camera={{ position: [16, 14, 16], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 20, 10]} intensity={0.9} castShadow />

        <Terrain visible={layers.terrain} />

        {isVolcano && (
          <>
            <VolcanoCone visible={layers.volcano} />
            <SmokeParticles visible={layers.particles} />
            <HazardRings visible={layers.rings} />
          </>
        )}

        {isEarthquake && (
          <>
            <EpicenterMarker />
            <RippleEffect />
            <SmokeParticles count={120} spread={0.5} visible={layers.particles} />
          </>
        )}

        {isAsh && (
          <>
            <VolcanoCone visible={layers.volcano} />
            <AshCloud visible />
          </>
        )}

        <OrbitControls
          ref={controlsRef}
          enablePan
          enableZoom
          enableRotate
          minDistance={5}
          maxDistance={40}
          target={[0, 0, 0]}
        />
      </Canvas>

      {panelOpen ? (
        <div className="absolute top-3 right-3 z-10 w-64 max-w-[calc(100%-1.5rem)] rounded-2xl glass-panel p-4 theme-transition sm:w-72">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-fg">3D Controls</h3>
            <div className="flex items-center gap-1">
              <button
                onClick={resetView}
                type="button"
                className="rounded-lg p-1.5 hover:bg-white/5"
                title="Reset view"
              >
                <RotateCcw className="h-4 w-4 text-accent" />
              </button>
              <button
                onClick={() => setPanelOpen(false)}
                type="button"
                className="rounded-lg p-1.5 hover:bg-white/5"
                title="Sembunyikan panel"
              >
                <X className="h-4 w-4 text-fg" />
              </button>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2">
          <button
            onClick={() => setView("volcano")}
            type="button"
            className={`flex flex-col items-center gap-1 min-w-0 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-all sm:py-2 sm:text-xs ${
              isVolcano
                ? "bg-accent text-bg font-bold shadow-[0_0_12px_var(--glow)]"
                : "text-fg hover:bg-white/5"
            }`}
          >
            <Flame className="h-4 w-4" /> Radius
          </button>
          <button
            onClick={() => setView("earthquake")}
            type="button"
            className={`flex flex-col items-center gap-1 min-w-0 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-all sm:py-2 sm:text-xs ${
              isEarthquake
                ? "bg-accent text-bg font-bold shadow-[0_0_12px_var(--glow)]"
                : "text-fg hover:bg-white/5"
            }`}
          >
            <Waves className="h-4 w-4" /> Gempa
          </button>
          <button
            onClick={() => setView("ash")}
            type="button"
            className={`flex flex-col items-center gap-1 min-w-0 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-all sm:py-2 sm:text-xs ${
              isAsh
                ? "bg-accent text-bg font-bold shadow-[0_0_12px_var(--glow)]"
                : "text-fg hover:bg-white/5"
            }`}
          >
            <Cloud className="h-4 w-4" /> Abu
          </button>
        </div>

        <div className="mb-4">
          <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-fg-muted">
            <Layers className="h-3.5 w-3.5" /> Layer 3D
          </label>
          <div className="space-y-2">
            {[
              { key: "terrain", label: "Terrain Grid" },
              { key: "volcano", label: "Model Gunung Api" },
              { key: "rings", label: "Radius KRB" },
              { key: "particles", label: "Partikel Asap/Awan" },
            ].map((item) => (
              <label
                key={item.key}
                className="flex cursor-pointer items-center gap-2 text-sm text-fg"
              >
                <input
                  type="checkbox"
                  checked={layers[item.key as keyof LayersState]}
                  onChange={(e) =>
                    setLayers((prev) => ({
                      ...prev,
                      [item.key]: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-accent rounded border-card-border bg-card"
                />
                {item.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-fg-muted">
            <Eye className="h-3.5 w-3.5" /> Legenda KRB
          </label>
          <div className="space-y-2">
            {KRB_RINGS.map((ring) => (
              <div key={ring.radius} className="flex items-start gap-2">
                <span
                  className="mt-0.5 h-3 w-3 shrink-0 rounded-full"
                  style={{
                    backgroundColor: ring.color,
                    boxShadow: `0 0 10px ${ring.glow}`,
                  }}
                />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-fg">
                    {ring.label}
                  </span>
                  <span className="text-[10px] text-fg-muted">{ring.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      ) : (
        <button
          onClick={() => setPanelOpen(true)}
          type="button"
          className="absolute top-3 right-3 z-10 rounded-2xl glass-panel p-3 shadow-lg theme-transition"
          title="Buka 3D Controls"
        >
          <SlidersHorizontal className="h-5 w-5 text-accent" />
        </button>
      )}
    </div>
  );
}
