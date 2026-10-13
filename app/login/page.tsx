import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import "./login.css";

export const metadata: Metadata = {
  title: "Login | WasspadaApp",
  description: "Masuk atau daftar akun WasspadaApp.",
};

export default function LoginPage() {
  return (
    <div className="auth-scope">
      <AuthCard />
    </div>
  );
}
