import type {GreenLayout} from './green-terrain-layout';
import {INTERSECTION_SPAWN} from './town-placement';

/** Admin's Green Terrain library only. These are not marketplace catalog entries. */
export const TERRAIN_LIBRARY_ASSETS=[
 {key:'forest-habitat',name:'Forest Habitat',icon:'🌳',category:'Buildings',modelUrl:'/models/green-terrain/forest-habitat.glb',defaultScale:1,description:'Furnished forest habitat with patio, landscaping and architectural detail. Green Terrain placement only.'},
 {key:'troo-transit-bus',name:'TROO Transit Bus',icon:'🚌',category:'Transport',modelUrl:'/models/green-terrain/troo-transit-bus.glb',defaultScale:1,description:'Detailed bus with passengers, destination signs and lights. Placed parked; its source route animation is not started.'},
] as const;
export function terrainLibraryAssetForModel(url:string){return TERRAIN_LIBRARY_ASSETS.find(asset=>asset.modelUrl===url.split(/[?#]/)[0]);}
export function placeTerrainLibraryAsset(imports:GreenLayout['imports'],key:string,identity:string):GreenLayout['imports']{
 const asset=TERRAIN_LIBRARY_ASSETS.find(asset=>asset.key===key);if(!asset)throw new Error('Unknown Green Terrain asset.');
 if(imports.length>=100)throw new Error('The town supports 100 imported models.');
 if(!/^[a-zA-Z0-9-]{1,36}$/.test(identity))throw new Error('Invalid placement identity.');
 const elementKey=asset.key+'-'+identity;if(imports.some(p=>p.elementKey===elementKey))throw new Error('This placement already exists.');
 return[...imports,{elementKey,glbUrl:asset.modelUrl,position:[...INTERSECTION_SPAWN],scale:asset.defaultScale,rotationY:0}];
}
