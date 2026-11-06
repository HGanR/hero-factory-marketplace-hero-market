// Floor-level dimensions from stadium-elyseum.glb. The walkable audience floor is
// inside the lower seating tier (inner radius 28); backstage lies beyond it.
export type StadiumFloor = { x:number; z:number; scale:number; yaw:number };
export function audienceMove(oldX:number,oldZ:number,newX:number,newZ:number,f:StadiumFloor):[number,number] {
  const c=Math.cos(f.yaw),s=Math.sin(f.yaw);
  const sx=(oldX-f.x)/f.scale,sz=(oldZ-f.z)/f.scale;
  let x=c*sx-s*sz,z=s*sx+c*sz;
  const dx=((newX-oldX)*c-(newZ-oldZ)*s)/f.scale,dz=((newX-oldX)*s+(newZ-oldZ)*c)/f.scale;
  // Clearance also accounts for the straight faces of the polygonal seating ring.
  const free=(a:number,b:number)=>a*a+b*b<=27.4**2 &&
    !(Math.abs(a)<=22.45 && b<=-15.55) && a*a+b*b>=6.45**2;
  const steps=Math.min(256,Math.ceil(Math.hypot(dx,dz)/0.2));
  for(let i=0;i<steps;i++){
    const stepX=Math.max(-0.2,Math.min(0.2,dx/steps)),stepZ=Math.max(-0.2,Math.min(0.2,dz/steps));
    if(free(x+stepX,z))x+=stepX;
    if(free(x,z+stepZ))z+=stepZ;
  }
  return [f.x+f.scale*(c*x+s*z), f.z+f.scale*(-s*x+c*z)];
}
