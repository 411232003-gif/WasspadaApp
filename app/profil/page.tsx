import type { Metadata } from "next";
import { ProfileForm } from "@/components/profile/profile-form";

export const metadata: Metadata = {
  title: "Profil | WasspadaApp",
  description: "Atur nama, tanggal lahir, dan foto profil kamu.",
};

export default function ProfilPage() {
  return (
    <div className="mx-auto max-w-2xl py-4">
      <h1 className="mb-1 text-2xl font-bold text-fg">Profil Saya</h1>
      <p className="mb-6 text-sm text-fg-muted">
        Data ini tampil sebagai identitas kamu di Chat Publik.
      </p>
      <ProfileForm />
    </div>
  );
}
