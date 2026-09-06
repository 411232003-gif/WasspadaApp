"use client";

import { useEffect, useState } from "react";
import { MapPin, ChevronDown } from "lucide-react";
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
    if (!selectedProvince) {
      setRegencies([]);
      return;
    }
    fetchWilayah("regency", selectedProvince.slug).then((res) => {
      setRegencies(res.entities);
      setDistricts([]);
      setVillages([]);
    });
  }, [selectedProvince]);

  useEffect(() => {
    if (!selectedRegency) {
      setDistricts([]);
      return;
    }
    fetchWilayah("district", selectedRegency.slug).then((res) => {
      setDistricts(res.entities);
      setVillages([]);
    });
  }, [selectedRegency]);

  useEffect(() => {
    if (!selectedDistrict) {
      setVillages([]);
      return;
    }
    fetchWilayah("village", selectedDistrict.slug).then((res) => {
      setVillages(res.entities);
    });
  }, [selectedDistrict]);

  const displayName = selectedVillage?.name_local || selectedKelurahan?.name_local || "Pilih Wilayah";

  const handleVillageSelect = (v: RegionEntity | null) => {
    setSelectedVillage(v);
    if (v) {
      setSelectedKelurahan(v);
      addBookmark({
        name: v.name_local,
        lat: v.lat,
        lon: v.lon,
        note: `${v.name_local} - ${v.parent_name_local}`,
      });
      setOpen(false);
    }
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
            onChange={setSelectedProvince}
          />
          <Select
            label={LEVEL_LABELS.regency}
            options={regencies}
            value={selectedRegency}
            onChange={(r) => {
              setSelectedRegency(r);
              setSelectedDistrict(null);
              setSelectedVillage(null);
            }}
          />
          <Select
            label={LEVEL_LABELS.district}
            options={districts}
            value={selectedDistrict}
            onChange={(d) => {
              setSelectedDistrict(d);
              setSelectedVillage(null);
            }}
          />
          <Select
            label={LEVEL_LABELS.village}
            options={villages}
            value={selectedVillage}
            onChange={handleVillageSelect}
          />
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
