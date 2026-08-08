const MODEL = "gemini-3.1-flash-live-preview";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  const key = process.env.GEMINI_API_KEY;

  if (req.method === "GET") {
    return res.status(200).json({
      configured: Boolean(key),
      model: MODEL,
      mode: "ephemeral-token"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  if (!key) {
    return res.status(503).json({
      error: "gemini_not_configured",
      message: "GEMINI_API_KEY is not configured in Vercel."
    });
  }

  try {
    const now = Date.now();
    const expireTime = new Date(now + 30 * 60 * 1000).toISOString();
    const newSessionExpireTime = new Date(now + 60 * 1000).toISOString();

    const body = {
      uses: 1,
      expireTime,
      newSessionExpireTime,
      liveConnectConstraints: {
        model: `models/${MODEL}`,
        config: {
          sessionResumption: {},
          responseModalities: ["AUDIO"]
        }
      }
    };

    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/auth_tokens",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": key,
          "content-type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );

    const data = await r.json().catch(() => ({}));

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
      expires: expireTime
    });
  } catch (e) {
    console.error("Gemini token exception", e);
    return res.status(500).json({
      error: "token_exception",
      message: String(e?.message || e)
    });
  }
}
