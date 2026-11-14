import {STADIUM_ACCESS as A} from './stadium-navigation';
export const VENUE={stageRadius:9,guestRadius:18,wallRadius:70,ceilingY:36,screenY:26,screenZ:-63,aisleHalfWidth:5.2} as const;
export const seatingRows=()=>[...Array.from({length:6},(_,i)=>{const r=30+i*3.3;return{r,y:A.arenaY+Math.ceil((r-A.stairBottomZ)/(A.stairTopZ-A.stairBottomZ)*A.steps)*(A.landingY-A.arenaY)/A.steps,width:3.3}}),...Array.from({length:3},(_,i)=>({r:62+i*2.5,y:17+i*2.3,width:2.5}))];
export type VenueSeat={x:number;y:number;z:number;yaw:number;guest:boolean};
/** Four radial circulation corridors are excluded before any seat is placed. */
export function venueSeats():VenueSeat[]{
 const rows=seatingRows();
 const seats:VenueSeat[]=[];
 rows.forEach(({r,y},row)=>{const count=Math.floor(2*Math.PI*r/3.4);for(let i=0;i<count;i++){const a=(i+.5)*2*Math.PI/count,x=Math.sin(a)*r,z=Math.cos(a)*r;
  if(Math.min(Math.abs(x),Math.abs(z))<VENUE.aisleHalfWidth+1.4)continue;
  // Reserve a clear sightline and service bay behind the raised main LED wall.
  if(row>=6&&z< -57&&Math.abs(x)<21)continue;
  seats.push({x,y,z,yaw:a+Math.PI,guest:false});
 }});
 for(let i=0;i<12;i++){const a=(i+.5)*Math.PI*2/12;seats.push({x:Math.sin(a)*14,y:A.arenaY,z:Math.cos(a)*14,yaw:a+Math.PI,guest:true});}
 return seats;
}
export function inVenueAisle(x:number,z:number,margin=0){return Math.min(Math.abs(x),Math.abs(z))<VENUE.aisleHalfWidth+margin;}
