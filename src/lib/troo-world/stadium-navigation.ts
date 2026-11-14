import type {Point3} from './town-collision';
export type InteriorFrame={position:Point3;scale:number;rotationY:number;eyeHeight?:number;stageAccess?:boolean};
export const STADIUM_ACCESS={arenaY:0.3,landingY:15.1,arenaRadius:27,concourseInner:56,concourseOuter:61,stairBottomZ:24,stairTopZ:56,landingEndZ:64,entryZ:56.8,width:8,steps:64} as const;
export const INTERIOR_EYE_HEIGHT=1.7;
export function toInteriorLocal(p:Point3,f:InteriorFrame):Point3{const x=(p[0]-f.position[0])/f.scale,z=(p[2]-f.position[2])/f.scale,c=Math.cos(f.rotationY),s=Math.sin(f.rotationY);return[c*x-s*z,(p[1]-f.position[1])/f.scale,s*x+c*z];}
export function fromInteriorLocal(p:Point3,f:InteriorFrame):Point3{const c=Math.cos(f.rotationY),s=Math.sin(f.rotationY);return[f.position[0]+f.scale*(c*p[0]+s*p[2]),f.position[1]+f.scale*p[1],f.position[2]+f.scale*(-s*p[0]+c*p[2])];}
export function stadiumEntry(f:InteriorFrame){const position=fromInteriorLocal([0,STADIUM_ACCESS.landingY,STADIUM_ACCESS.entryZ],f),lookAt=fromInteriorLocal([0,5,0],f);position[1]+=(f.eyeHeight??INTERIOR_EYE_HEIGHT*f.scale);return{position,lookAt};}
export function stadiumLocalFloor(x:number,z:number,stageAccess=false){
 if(stageAccess){if(Math.hypot(x,z)<=9)return 1.2;if(Math.abs(x)<=1.5&&z>=9&&z<=13.5)return .3+(13.5-z)/4.5*.9;}
 const a=STADIUM_ACCESS;
 const along=Math.max(Math.abs(x),Math.abs(z)),across=Math.min(Math.abs(x),Math.abs(z));
 if(across<=a.width/2&&along>=a.stairBottomZ&&along<=a.landingEndZ){const fraction=Math.min(1,Math.max(0,(along-a.stairBottomZ)/(a.stairTopZ-a.stairBottomZ)));return a.arenaY+Math.ceil(fraction*a.steps-1e-8)*(a.landingY-a.arenaY)/a.steps;}
 return Math.hypot(x,z)>=a.concourseInner?a.landingY:a.arenaY;
}
export function stadiumFloorAt(x:number,z:number,f:InteriorFrame){const p=toInteriorLocal([x,f.position[1],z],f);return f.position[1]+stadiumLocalFloor(p[0],p[2],f.stageAccess)*f.scale;}
function allowed(x:number,z:number,f:InteriorFrame){const a=STADIUM_ACCESS,r=Math.hypot(x,z),clearance=0.4;
 // The stage remains restricted for ordinary visitors, in the same scaled coordinate frame.
 if(r<18+clearance&&!f.stageAccess)return false;
 return r<=a.arenaRadius-clearance || (Math.min(Math.abs(x),Math.abs(z))<=a.width/2-clearance&&Math.max(Math.abs(x),Math.abs(z))>=a.stairBottomZ&&Math.max(Math.abs(x),Math.abs(z))<=a.landingEndZ) || (r>=a.concourseInner+clearance&&r<=a.concourseOuter-clearance);
}
function recover(p:Point3,f:InteriorFrame):Point3{if(allowed(p[0],p[2],f))return p;const a=STADIUM_ACCESS,r=Math.hypot(p[0],p[2])||1,clearance=0.4;
 const candidates:Point3[]=[[0,0,62],[0,0,22],[p[0]/r*(a.arenaRadius-clearance-0.01),0,p[2]/r*(a.arenaRadius-clearance-.01)],[p[0]/r*(a.concourseOuter-clearance-.01),0,p[2]/r*(a.concourseOuter-clearance-.01)]];
 const valid=candidates.filter(q=>allowed(q[0],q[2],f));valid.sort((a,b)=>(a[0]-p[0])**2+(a[2]-p[2])**2-((b[0]-p[0])**2+(b[2]-p[2])**2));return valid[0]??[0,0,22];
}
/** Substeps prevent tunneling through the seating gap, outer wall, stage or stair rails. */
export function constrainStadiumMotion(from:Point3,wanted:Point3,f:InteriorFrame):Point3{
 const original=toInteriorLocal(from,f),end=toInteriorLocal(wanted,f);let p=recover(original,f);let dx=end[0]-original[0],dz=end[2]-original[2];
 const distance=Math.hypot(dx,dz);if(distance>30){dx*=30/distance;dz*=30/distance;}const count=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.2));
 const valid=(x:number,z:number)=>allowed(x,z,f)&&Math.abs(stadiumLocalFloor(x,z,f.stageAccess)-stadiumLocalFloor(p[0],p[2],f.stageAccess))<=.3;
 for(let i=0;i<count;i++){const x=p[0]+dx/count,z=p[2]+dz/count;if(valid(x,z)){p=[x,0,z];}else if(valid(x,p[2]))p=[x,0,p[2]];else if(valid(p[0],z))p=[p[0],0,z];}
 const result=fromInteriorLocal([p[0],stadiumLocalFloor(p[0],p[2],f.stageAccess),p[2]],f);result[1]+=(f.eyeHeight??INTERIOR_EYE_HEIGHT*f.scale);return result;
}
export function constrainRoomMotion(wanted:Point3,f:InteriorFrame,halfWidth:number,halfDepth:number):Point3{const p=toInteriorLocal(wanted,f),r=.4/f.scale;p[0]=Math.max(-halfWidth+r,Math.min(halfWidth-r,p[0]));p[2]=Math.max(-halfDepth+r,Math.min(halfDepth-r,p[2]));const out=fromInteriorLocal(p,f);out[1]=wanted[1];return out;}
export function worldOrbitEnabled(state:string,firstPerson:boolean){return state==='world'&&!firstPerson;}

