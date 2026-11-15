import * as THREE from 'three';
import {fromInteriorLocal,toInteriorLocal,type InteriorFrame} from './stadium-navigation';
import {STOREFRONT} from '../world-assets/storefront';
export const isOffice=(p:{glbUrl:string})=>p.glbUrl.split(/[?#]/)[0]===STOREFRONT.modelUrl;
export const BUILDING_NAMES:Record<string,string>={'nexus-tower':'Nexus Tower','meridian-tower':'Meridian Tower','troothhertz-tower':'Troothhertz Tower','stadium-elyseum':'TROOTHHERTZ Stadium','veritas-school':'Veritas'};
export function importedBuildingName(p:{glbUrl:string;elementKey:string}){return isOffice(p)?STOREFRONT.name:p.elementKey.startsWith('airport-')?'Airport':p.elementKey;}
export function officeEntry(frame:InteriorFrame){return{position:fromInteriorLocal([4.5,2.15,2.8],frame),lookAt:fromInteriorLocal([0,2.15,-2],frame)};}
/** Read the supplied model's walkable collision meshes, including its sloping stair ramps. */
export function officeWalker(frame:InteriorFrame,findModel:()=>THREE.Object3D|undefined){
 let floor=frame.position[1]+.45*frame.scale;const eye=1.7*frame.scale,ray=new THREE.Raycaster();
 const surface=(x:number,z:number,y:number)=>{
  const root=findModel();if(!root)return undefined;root.updateWorldMatrix(true,true);
  const meshes:THREE.Object3D[]=[];root.traverse(n=>{if((n as THREE.Mesh).isMesh&&/^COL_(plinth|floor[23]_slab|stairs_.*(?:ramp|landing)|entry_steps_ramp)$/.test(n.name))meshes.push(n)});
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
    x=Math.max(-7.65,Math.min(7.65,x));z=Math.max(-5.65,Math.min(maxZ,z));
    const target=fromInteriorLocal([x,0,z],frame),height=surface(target[0],target[2],floor);
    if(height===undefined||Math.abs(height-floor)>.31*frame.scale)return false;
    p=[x,0,z];floor=height;return true;
   };
   for(let i=0;i<count;i++){if(!step(p[0]+dx,p[2]+dz)){if(!step(p[0]+dx,p[2]))step(p[0],p[2]+dz)}}
   const result=fromInteriorLocal(p,frame);result[1]=floor+eye;return result;
  },
 };
}
