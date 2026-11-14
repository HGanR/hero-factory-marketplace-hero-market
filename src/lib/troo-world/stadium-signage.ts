import * as THREE from 'three';
export const STADIUM_TICKER_TEXT='TROOTHHURTZ STADIUM';
/** Measure actual transformed shell vertices, not a guessed inner radius or the square bounds diagonal. */
export function stadiumSignagePlacement(scene:THREE.Object3D){
 scene.updateWorldMatrix(true,true);const point=new THREE.Vector3();let radius=0,wallTop=-Infinity;
 scene.traverse(object=>{
  if(object.name!=='Bowl_Wall'&&object.name!=='Roof_Ring')return;
  object.traverse(child=>{
   const mesh=child as THREE.Mesh;if(!mesh.isMesh)return;const positions=mesh.geometry.getAttribute('position');if(!positions)return;
   for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);radius=Math.max(radius,Math.hypot(point.x,point.z));if(object.name==='Bowl_Wall')wallTop=Math.max(wallTop,point.y);}
  });
 });
 // Known asset fallback remains safely beyond the verified 72-unit outer wall.
 return {radius:(radius||72)+1.5,y:Number.isFinite(wallTop)?wallTop-2:26,height:4};
}

/** The authored GLB's shell has outward normals but inward index winding. Clone
 * first, then repair its indices so front-face culling and illumination agree. */
export function cloneStadiumExterior(source:THREE.Object3D){
 const scene=source.clone(true);scene.updateWorldMatrix(true,true);const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3(),cross=new THREE.Vector3();
 scene.traverse(object=>{
  const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(m=>m.clone()):mesh.material.clone();
  if(/^(screen_(main|side_left|side_right)|scoreboard_screen|ticker_board)$/i.test(mesh.name)){
   // The authored display boxes contain POSITION/NORMAL only. A map without UVs
   // samples one corner of the poster, making a correctly assigned graphic look blank.
   mesh.geometry=mesh.geometry.clone();mesh.userData.stadiumDisplayGeometry=true;
   const geometry=mesh.geometry;geometry.computeBoundingBox();const box=geometry.boundingBox!,p=geometry.getAttribute('position'),uv=new Float32Array(p.count*2);
   const width=Math.max(.001,box.max.x-box.min.x),height=Math.max(.001,box.max.y-box.min.y);
   for(let i=0;i<p.count;i++){uv[i*2]=(p.getX(i)-box.min.x)/width;uv[i*2+1]=1-(p.getY(i)-box.min.y)/height;}
   geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  }
  if(/^Seating_Tier[123]$/.test(mesh.name)){
   // Cut an aisle through the imported seating surfaces rather than burying the new stairs in them.
   mesh.geometry=mesh.geometry.clone();const g=mesh.geometry,p=g.getAttribute('position');const index=g.index;const kept:number[]=[];
   if(index){for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];const points=ids.map(id=>new THREE.Vector3().fromBufferAttribute(p,id).applyMatrix4(mesh.matrixWorld));
    const crossesAisle=Math.min(...points.map(p=>p.x))<5&&Math.max(...points.map(p=>p.x))>-5&&Math.max(...points.map(p=>p.z))>=24&&Math.min(...points.map(p=>p.z))<=64;
    if(!crossesAisle)kept.push(...ids);
   }g.setIndex(kept);}
   return;
  }
  if(mesh.name!=='Bowl_Wall'&&mesh.name!=='Roof_Ring')return;
  mesh.geometry=mesh.geometry.clone();const geometry=mesh.geometry,p=geometry.getAttribute('position'),n=geometry.getAttribute('normal');if(!p||!n)return;
  if(!geometry.index)geometry.setIndex(Array.from({length:p.count},(_,i)=>i));const index=geometry.index!;
  let reversed=false;
  for(let i=0;i<index.count;i+=3){const ia=index.getX(i),ib=index.getX(i+1),ic=index.getX(i+2);a.fromBufferAttribute(p,ia);b.fromBufferAttribute(p,ib);c.fromBufferAttribute(p,ic);normal.fromBufferAttribute(n,ia);cross.crossVectors(b.sub(a),c.sub(a));const orientation=cross.dot(normal);if(Math.abs(orientation)>1e-8){reversed=orientation<0;break;}}
  if(reversed){for(let i=0;i<index.count;i+=3){const v=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,v);}index.needsUpdate=true;}
 });
 return scene;
}
export function disposeStadiumExterior(scene:THREE.Object3D){
 scene.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
  (Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(m=>m.dispose());
  if(mesh.userData.stadiumDisplayGeometry||mesh.name==='Bowl_Wall'||mesh.name==='Roof_Ring'||/^Seating_Tier[123]$/.test(mesh.name))mesh.geometry.dispose();
 });
}

