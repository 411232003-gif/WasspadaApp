import { redirect } from "next/navigation";

export const metadata = {
  title: "Monev Map | WasspadaApp",
};

export default function ThreeDHazardPage() {
  redirect("/live-map");
}
