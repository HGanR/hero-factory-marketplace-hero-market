import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {STADIUM_ACCESS as A} from './stadium-navigation';
export const VENUE_NAME='TROOTHHERTZ STADIUM';
export const VENUE={stageRadius:9,guestRadius:18,wallRadius:70,ceilingY:36,screenY:26,screenZ:-63,aisleHalfWidth:5.2} as const;
export type VenueSeat={x:number;y:number;z:number;yaw:number;guest:boolean};
/** Four radial circulation corridors are excluded before any seat is placed. */
export function venueSeats():VenueSeat[]{
 const rows=[...Array.from({length:8},(_,i)=>({r:30+i*3.3,y:1.3+i*1.86})),...Array.from({length:3},(_,i)=>({r:62+i*2.5,y:17+i*2.3}))];
 const seats:VenueSeat[]=[];
 rows.forEach(({r,y},row)=>{const count=Math.floor(2*Math.PI*r/3.4);for(let i=0;i<count;i++){const a=(i+.5)*2*Math.PI/count,x=Math.sin(a)*r,z=Math.cos(a)*r;
  if(Math.min(Math.abs(x),Math.abs(z))<VENUE.aisleHalfWidth+1.4)continue;
  // Reserve a clear sightline and service bay behind the raised main LED wall.
  if(row>=8&&z< -57&&Math.abs(x)<21)continue;
  seats.push({x,y,z,yaw:a+Math.PI,guest:false});
 }});
 for(let i=0;i<12;i++){const a=(i+.5)*Math.PI*2/12;seats.push({x:Math.sin(a)*14,y:A.arenaY,z:Math.cos(a)*14,yaw:a+Math.PI,guest:true});}
 return seats;
}
export function inVenueAisle(x:number,z:number,margin=0){return Math.min(Math.abs(x),Math.abs(z))<VENUE.aisleHalfWidth+margin;}
/** Deterministic geometric renovation, owned by this clone; cached GLB stays untouched. */
export function renovateStadium(scene:THREE.Object3D){
 const root=new THREE.Group();root.name='Stadium_Renovation';root.userData.renovated=true;
 const materials:THREE.Material[]=[],geometries:THREE.BufferGeometry[]=[];
 const material=(color:string,metalness=.15,roughness=.7,emissive?:string)=>{const m=new THREE.MeshStandardMaterial({color,metalness,roughness,...(emissive?{emissive,emissiveIntensity:1.4}:{})});materials.push(m);return m;};
 const navy=material('#102b40'),charcoal=material('#19232f'),carpet=material('#263443',0,.95),teal=material('#146878',.15,.6),seatBack=material('#174453',.1,.8),gold=material('#b89355',.75,.28),warm=material('#ffe0a0',.15,.3,'#ffb950'),cyan=material('#31c4ce',.2,.3,'#168892'),wall=material('#2b3946'),black=material('#080e17');
 const glass=new THREE.MeshStandardMaterial({color:'#76b4bf',metalness:.4,roughness:.15,transparent:true,opacity:.5});materials.push(glass);
 const geo=<T extends THREE.BufferGeometry>(g:T)=>{geometries.push(g);return g;};
 const box=geo(new THREE.BoxGeometry(1,1,1)),softBox=geo(new RoundedBoxGeometry(1,1,1,2,.09));
 const add=(name:string,g:THREE.BufferGeometry,m:THREE.Material,p:number[],rotation?:number[])=>{const o=new THREE.Mesh(g,m);o.name=name;o.position.fromArray(p);if(rotation)o.rotation.set(rotation[0],rotation[1],rotation[2]);o.receiveShadow=true;root.add(o);return o;};
 const block=(name:string,p:number[],size:number[],m:THREE.Material,ry=0)=>{const o=add(name,box,m,p);o.scale.fromArray(size);o.rotation.y=ry;return o;};
 const ring=(name:string,r:number,y:number,tube:number,m:THREE.Material)=>add(name,geo(new THREE.TorusGeometry(r,tube,6,128)),m,[0,y,0],[Math.PI/2,0,0]);
 const instances=(name:string,m:THREE.Material,items:{p:number[];s:number[];yaw?:number}[],rounded=false)=>{const o=new THREE.InstancedMesh(rounded?softBox:box,m,items.length);o.name=name;const dummy=new THREE.Object3D();items.forEach((v,i)=>{dummy.position.fromArray(v.p);dummy.scale.fromArray(v.s);dummy.rotation.set(0,v.yaw??0,0);dummy.updateMatrix();o.setMatrixAt(i,dummy.matrix)});o.instanceMatrix.needsUpdate=true;o.castShadow=true;o.receiveShadow=true;o.computeBoundingSphere();root.add(o);return o;};
 // Retire the old rear stage, obstructing scoreboard, floating markers and seating slabs.
 const screens=new Set(['Screen_Main','Screen_Side_Left','Screen_Side_Right','Scoreboard_Screen']);
 scene.traverse(o=>{if(screens.has(o.name))return;if(o.name==='Ticker_Board'){o.visible=false;o.name='Retired_Ticker_Board';return;}if(/^(Stage_|Podium_|SPAWN_|Seating_Tier|Truss|LightSpot_|LightPAR_|VR_CAM|Backstage_|Screen_Frame_Main|Scoreboard_Housing|Ticker_Board|TunnelArch_)/.test(o.name))o.visible=false;});
 // Keep display node names/contracts, but bring them out of retired stage groups.
 const placements:{[key:string]:{p:number[];yaw:number;size?:number[]}}={Screen_Main:{p:[0,VENUE.screenY,VENUE.screenZ],yaw:0},Screen_Side_Left:{p:[-64,25,0],yaw:Math.PI/2},Screen_Side_Right:{p:[64,25,0],yaw:-Math.PI/2},Scoreboard_Screen:{p:[0,27,65],yaw:Math.PI}};
 for(const[name,place]of Object.entries(placements)){const o=scene.getObjectByName(name);if(!o)continue;scene.add(o);o.visible=true;o.position.fromArray(place.p);o.rotation.set(0,place.yaw,0);o.scale.set(1,1,1);
  const w=name==='Screen_Main'?37:name==='Scoreboard_Screen'?17:15,h=name==='Screen_Main'?13:name==='Scoreboard_Screen'?6:9;
  block(name+'_New_Frame',[place.p[0]-Math.sin(place.yaw)*.3,place.p[1],place.p[2]-Math.cos(place.yaw)*.3],[w,h,.65],black,place.yaw);
 }
 // Source floor and shell remain as the stable exterior envelope.
 const floor=scene.getObjectByName('Floor') as THREE.Mesh;if(floor?.material)(floor.material as THREE.MeshStandardMaterial).color.set('#15212e');
 const shell=scene.getObjectByName('Bowl_Wall') as THREE.Mesh;if(shell?.material)(shell.material as THREE.MeshStandardMaterial).color.set('#102b40');
 const roof=scene.getObjectByName('Roof_Ring');if(roof)roof.visible=false;
 const interior=geo(new THREE.CylinderGeometry(70,70,35.7,128,1,true));const insideWall=wall.clone();insideWall.side=THREE.BackSide;materials.push(insideWall);add('Venue_Acoustic_Wall',interior,insideWall,[0,17.85,0]);
 add('Venue_Arena_Floor',geo(new THREE.CircleGeometry(28,96)),carpet,[0,A.arenaY,0],[-Math.PI/2,0,0]);
 add('Venue_Stage',geo(new THREE.CylinderGeometry(9,9,.9,96)),charcoal,[0,A.arenaY+.45,0]);ring('Venue_Stage_Gold_Edge',8.95,A.arenaY+.93,.07,warm);
 // Microphone is a real mesh and remains available with no avatar present.
 add('Venue_Microphone_Base',geo(new THREE.CylinderGeometry(.45,.55,.12,24)),black,[0,1.25,0]);
 add('Venue_Microphone_Stand',geo(new THREE.CylinderGeometry(.045,.045,2.8,12)),gold,[0,2.65,0]);
 add('Venue_Microphone',geo(new THREE.CapsuleGeometry(.12,.45,4,8)),black,[0,4.08,0],[Math.PI/3,0,0]);
 const host=new THREE.Object3D();host.name='SPAWN_HOST';host.position.set(0,1.2,-1);root.add(host);
 // An accessible ramp, inside the controlled guest ring.
 const ramp=block('Venue_Stage_Ramp',[0,.75,11],[3,.16,5],charcoal);ramp.rotation.x=Math.atan2(.9,5);block('Venue_Ramp_Lip',[0,.36,13.5],[3,.12,.4],gold);
 scene.traverse(o=>{if(o.name.startsWith('SPAWN_'))o.name='Retired_'+o.name;});
 const seats=venueSeats(),publicSeats=seats.filter(s=>!s.guest),guests=seats.filter(s=>s.guest);
 const seatParts=(list:VenueSeat[],guest:boolean)=>{const prefix=guest?'Venue_Guest':'Venue_Seat';const local=(seat:VenueSeat,x:number,y:number,z:number)=>[seat.x+Math.cos(seat.yaw)*x+Math.sin(seat.yaw)*z,seat.y+y,seat.z-Math.sin(seat.yaw)*x+Math.cos(seat.yaw)*z];
  instances(prefix+'_Cushions',teal,list.map(s=>({p:local(s,0,.95,0),s:[2.25,.3,1.95],yaw:s.yaw})),true);
  instances(prefix+'_Backs',seatBack,list.map(s=>({p:local(s,0,1.85,-.85),s:[2.25,1.65,.26],yaw:s.yaw})),true);
  instances(prefix+'_Bases',black,list.map(s=>({p:local(s,0,.45,0),s:[1.55,.8,1.4],yaw:s.yaw})));
  instances(prefix+'_Arms',navy,list.flatMap(s=>[-1,1].map(side=>({p:local(s,side*1.2,1.28,0),s:[.18,.35,1.8],yaw:s.yaw}))),true);
 };
 seatParts(publicSeats,false);seatParts(guests,true);
 publicSeats.forEach((s,i)=>{const o=new THREE.Object3D();o.name='SPAWN_AUDIENCE_'+String(i+1).padStart(3,'0');o.position.set(s.x,s.y,s.z);o.rotation.y=s.yaw;root.add(o)});
 root.userData.publicSeats=publicSeats.length;root.userData.guestSeats=guests.length;
 // Terraces are cut into four sectors; no slab or chair crosses a stair corridor.
 
 for(const [r,y,width]of [...Array.from({length:8},(_,i)=>[30+i*3.3,1.3+i*1.86,3.3]),...Array.from({length:3},(_,i)=>[62+i*2.5,17+i*2.3,2.5])]){
  const gap=Math.asin((VENUE.aisleHalfWidth+.2)/(r-width/2));
  for(let q=0;q<4;q++){const g=geo(new THREE.RingGeometry(r-width/2,r+width/2,28,1,q*Math.PI/2+gap,Math.PI/2-2*gap));add('Venue_Seating_Terrace',g,carpet,[0,y,0],[-Math.PI/2,0,0]);const rise=r<60?(r===30?1:1.86):(r===62?1.9:2.3);add('Venue_Seating_Riser',geo(new THREE.CylinderGeometry(r-width/2,r-width/2,rise,28,1,true,q*Math.PI/2+gap,Math.PI/2-2*gap)),navy,[0,y-rise/2,0]);}
 }
 const stepItems:{p:number[];s:number[];yaw:number}[]=[],edgeItems:{p:number[];s:number[];yaw:number}[]=[],posts:{p:number[];s:number[]}[]=[];
 const depth=(A.stairTopZ-A.stairBottomZ)/A.steps;
 for(let q=0;q<4;q++){const angle=q*Math.PI/2,s=Math.sin(angle),c=Math.cos(angle);
  for(let i=0;i<A.steps;i++){const d=A.stairBottomZ+(i+.5)*depth,y=A.arenaY+(i+1)*(A.landingY-A.arenaY)/A.steps;
   stepItems.push({p:[s*d,y/2,c*d],s:[A.width,y,depth],yaw:angle});edgeItems.push({p:[s*(d-depth*.42),y+.02,c*(d-depth*.42)],s:[A.width-.15,.035,.045],yaw:angle});}
  for(const side of [-1,1]){for(let i=0;i<=8;i++){const d=24+i*4,y=A.arenaY+i/8*(A.landingY-A.arenaY);posts.push({p:[s*d+c*side*4.15,y+.65,c*d-s*side*4.15],s:[.07,1.3,.07]});}
   const rail=add('Venue_Stair_Handrail',geo(new THREE.CylinderGeometry(.07,.07,Math.hypot(32,A.landingY-A.arenaY),8)),gold,[s*40+c*side*4.15,(A.landingY+A.arenaY)/2+1.3,c*40-s*side*4.15]);rail.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(s*32,A.landingY-A.arenaY,c*32).normalize());
  }
 }
 instances('Venue_Clear_Stairs',carpet,stepItems);instances('Venue_Stair_Lights',warm,edgeItems);instances('Venue_Stair_Posts',gold,posts);
 add('Stadium_Upper_Concourse',geo(new THREE.RingGeometry(55,69,128)),carpet,[0,A.landingY,0],[-Math.PI/2,0,0]);
 // Balcony rail, guest-only perimeter, and decorative LED lines are continuous except at access gates.
 for(const [radius,y]of [[55,16.3],[18,1.7]]){
  const gap=radius===18?.13:.085;
  for(let q=0;q<4;q++){const start=q*Math.PI/2+gap,length=Math.PI/2-2*gap;
   const g=geo(new THREE.TorusGeometry(radius,.065,6,48,length));const o=add(radius===18?'Venue_Guest_Rail':'Venue_Balcony_Rail',g,gold,[0,y,0],[Math.PI/2,0,start]);
   o.rotation.set(Math.PI/2,0,0);o.rotateZ(start);
  }
 }
 const guestPosts=[];for(let i=0;i<48;i++){const a=i*Math.PI/24;if(Math.min(Math.abs(Math.sin(a)),Math.abs(Math.cos(a)))<.15)continue;guestPosts.push({p:[18*Math.sin(a),.95,18*Math.cos(a)],s:[.07,1.3,.07]});}instances('Venue_Guest_Rail_Posts',gold,guestPosts);
 ring('Venue_Guest_Perimeter_Light',18,.35,.04,warm);
 // Doors on all four original exterior hall appendages and four interior portals.
 for(let q=0;q<4;q++){const a=q*Math.PI/2,s=Math.sin(a),c=Math.cos(a);const tunnel=scene.getObjectByName(['Tunnel_North','Tunnel_East','Tunnel_South','Tunnel_West'][q]);if(tunnel)tunnel.visible=false;
  for(const [r,base,inside]of [[76,0,false],[61,A.landingY,true]] as const){
   const door=new THREE.Group();door.name=inside?'Venue_Interior_Doors_'+q:'Venue_Exterior_Doors_'+q;door.position.set(s*r,base,c*r);door.rotation.y=a;root.add(door);
   const part=(name:string,p:number[],size:number[],m:THREE.Material)=>{const o=new THREE.Mesh(box,m);o.name=name;o.position.fromArray(p);o.scale.fromArray(size);door.add(o);};
   part('Door_Header',[0,4.8,0],[8.8,.5,.8],gold);part('Door_Left_Jamb',[-4.15,2.4,0],[.4,4.8,.8],gold);part('Door_Right_Jamb',[4.15,2.4,0],[.4,4.8,.8],gold);
   for(const side of [-1,1]){part('Glass_Door_Leaf',[side*2,2.35,0],[3.85,4.5,.18],glass);part('Door_Pull',[side*.25,2.3,.25],[.09,1.3,.09],gold);part('Door_Bottom',[side*2,.2,0],[3.85,.2,.3],navy);}
   part('Door_Canopy',[0,5.4,-1],[9.6,.25,3.6],navy);part('Door_Welcome_Light',[0,5,-.4],[7,.07,.1],warm);
  }
  block('Venue_Exterior_Hall',[s*72,2.6,c*72],[9,5.2,8],navy,a);
  // Show door faces rather than a solid end-cap box.
  const hall=root.children.at(-1) as THREE.Mesh;hall.visible=false;
  for(const side of [-1,1])block('Venue_Exterior_Hall_Wall',[s*72+c*side*4.6,2.6,c*72-s*side*4.6],[.3,5.2,8],navy,a);
  block('Venue_Exterior_Hall_Roof',[s*72,5.3,c*72],[9.4,.3,8],navy,a);
 }
 // An oculus canopy, understated acoustic fins and warm wall lighting.
 const canopyMat=navy.clone();canopyMat.side=THREE.DoubleSide;materials.push(canopyMat);add('Stadium_Seating_Canopy',geo(new THREE.RingGeometry(32,72,128)),canopyMat,[0,36,0],[-Math.PI/2,0,0]);ring('Venue_Oculus_Trim',32,35.8,.12,cyan);ring('Venue_Canopy_Gold',69,35.6,.08,gold);
 const fins=[];for(let i=0;i<96;i++){const a=i*Math.PI/48;fins.push({p:[69.3*Math.sin(a),26,69.3*Math.cos(a)],s:[.22,16,.65],yaw:a});}instances('Venue_Acoustic_Fins',navy,fins);
 const wallLights=[];for(let i=0;i<32;i++){const a=(i+.5)*Math.PI/16;wallLights.push({p:[68.8*Math.sin(a),22,68.8*Math.cos(a)],s:[.12,2.5,.15],yaw:a});}instances('Venue_Wall_Sconces',warm,wallLights);
 ring('Venue_Lighting_Truss_Lower',21,31,.14,black);ring('Venue_Lighting_Truss_Upper',21,32,.14,black);
 for(let i=0;i<12;i++){const a=i*Math.PI/6,x=21*Math.sin(a),z=21*Math.cos(a);block('Venue_Truss_Brace',[x,31.5,z],[.13,1,.13],gold);
  const housing=add('Venue_Spotlight_Fixture',geo(new THREE.CylinderGeometry(.45,.5,1,12)),black,[x,30.7,z]);housing.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(-x,-29,-z).normalize());
  if(i%3===0){const light=new THREE.SpotLight('#ffe1a6',2400,90,.36,.6,2);light.name='Venue_Host_Spotlight';light.position.set(x,30,z);light.target.position.set(0,1,0);light.userData.venueBaseIntensity=2400;light.userData.venueBaseDistance=90;root.add(light,light.target);}
 }
 for(const [x,z]of [[-30,15],[30,15],[0,-30]]){const light=new THREE.PointLight('#38bac9',350,65,2);light.position.set(x,19,z);light.userData.venueBaseIntensity=350;light.userData.venueBaseDistance=65;root.add(light);}
 // Ticker remains a normal named display node, facing the audience without mirrored text.
 const ticker=geo(new THREE.CylinderGeometry(55,55,2.8,128,1,true));const uv=ticker.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));const tickerMaterial=black.clone();tickerMaterial.side=THREE.BackSide;materials.push(tickerMaterial);add('Ticker_Board',ticker,tickerMaterial,[0,13.8,0]);
 scene.add(root);scene.updateMatrixWorld(true);
 return {root,seats,dispose:()=>{geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());scene.remove(root);}};
}
