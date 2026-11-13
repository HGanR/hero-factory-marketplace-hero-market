import type {GreenLayout,Vec3} from './green-terrain-layout';

export const AIRPORT={
 key:'airport-cycle-30min',name:'Airport · 30-minute flight cycle',
 modelUrl:'/models/world-assets/airport_cycle_30min.glb',duration:1800,
 // The source is metres and has a 600 m runway. This editable display scale
 // fits its static footprint in the current town without relocating buildings.
 defaultPosition:[0,0,-65] as Vec3,defaultScale:.1,
 stages:[
  {name:'Deplaning',time:0},{name:'Servicing',time:125},{name:'Boarding',time:1125},
  {name:'Bridge retracts',time:1275},{name:'Taxi out',time:1305},{name:'Takeoff',time:1405},
  {name:'Climb',time:1450},{name:'Airspace clear',time:1500},{name:'Approach',time:1625},
  {name:'Landing and taxi in',time:1665},{name:'Bridge docks',time:1777},
 ],
} as const;
export type ImportedPlacement=GreenLayout['imports'][number];
export function isAirport(placement:ImportedPlacement){return placement.glbUrl.split(/[?#]/)[0]===AIRPORT.modelUrl;}
export function placeAirport(imports:GreenLayout['imports']):GreenLayout['imports']{
 if(imports.some(isAirport))return imports;
 if(imports.length>=100)throw new Error('Remove an imported model before adding another. The saved town supports 100 imports.');
 if(imports.some(p=>p.elementKey===AIRPORT.key))throw new Error('An existing model uses the airport placement name. Rename or remove that placement first.');
 return [...imports,{elementKey:AIRPORT.key,glbUrl:AIRPORT.modelUrl,position:[...AIRPORT.defaultPosition],scale:AIRPORT.defaultScale,rotationY:0}];
}
export function airportStage(time:number){
 const seconds=((time%AIRPORT.duration)+AIRPORT.duration)%AIRPORT.duration;
 return [...AIRPORT.stages].reverse().find(stage=>seconds>=stage.time)??AIRPORT.stages[0];
}
export function airportView(placement:ImportedPlacement){
 const transform=([x,y,z]:Vec3):Vec3=>{
  const c=Math.cos(placement.rotationY),s=Math.sin(placement.rotationY),k=placement.scale;
  return [placement.position[0]+k*(x*c+z*s),placement.position[1]+k*y,placement.position[2]+k*(-x*s+z*c)];
 };
 return {position:transform([420,300,420]),lookAt:transform([0,15,60])};
}
