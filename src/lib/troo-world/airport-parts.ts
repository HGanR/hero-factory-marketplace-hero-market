import type {Vec3,GreenLayout} from './green-terrain-layout';
export const AIRPORT_PART_IDS=['terminal','runway','tower','airplane'] as const;
export type AirportPartId=typeof AIRPORT_PART_IDS[number];
export type AirportPart={offset:Vec3;scale:number;rotationY:number;stretch?:Vec3};
export type AirportParts=Record<AirportPartId,AirportPart>;
export const AIRPORT_PART_NAMES:Record<AirportPartId,string>={terminal:'Terminal',runway:'Runway',tower:'Control tower',airplane:'Airplane'};
export const AIRPORT_PIVOTS:Record<AirportPartId,Vec3>={terminal:[0,0,114],runway:[0,0,0],tower:[140,0,115],airplane:[0,4.2,60]};
export const identityAirportParts=():AirportParts=>Object.fromEntries(AIRPORT_PART_IDS.map(id=>[id,{offset:[0,0,0],scale:1,rotationY:0}])) as AirportParts;
/** Existing placements retain their original shape until explicitly edited. */
export function fitAirportParts(parentScale:number):AirportParts{
 const parts=identityAirportParts();parts.runway={offset:[0,0,0],scale:1/parentScale,rotationY:0,stretch:[.25,1,2]};
 parts.terminal={offset:[0,0,74.2/parentScale-114],scale:.3/parentScale,rotationY:0};
 parts.tower={offset:[40/parentScale-140,0,72.3/parentScale-115],scale:.3/parentScale,rotationY:0};parts.airplane.scale=1/parentScale;return parts;
}
export function partPoint(point:Vec3,id:AirportPartId,parts:AirportParts):Vec3{
 const p=parts[id],pivot=AIRPORT_PIVOTS[id],stretch=p.stretch??[1,1,1],x=(point[0]-pivot[0])*p.scale*stretch[0],z=(point[2]-pivot[2])*p.scale*stretch[2],c=Math.cos(p.rotationY),s=Math.sin(p.rotationY);
 return[pivot[0]+p.offset[0]+x*c+z*s,pivot[1]+p.offset[1]+(point[1]-pivot[1])*p.scale*stretch[1],pivot[2]+p.offset[2]-x*s+z*c];
}
export function airportGate(parts:AirportParts):Vec3{
 const front=partPoint([0,0,100],'terminal',parts),distance=17*parts.airplane.scale+23*parts.terminal.scale,yaw=parts.terminal.rotationY;
 return[front[0]-Math.sin(yaw)*distance+parts.airplane.offset[0],parts.terminal.offset[1]+4.2*parts.airplane.scale+parts.airplane.offset[1],front[2]-Math.cos(yaw)*distance+parts.airplane.offset[2]];
}
/** Taxi transitions follow the gate; takeoff/landing stay on the edited runway. */
export function airportFlightPoint(point:Vec3,parts:AirportParts,ground=false):Vec3{
 const w=Math.max(0,Math.min(1,point[2]/60)),gate=airportGate(parts),base=partPoint([point[0],0,point[2]],'runway',parts),oldGate=partPoint([0,0,60],'runway',parts);
 return[base[0]+w*(gate[0]-oldGate[0]),ground?base[1]+point[1]*parts.runway.scale+w*(parts.terminal.offset[1]-parts.runway.offset[1]):base[1]+(point[1]-4.2)*parts.runway.scale+4.2*parts.airplane.scale+w*(gate[1]-parts.runway.offset[1]-4.2*parts.airplane.scale),base[2]+w*(gate[2]-oldGate[2])];
}
export function airportPartOrigin(placement:GreenLayout['imports'][number],id:AirportPartId):Vec3{
 const parts=placement.airportParts??identityAirportParts(),p=id==='airplane'?airportGate(parts):partPoint(AIRPORT_PIVOTS[id],id,parts),c=Math.cos(placement.rotationY),s=Math.sin(placement.rotationY),k=placement.scale;
 return[placement.position[0]+k*(p[0]*c+p[2]*s),placement.position[1]+k*p[1],placement.position[2]+k*(-p[0]*s+p[2]*c)];
}
export function moveAirportPart(placement:GreenLayout['imports'][number],id:AirportPartId,world:Vec3){
 const origin=airportPartOrigin(placement,id),dx=(world[0]-origin[0])/placement.scale,dz=(world[2]-origin[2])/placement.scale,c=Math.cos(placement.rotationY),s=Math.sin(placement.rotationY),parts=placement.airportParts??identityAirportParts();
 return{...placement,airportParts:{...parts,[id]:{...parts[id],offset:[parts[id].offset[0]+dx*c-dz*s,parts[id].offset[1]+(world[1]-origin[1])/placement.scale,parts[id].offset[2]+dx*s+dz*c] as Vec3}}};
}

export function airportHeading(z:number,parts:AirportParts){const w=Math.max(0,Math.min(1,z/60)),delta=Math.atan2(Math.sin(parts.terminal.rotationY-parts.runway.rotationY),Math.cos(parts.terminal.rotationY-parts.runway.rotationY));return parts.runway.rotationY+delta*w+parts.airplane.rotationY*w;}
