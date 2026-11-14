import {createHash,randomBytes} from 'node:crypto';
import {getConnection} from '@/lib/db';
import type {RoomServiceClient} from 'livekit-server-sdk';
import {presenceScope,PresenceError} from './presence-store';
import {parsePresenceMetadata,seatPose,hostPose,type PresenceIdentity,PUBLIC_SEATS} from './presence-model';
import type {InteriorFrame} from './stadium-navigation';
export type SpeakerFloor={hostIdentity:string;hostSeatIndex:number;speakerIdentity:string|null;turnId:string|null;invitedIdentity:string|null;inviteId:string|null;inviteExpiresAt:number;revision:number};
const roomHash=(room:string)=>createHash('sha256').update(room).digest('hex');
export async function readSpeakerFloor(room:string){const db=await getConnection();const[rows]=await db.execute('SELECT * FROM troo_stadium_floor WHERE scope = ? AND roomKey = ?',[presenceScope(),roomHash(room)]);const row=(rows as SpeakerFloor[])[0];return row?{...row,revision:Number(row.revision),hostSeatIndex:Number(row.hostSeatIndex),inviteExpiresAt:Number(row.inviteExpiresAt)}:null;}
export async function registerFloorHost(room:string,identity:string,seatIndex:number){
 const db=await getConnection();await db.execute('INSERT IGNORE INTO troo_stadium_floor(scope,roomKey,hostIdentity,hostSeatIndex) VALUES(?,?,?,?)',[presenceScope(),roomHash(room),identity,seatIndex]);const floor=await readSpeakerFloor(room);
 if(!floor||floor.hostIdentity!==identity)throw new PresenceError('Another administrator is hosting this event',409);
 if(floor.hostSeatIndex!==seatIndex){await db.execute('UPDATE troo_stadium_floor SET hostSeatIndex = ?, revision = revision + 1 WHERE scope = ? AND roomKey = ? AND hostIdentity = ?',[seatIndex,presenceScope(),roomHash(room),identity]);return(await readSpeakerFloor(room))!;}return floor;
}
async function commit(room:string,old:SpeakerFloor,next:SpeakerFloor){const db=await getConnection();const[result]=await db.execute('UPDATE troo_stadium_floor SET speakerIdentity = ?, turnId = ?, invitedIdentity = ?, inviteId = ?, inviteExpiresAt = ?, revision = revision + 1 WHERE scope = ? AND roomKey = ? AND revision = ?',[next.speakerIdentity,next.turnId,next.invitedIdentity,next.inviteId,next.inviteExpiresAt,presenceScope(),roomHash(room),old.revision]);if((result as {affectedRows:number}).affectedRows!==1)throw new PresenceError('The speaker invitation changed. Please retry.',409);return{...next,revision:old.revision+1};}
export function floorPresence(p:PresenceIdentity,floor:SpeakerFloor,frame:InteriorFrame):PresenceIdentity{
 const host=p.identity===floor.hostIdentity,speaker=p.identity===floor.speakerIdentity;const{invitation:_invite,turnId:_turn,...base}=p;
 const seatIndex=host?floor.hostSeatIndex:p.seatIndex;if(!Number.isInteger(seatIndex)||!PUBLIC_SEATS[seatIndex!])throw new PresenceError('This participant needs a valid event seat',409);
 return{...base,seatIndex,floorRevision:floor.revision,floorRole:host&&!floor.speakerIdentity?'host':speaker?'speaker':'audience',pose:host&&!floor.speakerIdentity||speaker?hostPose(frame,p.eventId!):seatPose(seatIndex!,frame,p.eventId!),...(speaker?{turnId:floor.turnId!}:{}),...(p.identity===floor.invitedIdentity&&floor.inviteId?{invitation:{id:floor.inviteId,expiresAt:floor.inviteExpiresAt}}:{})};
}
const clearInvitation=(f:SpeakerFloor)=>({...f,invitedIdentity:null,inviteId:null,inviteExpiresAt:0});
/** Server-owned compare-and-swap: accepting requires this exact pending invitation. */
export function transitionFloor(f:SpeakerFloor,actor:PresenceIdentity,action:string,input:{target?:unknown;invitationId?:unknown;turnId?:unknown},live:Set<string>,now=Date.now()):SpeakerFloor{
 if(action==='sync'){let n=f;if(f.invitedIdentity&&(now>=f.inviteExpiresAt||!live.has(f.invitedIdentity)||!live.has(f.hostIdentity)))n=clearInvitation(n);if(f.speakerIdentity&&(!live.has(f.speakerIdentity)||!live.has(f.hostIdentity)))n={...n,speakerIdentity:null,turnId:null};return n;}
 const host=actor.role==='host'&&actor.identity===f.hostIdentity;
 if(action==='invite'){
  if(!host)throw new PresenceError('Only the event host may invite a speaker');if(f.speakerIdentity||f.invitedIdentity)throw new PresenceError('Finish or cancel the current speaking turn first',409);
  if(typeof input.target!=='string'||input.target===f.hostIdentity||!live.has(input.target))throw new PresenceError('Choose a connected attendee',409);
  return{...f,invitedIdentity:input.target,inviteId:randomBytes(32).toString('hex'),inviteExpiresAt:now+60000};
 }
 if(action==='accept'||action==='decline'){
  if(actor.role!=='attendee'||f.invitedIdentity!==actor.identity||f.inviteId!==input.invitationId||now>=f.inviteExpiresAt)throw new PresenceError('This speaking invitation is no longer available',409);
  if(!live.has(f.hostIdentity))throw new PresenceError('The host is no longer connected',409);
  return action==='decline'?clearInvitation(f):{...clearInvitation(f),speakerIdentity:actor.identity,turnId:f.inviteId};
 }
 if(action==='end'){
  if(!host)throw new PresenceError('Only the event host may end a speaking turn');if(!f.speakerIdentity||input.target!==f.speakerIdentity||input.turnId!==f.turnId)throw new PresenceError('That speaking turn has already ended',409);
  return{...f,speakerIdentity:null,turnId:null};
 }
 if(action==='cancel-invite'){
  if(!host)throw new PresenceError('Only the event host may cancel invitations');if(input.target!==f.invitedIdentity||input.invitationId!==f.inviteId)throw new PresenceError('That invitation has already ended',409);return clearInvitation(f);
 }
 throw new PresenceError('Unknown speaker action',400);
}
/** Reconcile desired DB state after every change, and during low-frequency client heartbeats.
 * Metadata versions keep an older overlapping RPC from moving clients backwards. */
