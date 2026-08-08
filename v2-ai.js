const $=(s,r=document)=>r.querySelector(s);
const WA='5548996752532';
const MODEL='gemini-3.1-flash-live-preview';
const state={
  lang: document.documentElement.lang?.toLowerCase().startsWith('pt') ? 'pt' : 'es',
  connected:false,
  ready:false,
  lead:{company:'',businessType:'',mainPain:'',channels:[],approxVolume:'',currentTools:[],manualTasks:[],expectedResult:'',recommendedFirstAutomation:'',recommendedPackage:'',purchaseIntent:'low',nextStep:''},
  messages:[]
};
let kb={};
try{kb=await fetch('/knowledge-base.json',{cache:'no-store'}).then(r=>r.json())}catch(e){console.warn('V2 AI knowledge base unavailable',e)}

const copy={
  es:{badge:'Conversá con V2 AI',title:'V2 AI · Consultor Comercial',ready:'Listo para conversar',connecting:'Conectando con Gemini…',live:'Escuchando · podés interrumpirme',speaking:'V2 AI está hablando…',start:'Iniciar conversación',stop:'Terminar',placeholder:'Escribí o hablá…',welcome:'¡Hola! Soy V2 AI, el consultor comercial de V2 Studio. Puedo entender cómo funciona tu negocio y mostrarte dónde podríamos ayudarte. ¿Qué tipo de negocio tenés?',lead:'Diagnóstico en vivo',wa:'Continuar por WhatsApp',kb:'Base de conocimiento V2 Studio',hint:'Gemini Live · voz en tiempo real · PT/ES',micDenied:'Necesito permiso del micrófono para conversar por voz. También podés escribir acá abajo.',connectError:'No pude conectar con Gemini Live. Probá nuevamente en unos segundos.'},
  pt:{badge:'Converse com a V2 AI',title:'V2 AI · Consultor Comercial',ready:'Pronto para conversar',connecting:'Conectando ao Gemini…',live:'Ouvindo · você pode me interromper',speaking:'V2 AI está falando…',start:'Iniciar conversa',stop:'Encerrar',placeholder:'Escreva ou fale…',welcome:'Olá! Eu sou a V2 AI, consultor comercial da V2 Studio. Posso entender como seu negócio funciona e mostrar onde podemos ajudar. Que tipo de negócio você tem?',lead:'Diagnóstico ao vivo',wa:'Continuar no WhatsApp',kb:'Base de conhecimento V2 Studio',hint:'Gemini Live · voz em tempo real · PT/ES',micDenied:'Preciso da permissão do microfone para conversar por voz. Você também pode escrever aqui embaixo.',connectError:'Não consegui conectar ao Gemini Live. Tente novamente em alguns segundos.'}
};
const t=()=>copy[state.lang];

const root=document.createElement('div');
root.id='v2ai-root';
root.innerHTML=`
<div class="v2ai-launch">
  <button class="v2ai-orb" aria-label="V2 AI"><span class="v2ai-core"></span></button>
  <div class="v2ai-badge"><b>V2 AI</b><span>${t().badge}</span></div>
</div>
<section class="v2ai-panel" aria-label="V2 AI">
  <header class="v2ai-head">
    <div class="v2ai-mini"></div>
    <div><strong>${t().title}</strong><small><i>●</i> <span class="v2ai-status">${t().ready}</span></small></div>
    <button class="v2ai-close" aria-label="Cerrar">×</button>
  </header>
  <div class="v2ai-grid">
    <div class="v2ai-main">
      <div class="v2ai-stage">
        <button class="v2ai-bigorb" aria-label="Iniciar voz"><span class="v2ai-stage-core"></span></button>
        <button class="v2ai-call">🎙 ${t().start}</button>
        <small>${t().hint}</small>
      </div>
      <div class="v2ai-messages"></div>
      <div class="v2ai-compose"><input class="v2ai-input" placeholder="${t().placeholder}" autocomplete="off"><button class="v2ai-send">➜</button></div>
    </div>
    <aside class="v2ai-side">
      <div class="v2ai-side-title"><span>${t().lead}</span><em>LIVE</em></div>
      <div class="v2ai-lead"></div>
      <button class="v2ai-wa" hidden>${t().wa}</button>
      <button class="v2ai-kb-btn">${t().kb}</button>
    </aside>
  </div>
</section>`;
document.body.appendChild(root);

