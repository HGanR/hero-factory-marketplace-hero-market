import * as THREE from 'three';
export type ModelFootprint={minX:number;maxX:number;minZ:number;maxZ:number};
/** Pavement cutouts follow the building at walking height, not lawn tiles, signs or roof overhangs. */
export function measureModelFootprint(model:THREE.Object3D):ModelFootprint|null{
 model.updateWorldMatrix(true,true);const inverse=model.matrixWorld.clone().invert(),overall=new THREE.Box3(),result=new THREE.Box3(),rows:Array<{mesh:THREE.Mesh;box:THREE.Box3}>=[];
 model.traverseVisible(n=>{const mesh=n as THREE.Mesh;if(!mesh.isMesh)return;mesh.geometry.computeBoundingBox();if(!mesh.geometry.boundingBox)return;let bounds=mesh.geometry.boundingBox;if((mesh as THREE.InstancedMesh).isInstancedMesh){(mesh as THREE.InstancedMesh).computeBoundingBox();bounds=(mesh as THREE.InstancedMesh).boundingBox??bounds;}const box=bounds.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld));rows.push({mesh,box});overall.union(box);});if(overall.isEmpty())return null;
 const ground=overall.min.y,lower=ground+.6,upper=ground+2.2;
 const clip=(points:THREE.Vector3[],height:number,above:boolean)=>{const out:THREE.Vector3[]=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],inside=above?a.y>=height:a.y<=height,next=above?b.y>=height:b.y<=height;if(inside)out.push(a);if(inside!==next)out.push(a.clone().lerp(b,(height-a.y)/(b.y-a.y)));}return out;};
 for(const{mesh:m,box}of rows){if(/ground|patio|seam|plaza|paver|terrain|landscap|tree|trunk|pine|foliage|bush|rock|truck|tire|bridge|light|sign|placeholder/i.test(m.name))continue;if(box.max.y<lower||box.min.y>upper||box.max.y-box.min.y<.35)continue;
  const matrix=new THREE.Matrix4().multiplyMatrices(inverse,m.matrixWorld),p=m.geometry.getAttribute('position'),index=m.geometry.index;
  const matrices=[matrix];if((m as THREE.InstancedMesh).isInstancedMesh){matrices.length=0;const mesh=m as THREE.InstancedMesh;for(let i=0;i<mesh.count;i++){const instance=new THREE.Matrix4();mesh.getMatrixAt(i,instance);matrices.push(matrix.clone().multiply(instance));}}
  for(const transform of matrices)for(let i=0;i<(index?.count??p.count);i+=3){const v=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(transform));if(Math.max(...v.map(p=>p.y))<lower||Math.min(...v.map(p=>p.y))>upper)continue;
   const normal=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));if(Math.hypot(normal.x,normal.z)<normal.length()*.05)continue;for(const point of clip(clip(v,lower,true),upper,false))result.expandByPoint(point);
  }
 }
 return result.isEmpty()?null:{minX:result.min.x,maxX:result.max.x,minZ:result.min.z,maxZ:result.max.z};
}
