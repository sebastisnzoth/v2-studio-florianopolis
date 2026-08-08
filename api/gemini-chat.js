import fs from 'node:fs';
import path from 'node:path';

const MODEL = 'gemini-2.5-flash';

function loadKB(){
  try{return JSON.parse(fs.readFileSync(path.join(process.cwd(),'knowledge-base.json'),'utf8'))}
  catch{return {brand:{name:'V2 Studio'},truth:{unknown_es:'No tengo esa información confirmada.',unknown_pt:'Não tenho essa informação confirmada.'}}}
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  if(req.method==='GET') return res.status(200).json({configured:Boolean(process.env.GEMINI_API_KEY),model:MODEL,mode:'browser-voice-text-ai'});
  if(req.method!=='POST') return res.status(405).json({error:'method_not_allowed'});
  const key=process.env.GEMINI_API_KEY;
  if(!key) return res.status(503).json({error:'gemini_not_configured'});

  const {message='',history=[],lead={},lang='es'}=req.body||{};
  if(!String(message).trim()) return res.status(400).json({error:'empty_message'});
  const kb=loadKB();
  const system=`Eres V2 AI, consultor comercial virtual de V2 Studio. Responde en el idioma del visitante (español o portugués brasileño). Sé humano, breve y consultivo. En voz: 1 a 3 frases y UNA sola pregunta por turno. Diagnostica antes de vender. Flujo orientativo: tipo de negocio -> problema principal -> canales -> volumen -> herramientas solo si hace falta -> impacto -> resumen -> UNA primera solución -> objeciones -> próximo paso. No repitas preguntas ya respondidas. No inventes precios, clientes, casos, ROI ni integraciones. Para Booking/Airbnb/PMS/channel manager, aclara que depende de API y permisos. Modelo comercial: implementación + mensualidad; el precio depende de canales, volumen, integraciones y complejidad. Cuando haya intención real, invita a continuar por WhatsApp. Devuelve además una ficha parcial del lead con solo lo aprendido o inferido con alta confianza. Base oficial: ${JSON.stringify(kb)}`;

  const contents=[];
  for(const m of Array.isArray(history)?history.slice(-12):[]){
    if(!m?.text) continue;
    contents.push({role:m.who==='ai'?'model':'user',parts:[{text:String(m.text).slice(0,1800)}]});
  }
  contents.push({role:'user',parts:[{text:`Idioma preferido: ${lang}. Ficha actual: ${JSON.stringify(lead)}\nMensaje del visitante: ${String(message).slice(0,3000)}`} ]});

  const responseSchema={type:'object',properties:{reply:{type:'string'},lead:{type:'object',properties:{company:{type:'string'},businessType:{type:'string'},mainPain:{type:'string'},channels:{type:'array',items:{type:'string'}},approxVolume:{type:'string'},currentTools:{type:'array',items:{type:'string'}},manualTasks:{type:'array',items:{type:'string'}},expectedResult:{type:'string'},recommendedFirstAutomation:{type:'string'},recommendedPackage:{type:'string'},purchaseIntent:{type:'string'},nextStep:{type:'string'}}},openWhatsapp:{type:'boolean'}},required:['reply','lead','openWhatsapp']};

  try{
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,{
      method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key},
      body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents,generationConfig:{temperature:0.6,responseMimeType:'application/json',responseJsonSchema:responseSchema}})
    });
    const data=await r.json();
    if(!r.ok){console.error('Gemini generateContent error',r.status,data);return res.status(r.status).json({error:'gemini_error',message:data?.error?.message||'Gemini request failed'})}
    const raw=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
    let parsed;try{parsed=JSON.parse(raw)}catch{parsed={reply:raw|| (lang==='pt'?'Não consegui responder agora.':'No pude responder ahora.'),lead:{},openWhatsapp:false}}
    return res.status(200).json(parsed);
  }catch(e){console.error(e);return res.status(500).json({error:'server_error',message:String(e?.message||e)})}
}