const panel=$('.v2ai-panel',root),orb=$('.v2ai-orb',root),bigOrb=$('.v2ai-bigorb',root),call=$('.v2ai-call',root),statusEl=$('.v2ai-status',root),msgs=$('.v2ai-messages',root),input=$('.v2ai-input',root),send=$('.v2ai-send',root),leadBox=$('.v2ai-lead',root),waBtn=$('.v2ai-wa',root),closeBtn=$('.v2ai-close',root),kbBtn=$('.v2ai-kb-btn',root);

let ws=null,micStream=null,micCtx=null,processor=null,source=null,outCtx=null,audioSources=new Set(),nextAudioTime=0,outputTranscript='',inputTranscript='',startedGreeting=false;

function syncLang(){
  const next=document.documentElement.lang?.toLowerCase().startsWith('pt')?'pt':'es';
  if(next===state.lang)return;
  state.lang=next;
  input.placeholder=t().placeholder;
  call.textContent=(state.connected?'■ ':'🎙 ')+(state.connected?t().stop:t().start);
  waBtn.textContent=t().wa;
  kbBtn.textContent=t().kb;
  renderLead();
}
setInterval(syncLang,800);

function setStatus(s){statusEl.textContent=s}
function addMessage(text,who='ai'){
  if(!text)return;
  state.messages.push({who,text});
  const d=document.createElement('div');
  d.className='v2ai-msg '+who;
  d.textContent=text;
  msgs.appendChild(d);
  msgs.scrollTop=msgs.scrollHeight;
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function packageLabel(v){return v==='pacote_1'?'Presença & Atendimento':v==='pacote_2'?'Business Automation':v==='pacote_3'?'Ecossistema Digital & IA':''}
function intentLabel(v){return state.lang==='pt'?({low:'Baixa',medium:'Média',high:'Alta'}[v]||v):({low:'Baja',medium:'Media',high:'Alta'}[v]||v)}
function renderLead(){
  const L=state.lead;
  const empty=state.lang==='pt'?'Ainda coletando informações…':'Todavía recopilando información…';
  const rows=[
    [state.lang==='pt'?'Negócio':'Negocio',L.businessType||L.company],
    [state.lang==='pt'?'Dor principal':'Problema principal',L.mainPain],
    [state.lang==='pt'?'Canais':'Canales',(L.channels||[]).join(', ')],
    [state.lang==='pt'?'Volume':'Volumen',L.approxVolume],
    [state.lang==='pt'?'Ferramentas':'Herramientas',(L.currentTools||[]).join(', ')],
    [state.lang==='pt'?'1ª automação':'1ª automatización',L.recommendedFirstAutomation],
    [state.lang==='pt'?'Pacote':'Paquete',packageLabel(L.recommendedPackage)],
    [state.lang==='pt'?'Intenção':'Intención',intentLabel(L.purchaseIntent)]
  ].filter(x=>x[1]);
  leadBox.innerHTML=rows.length?rows.map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join(''):`<p>${empty}</p>`;
  if(L.purchaseIntent==='high'||L.nextStep==='whatsapp')waBtn.hidden=false;
}
function mergeLead(args={}){
  for(const k of Object.keys(state.lead)){
    const v=args[k];
    if(v===undefined||v===null||v==='')continue;
    if(Array.isArray(v)){
      if(v.length)state.lead[k]=[...new Set([...(state.lead[k]||[]),...v])];
    }else state.lead[k]=v;
  }
  renderLead();
  try{sessionStorage.setItem('v2ai-lead',JSON.stringify(state.lead))}catch{}
}
try{const saved=JSON.parse(sessionStorage.getItem('v2ai-lead')||'null');if(saved)state.lead={...state.lead,...saved}}catch{}
renderLead();

function systemPrompt(){return `# V2 AI — CONSULTOR COMERCIAL POR VOZ

IDENTIDADE
Você é V2 AI, consultor comercial virtual da V2 Studio, Florianópolis, Santa Catarina. Converse como um consultor humano: entenda o negócio, detecte um problema real, recomende UMA primeira solução e gere um próximo passo concreto. Não aja como FAQ nem catálogo.

IDIOMA
Detecte o idioma do visitante. Português -> português brasileiro natural. Espanhol -> espanhol natural rioplatense/neutro.

ESTILO DE VOZ
Humano, profissional, próximo, seguro, claro, consultivo e breve. Normalmente 1 a 3 frases. Faça SOMENTE UMA pergunta por turno. Não leia listas. Permita interrupções.

PRINCÍPIO COMERCIAL
Não vendemos tecnologia por tecnologia. Identificamos onde a empresa perde tempo, clientes ou dinheiro e propomos uma solução simples para corrigir isso. Fale de resultado antes de tecnologia.

ORDEM CONVERSACIONAL
1 tipo de negócio; 2 principal problema; 3 canais; 4 volume; 5 quem atende; 6 ferramentas apenas se relevante; 7 impacto; 8 resumo; 9 UMA primeira solução pequena; 10 objeções; 11 intenção de compra; 12 WhatsApp. Pule o que já foi respondido.

PREÇOS
Nunca invente preço. Modelo: implantação + mensalidade de suporte/manutenção/melhorias; depende de canais, volume, integrações e complexidade.

INTEGRAÇÕES
Para Booking, Airbnb, PMS ou channel manager: integrações dependem da disponibilidade da API e das permissões da conta. Nunca prometa antes de validar.

CLOSER
Use: problema confirmado -> impacto -> solução pequena -> próximo passo concreto. Nunca pressione, nunca use escassez falsa e nunca invente case, cliente, estatística ou ROI.

FERRAMENTAS
Sempre que aprender dados comerciais do lead, chame update_lead silenciosamente. Quando o lead pedir contato humano, proposta, orçamento, como começar, demonstrar alta intenção ou aceitar a recomendação, chame open_whatsapp. Depois continue a conversa naturalmente.

BASE DE CONHECIMENTO OFICIAL
${JSON.stringify(kb)}

LEAD ATUAL
${JSON.stringify(state.lead)}`}

const tools=[{functionDeclarations:[
  {name:'update_lead',description:'Atualiza a ficha comercial do lead quando novas informações forem aprendidas.',parameters:{type:'OBJECT',properties:{company:{type:'STRING'},businessType:{type:'STRING'},mainPain:{type:'STRING'},channels:{type:'ARRAY',items:{type:'STRING'}},approxVolume:{type:'STRING'},currentTools:{type:'ARRAY',items:{type:'STRING'}},manualTasks:{type:'ARRAY',items:{type:'STRING'}},expectedResult:{type:'STRING'},recommendedFirstAutomation:{type:'STRING'},recommendedPackage:{type:'STRING',description:'pacote_1, pacote_2 ou pacote_3'},purchaseIntent:{type:'STRING',description:'low, medium ou high'},nextStep:{type:'STRING'}}}},
  {name:'open_whatsapp',description:'Solicita handoff para a equipe humana da V2 Studio pelo WhatsApp quando houver intenção real ou pedido explícito.',parameters:{type:'OBJECT',properties:{reason:{type:'STRING'},summary:{type:'STRING'}}}}
]}];

function bytesToB64(int16){
  const u=new Uint8Array(int16.buffer,int16.byteOffset,int16.byteLength);
  let s='';
  for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode(...u.subarray(i,i+32768));
  return btoa(s);
}
function b64ToInt16(s){
  const bin=atob(s),u=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
  return new Int16Array(u.buffer);
}
function downsample(input,srcRate,target=16000){
  if(srcRate===target){
    const out=new Int16Array(input.length);
    for(let i=0;i<input.length;i++){const v=Math.max(-1,Math.min(1,input[i]));out[i]=v<0?v*32768:v*32767}
    return out;
  }
  const ratio=srcRate/target,len=Math.max(1,Math.floor(input.length/ratio)),out=new Int16Array(len);
  for(let i=0;i<len;i++){
    const a=Math.floor(i*ratio),b=Math.min(input.length,Math.floor((i+1)*ratio));
    let sum=0,n=0;
    for(let j=a;j<b;j++){sum+=input[j];n++}
    const v=Math.max(-1,Math.min(1,n?sum/n:0));
    out[i]=v<0?v*32768:v*32767;
  }
  return out;
}
async function playAudio(b64){
  if(!outCtx)outCtx=new AudioContext({sampleRate:24000});
  if(outCtx.state==='suspended')await outCtx.resume();
  const pcm=b64ToInt16(b64),buffer=outCtx.createBuffer(1,pcm.length,24000),ch=buffer.getChannelData(0);
  for(let i=0;i<pcm.length;i++)ch[i]=pcm[i]/32768;
  const n=outCtx.createBufferSource();
  n.buffer=buffer;n.connect(outCtx.destination);audioSources.add(n);
  nextAudioTime=Math.max(nextAudioTime,outCtx.currentTime+.015);
  n.start(nextAudioTime);nextAudioTime+=buffer.duration;
  n.onended=()=>{audioSources.delete(n);if(!audioSources.size){orb.classList.remove('speaking');bigOrb.classList.remove('speaking');if(state.connected)setStatus(t().live)}};
  orb.classList.add('speaking');bigOrb.classList.add('speaking');setStatus(t().speaking);
}
function clearAudio(){
  for(const s of audioSources){try{s.stop()}catch{}}
  audioSources.clear();
  nextAudioTime=outCtx?.currentTime||0;
  orb.classList.remove('speaking');bigOrb.classList.remove('speaking');
}

async function startMic(){
  try{
    micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
  }catch(e){
    addMessage(t().micDenied,'ai');
    setStatus(t().ready);
    return false;
  }
  micCtx=new AudioContext();
  await micCtx.resume();
  source=micCtx.createMediaStreamSource(micStream);
  processor=micCtx.createScriptProcessor(2048,1,1);
  processor.onaudioprocess=e=>{
    if(!state.ready||!ws||ws.readyState!==WebSocket.OPEN)return;
    const pcm=downsample(e.inputBuffer.getChannelData(0),micCtx.sampleRate,16000);
    ws.send(JSON.stringify({realtimeInput:{audio:{data:bytesToB64(pcm),mimeType:'audio/pcm;rate=16000'}}}));
  };
  source.connect(processor);processor.connect(micCtx.destination);
  orb.classList.add('listening');bigOrb.classList.add('listening');setStatus(t().live);
  return true;
}
function stopMic(){
  if(processor){try{processor.disconnect()}catch{}processor=null}
  if(source){try{source.disconnect()}catch{}source=null}
  if(micStream){micStream.getTracks().forEach(x=>x.stop());micStream=null}
  if(micCtx){micCtx.close().catch(()=>{});micCtx=null}
  orb.classList.remove('listening');bigOrb.classList.remove('listening');
}

async function connect(){
  if(state.connected)return;
  panel.classList.add('open');
  call.disabled=true;
  setStatus(t().connecting);
  try{
    const r=await fetch('/api/gemini-token',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
    const d=await r.json();
    if(!r.ok||!d.token)throw new Error(d.message||d.error||'No Gemini token');
    const url=`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(d.token)}`;
    ws=new WebSocket(url);
    ws.onopen=()=>{
      const setup={
        setup:{
          model:`models/${d.model||MODEL}`,
          generationConfig:{
            temperature:0.7,
            responseModalities:['AUDIO'],
            speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:'Puck'}}}
          },
          systemInstruction:{parts:[{text:systemPrompt()}]},
          tools,
          inputAudioTranscription:{},
          outputAudioTranscription:{},
          sessionResumption:{}
        }
      };
      ws.send(JSON.stringify(setup));
    };
    ws.onmessage=onMessage;
    ws.onerror=()=>fail(t().connectError);
    ws.onclose=e=>{
      console.warn('Gemini Live closed',e.code,e.reason);
      if(state.connected){
        addMessage(state.lang==='pt'?'A conversa foi desconectada. Toque em iniciar para continuar.':'La conversación se desconectó. Tocá iniciar para continuar.','ai');
        disconnect(false);
      }
    };
  }catch(e){
    console.error('V2 AI connect error',e);
    fail(t().connectError);
  }finally{call.disabled=false}
}

