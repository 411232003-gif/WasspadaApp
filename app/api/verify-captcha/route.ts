export async function POST(req: Request) {
  try {
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (!secret) {
      return Response.json(
        { ok: false, error: "Captcha belum dikonfigurasi di server." },
        { status: 503 }
      );
    }

    const body = (await req.json()) as { token?: unknown };
    if (typeof body.token !== "string" || body.token.length === 0) {
      return Response.json({ ok: false }, { status: 400 });
    }

    const res = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(body.token)}`,
      }
    );
    const data = (await res.json()) as { success?: boolean };
    return Response.json({ ok: data.success === true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
