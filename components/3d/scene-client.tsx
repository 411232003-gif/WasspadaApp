"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Html } from "@react-three/drei";
import * as THREE from "three";
import { Flame, Waves, Cloud, RotateCcw, Layers, Eye, X, SlidersHorizontal, Info, AlertTriangle, MousePointer2, Wind, Navigation } from "lucide-react";
import { useAlert, ALERT_LEVELS } from "@/lib/alert-context";
import {
  fetchWind,
  getBearing,
  cardinalFrom,
  cardinalTo,
  type WindData,
} from "@/lib/live-api";

type ViewMode = "volcano" | "earthquake" | "ash";

interface LayersState {
  terrain: boolean;
  volcano: boolean;
  rings: boolean;
  particles: boolean;
}

const SCENE_SCALE = 0.5;

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

function VolcanoCone({
  visible,
  position,
  name,
  status,
}: {
  visible: boolean;
  position: [number, number, number];
  name?: string;
  status?: string;
}) {
  if (!visible) return null;
  return (
    <group position={position}>
      <mesh position={[0, 1.5, 0]} castShadow>
        <coneGeometry args={[1.7, 3.2, 32]} />
        <meshStandardMaterial
          color="#7f1d1d"
          emissive="#f97316"
          emissiveIntensity={0.5}
          roughness={0.8}
        />
      </mesh>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[1.72, 1.72, 0.25, 32]} />
        <meshStandardMaterial color="#3f0f0f" roughness={0.9} />
      </mesh>
      <mesh position={[0, 3.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.65, 0.12, 16, 32]} />
        <meshStandardMaterial color="#1a0505" roughness={1} />
      </mesh>
      <pointLight position={[0, 3.2, 0]} color="#f97316" intensity={4} distance={10} />
      <mesh position={[0, 3.05, 0]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshBasicMaterial color="#fbbf24" />
      </mesh>
      {name && (
        <Html position={[0, 5.2, 0]} center distanceFactor={15}>
          <div className="whitespace-nowrap rounded-md bg-black/60 px-2 py-1 text-center text-[10px] font-semibold text-white backdrop-blur-sm">
            {name}
            {status ? <span className="block text-[9px] font-normal text-fg-muted">{status}</span> : null}
          </div>
        </Html>
      )}
    </group>
  );
}

function SmokeParticles({
  count = 180,
  spread = 0.7,
  visible,
  position,
  windSpeed = 0,
  windFrom = 0,
}: {
  count?: number;
  spread?: number;
  visible: boolean;
  position: [number, number, number];
  windSpeed?: number;
  windFrom?: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const toRad = (v: number) => (v * Math.PI) / 180;
  const windTo = ((windFrom ?? 0) + 180) % 360;
  const windDrift = useMemo(() => {
    const base = windSpeed * 0.05;
    return {
      x: Math.sin(toRad(windTo)) * base,
      z: Math.cos(toRad(windTo)) * base,
    };
  }, [windSpeed, windTo]);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;
      arr[i3] = position[0] + Math.cos(angle) * r;
      arr[i3 + 1] = position[1] + 3 + Math.random() * 1.2;
      arr[i3 + 2] = position[2] + Math.sin(angle) * r;
    }
    return arr;
  }, [count, spread, position]);

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
      pos[i3] += (drifts[i * 2] + windDrift.x) * delta;
      pos[i3 + 2] += (drifts[i * 2 + 1] + windDrift.z) * delta;
      if (pos[i3 + 1] > position[1] + 6.5) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * spread;
        pos[i3] = position[0] + Math.cos(angle) * r;
        pos[i3 + 1] = position[1] + 3 + Math.random() * 0.5;
        pos[i3 + 2] = position[2] + Math.sin(angle) * r;
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

