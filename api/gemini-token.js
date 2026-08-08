export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"method_not_allowed"});
  const key=process.env.GEMINI_API_KEY;
  if(!key) return res.status(503).json({error:"gemini_not_configured",message:"Configure GEMINI_API_KEY in Vercel."});
  try{
    const now=Date.now();
    const payload={uses:1,expireTime:new Date(now+30*60*1000).toISOString(),newSessionExpireTime:new Date(now+60*1000).toISOString()};
    const r=await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens",{method:"POST",headers:{"x-goog-api-key":key,"content-type":"application/json"},body:JSON.stringify(payload)});
    const data=await r.json();
    if(!r.ok) return res.status(r.status).json({error:"gemini_token_error",detail:data});
    return res.status(200).json({token:data.name,model:"gemini-3.1-flash-live-preview",expires:payload.expireTime});
  }catch(e){return res.status(500).json({error:"token_exception",message:String(e?.message||e)})}
}
