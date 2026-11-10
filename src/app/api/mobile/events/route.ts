import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { mobileSameOrigin } from '@/lib/mobile/session-policy';
export const dynamic='force-dynamic';
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:NextRequest){
  if(process.env.SMART_TRUST_MOBILE_ENABLED!=='true')return reply({error:'Mobile is not enabled.'},404);
  if(!mobileSameOrigin(request))return reply({error:'Same-origin request required.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'JSON required.'},415);
  let bytes=0,raw='';const reader=request.body?.getReader();if(reader){const decoder=new TextDecoder();for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>4096){await reader.cancel();return reply({error:'Event too large.'},413);}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}
  let body;try{body=JSON.parse(raw);if(body.kind!=='troo_paypal_open')throw Error();}catch{return reply({error:'Unsupported mobile event.'},400);}
  const identifier=(value:unknown)=>typeof value==='string'&&/^[A-Za-z0-9:_-]{4,64}$/.test(value)?value:randomUUID();
  const event={sessionId:identifier(body.sessionId),visitorId:identifier(body.visitorId),path:'/mobile',eventType:'outbound_paypal',utmSource:'mobile_app',utmMedium:'app',
    metadata:{eventName:'mobile.troo_token.paypal.open',label:'Mobile app TROO Token purchases',source:'mobile_app',route:'/mobile',action:'troo_token_purchase_link_click',targetHref:'https://www.paypal.com/ncp/payment/YPS4H5NTVWDYE',paymentVerified:false}};
  try{
    const response=await fetch('https://troothhurtz.app/api/analytics/site-event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(event),redirect:'error',signal:AbortSignal.timeout(5000)});
    if(!response.ok)return reply({error:'Analytics could not be recorded.'},503);
    return reply({recorded:true});
  }catch{return reply({error:'Analytics is temporarily unavailable.'},503);}
}
