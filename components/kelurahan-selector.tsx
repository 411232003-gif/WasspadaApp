"use client";

import { useEffect, useState } from "react";
import { MapPin, ChevronDown, Crosshair } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { fetchWilayah, RegionEntity } from "@/lib/live-api";
import { useAlert } from "@/lib/alert-context";
import { addBookmark } from "@/lib/firestore";

type Level = "province" | "regency" | "district" | "village";

const LEVEL_LABELS: Record<Level, string> = {
  province: "Provinsi",
  regency: "Kabupaten/Kota",
  district: "Kecamatan",
  village: "Kelurahan/Desa",
};

export function KelurahanSelector() {
  const { selectedKelurahan, setSelectedKelurahan } = useAlert();
  const [open, setOpen] = useState(false);
  const [provinces, setProvinces] = useState<RegionEntity[]>([]);
  const [regencies, setRegencies] = useState<RegionEntity[]>([]);
  const [districts, setDistricts] = useState<RegionEntity[]>([]);
  const [villages, setVillages] = useState<RegionEntity[]>([]);

  const [selectedProvince, setSelectedProvince] = useState<RegionEntity | null>(null);
  const [selectedRegency, setSelectedRegency] = useState<RegionEntity | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<RegionEntity | null>(null);
  const [selectedVillage, setSelectedVillage] = useState<RegionEntity | null>(
    selectedKelurahan
  );

  useEffect(() => {
    fetchWilayah("province").then((res) => {
      setProvinces(res.entities);
    });
  }, []);

  useEffect(() => {
    if (!selectedProvince) return;
    fetchWilayah("regency", selectedProvince.slug).then((res) => {
      setRegencies(res.entities);
    });
  }, [selectedProvince]);

  useEffect(() => {
    if (!selectedRegency) return;
    fetchWilayah("district", selectedRegency.slug).then((res) => {
      setDistricts(res.entities);
    });
  }, [selectedRegency]);

  useEffect(() => {
    if (!selectedDistrict) return;
    fetchWilayah("village", selectedDistrict.slug).then((res) => {
      setVillages(res.entities);
    });
  }, [selectedDistrict]);

  const displayName = selectedVillage?.name_local || selectedKelurahan?.name_local || "Pilih Wilayah";

  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const handleVillageSelect = (v: RegionEntity | null) => {
    setSelectedVillage(v);
    if (v) {
      setSelectedKelurahan(v);
      addBookmark({
        name: v.name_local,
        lat: v.lat,
        lon: v.lon,
        note: `${v.name_local} - ${v.parent_name_local || ""}`,
      }).catch(() => {});
      setOpen(false);
    }
  };

  const handleProvinceChange = (p: RegionEntity | null) => {
    setSelectedProvince(p);
    setSelectedRegency(null);
    setSelectedDistrict(null);
    setSelectedVillage(null);
    setDistricts([]);
    setVillages([]);
    if (!p) setRegencies([]);
  };

  const handleRegencyChange = (r: RegionEntity | null) => {
    setSelectedRegency(r);
    setSelectedDistrict(null);
    setSelectedVillage(null);
    setVillages([]);
    if (!r) setDistricts([]);
  };

  const handleDistrictChange = (d: RegionEntity | null) => {
    setSelectedDistrict(d);
    setSelectedVillage(null);
    if (!d) setVillages([]);
  };

  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("Geolocation tidak didukung di perangkat ini.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const entity: RegionEntity = {
          id: `my-location-${Date.now()}`,
          name_local: "Lokasi Saya",
          name_en: "My Location",
          slug: "my-location",
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        };
        setSelectedProvince(null);
        setSelectedRegency(null);
        setSelectedDistrict(null);
        setRegencies([]);
        setDistricts([]);
        setVillages([]);
        setSelectedVillage(entity);
        setSelectedKelurahan(entity);
        addBookmark({
          name: entity.name_local,
          lat: entity.lat,
          lon: entity.lon,
          note: "Lokasi dari GPS perangkat",
        }).catch(() => {});
        setLocating(false);
        setOpen(false);
      },
      () => {
        setLocating(false);
        setLocationError("Gagal mengambil lokasi. Pastikan izin lokasi aktif.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="relative z-50">
      <button
        onClick={() => setOpen((prev) => !prev)}
        type="button"
        className="flex items-center gap-2 rounded-xl px-3 py-2 glass-panel theme-transition min-w-[180px] max-w-[260px]"
      >
        <MapPin className="h-4 w-4 text-accent" />
        <span className="flex-1 truncate text-left text-sm font-medium text-fg">
          {displayName}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-fg-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <GlassCard className="absolute top-full right-0 mt-2 w-[300px] p-4 space-y-3">
          <Select
            label={LEVEL_LABELS.province}
            options={provinces}
            value={selectedProvince}
            onChange={handleProvinceChange}
          />
          <Select
            label={LEVEL_LABELS.regency}
            options={regencies}
            value={selectedRegency}
            onChange={handleRegencyChange}
          />
          <Select
            label={LEVEL_LABELS.district}
            options={districts}
            value={selectedDistrict}
            onChange={handleDistrictChange}
          />
          <Select
            label={LEVEL_LABELS.village}
            options={villages}
            value={selectedVillage}
            onChange={handleVillageSelect}
          />

          <div className="border-t border-card-border pt-3">
            <button
              onClick={useMyLocation}
              disabled={locating}
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent/10 px-3 py-2 text-sm font-medium text-accent hover:bg-accent/20 disabled:opacity-60"
            >
              <Crosshair className={`h-4 w-4 ${locating ? "animate-spin" : ""}`} />
              {locating ? "Mencari lokasi..." : "Gunakan Lokasi Saya"}
            </button>
            {locationError && (
              <p className="mt-2 text-center text-xs text-red-400">{locationError}</p>
            )}
          </div>
        </GlassCard>
      )}
    </div>
  );
}

function Select({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: RegionEntity[];
  value: RegionEntity | null;
  onChange: (entity: RegionEntity | null) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold uppercase text-fg-muted">
        {label}
      </label>
      <select
        value={value?.id || ""}
        onChange={(e) => {
          const safeOptions = options || [];
          const selected = safeOptions.find((o) => o.id === e.target.value) || null;
          onChange(selected);
        }}
        className="w-full rounded-lg border border-card-border bg-card/50 px-3 py-2 text-sm text-fg outline-none focus:border-accent"
      >
        <option value="">-</option>
        {(options || []).map((o) => (
          <option key={o.id} value={o.id}>
            {o.name_local}
          </option>
        ))}
      </select>
    </div>
  );
}