async function onMessage(ev){
  let m;
  try{m=JSON.parse(ev.data)}catch{return}
  if(m.setupComplete){
    state.connected=state.ready=true;
    root.classList.add('connected');
    call.textContent='■ '+t().stop;
    await startMic();
    setStatus(t().live);
    if(!startedGreeting){startedGreeting=true;sendText(t().welcome,false)}
    return;
  }
  if(m.toolCall)handleToolCall(m.toolCall);
  const sc=m.serverContent;
  if(!sc)return;
  if(sc.interrupted){clearAudio();setStatus(t().live)}
  if(sc.inputTranscription?.text)inputTranscript+=sc.inputTranscription.text;
  if(sc.outputTranscription?.text)outputTranscript+=sc.outputTranscription.text;
  if(sc.modelTurn?.parts){for(const p of sc.modelTurn.parts){if(p.inlineData?.data)await playAudio(p.inlineData.data)}}
  if(sc.turnComplete){
    const user=inputTranscript.trim(),assistant=outputTranscript.trim();
    if(user)addMessage(user,'user');
    if(assistant)addMessage(assistant,'ai');
    inputTranscript='';outputTranscript='';
    if(state.connected)setStatus(t().live);
  }
}

function handleToolCall(toolCall){
  const functionResponses=[];
  for(const fc of toolCall.functionCalls||[]){
    let result={ok:true};
    try{
      if(fc.name==='update_lead'){
        mergeLead(fc.args||{});
        if((fc.args||{}).purchaseIntent==='high')waBtn.hidden=false;
        result={ok:true,lead:state.lead};
      }else if(fc.name==='open_whatsapp'){
        state.lead.nextStep='whatsapp';
        if(!state.lead.purchaseIntent||state.lead.purchaseIntent==='low')state.lead.purchaseIntent='high';
        mergeLead(state.lead);
        waBtn.hidden=false;
        result={ok:true,action:'whatsapp_ready'};
      }else result={ok:false,error:'unknown_tool'};
    }catch(e){result={ok:false,error:String(e?.message||e)}}
    functionResponses.push({name:fc.name,id:fc.id,response:{result}});
  }
  if(ws?.readyState===WebSocket.OPEN&&functionResponses.length){
    ws.send(JSON.stringify({toolResponse:{functionResponses}}));
  }
}

