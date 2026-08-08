const MODEL = "gemini-3.1-flash-live-preview";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    return res.status(503).json({
      error: "gemini_not_configured",
      message: "GEMINI_API_KEY is not configured in Vercel."
    });
  }

  async function createToken() {
    const now = Date.now();
    const authToken = {
      uses: 1,
      expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
      newSessionExpireTime: new Date(now + 60 * 1000).toISOString()
    };

    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/auth_tokens",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": key,
          "content-type": "application/json"
        },
        body: JSON.stringify({ authToken })
      }
    );

    const data = await r.json().catch(() => ({}));
    return { r, data, authToken };
  }

  if (req.method === "GET") {
    if (req.query?.test !== "1") {
      return res.status(200).json({ configured: true, model: MODEL, mode: "ephemeral-token" });
    }
    try {
      const { r, data } = await createToken();
      if (!r.ok || !data.name) {
        return res.status(r.status || 502).json({
          configured: true,
          tokenCreation: false,
          status: r.status,
          error: data?.error?.message || "Could not create Gemini Live token."
        });
      }
      return res.status(200).json({ configured: true, tokenCreation: true, model: MODEL, mode: "ephemeral-token" });
    } catch (e) {
      return res.status(500).json({ configured: true, tokenCreation: false, error: String(e?.message || e) });
    }
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const { r, data, authToken } = await createToken();
    if (!r.ok || !data.name) {
      console.error("Gemini token provisioning failed", r.status, data);
      return res.status(r.status || 502).json({
        error: "gemini_token_error",
        message: data?.error?.message || "Could not create Gemini Live token."
      });
    }

    return res.status(200).json({
      token: data.name,
      model: MODEL,
      expires: authToken.expireTime
    });
  } catch (e) {
    console.error("Gemini token exception", e);
    return res.status(500).json({
      error: "token_exception",
      message: String(e?.message || e)
    });
  }
}
