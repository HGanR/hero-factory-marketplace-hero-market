import type {GreenLayout,Vec3} from './green-terrain-layout';
export type Road={center:Vec3;yaw:number;length:number;width:number};
export type Walkway={id:string;center:Vec3;yaw:number;length:number;width:number};
export type Obstacle={x:number;z:number;halfX:number;halfZ:number;yaw:number};
const local=(p:Vec3,c:Vec3,yaw:number)=>{const x=p[0]-c[0],z=p[2]-c[2];return[x*Math.cos(yaw)-z*Math.sin(yaw),x*Math.sin(yaw)+z*Math.cos(yaw)]};
export function onRoad(p:Vec3,roads:Road[],margin=.6){return roads.some(r=>{const[x,z]=local(p,r.center,r.yaw);return Math.abs(x)<=r.width/2+margin&&Math.abs(z)<=r.length/2+margin})}
export function atBuilding(p:Vec3,obstacles:Obstacle[]){return obstacles.some(b=>{const[x,z]=local(p,[b.x,0,b.z],b.yaw);return Math.abs(x)<=b.halfX+.8&&Math.abs(z)<=b.halfZ+.8})}
export function pointOn(w:Walkway,along:number,lateral=0):Vec3{return[w.center[0]+Math.cos(w.yaw)*lateral+Math.sin(w.yaw)*along,w.center[1],w.center[2]-Math.sin(w.yaw)*lateral+Math.cos(w.yaw)*along]}
export function roadsFor(layout:Pick<GreenLayout,'objects'>):Road[]{return[
 {center:[0,.35,-47.5],yaw:0,length:95,width:10},{center:[0,.35,47.5],yaw:0,length:95,width:10},
 {center:[47.5,.35,0],yaw:Math.PI/2,length:95,width:10},{center:[-47.5,.35,0],yaw:Math.PI/2,length:95,width:10},
 ...layout.objects.filter(o=>o.type==='street').map(o=>({center:o.position,yaw:o.rotation[1],length:20*o.scale,width:8*o.scale})),
]}
export function obstaclesFor(layout:GreenLayout):Obstacle[]{
 const dimensions:Record<string,[number,number]>={'nexus-tower':[15,15],'meridian-tower':[15,15],'troothhertz-tower':[20,20],'stadium-elyseum':[45,45],'veritas-school':[37,28]};
 return[...Object.entries(layout.buildings).filter(([,b])=>b.visible).map(([id,b])=>({x:b.position[0],z:b.position[2],halfX:dimensions[id][0]*b.scale,halfZ:dimensions[id][1]*b.scale,yaw:b.rotationY})),
 ...layout.imports.map(b=>({x:b.position[0],z:b.position[2],halfX:20*b.scale,halfZ:20*b.scale,yaw:b.rotationY})),
 ...layout.objects.filter(o=>['lake','pond','parkinglot'].includes(o.type)).map(o=>({x:o.position[0],z:o.position[2],halfX:12*o.scale,halfZ:12*o.scale,yaw:o.rotation[1]}))];
}
/** Split at every intersection/obstacle; NPCs never cross streets or teleport between routes. */
export function walkwaysFor(layout:GreenLayout):Walkway[]{
 const roads=roadsFor(layout),obstacles=obstaclesFor(layout),out:Walkway[]=[];
 for(const[rid,road]of roads.entries())for(const side of[-1,1]){
  const offset=side*(road.width/2+1.6),origin:Walkway={id:rid+':'+side,center:road.center,yaw:road.yaw,length:road.length,width:2.4};
  let start:number|null=null;
  const finish=(end:number)=>{if(start!==null&&end-start>=5){const center=pointOn(origin,(start+end)/2,offset);center[1]=road.center[1]+.08;out.push({...origin,id:origin.id+':'+start,center,length:end-start})}start=null};
  for(let t=-road.length/2+1;t<=road.length/2-1;t+=.5){const p=pointOn(origin,t,offset);const safe=[-.8,0,.8].every(l=>{const q=pointOn({...origin,center:p},0,l);return!onRoad(q,roads)&&!atBuilding(q,obstacles)});if(safe){if(start===null)start=t}else finish(t-.5)}
  finish(road.length/2-1);
 }
 return out.slice(0,60);
}
export function pedestrianPose(w:Walkway,index:number,time:number){
 const period=24+(index%5)*3,phase=((time+index*4)%period)/period,move=phase<.42?phase/.42:phase<.5?1:phase<.92?1-(phase-.5)/.42:0;
 const walking=phase<.42||(phase>=.5&&phase<.92),along=(move-.5)*Math.max(0,w.length-3);
 return{position:pointOn(w,along,(index%2?1:-1)*.35),yaw:w.yaw+(phase<.5?0:Math.PI),walking};
}