function disconnect(closeSocket=true){
  state.connected=state.ready=false;
  root.classList.remove('connected');
  stopMic();clearAudio();
  call.textContent='🎙 '+t().start;
  setStatus(t().ready);
  if(closeSocket&&ws){try{ws.close(1000,'user_end')}catch{}}
  ws=null;
}
function fail(message){
  addMessage(message,'ai');
  disconnect();
}
function sendText(text,showUser=true){
  text=(text||'').trim();
  if(!text)return;
  if(showUser)addMessage(text,'user');
  input.value='';
  if(ws?.readyState===WebSocket.OPEN&&state.ready){
    ws.send(JSON.stringify({realtimeInput:{text}}));
  }else{
    addMessage(state.lang==='pt'?'Inicie a conversa para conectar com o Gemini.':'Iniciá la conversación para conectar con Gemini.','ai');
  }
}
function whatsappUrl(){
  const L=state.lead;
  const intro=state.lang==='pt'?'Olá! Conversei com a V2 AI no site e quero continuar o diagnóstico.':'Hola! Hablé con V2 AI en el sitio y quiero continuar el diagnóstico.';
  const details=[
    L.company&&`Empresa: ${L.company}`,
    L.businessType&&`${state.lang==='pt'?'Segmento':'Rubro'}: ${L.businessType}`,
    L.mainPain&&`${state.lang==='pt'?'Dor':'Problema'}: ${L.mainPain}`,
    L.channels?.length&&`${state.lang==='pt'?'Canais':'Canales'}: ${L.channels.join(', ')}`,
    L.approxVolume&&`${state.lang==='pt'?'Volume':'Volumen'}: ${L.approxVolume}`,
    L.recommendedFirstAutomation&&`${state.lang==='pt'?'Automação sugerida':'Automatización sugerida'}: ${L.recommendedFirstAutomation}`
  ].filter(Boolean).join('\n');
  return `https://wa.me/${WA}?text=${encodeURIComponent(intro+(details?'\n\n'+details:''))}`;
}

orb.onclick=()=>panel.classList.toggle('open');
bigOrb.onclick=()=>state.connected?disconnect():connect();
call.onclick=()=>state.connected?disconnect():connect();
closeBtn.onclick=()=>{panel.classList.remove('open');disconnect()};
send.onclick=()=>sendText(input.value);
input.addEventListener('keydown',e=>{if(e.key==='Enter')sendText(input.value)});
waBtn.onclick=()=>window.open(whatsappUrl(),'_blank','noopener');
kbBtn.onclick=()=>{
  const text=state.lang==='pt'
    ?'A V2 AI usa a base comercial oficial da V2 Studio: serviços, nichos, pacotes, objeções, regras de integração e fluxo de diagnóstico.'
    :'V2 AI usa la base comercial oficial de V2 Studio: servicios, nichos, paquetes, objeciones, reglas de integración y flujo de diagnóstico.';
  addMessage(text,'ai');
};
window.addEventListener('beforeunload',()=>disconnect());
