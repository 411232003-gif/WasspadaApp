"use client";

import { pushAlert, AlertType, AlertInput } from "./firestore";

const LOCATIONS = [
  "Barat Laut",
  "Barat Daya",
  "Timur Laut",
  "Tenggara",
  "Utara",
  "Selatan",
];

const VOLCANO_STATUSES = ["Normal", "Waspada", "Siaga", "Awas"] as const;
const VOLCANO_NAMES = [
  "Gunung Merapi",
  "Gunung Krakatau",
  "Gunung Tangkuban Perahu",
  "Gunung Sinabung",
];

function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomFloat(min: number, max: number) {
  return Number((Math.random() * (max - min) + min).toFixed(1));
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function levelFromEarthquake(magnitude: number): 1 | 2 | 3 | 4 {
  if (magnitude >= 6.0) return 4;
  if (magnitude >= 5.5) return 3;
  if (magnitude >= 5.0) return 2;
  return 1;
}

function levelFromVolcano(status: string): 1 | 2 | 3 | 4 {
  switch (status) {
    case "Awas":
      return 4;
    case "Siaga":
      return 3;
    case "Waspada":
      return 2;
    default:
      return 1;
  }
}

export function generateMockAlert(): AlertInput {
  const type: AlertType = Math.random() > 0.4 ? "earthquake" : "volcano";

  if (type === "earthquake") {
    const magnitude = randomFloat(3.0, 6.8);
    const depth = randomInt(5, 150);
    const distance = randomInt(10, 80);
    const location = `${distance} km ${randomItem(LOCATIONS)}`;
    const tsunami = magnitude >= 6.5 ? "Berpotensi tsunami" : "Tidak berpotensi tsunami";
    const level = levelFromEarthquake(magnitude);

    return {
      type,
      title: `Gempa Bumi M ${magnitude}`,
      description: `Gempa terdeteksi ${location} dengan kedalaman ${depth} km. ${tsunami}.`,
      level,
      magnitude,
      depth,
      location,
      tsunamiPotential: tsunami,
    };
  }

  const status = randomItem(VOLCANO_STATUSES);
  const level = levelFromVolcano(status);
  const name = randomItem(VOLCANO_NAMES);

  return {
    type,
    title: `${name} - ${status}`,
    description: `Status aktivitas vulkanik ${name} saat ini ${status}. Warga diimbau tetap waspada dan pantau informasi resmi.`,
    level,
    volcanoStatus: status,
  };
}

export async function pushRandomAlert(): Promise<string> {
  const alert = generateMockAlert();
  return pushAlert(alert);
}
