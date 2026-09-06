"use client";

import { MapPin, ChevronDown } from "lucide-react";
import { useState } from "react";

const KELURAHAN_LIST = [
  "Cilincing",
  "Tanjung Priok",
  "Kelapa Gading",
  "Pademangan",
  "Penjaringan",
  "Pluit",
  "Cengkareng",
  "Grogol Petamburan",
];

export function KelurahanSelector() {
  const [selected, setSelected] = useState(KELURAHAN_LIST[0]);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        type="button"
        className="flex items-center gap-2 rounded-xl px-3 py-2 glass-panel theme-transition min-w-[180px]"
      >
        <MapPin className="h-4 w-4 text-accent" />
        <span className="flex-1 text-left text-sm font-medium text-fg">
          {selected}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-fg-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-2 w-full min-w-[200px] rounded-xl glass-panel overflow-hidden py-1">
          {KELURAHAN_LIST.map((kel) => (
            <button
              key={kel}
              onClick={() => {
                setSelected(kel);
                setOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-white/5 ${
                kel === selected ? "text-accent font-semibold" : "text-fg"
              }`}
            >
              {kel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
