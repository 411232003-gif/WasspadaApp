import { CSSProperties, ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function GlassCard({ children, className = "", style }: GlassCardProps) {
  return (
    <div
      className={`min-w-0 rounded-2xl glass-panel theme-transition ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
