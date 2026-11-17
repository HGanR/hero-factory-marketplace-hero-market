import * as THREE from 'three';
import {terrainLibraryAssetForModel} from './terrain-library';
import {fromInteriorLocal,toInteriorLocal,type InteriorFrame} from './stadium-navigation';
import {STOREFRONT,LEVEL2_STORE,storefrontForModel} from '../world-assets/storefront';
export const isOffice=(p:{glbUrl:string})=>!!storefrontForModel(p.glbUrl);
export const BUILDING_NAMES:Record<string,string>={'nexus-tower':'Nexus Tower','meridian-tower':'Meridian Tower','troothhertz-tower':'Troothhertz Tower','stadium-elyseum':'TROOTHHERTZ Stadium','veritas-school':'Veritas'};
export function importedBuildingName(p:{glbUrl:string;elementKey:string}){return storefrontForModel(p.glbUrl)?.name??terrainLibraryAssetForModel(p.glbUrl)?.name??(p.elementKey.startsWith('airport-')?'Airport':p.elementKey);}
export function officeEntry(frame:InteriorFrame){return{position:fromInteriorLocal([4.5,2.15,2.8],frame),lookAt:fromInteriorLocal([0,2.15,-2],frame)};}
/** Read the supplied model's walkable collision meshes, including its sloping stair ramps. */
export function officeWalker(frame:InteriorFrame&{glbUrl?:string},findModel:()=>THREE.Object3D|undefined){
 const exteriorTower=frame.glbUrl===LEVEL2_STORE.modelUrl;
 let floor=frame.position[1]+.45*frame.scale;const eye=1.7*frame.scale,ray=new THREE.Raycaster();
 const surface=(x:number,z:number,y:number)=>{
  const root=findModel();if(!root)return undefined;root.updateWorldMatrix(true,true);
  const meshes:THREE.Object3D[]=[];root.traverse(n=>{if((n as THREE.Mesh).isMesh&&(exteriorTower?/^COL_(plaza|plinth|floor[23]_slab|roof_slab|balcony_f[23]_floor|tower_s[123]_(?:lane[AB]_ramp|mid_landing|platform)|entry_steps_ramp)$/:/^COL_(plinth|floor[23]_slab|stairs_.*(?:ramp|landing)|entry_steps_ramp)$/).test(n.name))meshes.push(n)});
  ray.set(new THREE.Vector3(x,y+.3*frame.scale,z),new THREE.Vector3(0,-1,0));ray.far=.7*frame.scale;
  return ray.intersectObjects(meshes,false)[0]?.point.y;
 };
 return{
  floor:()=>floor,
  move:(from:[number,number,number],wanted:[number,number,number]):[number,number,number]=>{
   let p=toInteriorLocal(from,frame);const end=toInteriorLocal(wanted,frame);floor=from[1]-eye;
   const count=Math.max(1,Math.ceil(Math.hypot(end[0]-p[0],end[2]-p[2])/.15)),dx=(end[0]-p[0])/count,dz=(end[2]-p[2])/count;
   const step=(x:number,z:number)=>{
    const maxZ=(floor-frame.position[1])/frame.scale<3.3?3.7:6.55;
    x=Math.max(exteriorTower?-13.1:-7.65,Math.min(exteriorTower?13.1:7.65,x));z=Math.max(exteriorTower?-8.1:-5.65,Math.min(exteriorTower?12.1:maxZ,z));
    if(exteriorTower){
     const root=findModel();if(!root)return false;root.updateWorldMatrix(true,true);const blockers:THREE.Object3D[]=[];root.traverse(n=>{if((n as THREE.Mesh).isMesh&&/^COL_(wall_|.*rail|tower_(?:outer_wall|far_wall|divider|column_)|.*platform_guard|roof_parapet_|pool|roof_service|tree_)/.test(n.name))blockers.push(n)});
     const start=fromInteriorLocal([p[0],0,p[2]],frame),end=fromInteriorLocal([x,0,z],frame),direction=new THREE.Vector3(end[0]-start[0],0,end[2]-start[2]),length=direction.length();
     if(length>0){ray.set(new THREE.Vector3(start[0],floor+.8*frame.scale,start[2]),direction.normalize());ray.far=length+.16*frame.scale;if(ray.intersectObjects(blockers,false).length)return false;}
    }
    const target=fromInteriorLocal([x,0,z],frame),height=surface(target[0],target[2],floor);
    if(height===undefined||Math.abs(height-floor)>.31*frame.scale)return false;
    p=[x,0,z];floor=height;return true;
   };
   for(let i=0;i<count;i++){if(!step(p[0]+dx,p[2]+dz)){if(!step(p[0]+dx,p[2]))step(p[0],p[2]+dz)}}
   const result=fromInteriorLocal(p,frame);result[1]=floor+eye;return result;
  },
 };
}
