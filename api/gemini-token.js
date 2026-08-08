export default async function handler(req,res){
  const key=process.env.GEMINI_API_KEY;
  if(req.method==="GET") return res.status(200).json({configured:Boolean(key),model:"gemini-3.1-flash-live-preview"});
  if(req.method!=="POST") return res.status(405).json({error:"method_not_allowed"});
  if(!key) return res.status(503).json({error:"gemini_not_configured",message:"GEMINI_API_KEY is not configured in Vercel."});
  try{
    const now=Date.now();
    const body={uses:1,expireTime:new Date(now+30*60*1000).toISOString(),newSessionExpireTime:new Date(now+60*1000).toISOString()};
    const r=await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens",{method:"POST",headers:{"x-goog-api-key":key,"content-type":"application/json"},body:JSON.stringify(body)});
    const data=await r.json();
    if(!r.ok) return res.status(r.status).json({error:"gemini_token_error",detail:data});
    return res.status(200).json({token:data.name,model:"gemini-3.1-flash-live-preview",expires:body.expireTime});
  }catch(e){return res.status(500).json({error:"token_exception",message:String(e?.message||e)})}
}
