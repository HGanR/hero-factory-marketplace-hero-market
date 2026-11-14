import {NextRequest,NextResponse} from 'next/server';
import {RoomServiceClient} from 'livekit-server-sdk';
import {createHash} from 'node:crypto';
import {engineRouteActor,requireSameOrigin,EngineAccessError} from '@/lib/security/engine-route-access';
import {seatLease,PresenceError,opaqueIdentity,missingPresenceSchema} from '@/lib/troo-world/presence-store';
import {AdmissionError,currentStadiumEvent,policyHash,stadiumRoom} from '@/lib/troo-world/stadium-admission';
import {speakerFloorAction} from '@/lib/troo-world/stadium-speaker-floor';
import {parsePresenceMetadata} from '@/lib/troo-world/presence-model';
import {loadGreenLayout} from '@/lib/troo-world/green-terrain-store';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:NextRequest){try{
 requireSameOrigin(req);const raw=await req.text();if(raw.length>4096)throw new PresenceError('Request too large',413);let body;try{body=JSON.parse(raw)}catch{throw new PresenceError('Invalid request',400)}
 if(!body||typeof body!=='object'||Array.isArray(body)||!['sync','invite','accept','decline','end','cancel-invite'].includes(body.action))throw new PresenceError('Invalid speaker action',400);
 const lease=await seatLease(body.seatToken),event=await currentStadiumEvent(lease.eventId),room=stadiumRoom(event);
 if(lease.policyHash!==policyHash(event)||lease.roomKey!==createHash('sha256').update(room).digest('hex'))throw new PresenceError('The event changed. Rejoin.',409);
 const url=process.env.LIVEKIT_URL,key=process.env.LIVEKIT_API_KEY,secret=process.env.LIVEKIT_API_SECRET;if(!url||!key||!secret)throw new PresenceError('Event voice is not configured',503);
 const service=new RoomServiceClient(url.replace(/^ws/,'http'),key,secret),participant=await service.getParticipant(room,lease.identityKey),actor=parsePresenceMetadata(participant.metadata,lease.identityKey);
 if(!actor||actor.eventId!==event.id||actor.role==='visitor')throw new PresenceError('Join this event first',403);
 if(['invite','end','cancel-invite'].includes(body.action)){const admin=await engineRouteActor(req);if(!admin.admin||actor.role!=='host'||actor.identity!==opaqueIdentity('host','user:'+admin.userId))throw new PresenceError('Only the event host may manage speakers');}
 const saved=await loadGreenLayout(),frame=saved?.layout.buildings['stadium-elyseum'];if(!frame)throw new PresenceError('Stadium placement unavailable',503);
 return NextResponse.json({presence:await speakerFloorAction(room,actor,body.action,body,service,frame)},{headers:{'Cache-Control':'no-store'}});
 }catch(e){const known=e instanceof PresenceError||e instanceof EngineAccessError||e instanceof AdmissionError;return NextResponse.json({error:known?e.message:missingPresenceSchema(e)?'Speaker controls need database setup':'Speaker controls are temporarily unavailable'},{status:known?e.status:503,headers:{'Cache-Control':'no-store'}});}}
