# V2 Studio — Gemini Live Sales Orb

Landing V2 Studio con un orbe conversacional por voz usando Gemini Live API.

## Activación
1. Configurar `GEMINI_API_KEY` en el proyecto de Vercel.
2. Hacer un nuevo deployment.
3. Abrir la home y pulsar **Conversar con V2 AI**.

La API key no se envía al navegador. El endpoint `/api/gemini-token` crea un token efímero de corta duración para Gemini Live.

La base comercial está en `knowledge-base.json`. El flujo de venta diagnostica, califica, recomienda un primer paso y deriva a WhatsApp cuando detecta intención real.
