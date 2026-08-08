const MODEL = "gpt-5-mini";

function systemPrompt(kb, lead, lang) {
  return `Eres V2 AI, consultor comercial virtual de V2 Studio, Florianópolis, SC.

OBJETIVO
Atender visitantes, entender su negocio, detectar un problema real, recomendar UNA primera solución concreta y convertir la conversación en un próximo paso comercial. No seas un FAQ ni un catálogo.

IDIOMA
Responde en ${lang === "pt" ? "portugués brasileño natural" : "español natural, claro y cercano"}.

ESTILO
- Humano, profesional, consultivo, breve y seguro.
- 1 a 3 frases normalmente.
- UNA sola pregunta por turno.
- No repitas preguntas ya respondidas.
- Vende resultados antes que tecnología.
- Nunca inventes precios, clientes, casos, ROI, integraciones ni plazos.
- Booking, Airbnb, PMS y channel managers dependen de API y permisos de la cuenta.

FLUJO
1 tipo de negocio; 2 problema principal; 3 canales; 4 volumen; 5 quién atiende; 6 herramientas si es relevante; 7 impacto; 8 resumen; 9 una primera solución; 10 objeciones; 11 intención; 12 WhatsApp.

CIERRE
Cuando haya intención real (pide presupuesto/propuesta, pregunta cómo empezar, acepta la recomendación, tiene urgencia o pide humano), marca handoff=true. No presiones.

Devuelve EXCLUSIVAMENTE JSON válido con esta forma:
{
  "reply":"texto breve para el visitante",
  "lead":{
    "company":"",
    "businessType":"",
    "mainPain":"",
    "channels":[],
    "approxVolume":"",
    "currentTools":[],
    "manualTasks":[],
    "expectedResult":"",
    "recommendedFirstAutomation":"",
    "recommendedPackage":"",
    "purchaseIntent":"low|medium|high",
    "nextStep":""
  },
  "handoff":false
}
Solo incluye en lead datos que realmente conozcas o hayas inferido con mucha seguridad de la conversación. recommendedPackage puede ser: pacote_1, pacote_2, pacote_3 o vacío.

BASE DE CONOCIMIENTO V2 STUDIO
${JSON.stringify(kb)}

LEAD ACTUAL
${JSON.stringify(lead)}`;
}

function extractText(data) {
  if (typeof data?.output_text === "string") return data.output_text;
  const out = data?.output || [];
  for (const item of out) {
    for (const c of item?.content || []) {
      if (c?.type === "output_text" && c?.text) return c.text;
    }
  }
  return "";
}

async function callOpenAI(key, body) {
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await r.json().catch(() => ({}));
  return { r, data };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  const key = process.env.OPENAI_API_KEY;

  if (!key) {
    return res.status(503).json({ error: "openai_not_configured", message: "OPENAI_API_KEY is not configured in Vercel." });
  }

  if (req.method === "GET") {
    if (req.query?.test !== "1") {
      return res.status(200).json({ configured: true, model: MODEL, mode: "browser-voice-openai-agent" });
    }
    try {
      const { r, data } = await callOpenAI(key, {
        model: MODEL,
        input: "Reply with exactly: OK",
        max_output_tokens: 20
      });
      const text = extractText(data).trim();
      return res.status(r.ok ? 200 : r.status).json({ configured: true, apiCall: r.ok, model: MODEL, result: r.ok ? text : (data?.error?.message || "OpenAI API error") });
    } catch (e) {
      return res.status(500).json({ configured: true, apiCall: false, error: String(e?.message || e) });
    }
  }

  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  try {
    const { message, history = [], lead = {}, kb = {}, lang = "es" } = req.body || {};
    if (!message || typeof message !== "string") return res.status(400).json({ error: "message_required" });

    const recent = Array.isArray(history) ? history.slice(-12) : [];
    const conversation = recent.map(m => `${m.who === "user" ? "Visitante" : "V2 AI"}: ${String(m.text || "").slice(0,1200)}`).join("\n");
    const input = `${conversation ? conversation + "\n" : ""}Visitante: ${message}`;

    const { r, data } = await callOpenAI(key, {
      model: MODEL,
      instructions: systemPrompt(kb, lead, lang),
      input,
      max_output_tokens: 700
    });

    if (!r.ok) {
      console.error("OpenAI Responses error", r.status, data);
      return res.status(r.status).json({ error: "openai_error", message: data?.error?.message || "OpenAI request failed." });
    }

    const raw = extractText(data).trim();
    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/\s*```$/, ""));
    } catch {
      parsed = { reply: raw || (lang === "pt" ? "Posso te ajudar. Que tipo de negócio você tem?" : "Puedo ayudarte. ¿Qué tipo de negocio tenés?"), lead: {}, handoff: false };
    }

    return res.status(200).json({
      reply: String(parsed.reply || ""),
      lead: parsed.lead && typeof parsed.lead === "object" ? parsed.lead : {},
      handoff: Boolean(parsed.handoff),
      model: MODEL
    });
  } catch (e) {
    console.error("OpenAI agent exception", e);
    return res.status(500).json({ error: "agent_exception", message: String(e?.message || e) });
  }
}
