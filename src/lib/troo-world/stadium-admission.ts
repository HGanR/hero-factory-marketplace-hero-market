import {createHash,randomBytes} from 'node:crypto';
import {createPublicClient,http,parseAbi,type Address,type Hex} from 'viem';
import {polygon} from 'viem/chains';
import {AccessToken,RoomServiceClient,TrackSource} from 'livekit-server-sdk';
import {avatarFor,opaqueIdentity,reserveSeat,presenceScope} from './presence-store';
import {portraitFor} from './presence-portrait';
import {seatPose,hostPose,type PresenceIdentity} from './presence-model';
import {getConnection} from '@/lib/db';
import {loadGreenLayout} from './green-terrain-store';
import {admissionEvent,STADIUM_ROOM_PREFIX,type StadiumEvent} from './stadium-events';

export class AdmissionError extends Error{constructor(message:string,public status=403){super(message)}}
export const policyHash=(event:StadiumEvent)=>createHash('sha256').update(JSON.stringify([event.id,event.enabled,event.paid,event.admissionOpensAt,event.startsAt,event.endsAt,event.capacity,event.chainId,event.contractAddress,event.tokenId])).digest('hex');
export const stadiumRoom=(event:StadiumEvent)=>STADIUM_ROOM_PREFIX+(presenceScope()==='production'?'':presenceScope()+'-')+event.id+'-'+policyHash(event).slice(0,24);
const address=(value:unknown):Address=>{if(typeof value!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(value)||/^0x0{40}$/.test(value))throw new AdmissionError('Choose a valid wallet',400);return value.toLowerCase() as Address};
export async function currentStadiumEvent(id:unknown){
 const saved=await loadGreenLayout();const event=admissionEvent(saved?.layout.stadium);
 if(!event||event.id!==id)throw new AdmissionError('This event is not accepting admissions',409);
 return event;
}
const client=()=>createPublicClient({chain:polygon,transport:http(process.env.POLYGON_RPC_URL||'https://polygon-bor-rpc.publicnode.com',{timeout:8000,retryCount:0})});
const nftAbi=parseAbi(['function supportsInterface(bytes4 interfaceId) view returns (bool)','function ownerOf(uint256 tokenId) view returns (address)','function balanceOf(address account,uint256 id) view returns (uint256)']);
export async function ownsStadiumToken(event:StadiumEvent,wallet:Address,rpc=client()){
 if(await rpc.getChainId()!==137)throw new AdmissionError('Polygon verification is unavailable',503);
 const args={address:event.contractAddress as Address,abi:nftAbi};
 const is1155=await rpc.readContract({...args,functionName:'supportsInterface',args:['0xd9b67a26']});
 if(is1155)return await rpc.readContract({...args,functionName:'balanceOf',args:[wallet,BigInt(event.tokenId)]})>0n;
 const is721=await rpc.readContract({...args,functionName:'supportsInterface',args:['0x80ac58cd']});
 if(!is721)throw new AdmissionError('The configured NFT standard is unsupported',503);
 return (await rpc.readContract({...args,functionName:'ownerOf',args:[BigInt(event.tokenId)]})).toLowerCase()===wallet.toLowerCase();
}
export async function createStadiumChallenge(event:StadiumEvent,value:unknown,origin:string){
 if(!event.paid)throw new AdmissionError('This free event needs no wallet',400);
 const wallet=address(value),id=randomBytes(32).toString('hex'),expiresAt=Date.now()+180000,hash=policyHash(event);
 const message=`${origin}\nStadium admission: ${event.title}\nEvent: ${event.id}\nWallet: ${wallet}\nChain ID: 137\nNFT: ${event.contractAddress}\nToken ID: ${event.tokenId}\nPolicy: ${hash}\nNonce: ${id}\nExpires: ${new Date(expiresAt).toISOString()}\nSign to prove wallet ownership. No purchase, transfer or approval.`;
 const db=await getConnection();
 await db.execute('DELETE FROM stadium_event_challenges WHERE expiresAt < ? LIMIT 100',[Date.now()]);
 const [counts]=await db.execute('SELECT COUNT(*) AS count FROM stadium_event_challenges WHERE wallet = ? AND expiresAt >= ?',[wallet,Date.now()]);
 if((counts as Array<{count:number}>)[0].count>=5)throw new AdmissionError('Please wait before requesting another wallet check',429);
 await db.execute('INSERT INTO stadium_event_challenges(id,wallet,eventId,policyHash,message,expiresAt) VALUES(?,?,?,?,?,?)',[id,wallet,event.id,hash,message,expiresAt]);
 return{id,message,expiresAt};
}
export async function proveStadiumAdmission(event:StadiumEvent,proof:{id?:unknown;signature?:unknown},origin:string){
 if(!event.paid)return null;
 if(typeof proof.id!=='string'||! /^[0-9a-f]{64}$/.test(proof.id)||typeof proof.signature!=='string'||!/^0x[0-9a-fA-F]{130,4096}$/.test(proof.signature))throw new AdmissionError('Sign the stadium admission request',400);
 const db=await getConnection();
 const [rows]=await db.execute('SELECT * FROM stadium_event_challenges WHERE id = ?',[proof.id]);
 const row=(rows as Array<{wallet:string;eventId:string;policyHash:string;message:string;expiresAt:number}>)[0];
 if(!row||Number(row.expiresAt)<=Date.now()||row.eventId!==event.id||row.policyHash!==policyHash(event)||!row.message.startsWith(origin+'\n'))throw new AdmissionError('Wallet request expired or the event changed. Try again',409);
 const wallet=address(row.wallet),rpc=client();
 if(!await rpc.verifyMessage({address:wallet,message:row.message,signature:proof.signature as Hex}))throw new AdmissionError('Wallet signature did not match');
 // Atomic single-use consume: concurrent replays cannot both issue room credentials.
 const [result]=await db.execute('DELETE FROM stadium_event_challenges WHERE id = ? AND expiresAt > ?',[proof.id,Date.now()]);
 if((result as {affectedRows:number}).affectedRows!==1)throw new AdmissionError('This wallet request was already used',409);
 if(!await ownsStadiumToken(event,wallet,rpc))throw new AdmissionError('This wallet does not hold the required event NFT');
 return wallet;
}
export async function issueStadiumRoom(event:StadiumEvent,wallet:string|null,hostUserId?:number,memberUserId?:number,adminUsername?:string){
 // Reload after potentially slow RPC; cancellation, time and policy edits take effect before issuance.
 const current=await currentStadiumEvent(event.id);
 if(policyHash(current)!==policyHash(event))throw new AdmissionError('The event admission policy changed. Try again',409);
 const url=process.env.LIVEKIT_URL,key=process.env.LIVEKIT_API_KEY,secret=process.env.LIVEKIT_API_SECRET;
 if(!url||!key||!secret)throw new AdmissionError('Event audio/video is not configured',503);
 const room=stadiumRoom(event),service=new RoomServiceClient(url.replace(/^ws/,'http'),key,secret);
 const created=await service.createRoom({name:room,maxParticipants:event.capacity,emptyTimeout:60,metadata:JSON.stringify({eventId:event.id,endsAt:event.endsAt})});
 if(created.maxParticipants!==event.capacity)throw new AdmissionError('Event capacity configuration does not match',503);
 const identity=opaqueIdentity(hostUserId?'host':'attendee',hostUserId?'user:'+hostUserId:memberUserId?'user:'+memberUserId:wallet??randomBytes(16).toString('hex'));
 const saved=await loadGreenLayout(),frame=saved?.layout.buildings['stadium-elyseum'];if(!frame)throw new AdmissionError('The stadium layout is unavailable',503);
 const seat=hostUserId?null:await reserveSeat(room,event.id,policyHash(event),identity,service);
 const portrait=await portraitFor(hostUserId?{userId:hostUserId,admin:true,username:adminUsername}:memberUserId?{userId:memberUserId,admin:false}:undefined);
 const presence:PresenceIdentity={...(portrait.portraitUrl?{portraitUrl:portrait.portraitUrl}:{}),v:1,identity,avatar:await avatarFor(hostUserId??memberUserId),role:hostUserId?'host':'attendee',eventId:event.id,pose:hostUserId?hostPose(frame,event.id):seatPose(seat!.seatIndex,frame,event.id)};
 const at=new AccessToken(key,secret,{identity,name:hostUserId?'Event host':'Attendee',metadata:JSON.stringify(presence),ttl:Math.max(1,Math.min(120,Math.floor((Date.parse(event.endsAt)-Date.now())/1000)))});
 at.addGrant({roomJoin:true,room,canSubscribe:true,canPublish:true,canPublishSources:[TrackSource.MICROPHONE],canPublishData:false,canUpdateOwnMetadata:false});
 return{token:await at.toJwt(),serverUrl:url,...((hostUserId??memberUserId)?{accountKey:opaqueIdentity('member','user:'+(hostUserId??memberUserId))}:{}),eventId:event.id,endsAt:event.endsAt,title:event.title,isHost:Boolean(hostUserId),presence,...(seat?{seatLeaseToken:seat.seatLeaseToken}:{})};
}
