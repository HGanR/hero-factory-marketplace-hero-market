import { NextRequest, NextResponse } from 'next/server';
import { mobileSameOrigin } from '@/lib/mobile/session-policy';
export const dynamic='force-dynamic';
const endpoint='https://troothhurtz.app/api/marketplace/register';
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:NextRequest){
  if(process.env.SMART_TRUST_MOBILE_ENABLED!=='true')return reply({error:'Mobile is not enabled.'},404);
  if(!mobileSameOrigin(request))return reply({error:'Same-origin request required.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'JSON required.'},415);
  let bytes=0,raw='';const reader=request.body?.getReader();if(reader){const decoder=new TextDecoder();for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>4096){await reader.cancel();return reply({error:'Request too large.'},413);}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}
  let body;try{body=JSON.parse(raw);if(typeof body.email!=='string'||typeof body.username!=='string'||body.email.length>320||body.username.length>100)throw Error();}catch{return reply({error:'Enter your email and username.'},400);}
  try{
    // No local account table, simulated email code, password or browser cookie is used.
    // Preflight prevents an old backend from creating an untracked mobile account.
    const capability=await fetch(endpoint,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});
    const features=await capability.json().catch(()=>({}));
    if(!capability.ok||features.version!==2||features.registrationAnalytics!==true)return reply({error:'Mobile registration is being connected. Register on troothhurtz.app or retry shortly.'},503);
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:body.email,username:body.username,registrationSource:'mobile'}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)return reply({error:response.status===409?'Email or username already registered. Use your existing account.':response.status===400?'Check your email and username.':'Registration could not be confirmed. Please retry.'},response.status===409?409:response.status===400?400:503);
    if(result.success!==true||result.pending!==true||result.analyticsRecorded!==true)return reply({error:'Registration status could not be confirmed. Contact support before submitting again.'},503);
    return reply({success:true,pending:true,message:'Your account is registered and pending administrator approval. Return here with your generated website password after approval.'});
  }catch{return reply({error:'Account service unavailable. Please retry when connected.'},503);}
}
