import * as THREE from 'three';
import {renovateAirport} from './airport-renovation';
import {AIRPORT_PIVOTS,airportHeading,airportFlightPoint,airportGate,identityAirportParts,partPoint,type AirportParts,type AirportPartId} from './airport-parts';
import type {Vec3} from './green-terrain-layout';
/** Split material triangles, including roof/glass shared by terminal and tower. Cached source stays untouched. */
export function createAirportRig(object:THREE.Object3D){
 const staticRoot=object.getObjectByName('Airport_Static')!,owned:THREE.BufferGeometry[]=[],frames={} as Record<'terminal'|'runway'|'tower',THREE.Group>,sourceTaxi:Array<{mesh:THREE.Mesh;positions:Float32Array}>=[];
 const meshes:THREE.Mesh[]=[];staticRoot.updateWorldMatrix(true,true);staticRoot.traverse(n=>{if((n as THREE.Mesh).isMesh)meshes.push(n as THREE.Mesh)});
 const replacement=new THREE.Group();replacement.name='Airport_Static';
 for(const id of ['terminal','runway','tower'] as const){const g=new THREE.Group();g.name='Airport part '+id;g.userData.airportPart=id;frames[id]=g;replacement.add(g);}
 for(const mesh of meshes){const geo=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone(),material=(Array.isArray(mesh.material)?mesh.material[0]:mesh.material),pos=geo.getAttribute('position'),bins=new Map<string,number[]>();
  for(let i=0;i<pos.count;i+=3){const x=(pos.getX(i)+pos.getX(i+1)+pos.getX(i+2))/3;const kind=material.name==='tower'||(['roof','glass_dark'].includes(material.name)&&x>110)?'tower':['runway','white_mark'].includes(material.name)?'runway':['taxi','yellow_mark'].includes(material.name)?'taxi':'terminal';if(!bins.has(kind))bins.set(kind,[]);bins.get(kind)!.push(i,i+1,i+2);}
  for(const[kind,indices]of bins){const g=new THREE.BufferGeometry();for(const[name,attr]of Object.entries(geo.attributes)){const a=attr as THREE.BufferAttribute,values=new Float32Array(indices.length*a.itemSize);indices.forEach((index,i)=>{for(let c=0;c<a.itemSize;c++)values[i*a.itemSize+c]=a.array[index*a.itemSize+c]});g.setAttribute(name,new THREE.BufferAttribute(values,a.itemSize,a.normalized));}g.applyMatrix4(mesh.matrixWorld);g.computeBoundingSphere();owned.push(g);const out=new THREE.Mesh(g,material);out.name='Airport_'+kind+'_'+material.name;out.castShadow=mesh.castShadow;out.receiveShadow=mesh.receiveShadow;
   if(['terminal','roof','tower','glass_dark'].includes(material.name))out.userData.townSolid=true;
   if(kind==='taxi'){replacement.add(out);sourceTaxi.push({mesh:out,positions:(g.getAttribute('position').array as Float32Array).slice()});out.userData.airportPart='runway';}else frames[kind as keyof typeof frames].add(out);
  }geo.dispose();
 }
 staticRoot.parent!.add(replacement);staticRoot.removeFromParent();
 const plane=object.getObjectByName('Airliner')!,jetBridge=object.getObjectByName('JetBridge')!,passengers:Array<THREE.Object3D>=[];object.traverse(n=>{if(/^Passenger_\d+$/.test(n.name))passengers.push(n)});plane.userData.airportPart='airplane';jetBridge.userData.airportPart='terminal';
 const bridge=new THREE.Group();bridge.name='Adjusted boarding bridge';bridge.userData.airportPart='terminal';object.add(bridge);
 const bridgeGeo=new THREE.BoxGeometry(1,1,1);owned.push(bridgeGeo);const mat=new THREE.MeshStandardMaterial({color:'#63747e'}),glass=new THREE.MeshStandardMaterial({color:'#84c7e2',transparent:true,opacity:.35});
 const floor=new THREE.Mesh(bridgeGeo,mat),wall1=new THREE.Mesh(bridgeGeo,glass),wall2=new THREE.Mesh(bridgeGeo,glass);bridge.add(floor,wall1,wall2);bridge.visible=false;
 const renovation=renovateAirport(plane,frames);
 let current:AirportParts|undefined,parentScale=.1;
 const native=new Map<THREE.Object3D,{position:THREE.Vector3;quaternion:THREE.Quaternion;scale:THREE.Vector3}>();
 const restore=()=>{for(const[n,t]of native){n.position.copy(t.position);n.quaternion.copy(t.quaternion);n.scale.copy(t.scale)}native.clear();jetBridge.visible=true;};
 const configure=(parts:AirportParts|undefined,scale:number)=>{current=parts;parentScale=scale;const p=parts??identityAirportParts();for(const id of ['terminal','runway','tower'] as const){const f=frames[id],v=p[id],pivot=AIRPORT_PIVOTS[id],stretch=v.stretch??[1,1,1];f.position.set(...pivot).add(new THREE.Vector3(...v.offset));f.rotation.y=v.rotationY;f.scale.set(v.scale*stretch[0],v.scale*stretch[1],v.scale*stretch[2]);for(const n of f.children)n.position.set(-pivot[0],-pivot[1],-pivot[2]);}
  for(const t of sourceTaxi){const a=t.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;for(let i=0;i<a.count;i++){const at=i*3,v=airportFlightPoint([t.positions[at],t.positions[at+1],t.positions[at+2]],p,true);a.setXYZ(i,...v)}a.needsUpdate=true;t.mesh.geometry.computeVertexNormals();t.mesh.geometry.computeBoundingSphere();t.mesh.geometry.computeBoundingBox();}
 };
 const apply=()=>{bridge.visible=!!current;jetBridge.visible=!current;if(!current)return;for(const n of [plane,...passengers])native.set(n,{position:n.position.clone(),quaternion:n.quaternion.clone(),scale:n.scale.clone()});const p=current,base=plane.position.toArray() as Vec3;plane.position.set(...airportFlightPoint(base,p));plane.scale.multiplyScalar(p.airplane.scale);const yaw=airportHeading(base[2],p);plane.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw));
  const gate=airportGate(p),doorOffset=new THREE.Vector3(-8.8,3-4.2,2.9).multiplyScalar(p.airplane.scale).applyAxisAngle(new THREE.Vector3(0,1,0),p.terminal.rotationY+p.airplane.rotationY),end=new THREE.Vector3(...gate).add(doorOffset),start=new THREE.Vector3(...partPoint([-8.8,3,99.5],'terminal',p));
  const retracted=Math.max(0,Math.min(1,jetBridge.position.z/28)),target=end.clone().lerp(start,retracted*.85),direction=target.clone().sub(start),length=direction.length(),width=1.6/parentScale,height=2.2/parentScale;bridge.position.copy(start).add(target).multiplyScalar(.5);bridge.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction.normalize());floor.scale.set(width,.12/parentScale,length);wall1.scale.set(.07/parentScale,height,length);wall2.scale.copy(wall1.scale);wall1.position.set(-width/2,height/2,0);wall2.position.set(width/2,height/2,0);
  for(const n of passengers){const w=Math.max(0,Math.min(1,(n.position.z-62.9)/(99.5-62.9))),at=end.clone().lerp(start,w);n.position.copy(at);n.scale.multiplyScalar(1.7/(1.91*parentScale));n.rotation.y=Math.atan2(start.x-end.x,start.z-end.z);}
 };
 return{configure,apply,restore,frames,updateDetails:renovation.update,dispose:()=>{renovation.dispose();owned.forEach(g=>g.dispose());mat.dispose();glass.dispose()}};
}
