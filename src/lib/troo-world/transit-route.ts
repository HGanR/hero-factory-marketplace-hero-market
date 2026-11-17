import {nextGreenEntry,STOP_LINE,type TrafficAxis} from './traffic-signals';
import {roadsFor,type Road} from './ambient-town';
import {transitSettings} from './transit-settings';
import type {GreenLayout,Vec3} from './green-terrain-layout';
export const BUS_SIZE={width:3.105,length:13,height:3.57};
/** A straight road corridor, merged only across touching, collinear segments. */
export function transitCorridor(p:GreenLayout['imports'][number],layout:Pick<GreenLayout,'objects'>){
 const s=transitSettings(p),yaw=s.axis==='north-south'?0:Math.PI/2,sin=Math.sin(yaw),cos=Math.cos(yaw);
 const along=(v:Vec3)=>v[0]*sin+v[2]*cos,lateral=(v:Vec3)=>v[0]*cos-v[2]*sin;
 const candidates=roadsFor(layout).filter(r=>Math.abs(Math.sin(r.yaw-yaw))<.02);if(!candidates.length)return null;
 const distance=(r:Road)=>Math.hypot(lateral(p.position)-lateral(r.center),Math.max(0,Math.abs(along(p.position)-along(r.center))-r.length/2));
 candidates.sort((a,b)=>distance(a)-distance(b));const first=candidates[0],line=lateral(first.center);let start=along(first.center)-first.length/2,end=along(first.center)+first.length/2,width=first.width;
 for(let pass=0;pass<candidates.length;pass++)for(const r of candidates){const a=along(r.center)-r.length/2,b=along(r.center)+r.length/2;if(Math.abs(lateral(r.center)-line)<.25&&a<=end+.5&&b>=start-.5){start=Math.min(start,a);end=Math.max(end,b);width=Math.min(width,r.width);}}
 return{start,end,width,line,yaw,height:first.center[1]};
}
export function transitPose(p:GreenLayout['imports'][number],layout:Pick<GreenLayout,'objects'>,time:number,road:ReturnType<typeof transitCorridor>=transitCorridor(p,layout)){
 const settings=transitSettings(p);if(!road||BUS_SIZE.width*p.scale>road.width/2-.4)return null;
 const sin=Math.sin(road.yaw),cos=Math.cos(road.yaw),margin=BUS_SIZE.length*p.scale/2+2,low=road.start-margin,span=road.end-road.start+2*margin;
 const direction=Math.cos(p.rotationY-road.yaw)>=0?1:-1;
 const initial=p.position[0]*sin+p.position[2]*cos,offset=Math.max(0,Math.min(span,direction>0?initial-low:low+span-initial));
 let distance=((time*settings.speed+offset)%(span*(settings.mode==='shuttle'?2:1))+span*(settings.mode==='shuttle'?2:1))%(span*(settings.mode==='shuttle'?2:1));
 let sign=direction,at:number;
 if(settings.mode==='shuttle'){if(distance>span){distance=2*span-distance;sign=-sign;}at=direction>0?low+distance:low+span-distance;}else at=direction>0?low+distance:low+span-distance;
 const lane=-sign*road.width/4,across=road.line+lane;
 return{position:[sin*at+cos*across,p.position[1]+road.height+.01,cos*at-sin*across] as Vec3,yaw:road.yaw+(sign<0?Math.PI:0),visible:at>=road.start-1&&at<=road.end+1,destination:settings.axis==='north-south'?(sign>0?'TROO SOUTH':'TROO NORTH'):(sign>0?'TROO EAST':'TROO WEST')};
}

export const TRANSIT_BREAK_SECONDS=30*60;
type Placement=GreenLayout['imports'][number];
type Corridor=NonNullable<ReturnType<typeof transitCorridor>>;
export type TransitServicePose={position:Vec3;yaw:number;visible:boolean;destination:string;stopped:boolean;onBreak:boolean;breakRemaining:number;axis:TrafficAxis};
/** Cache the exact timetable; no frame integration, drift or per-visitor route clock. */
export function createTransitService(p:Placement,layout:Pick<GreenLayout,'objects'>){
 const settings=transitSettings(p),both=settings.axis==='both';
 const corridors={
  'north-south':transitCorridor({...p,transit:{...settings,axis:'north-south'}},layout),
  'east-west':transitCorridor({...p,transit:{...settings,axis:'east-west'}},layout),
 };
 function leg(start:number,axis:TrafficAxis,sign:number){
  const road=corridors[axis];if(!road||BUS_SIZE.width*p.scale>road.width/2-.4)return null;
  const margin=BUS_SIZE.length*p.scale/2+2,from=sign>0?road.start-margin:road.end+margin,to=sign>0?road.end+margin:road.start-margin;
  const stop=-sign*(STOP_LINE+6.9*p.scale),distance=Math.abs(to-from);
  const controlled=Math.abs(road.line)<.25&&road.start< -STOP_LINE&&road.end>STOP_LINE;
  const approach=Math.max(0,Math.min(distance,(stop-from)*sign))/settings.speed,arrival=start+approach;
  const entry=controlled?nextGreenEntry(axis,arrival,(2*STOP_LINE+BUS_SIZE.length*p.scale)/settings.speed):arrival;
  return{start,end:start+distance/settings.speed+entry-arrival,axis,sign,road,from,to,stop,arrival,entry};
 }
 function plan(start:number,returning=false){
  const axis:TrafficAxis=settings.axis==='east-west'?'east-west':'north-south',sign=both?1:(Math.cos(p.rotationY-(axis==='north-south'?0:Math.PI/2))>=0?1:-1)*(returning?-1:1);
  const first=leg(start,axis,sign);if(!first)return null;
  const second=both?leg(first.end+2,'east-west',-1):null;if(both&&!second)return null;
  const end=second?.end??first.end;
  return{start,first,second,end,next:end+(both?TRANSIT_BREAK_SECONDS:2),returning};
 }
 let current=plan(0);
 function pose(l:NonNullable<ReturnType<typeof leg>>,time:number):TransitServicePose{
  const {road,sign}=l,sin=Math.sin(road.yaw),cos=Math.cos(road.yaw);
  const stopped=time>=l.arrival&&time<l.entry;
  const travel=Math.max(0,time-l.start)-Math.max(0,Math.min(time,l.entry)-l.arrival),at=Math.max(Math.min(l.from,l.to),Math.min(Math.max(l.from,l.to),l.from+sign*settings.speed*travel)),across=road.line-sign*road.width/4;
  return{position:[sin*at+cos*across,p.position[1]+road.height+.01,cos*at-sin*across],yaw:road.yaw+(sign<0?Math.PI:0),visible:time>=l.start&&time<l.end&&at>=road.start-1&&at<=road.end+1,destination:l.axis==='north-south'?(sign>0?'TROO SOUTH':'TROO NORTH'):(sign>0?'TROO EAST':'TROO WEST'),stopped,onBreak:false,breakRemaining:0,axis:l.axis};
 }
 return(time:number):TransitServicePose|null=>{
  if(!Number.isFinite(time)||time<0)return null;
  if(!current||time<current.start)current=plan(0);
  while(current&&time>=current.next)current=plan(current.next,!both&&settings.mode==='shuttle'?!current.returning:false);
  if(!current)return null;
  if(time<current.first.end)return pose(current.first,time);
  if(current.second&&time>=current.second.start&&time<current.second.end)return pose(current.second,time);
  const last=current.second??current.first,result=pose(last,last.end);
  return{...result,visible:false,stopped:true,onBreak:both&&time>=current.end,breakRemaining:both&&time>=current.end?current.next-time:0};
 };
}
