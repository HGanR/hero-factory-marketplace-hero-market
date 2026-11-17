export const TRANSIT_BUS_URL='/models/green-terrain/troo-transit-bus.glb';
export type TransitSettings={enabled:boolean;axis:'north-south'|'east-west'|'both';mode:'wrap'|'shuttle';speed:number};
export const isTransitBus=(p:{glbUrl:string})=>p.glbUrl.split(/[?#]/)[0]===TRANSIT_BUS_URL;
export function transitSettings(p:{rotationY:number;transit?:TransitSettings}):TransitSettings{return p.transit??{enabled:true,axis:'both',mode:'wrap',speed:6};}
export function validateTransitSettings(value:unknown):TransitSettings{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid bus route.');const r=value as Record<string,unknown>;
 if(Object.keys(r).some(k=>!['enabled','axis','mode','speed'].includes(k))||typeof r.enabled!=='boolean'||!['north-south','east-west','both'].includes(String(r.axis))||!['wrap','shuttle'].includes(String(r.mode))||typeof r.speed!=='number'||!Number.isFinite(r.speed)||r.speed<1||r.speed>12)throw Error('Invalid bus route settings.');
 return{enabled:r.enabled,axis:r.axis as TransitSettings['axis'],mode:r.mode as TransitSettings['mode'],speed:r.speed};
}
