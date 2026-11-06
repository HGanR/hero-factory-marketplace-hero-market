import {NextRequest,NextResponse} from 'next/server';
import {engineRouteActor,requireSameOrigin,EngineAccessError} from '@/lib/security/engine-route-access';
import {LayoutConflict,saveGreenLayout} from '@/lib/troo-world/green-terrain-store';
import {validateLayout,LayoutError} from '@/lib/troo-world/green-terrain-layout';
export const dynamic='force-dynamic';
export async function PUT(request:NextRequest){
 try{
  const actor=await engineRouteActor(request);if(!actor.admin)throw new EngineAccessError('Administrator access required',403);
  requireSameOrigin(request);
  const text=await request.text();if(text.length>750000)return NextResponse.json({ok:false,error:'World layout is too large'},{status:413});
  let body;try{body=JSON.parse(text)}catch{throw new LayoutError('Invalid save body')}
  if(!body||typeof body!=='object'||Object.keys(body).some(k=>!['layout','expectedRevision'].includes(k))||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0)throw new LayoutError('Invalid save revision');
  const layout=validateLayout(body.layout);
  return NextResponse.json({ok:true,...await saveGreenLayout(layout,body.expectedRevision)},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){
  if(e instanceof EngineAccessError)return NextResponse.json({ok:false,error:e.message},{status:e.status});
  if(e instanceof LayoutError)return NextResponse.json({ok:false,error:e.message},{status:400});
  if(e instanceof LayoutConflict || (e as {code?:string})?.code==='ER_DUP_ENTRY')return NextResponse.json({ok:false,error:'The world changed during saving. Reload before retrying.'},{status:409});
  return NextResponse.json({ok:false,error:'World was not saved. Check layout storage readiness and try again.'},{status:503});
 }
}
