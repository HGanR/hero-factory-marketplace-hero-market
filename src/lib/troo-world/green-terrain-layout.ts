import {validateStadiumSettings,type StadiumSettings} from './stadium-events';
/** The editor and public town share this exact, versioned presentation contract. */
export const GREEN_WORLD_ID = 'green-terrain';
export const BUILDING_IDS = ['nexus-tower','meridian-tower','troothhertz-tower','stadium-elyseum','veritas-school'] as const;
export type BuildingId = typeof BUILDING_IDS[number];
export type Vec3 = [number,number,number];
export type ObjectKind = 'street'|'sidewalk'|'lake'|'pond'|'bench'|'lightpost'|'parkinglot';
export type BuildingState = {position:Vec3;scale:number;rotationY:number;visible:boolean};
export type AirportDestination = {id:string;name:string;url:string};
export type GreenLayout = {
 version:1; buildings:Record<BuildingId,BuildingState>;
 trees:Array<{id:number;pos:Vec3;scale:number;phase:number}>;
 objects:Array<{id:string;type:ObjectKind;position:Vec3;rotation:Vec3;scale:number}>;
 imports:Array<{elementKey:string;glbUrl:string;position:Vec3;scale:number;rotationY:number;destinations?:AirportDestination[]}>;
 ambient:{enabled:boolean;sidewalks:boolean};
 stadium?:StadiumSettings;
};
export class LayoutError extends Error {}
const object=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new LayoutError('Invalid layout object');return v as Record<string,unknown>};
const num=(v:unknown,min=-1000,max=1000)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new LayoutError('Invalid layout number');return v};
const bool=(v:unknown)=>{if(typeof v!=='boolean')throw new LayoutError('Invalid layout switch');return v};
const str=(v:unknown,max=120)=>{if(typeof v!=='string'||!v.trim()||v.length>max||/[\u0000-\u001f]/.test(v))throw new LayoutError('Invalid layout text');return v};
const vec=(v:unknown):Vec3=>{if(!Array.isArray(v)||v.length!==3)throw new LayoutError('Invalid layout vector');return [num(v[0]),num(v[1]),num(v[2])]};
const list=(v:unknown,max:number):unknown[]=>{if(!Array.isArray(v)||v.length>max)throw new LayoutError('Layout exceeds object limit');return v};
const kinds=['street','sidewalk','lake','pond','bench','lightpost','parkinglot'];
export function modelUrl(value:unknown){const url=str(value,1500);if(url==='procedural:apex'||url==='procedural:harborview')return url;if(/^\/(?!\/)[^\s\\]*$/.test(url))return url;try{const u=new URL(url);if(u.protocol==='https:'&&!u.username&&!u.password&&(/(^|\.)(ipfs.io|mypinata.cloud|pinata.cloud)$/.test(u.hostname)))return url}catch{}throw new LayoutError('Only same-site model URLs or supported IPFS gateways are allowed')}
/** Curated hyperlinks only; destination URLs are never fetched by the server. */
export function destinationUrl(value:unknown){
 const url=str(value,1500).trim();
 if(/^\/(?!\/)[^\s\\]*$/.test(url))return url;
 try{const u=new URL(url);if(u.protocol==='https:'&&!u.username&&!u.password)return url;}catch{}
 throw new LayoutError('Use an HTTPS world URL or a same-site path.');
}
export function validateDestinations(value:unknown):AirportDestination[]{
 const rows=list(value,24).map(value=>{const r=object(value);return{id:str(r.id,80),name:str(r.name,80).trim(),url:destinationUrl(r.url)};});
 if(new Set(rows.map(r=>r.id)).size!==rows.length)throw new LayoutError('Duplicate flight destination.');
 return rows;
}
export function validateLayout(input:unknown):GreenLayout{
 const v=object(input);if(v.version!==1)throw new LayoutError('Unsupported layout version');
 if(Object.keys(v).some(k=>!['version','buildings','trees','objects','imports','ambient','stadium'].includes(k)))throw new LayoutError('Unknown layout field');
 const b=object(v.buildings),buildings={} as GreenLayout['buildings'];
 for(const id of BUILDING_IDS){const row=object(b[id]);buildings[id]={position:vec(row.position),scale:num(row.scale,.05,20),rotationY:num(row.rotationY,-Math.PI*20,Math.PI*20),visible:bool(row.visible)}}
 const trees=list(v.trees,1000).map(x=>{const r=object(x);const id=num(r.id,0,1000000000);if(!Number.isInteger(id))throw new LayoutError('Invalid tree ID');return{id,pos:vec(r.pos),scale:num(r.scale,.05,20),phase:num(r.phase,0,1000)}});
 const objects=list(v.objects,400).map(x=>{const r=object(x);if(!kinds.includes(String(r.type)))throw new LayoutError('Unsupported environment object');return{id:str(r.id),type:r.type as ObjectKind,position:vec(r.position),rotation:vec(r.rotation),scale:num(r.scale,.05,20)}});
 const imports=list(v.imports,100).map(x=>{const r=object(x);return{elementKey:str(r.elementKey,80),glbUrl:modelUrl(r.glbUrl),position:vec(r.position),scale:num(r.scale,.05,20),rotationY:num(r.rotationY,-Math.PI*20,Math.PI*20),...(r.destinations===undefined?{}:{destinations:validateDestinations(r.destinations)})}});
 for(const rows of [trees,objects,imports]){const ids=rows.map(r=>'id'in r?r.id:r.elementKey);if(new Set(ids).size!==ids.length)throw new LayoutError('Duplicate layout identity')}
 if(imports.some(r=>(BUILDING_IDS as readonly string[]).includes(r.elementKey)))throw new LayoutError('Imported model duplicates a built-in building');
 let stadium:StadiumSettings|undefined;
 if(v.stadium!==undefined){try{stadium=validateStadiumSettings(v.stadium)}catch(error){throw new LayoutError(error instanceof Error?error.message:'Invalid stadium settings')}}
 const a=object(v.ambient);return{version:1,buildings,trees,objects,imports,ambient:{enabled:bool(a.enabled),sidewalks:bool(a.sidewalks)},...(stadium?{stadium}:{})};
}
export const DEFAULT_BUILDINGS:GreenLayout['buildings']={
 'nexus-tower':{position:[-25,0,0],scale:1,rotationY:0,visible:true},
 'meridian-tower':{position:[25,0,0],scale:1,rotationY:0,visible:true},
 'troothhertz-tower':{position:[0,0,-35],scale:1,rotationY:0,visible:true},
 'stadium-elyseum':{position:[0,0,60],scale:1,rotationY:0,visible:true},
 'veritas-school':{position:[-55,0,30],scale:1,rotationY:0,visible:true},
};
/** Read-only legacy bridge: never copies default into green-terrain or writes while viewing. */
export function legacyLayout(placements:Record<string,unknown>[],elements:Record<string,unknown>[]):GreenLayout{
 const buildings=structuredClone(DEFAULT_BUILDINGS);for(const id of BUILDING_IDS)buildings[id].visible=false;
 const objects:GreenLayout['objects']=[],imports:GreenLayout['imports']=[];
 for(const p of placements){const id=String(p.elementKey);const position:Vec3=[Number(p.posX),Number(p.posY),Number(p.posZ)];const scale=Number(p.scale??1),rot=Number(p.rotY??0);
  if((BUILDING_IDS as readonly string[]).includes(id))buildings[id as BuildingId]={position,scale,rotationY:rot*Math.PI/180,visible:true};
  else{const kind=kinds.find(k=>id===k||id.startsWith(k+'-'));if(kind)objects.push({id,type:kind as ObjectKind,position,scale,rotation:[0,rot,0]});else imports.push({elementKey:id,glbUrl:String(p.glbUrl),position,scale,rotationY:rot*Math.PI/180})}
 }
 const trees=elements.filter(e=>e.type==='tree').map((e,i)=>({id:Number(e.id??i),pos:[Number(e.posX),Number(e.posY),Number(e.posZ)] as Vec3,scale:Number(e.scale??1),phase:i%10}));
 return validateLayout({version:1,buildings,objects,imports,trees,ambient:{enabled:false,sidewalks:false}});
}
