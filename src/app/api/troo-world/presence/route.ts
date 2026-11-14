import {NextRequest,NextResponse} from 'next/server';
import {AccessToken,RoomServiceClient,TrackSource} from 'livekit-server-sdk';
import {engineRouteActor,requireSameOrigin,EngineAccessError} from '@/lib/security/engine-route-access';
import {PresenceError,avatarFor,claimJarvon,missingPresenceSchema,opaqueIdentity,worldPresenceRoom,seatLease,renewSeat,releaseSeat} from '@/lib/troo-world/presence-store';
import {currentStadiumEvent,policyHash,stadiumRoom} from '@/lib/troo-world/stadium-admission';
import type {PresenceIdentity} from '@/lib/troo-world/presence-model';
export const runtime='nodejs';export const dynamic='force-dynamic';
const configured=()=>!!(process.env.LIVEKIT_URL&&process.env.LIVEKIT_API_KEY&&process.env.LIVEKIT_API_SECRET);
const service=()=>new RoomServiceClient(process.env.LIVEKIT_URL!.replace(/^ws/,'http'),process.env.LIVEKIT_API_KEY!,process.env.LIVEKIT_API_SECRET!);
function fail(e:unknown){const known=e instanceof PresenceError||e instanceof EngineAccessError;return NextResponse.json({error:known?e.message:missingPresenceSchema(e)?'Avatar and seating setup is required':'World voice is temporarily unavailable'},{status:known?e.status:503,headers:{'Cache-Control':'no-store'}});}
export async function GET(req:NextRequest){try{const actor=await engineRouteActor(req);let avatar:'jarvon'|'member'='member',setupRequired=false;try{avatar=await avatarFor(actor.userId)}catch(e){if(!missingPresenceSchema(e))throw e;setupRequired=true;}
 return NextResponse.json({signedIn:true,accountKey:opaqueIdentity('member','user:'+actor.userId),admin:actor.admin,avatar,setupRequired,voiceConfigured:configured()},{headers:{'Cache-Control':'no-store'}});}catch(e){return fail(e);}}
export async function POST(req:NextRequest){try{requireSameOrigin(req);const raw=await req.text();if(raw.length>4096)throw new PresenceError('Request too large',413);let body;try{body=JSON.parse(raw)}catch{throw new PresenceError('Invalid request',400)}
 if(!body||typeof body!=='object'||Array.isArray(body))throw new PresenceError('Invalid request',400);
 if(body.action==='renew-seat'||body.action==='release-seat'){
  if(!configured())throw new PresenceError('World voice is not configured',503);const row=await seatLease(body.token),event=await currentStadiumEvent(row.eventId);if(policyHash(event)!==row.policyHash)throw new PresenceError('The event changed. Rejoin.',409);
  if(body.action==='release-seat'){try{await service().removeParticipant(stadiumRoom(event),row.identityKey);}catch(e){if(!/not.?found|does not exist/i.test(String((e as Error)?.message)))throw e;}await releaseSeat(body.token);}else await renewSeat(body.token);return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }
 const actor=await engineRouteActor(req);
 if(body.action==='claim-jarvon'){if(!actor.admin)throw new PresenceError('Administrator access required');await claimJarvon(actor.userId);return NextResponse.json({avatar:'jarvon'},{headers:{'Cache-Control':'no-store'}});}
 if(body.action!=='join')throw new PresenceError('Unknown presence action',400);if(!configured())throw new PresenceError('World voice server is not configured',503);
 const identity=opaqueIdentity('member','user:'+actor.userId),avatar=await avatarFor(actor.userId),room=worldPresenceRoom();await service().createRoom({name:room,maxParticipants:100,emptyTimeout:60});
 const presence:PresenceIdentity={v:1,identity,avatar,role:'visitor',pose:{position:[0,0,0],yaw:0,mode:'standing',zone:'world'}};
 const at=new AccessToken(process.env.LIVEKIT_API_KEY!,process.env.LIVEKIT_API_SECRET!,{identity,name:avatar==='jarvon'?'Jarvon':'Visitor',metadata:JSON.stringify(presence),ttl:120});
 at.addGrant({roomJoin:true,room,canSubscribe:true,canPublish:true,canPublishSources:[TrackSource.MICROPHONE],canPublishData:true,canUpdateOwnMetadata:false});return NextResponse.json({token:await at.toJwt(),serverUrl:process.env.LIVEKIT_URL,presence},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return fail(e);}}
