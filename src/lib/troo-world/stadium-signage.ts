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