export async function speakerFloorAction(room:string,actor:PresenceIdentity,action:string,input:{target?:unknown;invitationId?:unknown;turnId?:unknown},service:RoomServiceClient,frame:InteriorFrame){
 const participants=await service.listParticipants(room),byId=new Map(participants.map(p=>[p.identity,p]));let floor=await readSpeakerFloor(room);
 if(!floor){if(action==='sync')return actor;throw new PresenceError('The event host has not joined yet',409);}
 if(action==='invite'){const target=typeof input.target==='string'?byId.get(input.target):undefined;const p=target&&parsePresenceMetadata(target.metadata,target.identity);if(!p||p.role!=='attendee'||p.eventId!==actor.eventId)throw new PresenceError('Choose an attendee in this event',409);}
 let next=transitionFloor(floor,actor,'sync',{},new Set(byId.keys()));if(next!==floor)floor=await commit(room,floor,next);
 next=transitionFloor(floor,actor,action,input,new Set(byId.keys()));if(next!==floor)floor=await commit(room,floor,next);
 // Re-read after RPC updates so concurrent actions converge on the newest desired state.
 for(let pass=0;pass<3;pass++){
  const peers=await service.listParticipants(room);
  // Remove old broadcast roles before assigning the next one.
  peers.sort((a,b)=>{const pa=parsePresenceMetadata(a.metadata,a.identity),pb=parsePresenceMetadata(b.metadata,b.identity);return Number(pa?.floorRole!=='speaker'&&!(pa?.role==='host'&&pa.floorRole!=='audience'))-Number(pb?.floorRole!=='speaker'&&!(pb?.role==='host'&&pb.floorRole!=='audience'));});
  for(const peer of peers){const p=parsePresenceMetadata(peer.metadata,peer.identity);if(!p||p.eventId!==actor.eventId||p.role==='visitor')continue;
   if(p.identity!==floor.hostIdentity&&p.identity!==floor.speakerIdentity&&p.identity!==floor.invitedIdentity&&!p.invitation&&p.floorRole!=='speaker')continue;
   const desired=floorPresence(p,floor,frame);if(JSON.stringify(p)===JSON.stringify(desired))continue;
   await service.updateParticipant(room,p.identity,{metadata:JSON.stringify(desired)});
   if((p.floorRole==='speaker'||p.role==='host'&&p.floorRole!=='audience')&&desired.floorRole==='audience')for(const track of peer.tracks)if(track.type===0)await service.mutePublishedTrack(room,p.identity,track.sid,true);
  }
  const latest=await readSpeakerFloor(room);if(!latest)throw new PresenceError('Speaker state unavailable',503);if(latest.revision===floor.revision)return floorPresence(actor,latest,frame);floor=latest;
 }
 throw new PresenceError('The speaker state is changing. Please retry.',409);
}
