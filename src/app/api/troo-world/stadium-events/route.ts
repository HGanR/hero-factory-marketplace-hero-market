import {NextResponse} from 'next/server';
import {and,eq} from 'drizzle-orm';
import {RoomServiceClient} from 'livekit-server-sdk';
import {getDb} from '@/lib/db';
import {meetingNodePlacements as n,trooWorldPlacements as p} from '@/lib/db/schema';
import {physical} from '@/lib/stadium/server';
export const dynamic='force-dynamic';
export async function GET(){
 try {
  const db=await getDb();
  const candidates=await db.select({id:n.id,title:n.title,roomId:n.roomId}).from(n).innerJoin(p,eq(n.parentPlacementId,p.id)).where(and(eq(p.elementKey,'stadium-elyseum'),eq(n.worldId,'default'),eq(n.accessType,'public'),eq(n.isActive,true),eq(n.webEnabled,true)));
  if (!candidates.length) return NextResponse.json({events:[]});
  const {LIVEKIT_URL:url,LIVEKIT_API_KEY:key,LIVEKIT_API_SECRET:secret}=process.env;
  if(!url||!key||!secret) throw Error();
  const service=new RoomServiceClient(url.replace(/^ws/,'http'),key,secret);
  const rooms=await service.listRooms(candidates.map(c=>physical(c.id)));
  const active=new Set(rooms.filter(r=>r.numParticipants>0).map(r=>r.name));
  return NextResponse.json({events:candidates.filter(c=>active.has(physical(c.id)))},{headers:{'Cache-Control':'no-store'}});
 } catch {return NextResponse.json({error:'Event status unavailable'},{status:503});}
}
