/** Public event presentation and admission policy. No credentials live in this document. */
export const STADIUM_ROOM_PREFIX='stadium-event-';
export const DEFAULT_STADIUM_CONTRACT='0x7202cd71cb52ce0d71b9a13f2dacc4599b6cb13a';
export type StadiumEvent={id:string;title:string;enabled:boolean;paid:boolean;admissionOpensAt:string;startsAt:string;endsAt:string;capacity:number;contractAddress:string;tokenId:string;chainId:137;poster?:string};
export type StadiumSettings={tickerText:string;events:StadiumEvent[]};
export const DEFAULT_STADIUM_SETTINGS:StadiumSettings={tickerText:'TROOTHHURTZ STADIUM',events:[]};
export class StadiumPolicyError extends Error{}
function fail(message:string):never{throw new StadiumPolicyError(message)}
function text(v:unknown,max:number){return typeof v==='string'&&v.trim()&&v.length<=max&&!/[\u0000-\u001f]/.test(v)?v.trim():fail('Invalid event text');}
function time(v:unknown){const s=text(v,40);return /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(s)&&Number.isFinite(Date.parse(s))?s:fail('Event times must be valid UTC dates');}
export function validateStadiumSettings(value:unknown):StadiumSettings{
 if(!value||typeof value!=='object')fail('Invalid stadium settings');
 const v=value as Record<string,unknown>;
 if(!Array.isArray(v.events)||v.events.length>8)fail('Use at most eight scheduled events');
 const events=v.events.map((input:unknown):StadiumEvent=>{
  if(!input||typeof input!=='object')fail('Invalid event');const r=input as Record<string,unknown>;
  const id=text(r.id,64);if(!/^[a-zA-Z0-9-]+$/.test(id))fail('Invalid event ID');
  if(typeof r.enabled!=='boolean'||typeof r.paid!=='boolean')fail('Invalid event switch');
  const admissionOpensAt=time(r.admissionOpensAt),startsAt=time(r.startsAt),endsAt=time(r.endsAt);
  if(Date.parse(admissionOpensAt)>Date.parse(startsAt)||Date.parse(startsAt)>=Date.parse(endsAt))fail('Admission must open before the event ends, and no later than its start');
  if(!Number.isInteger(r.capacity)||Number(r.capacity)<1||Number(r.capacity)>500)fail('Capacity must be 1–500, including hosts');
  const contractAddress=text(r.contractAddress,42).toLowerCase();if(!/^0x[0-9a-f]{40}$/.test(contractAddress)||/^0x0{40}$/.test(contractAddress))fail('Invalid NFT contract address');
  const tokenId=typeof r.tokenId==='string'?r.tokenId:fail('Token ID must be a decimal string');
  if(!/^(0|[1-9]\d{0,77})$/.test(tokenId)||BigInt(tokenId)>=2n**256n)fail('Invalid token ID');
  if(r.chainId!==137)fail('Select Polygon for this event');
  let poster:string|undefined;
  if(r.poster!==undefined){poster=text(r.poster,130000);if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(poster))fail('Use a PNG, JPEG or WebP event graphic');}
  return{id,title:text(r.title,100),enabled:r.enabled,paid:r.paid,admissionOpensAt,startsAt,endsAt,capacity:Number(r.capacity),contractAddress,tokenId,chainId:137,...(poster?{poster}:{})};
 });
 if(new Set(events.map(e=>e.id)).size!==events.length)fail('Duplicate event ID');
 const enabled=events.filter(e=>e.enabled).sort((a,b)=>Date.parse(a.admissionOpensAt)-Date.parse(b.admissionOpensAt));
 for(let i=1;i<enabled.length;i++)if(Date.parse(enabled[i].admissionOpensAt)<Date.parse(enabled[i-1].endsAt))fail('Event admission windows cannot overlap');
 if(events.reduce((n,e)=>n+(e.poster?.length??0),0)>500000)fail('Event graphics are too large in total');
 return{tickerText:text(v.tickerText,160),events};
}
export function admissionEvent(settings:StadiumSettings|undefined,now=Date.now()){
 return settings?.events.find(e=>e.enabled&&now>=Date.parse(e.admissionOpensAt)&&now<Date.parse(e.endsAt))??null;
}
export function requiresStadiumWallet(settings:StadiumSettings|undefined,now=Date.now()){return Boolean(admissionEvent(settings,now)?.paid);}
export function displayStadiumEvent(settings:StadiumSettings|undefined,now=Date.now()){
 return admissionEvent(settings,now)??settings?.events.filter(e=>e.enabled&&Date.parse(e.startsAt)>now).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt))[0]??null;
}
export function protectedStadiumRoom(room:string){return room.toLowerCase().startsWith(STADIUM_ROOM_PREFIX);}
