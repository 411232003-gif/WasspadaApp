"use client";

import { Ref, useEffect, useImperativeHandle, useRef } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "";
export const isCaptchaConfigured = Boolean(SITE_KEY);

export interface CaptchaHandle {
  reset: () => void;
}

interface Grecaptcha {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      theme?: string;
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    }
  ) => number;
  reset: (id: number) => void;
}

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
    onWasspadaCaptchaLoad?: () => void;
  }
}

export function CaptchaBox({
  onChange,
  ref,
}: {
  onChange: (token: string | null) => void;
  ref?: Ref<CaptchaHandle>;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<number | null>(null);
  const cbRef = useRef(onChange);

  useEffect(() => {
    cbRef.current = onChange;
  }, [onChange]);

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (window.grecaptcha && widgetId.current != null) {
        window.grecaptcha.reset(widgetId.current);
      }
      cbRef.current(null);
    },
  }));

  useEffect(() => {
    if (!SITE_KEY) return;
    const render = () => {
      if (!window.grecaptcha || !boxRef.current || widgetId.current != null) {
        return;
      }
      widgetId.current = window.grecaptcha.render(boxRef.current, {
        sitekey: SITE_KEY,
        theme: "light",
        callback: (t) => cbRef.current(t),
        "expired-callback": () => cbRef.current(null),
        "error-callback": () => cbRef.current(null),
      });
    };

    if (window.grecaptcha) {
      render();
      return;
    }
    window.onWasspadaCaptchaLoad = render;
    if (!document.getElementById("recaptcha-api")) {
      const s = document.createElement("script");
      s.id = "recaptcha-api";
      s.src =
        "https://www.google.com/recaptcha/api.js?onload=onWasspadaCaptchaLoad&render=explicit";
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }
  }, []);

  if (!isCaptchaConfigured) return null;

  return (
    <div className="captcha-3d">
      <div ref={boxRef} className="g-recaptcha" />
    </div>
  );
}

export async function verifyCaptcha(token: string): Promise<boolean> {
  try {
    const res = await fetch("/api/verify-captcha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = (await res.json()) as { ok?: boolean };
    return data.ok === true;
  } catch {
    return false;
  }
}
