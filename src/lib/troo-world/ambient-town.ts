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
function straightWalkwaysFor(layout:GreenLayout):Walkway[]{
 const roads=roadsFor(layout),obstacles=obstaclesFor(layout),out:Walkway[]=[];
 for(const[rid,road]of roads.entries())for(const side of[-1,1]){
  const offset=side*(road.width/2+1.6),origin:Walkway={id:rid+':'+side,center:road.center,yaw:road.yaw,length:road.length,width:2.4};
  let start:number|null=null;
  const finish=(end:number)=>{if(start!==null&&end-start>=5){const center=pointOn(origin,(start+end)/2,offset);center[1]=road.center[1]+.08;out.push({...origin,id:origin.id+':'+start,center,length:end-start-1.6})}start=null};
  for(let t=-road.length/2+1;t<=road.length/2-1;t+=.5){const p=pointOn(origin,t,offset);const safe=[-.8,0,.8].every(l=>{const q=pointOn({...origin,center:p},0,l);return!onRoad(q,roads)&&!atBuilding(q,obstacles)});if(safe){if(start===null)start=t}else finish(t-.5)}
  finish(road.length/2-1);
 }
 return out.slice(0,60);
}
/** Connect safe pavement ends around curbs and placed obstacles, never across a road. */
export function walkwaysFor(layout:GreenLayout):Walkway[]{
 const base=straightWalkwaysFor(layout),roads=roadsFor(layout),obstacles=obstaclesFor(layout);
 if(!base.length)return base;
 let remainingChecks=20000; // Keep automatic junction generation bounded on large editor scenes.
 const safe=(p:Vec3)=>--remainingChecks>=0&&[-.8,0,.8].every(x=>[-.8,0,.8].every(z=>!onRoad([p[0]+x,p[1],p[2]+z],roads,.6)&&!atBuilding([p[0]+x,p[1],p[2]+z],obstacles)));
 const edgeSafe=(a:Vec3,b:Vec3)=>{const length=Math.hypot(a[0]-b[0],a[2]-b[2]);for(let i=0;i<=Math.ceil(length/.5);i++){const t=i/Math.max(1,Math.ceil(length/.5));if(!safe([a[0]+(b[0]-a[0])*t,a[1],a[2]+(b[2]-a[2])*t]))return false;}return true};
 const ends=base.flatMap((w,i)=>[-1,1].map(side=>({p:pointOn(w,side*w.length/2),component:i})));
 const parent=base.map((_,i)=>i),find=(i:number):number=>parent[i]===i?i:(parent[i]=find(parent[i]));
 const pairs:Array<{a:number;b:number;distance:number}>=[];
 for(let a=0;a<ends.length;a++)for(let b=a+1;b<ends.length;b++){const distance=Math.hypot(ends[a].p[0]-ends[b].p[0],ends[a].p[2]-ends[b].p[2]);if(ends[a].component!==ends[b].component&&distance<=70)pairs.push({a,b,distance});}
 pairs.sort((a,b)=>a.distance-b.distance);
 const links:Walkway[]=[];
 function detour(start:Vec3,end:Vec3):Vec3[]|null{
  if(edgeSafe(start,end))return[start,end];
  const step=2,key=(x:number,z:number)=>x+','+z;
  const minX=Math.min(start[0],end[0])-18,maxX=Math.max(start[0],end[0])+18,minZ=Math.min(start[2],end[2])-18,maxZ=Math.max(start[2],end[2])+18;
  type Node={x:number;z:number;cost:number;score:number;previous?:Node};
  const open:Node[]=[{x:start[0],z:start[2],cost:0,score:0}],best=new Map<string,number>();
  for(let attempts=0;open.length&&attempts<3500;attempts++){
   let index=0;for(let i=1;i<open.length;i++)if(open[i].score<open[index].score)index=i;
   const n=open.splice(index,1)[0],p:Vec3=[n.x,start[1],n.z];
   if(Math.hypot(n.x-end[0],n.z-end[2])<=3&&edgeSafe(p,end)){const points:Vec3[]=[end];let current:Node|undefined=n;while(current){points.push([current.x,start[1],current.z]);current=current.previous;}return points.reverse();}
   for(const[dx,dz]of [[step,0],[-step,0],[0,step],[0,-step]]){const x=n.x+dx,z=n.z+dz,cost=n.cost+step,k=key(x,z);if(x<minX||x>maxX||z<minZ||z>maxZ||(best.get(k)??Infinity)<=cost||!edgeSafe(p,[x,start[1],z]))continue;best.set(k,cost);open.push({x,z,cost,score:cost+Math.hypot(x-end[0],z-end[2]),previous:n});}
  }return null;
 }
 for(const pair of pairs){if(remainingChecks<=0)break;const a=ends[pair.a],b=ends[pair.b];if(find(a.component)===find(b.component))continue;
  const points=detour(a.p,b.p);if(!points)continue;
  parent[find(a.component)]=find(b.component);
  // Collapse collinear grid edges, keeping the exact first/last junction coordinates.
  const simplified:Vec3[]=[];for(const p of points){while(simplified.length>=2){const a=simplified[simplified.length-2],b=simplified[simplified.length-1];if(Math.abs((b[0]-a[0])*(p[2]-b[2])-(b[2]-a[2])*(p[0]-b[0]))>.001)break;simplified.pop();}simplified.push(p);}
  for(let i=1;i<simplified.length;i++){const a=simplified[i-1],b=simplified[i],length=Math.hypot(b[0]-a[0],b[2]-a[2]);if(length<.01)continue;links.push({id:'junction-'+links.length,center:[(a[0]+b[0])/2,a[1],(a[2]+b[2])/2],yaw:Math.atan2(b[0]-a[0],b[2]-a[2]),length,width:1.6});}
 }
 return [...base,...links];
}
export type PedestrianRoute={points:Vec3[];length:number};
/** Walkers visit successive pavement edges instead of bouncing on a single slab. */
export function pedestrianRoutes(paths:Walkway[]):PedestrianRoute[]{
 const nodes:Array<{p:Vec3;edges:number[]}>=[],edges:Array<[number,number]>=[];
 function node(p:Vec3){let i=nodes.findIndex(n=>Math.hypot(n.p[0]-p[0],n.p[2]-p[2])<.05);if(i<0){i=nodes.length;nodes.push({p,edges:[]})}return i;}
 for(const w of paths){const a=node(pointOn(w,-w.length/2)),b=node(pointOn(w,w.length/2));edges.push([a,b]);nodes[a].edges.push(b);nodes[b].edges.push(a);}
 const seen=new Set<number>(),routes:PedestrianRoute[]=[];
 for(let start=0;start<nodes.length;start++){if(seen.has(start))continue;const points:Vec3[]=[];function visit(i:number){seen.add(i);points.push(nodes[i].p);for(const next of nodes[i].edges)if(!seen.has(next)){visit(next);points.push(nodes[i].p)}}visit(start);const length=points.slice(1).reduce((n,p,i)=>n+Math.hypot(p[0]-points[i][0],p[2]-points[i][2]),0);if(length>0)routes.push({points,length});}
 return routes;
}
export function pedestrianRoutePose(route:PedestrianRoute,index:number,time:number){
 let distance=((time*.85+index*13)%route.length+route.length)%route.length;
 for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i],length=Math.hypot(b[0]-a[0],b[2]-a[2]);if(distance<=length){const t=distance/length;return{position:[a[0]+(b[0]-a[0])*t,a[1],a[2]+(b[2]-a[2])*t] as Vec3,yaw:Math.atan2(b[0]-a[0],b[2]-a[2]),walking:true}}distance-=length;}
 return{position:route.points[0],yaw:0,walking:false};
}
export function pedestrianPose(w:Walkway,index:number,time:number){
 const period=24+(index%5)*3,phase=((time+index*4)%period)/period,move=phase<.42?phase/.42:phase<.5?1:phase<.92?1-(phase-.5)/.42:0;
 const walking=phase<.42||(phase>=.5&&phase<.92),along=(move-.5)*Math.max(0,w.length-3);
 return{position:pointOn(w,along,(index%2?1:-1)*.35),yaw:w.yaw+(phase<.5?0:Math.PI),walking};
}

