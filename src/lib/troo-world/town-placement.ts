import type {GreenLayout,Vec3,BuildingId} from './green-terrain-layout';
export const INTERSECTION_SPAWN:Vec3=[0,0,0];
export type TownSelection={kind:'object'|'import'|'building';id:string}|{kind:'tree';id:number};
const yaw=(r:number)=>Math.atan2(Math.sin(r),Math.cos(r));
export function rotateTownSelection(layout:GreenLayout,selection:TownSelection,delta:number):GreenLayout{
 if(!Number.isFinite(delta))return layout;
 if(selection.kind==='object')return{...layout,objects:layout.objects.map(row=>row.id===selection.id?{...row,rotation:[row.rotation[0],yaw(row.rotation[1]+delta),row.rotation[2]]}:row)};
 if(selection.kind==='import')return{...layout,imports:layout.imports.map(row=>row.elementKey===selection.id?{...row,rotationY:yaw(row.rotationY+delta)}:row)};
 if(selection.kind==='tree')return{...layout,trees:layout.trees.map(row=>row.id===selection.id?{...row,rotationY:yaw((row.rotationY??0)+delta)}:row)};
 const id=selection.id as BuildingId;if(!layout.buildings[id])return layout;
 return{...layout,buildings:{...layout.buildings,[id]:{...layout.buildings[id],rotationY:yaw(layout.buildings[id].rotationY+delta)}}};
}
