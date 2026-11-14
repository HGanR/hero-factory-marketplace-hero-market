import {NextRequest,NextResponse} from 'next/server';
import {engineRouteActor,requireSameOrigin,EngineAccessError} from '@/lib/security/engine-route-access';
import {AdmissionError,currentStadiumEvent,createStadiumChallenge,proveStadiumAdmission,issueStadiumRoom} from '@/lib/troo-world/stadium-admission';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 try{
  requireSameOrigin(req);
  const raw=await req.text();if(raw.length>12000)return NextResponse.json({error:'Request too large'},{status:413});
  let body;try{body=JSON.parse(raw)}catch{throw new AdmissionError('Invalid admission request',400)}
  const event=await currentStadiumEvent(body.eventId),origin=new URL(req.url).origin;
  if(body.action==='challenge')return NextResponse.json(await createStadiumChallenge(event,body.wallet,origin),{headers:{'Cache-Control':'no-store'}});
  let hostId:number|undefined;
  if(body.action==='host'){const actor=await engineRouteActor(req);if(!actor.admin)throw new AdmissionError('Administrator access required');hostId=actor.userId;}
  else if(body.action!=='join')throw new AdmissionError('Unknown admission action',400);
  const wallet=hostId?null:await proveStadiumAdmission(event,body,origin);
  return NextResponse.json(await issueStadiumRoom(event,wallet,hostId),{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  const known=error instanceof AdmissionError||error instanceof EngineAccessError;
  if(!known)console.error('Stadium admission unavailable',error instanceof Error?error.name:'Unknown error');
  return NextResponse.json({error:known?error.message:'Event verification is temporarily unavailable. Admission was not granted.'},{status:known?error.status:503,headers:{'Cache-Control':'no-store'}});
 }
}
