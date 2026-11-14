import {NextRequest,NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {put} from '@vercel/blob';
import {engineRouteActor,requireSameOrigin,EngineAccessError} from '@/lib/security/engine-route-access';
import {inspectStadiumMp4,MAX_STADIUM_CLIP_BYTES,StadiumMediaError} from '@/lib/troo-world/stadium-mp4';
export const runtime='nodejs';
export const maxDuration=30;
export async function POST(req:NextRequest){
 try{
  const actor=await engineRouteActor(req);if(!actor.admin)throw new EngineAccessError('Administrator access required',403);requireSameOrigin(req);
  const length=Number(req.headers.get('content-length'));if(length>MAX_STADIUM_CLIP_BYTES+65536)return NextResponse.json({error:'MP4 clips must be at most 3 MB'},{status:413});
  const form=await req.formData(),file=form.get('file');if(!(file instanceof File)||!file.name.toLowerCase().endsWith('.mp4')||file.size>MAX_STADIUM_CLIP_BYTES||file.size===0)throw new StadiumMediaError('Choose an MP4 clip up to 3 MB');
  const buffer=new Uint8Array(await file.arrayBuffer()),metadata=inspectStadiumMp4(buffer);
  if(!process.env.BLOB_READ_WRITE_TOKEN)return NextResponse.json({error:'Stadium video storage is not configured'},{status:503});
  const scope=process.env.VERCEL_ENV==='preview'?'preview':'production',path=`stadium-displays/${scope}/${randomUUID()}.mp4`;
  const result=await put(path,file,{access:'public',addRandomSuffix:false,allowOverwrite:false,contentType:'video/mp4'});
  return NextResponse.json({media:{kind:'video',url:result.url,...metadata}},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  if(error instanceof EngineAccessError)return NextResponse.json({error:error.message},{status:error.status});
  if(error instanceof StadiumMediaError)return NextResponse.json({error:error.message},{status:400});
  console.error('Stadium media upload failed',error instanceof Error?error.name:'Unknown error');return NextResponse.json({error:'Video could not be stored. Your existing display has been retained.'},{status:503});
 }
}
