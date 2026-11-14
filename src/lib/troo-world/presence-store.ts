import {createHash,randomBytes} from 'node:crypto';
import {getConnection} from '@/lib/db';
import type {RoomServiceClient} from 'livekit-server-sdk';
import {PUBLIC_SEATS} from './presence-model';
export class PresenceError extends Error{constructor(message:string,public status=403){super(message)}}
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export const presenceScope=()=>process.env.VERCEL_ENV==='preview'?'preview-'+hash(process.env.VERCEL_GIT_COMMIT_REF||process.env.VERCEL_URL||'local-preview').slice(0,24):'production';
export const worldPresenceRoom=()=> 'troo-presence-'+presenceScope();
export const opaqueIdentity=(kind:string,value:string)=>kind+'-'+hash(presenceScope()+'|'+value).slice(0,40);
export const missingPresenceSchema=(e:unknown)=>(e as {code?:string})?.code==='ER_NO_SUCH_TABLE';
export async function avatarOwner(){const db=await getConnection();const [rows]=await db.execute('SELECT userId FROM troo_avatar_assignments WHERE scope = ? AND avatarId = ?',[presenceScope(),'jarvon']);return Number((rows as {userId:number}[])[0]?.userId)||null;}
export async function claimJarvon(userId:number){const db=await getConnection();await db.execute('INSERT IGNORE INTO troo_avatar_assignments(scope,avatarId,userId) VALUES(?,?,?)',[presenceScope(),'jarvon',userId]);if(await avatarOwner()!==userId)throw new PresenceError('Jarvon is already assigned to another administrator',409);}
export async function avatarFor(userId?:number){return userId&&await avatarOwner()===userId?'jarvon' as const:'member' as const;}
type SeatRow={scope:string;roomKey:string;identityKey:string;eventId:string;policyHash:string;seatIndex:number;nonceHash:string;expiresAt:number};
/** Unique keys prevent double booking without transactions on the shared connection. */
export async function reserveSeat(room:string,eventId:string,policy:string,identity:string,service:RoomServiceClient,now=Date.now()){
 const db=await getConnection(),scope=presenceScope(),roomKey=hash(room);
 const [stale]=await db.execute('SELECT * FROM troo_stadium_seats WHERE scope = ? AND roomKey = ? AND expiresAt <= ? LIMIT 20',[scope,roomKey,now]);
 for(const row of stale as SeatRow[]){const [locked]=await db.execute('UPDATE troo_stadium_seats SET expiresAt = 0 WHERE scope = ? AND roomKey = ? AND identityKey = ? AND nonceHash = ? AND expiresAt <= ?',[scope,roomKey,row.identityKey,row.nonceHash,now]);if((locked as {affectedRows:number}).affectedRows!==1)continue;try{await service.removeParticipant(room,row.identityKey);}catch(e){if(!/not.?found|does not exist/i.test(String((e as Error)?.message)))throw e;}
 await db.execute('DELETE FROM troo_stadium_seats WHERE scope = ? AND roomKey = ? AND identityKey = ? AND nonceHash = ? AND expiresAt <= ?',[scope,roomKey,row.identityKey,row.nonceHash,now]);}
 let index:number|undefined;
 for(let attempt=0;attempt<20;attempt++){
  const [own]=await db.execute('SELECT * FROM troo_stadium_seats WHERE scope = ? AND roomKey = ? AND identityKey = ? AND expiresAt > ?',[scope,roomKey,identity,now]);if((own as SeatRow[])[0]){index=Number((own as SeatRow[])[0].seatIndex);break;}
  const [taken]=await db.execute('SELECT seatIndex FROM troo_stadium_seats WHERE scope = ? AND roomKey = ?',[scope,roomKey]);const used=new Set((taken as SeatRow[]).map(r=>Number(r.seatIndex)));index=PUBLIC_SEATS.findIndex((_,i)=>!used.has(i));if(index<0)throw new PresenceError('All stadium seats are occupied',409);
  const [result]=await db.execute('INSERT IGNORE INTO troo_stadium_seats(scope,roomKey,identityKey,eventId,policyHash,seatIndex,nonceHash,expiresAt) VALUES(?,?,?,?,?,?,?,?)',[scope,roomKey,identity,eventId,policy,index,hash(randomBytes(32).toString('hex')),now+180000]);if((result as {affectedRows:number}).affectedRows===1)break;index=undefined;
 }
 if(index===undefined||!PUBLIC_SEATS[index])throw new PresenceError('Seat assignment is busy. Retry.',409);
 const token=randomBytes(32).toString('hex');await db.execute('UPDATE troo_stadium_seats SET nonceHash = ?, expiresAt = ? WHERE scope = ? AND roomKey = ? AND identityKey = ?',[hash(token),now+180000,scope,roomKey,identity]);return{seatIndex:index,seatLeaseToken:token};
}
export async function seatLease(token:unknown){if(typeof token!=='string'||! /^[a-f0-9]{64}$/.test(token))throw new PresenceError('Invalid seat session',400);const db=await getConnection();const [rows]=await db.execute('SELECT * FROM troo_stadium_seats WHERE scope = ? AND nonceHash = ?',[presenceScope(),hash(token)]);const row=(rows as SeatRow[])[0];if(!row||Number(row.expiresAt)<=Date.now())throw new PresenceError('Seat session expired. Rejoin the event.',409);return row;}
export async function renewSeat(token:string){const row=await seatLease(token),db=await getConnection(),now=Date.now();const [result]=await db.execute('UPDATE troo_stadium_seats SET expiresAt = ? WHERE scope = ? AND nonceHash = ? AND expiresAt > ?',[now+180000,presenceScope(),hash(token),now]);if((result as {affectedRows:number}).affectedRows!==1)throw new PresenceError('Seat session expired. Rejoin the event.',409);return row;}
export async function releaseSeat(token:string){const row=await seatLease(token),db=await getConnection();await db.execute('DELETE FROM troo_stadium_seats WHERE scope = ? AND nonceHash = ?',[presenceScope(),hash(token)]);return row;}
