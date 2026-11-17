import * as THREE from 'three';

/** Detail belongs to the placement clone and its existing moving/scaling part frames. */
export function renovateAirport(plane:THREE.Object3D,frames:Record<'terminal'|'tower'|'runway',THREE.Group>){
 const geometries:THREE.BufferGeometry[]=[],materials:THREE.Material[]=[],textures:THREE.Texture[]=[],roots:THREE.Group[]=[],fans:THREE.Group[]=[],flashes:Array<{mesh:THREE.Mesh;kind:'strobe'|'beacon'}>=[];
 const geo=<T extends THREE.BufferGeometry>(g:T)=>{geometries.push(g);return g;};
 const mat=(color:string,metalness=.1,roughness=.5,emissive?:string)=>{const m=new THREE.MeshStandardMaterial({color,metalness,roughness,...(emissive?{emissive,emissiveIntensity:1.5}:{})});materials.push(m);return m;};
 const skin=mat('#a82b70',.45,.28),silver=mat('#adbac7',.8,.27),dark=mat('#101e2a',.4,.3),glass=mat('#102e48',.65,.15,'#0a2030'),window=mat('#99d8ef',.4,.22,'#437b91'),trim=mat('#d4dee4',.6,.4),concrete=mat('#697e8b',.15,.65),warm=mat('#ffdaa0',.1,.3,'#ffbd68');
 const box=geo(new THREE.BoxGeometry(1,1,1)),sphere=geo(new THREE.SphereGeometry(1,12,8)),pane=geo(new THREE.CapsuleGeometry(.19,.26,3,8));
 const group=(parent:THREE.Object3D,name:string)=>{const g=new THREE.Group();g.name=name;parent.add(g);roots.push(g);return g;};
 const aircraft=group(plane,'Aircraft_Detail'),terminal=group(frames.terminal,'Terminal_Detail'),tower=group(frames.tower,'Tower_Detail');
 aircraft.userData.airportPart='airplane';terminal.userData.airportPart='terminal';tower.userData.airportPart='tower';
 const mesh=(parent:THREE.Object3D,name:string,g:THREE.BufferGeometry,m:THREE.Material,p:number[],s=[1,1,1])=>{const o=new THREE.Mesh(g,m);o.name=name;o.position.fromArray(p);o.scale.fromArray(s);parent.add(o);return o;};
 const block=(parent:THREE.Object3D,name:string,p:number[],s:number[],m:THREE.Material)=>mesh(parent,name,box,m,p,s);
 const sign=(parent:THREE.Object3D,name:string,text:string,p:number[],w:number,h:number,yaw=0)=>{if(typeof document==='undefined')return;const c=document.createElement('canvas');c.width=1024;c.height=128;const ctx=c.getContext('2d');if(!ctx)return;ctx.fillStyle='#102334';ctx.fillRect(0,0,1024,128);ctx.fillStyle='#d9f4ff';ctx.font='700 66px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,64,980);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;textures.push(t);const m=new THREE.MeshBasicMaterial({map:t,toneMapped:false});materials.push(m);mesh(parent,name,geo(new THREE.PlaneGeometry(w,h)),m,p).rotation.y=yaw;};
 const instances=(parent:THREE.Object3D,name:string,g:THREE.BufferGeometry,m:THREE.Material,items:{p:number[];s:number[]}[])=>{const o=new THREE.InstancedMesh(g,m,items.length),d=new THREE.Object3D();o.name=name;items.forEach((v,i)=>{d.position.fromArray(v.p);d.scale.fromArray(v.s);d.updateMatrix();o.setMatrixAt(i,d.matrix)});o.computeBoundingSphere();parent.add(o);return o;};
 // Recolor only this clone's fuselage; never mutate the loader's shared materials.
 const sourceMaterials:Array<{mesh:THREE.Mesh;material:THREE.Material|THREE.Material[]}>=[];
 plane.traverse(n=>{const m=n as THREE.Mesh;if(m.isMesh&&!Array.isArray(m.material)&&m.material.name==='plane_white'){sourceMaterials.push({mesh:m,material:m.material});m.material=skin;}});
 const passenger:{p:number[];s:number[]}[]=[],framesList:{p:number[];s:number[]}[]=[];
 for(const side of [-1,1])for(let i=0;i<29;i++){const x=-11.6+i*.8,y=.9,z=side*Math.sqrt(2.6**2-y**2);framesList.push({p:[x,y,z],s:[1.25,1.13,.20]});passenger.push({p:[x,y,z+side*.055],s:[1,.92,.22]});}
 instances(aircraft,'Passenger_Window_Frames',pane,silver,framesList);instances(aircraft,'Passenger_Windows',pane,window,passenger);
 for(const side of [-1,1])sign(aircraft,'Aircraft_Airline_Wordmark','TROOTHHERTZ AIR',[0,-.55,side*2.58],10,.72,side<0?Math.PI:0);
 // Faceted, inset cockpit glazing with a central windshield mullion.
 for(const side of [-1,1]){
  const outer=block(aircraft,'Cockpit_Window_Frame',[14.35,1.32,side*1.72],[3.2,.98,.12],silver);outer.rotation.y=side*.24;outer.rotation.x=side*-.22;
  const inner=block(aircraft,'Cockpit_Windows',[14.35,1.32,side*1.80],[2.94,.75,.10],glass);inner.rotation.copy(outer.rotation);
  block(aircraft,'Cockpit_Mullion',[14.35,1.32,side*1.87],[.09,.84,.13],silver).rotation.copy(outer.rotation);
  for(const x of [-10.4,11.7]){const door=block(aircraft,'Cabin_Door_Frame',[x,-.12,side*2.59],[1.12,2.12,.08],silver);const panel=block(aircraft,'Cabin_Door',[x,-.12,side*2.65],[.96,1.96,.06],skin);block(aircraft,'Door_Handle',[x+.26,-.25,side*2.70],[.23,.06,.05],trim);mesh(aircraft,'Door_Window',pane,glass,[x,.42,side*2.70],[.8,.72,.1]);}
 }
 // Twin high-bypass nacelles with an open intake, hub and rotating fan blades.
 const shell=geo(new THREE.CylinderGeometry(1.14,1.0,3.65,32,1,true)),rim=geo(new THREE.TorusGeometry(1.10,.10,8,32)),disc=geo(new THREE.CircleGeometry(1.03,32)),hub=geo(new THREE.ConeGeometry(.26,.65,16));
 for(const side of [-1,1]){
  block(aircraft,'Engine_Pylon',[.15,-1.25,side*6.2],[2.2,1.4,.30],silver);
  const nacelle=mesh(aircraft,'Engine_Nacelle',shell,silver,[.6,-2,side*6.2]);nacelle.rotation.z=-Math.PI/2;
  mesh(aircraft,'Engine_Intake_Rim',rim,trim,[2.43,-2,side*6.2]).rotation.y=Math.PI/2;
  mesh(aircraft,'Engine_Intake',disc,dark,[2.26,-2,side*6.2]).rotation.y=Math.PI/2;
  const fan=new THREE.Group();fan.name='Turbine_Fan';fan.position.set(2.31,-2,side*6.2);aircraft.add(fan);fans.push(fan);
  for(let i=0;i<12;i++){const a=i*Math.PI/6,b=block(fan,'Turbine_Blade',[0,Math.cos(a)*.62,Math.sin(a)*.62],[.06,.65,.12],silver);b.rotation.x=a+.4;}
  mesh(fan,'Turbine_Hub',hub,silver,[.18,0,0]).rotation.z=-Math.PI/2;
  mesh(aircraft,'Engine_Exhaust',rim,dark,[-1.24,-2,side*6.2],[.78,.78,.78]).rotation.y=Math.PI/2;
 }
 // Gear details attach to the animated gear nodes, so they retract with the original rig.
 const wheelHub=geo(new THREE.CylinderGeometry(.30,.30,.08,16));
 for(const name of ['Gear_Nose','Gear_MainLeft','Gear_MainRight']){const gear=plane.getObjectByName(name);if(!gear)continue;const detail=group(gear,'Landing_Gear_Detail');for(const side of [-1,1]){const h=mesh(detail,'Wheel_Hub',wheelHub,silver,[0,name==='Gear_Nose'?-1:-1.2,side*(name==='Gear_Nose'?.19:.57)]);h.rotation.x=Math.PI/2;}}
 // Steady port red / starboard green / tail white, plus anti-collision flashes.
 const lens=(parent:THREE.Object3D,name:string,p:number[],color:string,r:number,kind?:'strobe'|'beacon')=>{const m=new THREE.MeshBasicMaterial({color,toneMapped:false});materials.push(m);const o=mesh(parent,name,sphere,m,p,[r,r,r]);if(kind)flashes.push({mesh:o,kind});return o;};
 lens(aircraft,'Navigation_Port_Red',[-2,-.2,-17],'#ff1818',.14);lens(aircraft,'Navigation_Starboard_Green',[-2,-.2,17],'#16ff6c',.14);lens(aircraft,'Navigation_Tail_White',[-20.25,1.3,0],'#ffffff',.13);
 lens(aircraft,'Wing_Strobe_Left',[-2.3,-.2,-16.9],'#ffffff',.18,'strobe');lens(aircraft,'Wing_Strobe_Right',[-2.3,-.2,16.9],'#ffffff',.18,'strobe');lens(aircraft,'AntiCollision_Top',[0,2.67,0],'#ff1818',.18,'beacon');lens(aircraft,'AntiCollision_Belly',[0,-2.67,0],'#ff1818',.15,'beacon');
 for(const side of [-1,1]){lens(aircraft,'Landing_Light_Lens',[2.0,-.7,side*3.5],'#fff6dc',.20);const light=new THREE.SpotLight('#fff3cf',24,45,.22,.55,2);light.name='Aircraft_Landing_Light';light.position.set(2,-.7,side*3.5);light.target.position.set(38,-4,side*3.5);aircraft.add(light,light.target);}
 // Terminal curtain-wall mullions, a sheltered entry, roof plant and boarding-gate signage.
 const mullions:{p:number[];s:number[]}[]=[],roofLights:{p:number[];s:number[]}[]=[];
 for(const z of [99.60,128.18]){for(let x=-87;x<=87;x+=6)mullions.push({p:[x,7.8,z],s:[.20,8.3,.22]});for(const y of [4.2,8,11.8])mullions.push({p:[0,y,z],s:[176,.16,.22]});roofLights.push({p:[0,11.7,z-.1],s:[178,.12,.12]});}
 instances(terminal,'Terminal_Window_Mullions',box,trim,mullions);instances(terminal,'Terminal_Roof_Light_Strips',box,warm,roofLights);
 block(terminal,'Terminal_Entrance_Canopy',[0,7,132],[25,.4,10],silver);for(const x of [-11,11])block(terminal,'Terminal_Entrance_Column',[x,3.4,135],[.4,6.8,.4],silver);
 for(const x of [-3.2,0,3.2])block(terminal,'Terminal_Entrance_Glass',[x,3.1,128.25],[2.9,5.8,.18],glass);
 sign(terminal,'Terminal_Departures_Sign','TERMINAL  /  DEPARTURES',[0,9.2,128.35],32,3.1);
 for(const x of [-60,-30,0,30,60])sign(terminal,'Boarding_Gate_Sign','GATE '+String(Math.round((x+60)/30)+1).padStart(2,'0'),[x,9.6,99.40],10,1.5,Math.PI);
 for(let x=-75;x<=75;x+=30){block(terminal,'Terminal_Roof_Plant',[x,13.0,116],[8,1.8,4],concrete);for(let i=0;i<4;i++)block(terminal,'Roof_Plant_Louvre',[x-2.7+i*1.8,14,116],[.65,.1,3.5],dark);}
 // Tower cab: four glazed faces, fine mullions, illuminated sill, radar and obstruction lights.
 for(const side of [-1,1]){block(tower,'Tower_Cab_Window',[140+side*5.09,32.7,115],[.12,3.9,9.8],glass);block(tower,'Tower_Cab_Window',[140,32.7,115+side*5.09],[9.8,3.9,.12],glass);
  for(const d of [-3,0,3]){block(tower,'Tower_Cab_Mullion',[140+side*5.19,32.7,115+d],[.16,4.1,.16],trim);block(tower,'Tower_Cab_Mullion',[140+d,32.7,115+side*5.19],[.16,4.1,.16],trim);}
  block(tower,'Tower_Cab_Sill_Light',[140+side*5.15,30.5,115],[.13,.14,10.3],window);block(tower,'Tower_Cab_Sill_Light',[140,30.5,115+side*5.15],[10.3,.14,.13],window);
  for(const z of [112,118])lens(tower,'Tower_Obstruction_Red',[140+side*5,36.2,z],'#ff2424',.22,'beacon');
 }
 for(const y of [5,11,17,23]){block(tower,'Tower_Service_Window',[140,y,111.91],[2.3,2,.12],window);block(tower,'Tower_Service_Sill',[140,y-1.1,111.8],[2.7,.16,.3],trim);}
 block(tower,'Tower_Antenna_Mast',[140,38.7,115],[.20,5.5,.20],silver);const radar=new THREE.Group();radar.name='Tower_Rotating_Radar';radar.position.set(140,39,115);tower.add(radar);block(radar,'Radar_Array',[0,0,0],[5,.7,.30],trim);lens(tower,'Tower_Mast_Beacon',[140,41.5,115],'#ff2424',.26,'beacon');
 const update=(time:number)=>{fans.forEach((f,i)=>f.rotation.x=time*8*(i?1:-1));radar.rotation.y=time*.35;flashes.forEach(({mesh,kind})=>{const phase=time%(kind==='strobe'?1.3:1.5);mesh.visible=kind==='strobe'?phase<.06||(phase>.15&&phase<.21):phase<.15;});};
 update(0);
 return{aircraft,terminal,tower,update,dispose:()=>{roots.forEach(r=>r.removeFromParent());sourceMaterials.forEach(v=>v.mesh.material=v.material);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}