function HazardRings({
  visible,
  position,
}: {
  visible: boolean;
  position: [number, number, number];
}) {
  if (!visible) return null;
  return (
    <group>
      {KRB_RINGS.map((ring) => (
        <mesh
          key={ring.radius}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[position[0], position[1] + 0.05, position[2]]}
        >
          <torusGeometry args={[ring.radius * SCENE_SCALE, 0.06, 16, 100]} />
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

function WindArrow({
  windFrom,
  windSpeed,
}: {
  windFrom?: number;
  windSpeed?: number;
}) {
  if (windFrom == null) return null;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const windTo = ((windFrom + 180) % 360);
  const color = windSpeed && windSpeed > 20 ? "#22d3ee" : "#94a3b8";
  return (
    <group position={[0, 0.2, 0]} rotation={[0, -toRad(windTo), 0]}>
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 3, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 3.2, 0]}>
        <coneGeometry args={[0.3, 0.8, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
      </mesh>
      <Html position={[0, 4.2, 0]} center distanceFactor={15}>
        <div className="whitespace-nowrap rounded-md bg-black/60 px-2 py-1 text-center text-[9px] text-white backdrop-blur-sm">
          Angin {cardinalFrom(windFrom)} {windSpeed ? `${windSpeed} km/h` : ""}
          <br />
          <span className="text-[8px] text-fg-muted">Abu ke {cardinalTo(windFrom)}</span>
        </div>
      </Html>
    </group>
  );
}

function EpicenterMarker({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.4, 24, 24]} />
      <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.6} />
    </mesh>
  );
}

function RippleEffect({ position }: { position: [number, number, number] }) {
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
    <mesh ref={meshRef} position={position} rotation={[-Math.PI / 2, 0, 0]}>
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

function AshCloud({
  visible,
  position,
  windFrom,
  windSpeed,
}: {
  visible: boolean;
  position: [number, number, number];
  windFrom?: number;
  windSpeed?: number;
}) {
  if (!visible) return null;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const windTo = ((windFrom ?? 0) + 180) % 360;
  const plumeLength = Math.min(12, 3 + (windSpeed ?? 0) * 0.35) * SCENE_SCALE;
  const plumeWidth = Math.min(3.5, 1 + (windSpeed ?? 0) * 0.12) * SCENE_SCALE;
  return (
    <group>
      <mesh position={[position[0], position[1] + 4.2, position[2]]}>
        <sphereGeometry args={[3.2, 32, 32]} />
        <meshStandardMaterial
          color="#6b7280"
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </mesh>
      <group
        position={[position[0], position[1] + 4.4, position[2]]}
        rotation={[0, -toRad(windTo), 0]}
      >
        <mesh position={[0, plumeLength / 2, 0]}>
          <cylinderGeometry args={[plumeWidth, 0.1, plumeLength, 32, 1, true]} />
          <meshStandardMaterial
            color="#4b4845"
            transparent
            opacity={0.32}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
      <SmokeParticles count={360} spread={2.4} visible position={position} windFrom={windFrom} windSpeed={windSpeed} />
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
  const [wind, setWind] = useState<WindData | null>(null);
  const controlsRef = useRef<any>(null);
  const { disasterCenter, nearestVolcano, nearestEarthquake } = useAlert();

  useEffect(() => {
    fetchWind(disasterCenter[0], disasterCenter[1]).then(setWind);
  }, [disasterCenter[0], disasterCenter[1]]);

  const toRad = (v: number) => (v * Math.PI) / 180;

  const volcanoRel = useMemo(() => {
    if (!nearestVolcano || nearestVolcano.item.lat == null || nearestVolcano.item.lon == null) {
      return { position: [0, 0, 0] as [number, number, number], distance: 0, bearing: 0 };
    }
    const distance = nearestVolcano.distanceKm;
    const bearing = getBearing(disasterCenter, [nearestVolcano.item.lat, nearestVolcano.item.lon]);
    const x = distance * SCENE_SCALE * Math.sin(toRad(bearing));
    const z = distance * SCENE_SCALE * Math.cos(toRad(bearing));
    return {
      position: [x, 0, z] as [number, number, number],
      distance,
      bearing,
    };
  }, [nearestVolcano, disasterCenter[0], disasterCenter[1]]);

  const earthquakeRel = useMemo(() => {
    if (!nearestEarthquake || !nearestEarthquake.item.coordinates) {
      return { position: [-4 * SCENE_SCALE, 0.1, -4 * SCENE_SCALE] as [number, number, number], distance: 0, bearing: 0 };
    }
    const [lat, lon] = nearestEarthquake.item.coordinates;
    const distance = nearestEarthquake.distanceKm;
    const bearing = getBearing(disasterCenter, [lat, lon]);
    const x = distance * SCENE_SCALE * Math.sin(toRad(bearing));
    const z = distance * SCENE_SCALE * Math.cos(toRad(bearing));
    return {
      position: [x, 0.1, z] as [number, number, number],
      distance,
      bearing,
    };
  }, [nearestEarthquake, disasterCenter[0], disasterCenter[1]]);

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

        {wind && <WindArrow windFrom={wind.windDirectionFrom} windSpeed={wind.windSpeed} />}

        {isVolcano && (
          <>
            <VolcanoCone visible={layers.volcano} position={volcanoRel.position} name={nearestVolcano?.item.name} status={nearestVolcano?.item.status} />
            <SmokeParticles visible={layers.particles} position={volcanoRel.position} windFrom={wind?.windDirectionFrom} windSpeed={wind?.windSpeed} />
            <HazardRings visible={layers.rings} position={volcanoRel.position} />
          </>
        )}

        {isEarthquake && (
          <>
            <EpicenterMarker position={earthquakeRel.position} />
            <RippleEffect position={earthquakeRel.position} />
            <SmokeParticles count={120} spread={0.5} visible={layers.particles} position={volcanoRel.position} windFrom={wind?.windDirectionFrom} windSpeed={wind?.windSpeed} />
          </>
        )}

        {isAsh && (
          <>
            <VolcanoCone visible={layers.volcano} position={volcanoRel.position} name={nearestVolcano?.item.name} status={nearestVolcano?.item.status} />
            <AshCloud visible position={volcanoRel.position} windFrom={wind?.windDirectionFrom} windSpeed={wind?.windSpeed} />
          </>
        )}

        <OrbitControls
          ref={controlsRef}
          enablePan
          enableZoom
          enableRotate
          minDistance={5}
          maxDistance={80}
          target={volcanoRel.position}
        />
      </Canvas>

      {panelOpen ? (
        <div className="absolute top-3 right-3 z-10 w-64 max-w-[calc(100%-1.5rem)] max-h-[80vh] overflow-auto rounded-2xl glass-panel p-4 theme-transition sm:w-72">
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

        {(nearestVolcano || nearestEarthquake) && (
          <div className="mb-4 rounded-xl border border-card-border bg-white/5 p-3">
            <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-fg-muted">
              <Info className="h-3.5 w-3.5" /> Data Mitigasi Terdekat
            </label>
            {nearestVolcano && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-fg">
                  {nearestVolcano.item.name}
                </p>
                <p className="text-[10px] text-fg-muted">
                  {nearestVolcano.item.status} · {nearestVolcano.distanceKm.toFixed(1)} km · {cardinalFrom(volcanoRel.bearing)} arah pengguna
                </p>
              </div>
            )}
            {nearestEarthquake && (
              <div>
                <p className="text-xs font-semibold text-fg">
                  Gempa M {nearestEarthquake.item.magnitude ?? "-"}
                </p>
                <p className="text-[10px] text-fg-muted">
                  {nearestEarthquake.item.location || "Tidak diketahui"} · {nearestEarthquake.distanceKm.toFixed(1)} km · {cardinalFrom(earthquakeRel.bearing)}
                </p>
              </div>
            )}
            {nearestVolcano && nearestVolcano.item.level >= 3 && (
              <p className="mt-2 flex items-center gap-1 text-[10px] font-bold text-red-400">
                <AlertTriangle className="h-3 w-3" />
                {ALERT_LEVELS[nearestVolcano.item.level].evacuationCue}
              </p>
            )}
          </div>
        )}

        {wind && (
          <div className="mb-4 rounded-xl border border-card-border bg-white/5 p-3">
            <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-fg-muted">
              <Wind className="h-3.5 w-3.5" /> Data Angin (Open-Meteo)
            </label>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <p className="text-fg-muted">Arah angin</p>
                <p className="font-semibold text-fg">{cardinalFrom(wind.windDirectionFrom)} ({wind.windDirectionFrom}°)</p>
              </div>
              <div>
                <p className="text-fg-muted">Kecepatan</p>
                <p className="font-semibold text-fg">{wind.windSpeed} km/jam</p>
              </div>
              <div className="col-span-2">
                <p className="text-fg-muted">Arah abu vulkanik</p>
                <p className="font-semibold text-fg">{cardinalTo(wind.windDirectionFrom)} ({wind.windDirectionTo}°)</p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4 rounded-xl border border-card-border bg-white/5 p-3">
          <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-fg-muted">
            <MousePointer2 className="h-3.5 w-3.5" /> Cara Menggunakan
          </label>
          <ul className="list-disc space-y-1 pl-4 text-[10px] text-fg-muted">
            <li>Anda berada di titik tengah (0,0). Gunung & gempa ditampilkan sesuai arah dan jarak nyata.</li>
            <li>Sentuh & seret untuk memutar sudut pandang 3D.</li>
            <li>Pinch / scroll untuk zoom in & zoom out.</li>
            <li>Mode Abu mengikuti arah angin real-time dari Open-Meteo.</li>
            <li>Aktifkan/nonaktifkan layer di bawah ini.</li>
          </ul>
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
