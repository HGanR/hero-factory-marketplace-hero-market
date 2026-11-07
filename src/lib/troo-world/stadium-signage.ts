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
 const scene=source.clone(true);const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3(),cross=new THREE.Vector3();
 scene.traverse(object=>{
  const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(m=>m.clone()):mesh.material.clone();
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
  if(mesh.name==='Bowl_Wall'||mesh.name==='Roof_Ring')mesh.geometry.dispose();
 });
}
