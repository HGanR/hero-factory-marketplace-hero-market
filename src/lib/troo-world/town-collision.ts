/** Conservative exterior camera volumes; explicit interior/portal travel uses its own controls. */
export type Point3 = [number,number,number];
export type TownBox = {min:Point3;max:Point3};
export const VISITOR_CLEARANCE=0.65;
const EPS=0.0001;
// Walking uses a body extending two units below the eye, so low benches/trunks block too.
const expanded=(b:TownBox,walking:boolean,clearance:number):TownBox=>({min:b.min.map(v=>v-clearance) as Point3,max:b.max.map((v,i)=>v+(walking&&i===1?2:clearance)) as Point3});
const contains=(p:Point3,b:TownBox)=>p.every((v,i)=>v>b.min[i]-EPS/2&&v<b.max[i]+EPS/2);
function recover(p:Point3,boxes:TownBox[],walking:boolean):Point3 {
 if(!boxes.some(b=>contains(p,b)))return [...p];
 // Handle a newly loaded/resized building enclosing the camera, or orbit -> walking.
 const axes=walking?[0,2]:[0,1,2];const candidates:Point3[]=[];
 for(const axis of axes)for(const b of boxes)for(const value of [b.min[axis]-EPS,b.max[axis]+EPS]){const q=[...p] as Point3;q[axis]=value;candidates.push(q);}
 const valid=candidates.filter(q=>!boxes.some(b=>contains(q,b)));
 valid.sort((a,b)=>a.reduce((n,v,i)=>n+(v-p[i])**2,0)-b.reduce((n,v,i)=>n+(v-p[i])**2,0));
 return valid[0]??[...p];
}
function entry(p:Point3,d:Point3,b:TownBox){
 let near=-Infinity,far=Infinity,axis=-1;
 for(let i=0;i<3;i++){
  if(Math.abs(d[i])<1e-10){if(p[i]<b.min[i]||p[i]>b.max[i])return null;continue;}
  let a=(b.min[i]-p[i])/d[i],z=(b.max[i]-p[i])/d[i];if(a>z)[a,z]=[z,a];
  if(a>near){near=a;axis=i;}far=Math.min(far,z);if(near>far)return null;
 }
 return near>=0&&near<=1&&far>=0?{time:near,axis}:null;
}
/** Swept point against clearance-expanded volumes: prevents crossing even in a large zoom/scroll step. */
export function constrainTownCamera(from:Point3,wanted:Point3,volumes:TownBox[],walking=false,clearance=VISITOR_CLEARANCE):Point3 {
 const boxes=volumes.map(b=>expanded(b,walking,clearance));let p=recover(from,boxes,walking),d=wanted.map((v,i)=>v-from[i]) as Point3;
 for(let pass=0;pass<3;pass++){
  let first:{time:number;axis:number}|null=null;
  for(const b of boxes){const hit=entry(p,d,b);if(hit&&(!first||hit.time<first.time))first=hit;}
  if(!first)return p.map((v,i)=>v+d[i]) as Point3;
  const length=Math.hypot(...d),t=Math.max(0,first.time-EPS/Math.max(length,EPS));
  p=p.map((v,i)=>v+d[i]*t) as Point3;d=d.map(v=>v*(1-t)) as Point3;d[first.axis]=0;
 }
 return p;
}
