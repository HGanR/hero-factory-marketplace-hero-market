import slots from './storefront-slots.json';
import level2Slots from './level2-store-slots.json';
import {STOREFRONT,LEVEL2_STORE} from './storefront';
export type InteriorItem={id:string;kind:'desk'|'chair'|'lamp'|'wall-art'|'agent';slotId:string;rotationY:number;position?:[number,number,number];image?:string;href?:string;agentId?:string;label?:string};
export const INTERIOR_SLOTS=[...slots.slots.furniture.map(s=>({...s,type:'furniture' as const})),...slots.slots.frames.map(s=>({...s,type:'frame' as const}))];
export const LEVEL2_INTERIOR_SLOTS=[...level2Slots.slots.furniture.map(s=>({...s,id:'v3_'+s.id,type:'furniture' as const})),...level2Slots.slots.frames.map(s=>({...s,id:'v3_'+s.id,type:'frame' as const}))];
export const ALL_INTERIOR_SLOTS=[...INTERIOR_SLOTS,...LEVEL2_INTERIOR_SLOTS];
export const interiorSlotsForModel=(modelUrl?:string)=>modelUrl===LEVEL2_STORE.modelUrl?LEVEL2_INTERIOR_SLOTS:INTERIOR_SLOTS;
export const INTERIOR_MODELS=[STOREFRONT.modelUrl,LEVEL2_STORE.modelUrl];
export function safeInteriorLink(value:unknown):string|undefined{
 if(value===undefined||value==='')return undefined;
 if(typeof value!=='string'||value.length>1500)throw new Error('Invalid wall link.');
 const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)throw new Error('Wall links must use HTTPS.');return u.href;
}
/** Server and renderer share strict data-only validation. No SVG, scripts or remote fetches. */
export function validateInterior(value:unknown,allowPosition=false,modelUrl?:string):InteriorItem[]{
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>40)throw new Error('A building supports up to 40 interior items.');
 const ids=new Set<string>(),occupied=new Set<string>();
 return value.map(raw=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid interior item.');
  const r=raw as Record<string,unknown>,slot=(modelUrl?interiorSlotsForModel(modelUrl):ALL_INTERIOR_SLOTS).find(s=>s.id===r.slotId);
  let position:[number,number,number]|undefined;
  if(r.position!==undefined){
   if(!allowPosition||!Array.isArray(r.position)||r.position.length!==3||r.position.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>150))throw new Error('Invalid interior position.');
   position=[...r.position] as [number,number,number];
  }
  const slotId=String(r.slotId??'');
  if(typeof r.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(r.id)||ids.has(r.id)||(!slot&&!position)||!/^[a-zA-Z0-9_-]{1,80}$/.test(slotId)||occupied.has(slotId))throw new Error('Invalid or duplicate interior position.');
  ids.add(r.id);occupied.add(slotId);
  if(!['desk','chair','lamp','wall-art','agent'].includes(String(r.kind))||(!position&&(r.kind==='wall-art')!==(slot?.type==='frame')))throw new Error('Choose a compatible location.');
  const category={desk:'desk',chair:'seating',lamp:'lamp',agent:'display'}[r.kind as 'desk'|'chair'|'lamp'|'agent'];
  if(!position&&slot?.type==='furniture'&&!slot.allowedCategories.includes(category))throw new Error('This location does not allow that furnishing.');
  if(typeof r.rotationY!=='number'||!Number.isFinite(r.rotationY)||Math.abs(r.rotationY)>Math.PI*2)throw new Error('Invalid furnishing rotation.');
  const item:InteriorItem={id:r.id,kind:r.kind as InteriorItem['kind'],slotId,rotationY:r.rotationY,...(position?{position}:{})};
  if(item.kind==='wall-art'){
   if(typeof r.image!=='string'||r.image.length>140000||!/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(r.image))throw new Error('Upload a PNG image of at most 100 KB.');
   try{
    const bytes=Uint8Array.from(atob(r.image.slice(22)),c=>c.charCodeAt(0));
    const view=new DataView(bytes.buffer);
    if(bytes.length<45||view.getUint32(0)!==0x89504e47||view.getUint32(4)!==0x0d0a1a0a||view.getUint32(8)!==13||view.getUint32(12)!==0x49484452||view.getUint32(bytes.length-8)!==0x49454e44||view.getUint32(bytes.length-4)!==0xae426082)throw new Error();
    const width=view.getUint32(16),height=view.getUint32(20);
    if(!width||!height||width>512||height>512)throw new Error();
   }catch{throw new Error('Wall artwork must be a valid PNG no larger than 512 × 512 pixels.');}
   item.image=r.image;item.href=safeInteriorLink(r.href);
  }
  if(item.kind==='agent'){
   if(typeof r.agentId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(r.agentId))throw new Error('Choose an existing public agent.');
   item.agentId=r.agentId;
  }
  if(typeof r.label==='string')item.label=r.label.trim().slice(0,80);
  return item;
 });
}
export function validatePlacementInteriors(chunks:Array<{placementsJson:unknown}>,assetIds:Set<string>|Map<string,string>){
 for(const chunk of chunks){if(!Array.isArray(chunk.placementsJson))throw new Error('Invalid placement list.');for(const p of chunk.placementsJson){
  if(!p||typeof p!=='object')throw new Error('Invalid placement.');
  if(p.interior!==undefined){if(!assetIds.has(p.assetId))throw new Error('This asset does not support interior editing.');p.interior=validateInterior(p.interior,false,assetIds instanceof Map?assetIds.get(p.assetId):undefined);}
 }}
}
export const INTERIOR_MODEL=STOREFRONT.modelUrl;
