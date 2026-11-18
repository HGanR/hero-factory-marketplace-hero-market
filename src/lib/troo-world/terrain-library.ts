import type {GreenLayout} from './green-terrain-layout';
import {INTERSECTION_SPAWN} from './town-placement';

/** Admin's Green Terrain library only. These are not marketplace catalog entries. */
export const TERRAIN_LIBRARY_ASSETS=[
 {key:'forest-habitat',name:'Forest Habitat',icon:'🌳',category:'Buildings',modelUrl:'/models/green-terrain/forest-habitat.glb',defaultScale:1,description:'Furnished forest habitat with patio, landscaping and architectural detail. Green Terrain placement only.'},
 {key:'for-rent-sign',name:'For Rent / For Sale Sign',icon:'🏷️',category:'Property Signs',modelUrl:'procedural:for-rent-sign',defaultScale:1,description:'Placeable property sign with nighttime spotlights. Position beside the listing building; link the property agent in Assign Property Agent.'},
 {key:'troo-transit-bus',name:'TROO Transit Bus',icon:'🚌',category:'Transport',modelUrl:'/models/green-terrain/troo-transit-bus.glb',defaultScale:1,description:'Detailed bus with passengers, destination signs and lights. Alternates North–South then East–West, obeys junction signals and takes a 30-minute break after each pair. Parked in Editor Mode; route settings in Save.'},
] as const;
export function terrainLibraryAssetForModel(url:string){return TERRAIN_LIBRARY_ASSETS.find(asset=>asset.modelUrl===url.split(/[?#]/)[0]);}
export function placeTerrainLibraryAsset(imports:GreenLayout['imports'],key:string,identity:string):GreenLayout['imports']{
 const asset=TERRAIN_LIBRARY_ASSETS.find(asset=>asset.key===key);if(!asset)throw new Error('Unknown Green Terrain asset.');
 if(imports.length>=100)throw new Error('The town supports 100 imported models.');
 if(!/^[a-zA-Z0-9-]{1,36}$/.test(identity))throw new Error('Invalid placement identity.');
 const elementKey=asset.key+'-'+identity;if(imports.some(p=>p.elementKey===elementKey))throw new Error('This placement already exists.');
 return[...imports,{elementKey,glbUrl:asset.modelUrl,position:[...INTERSECTION_SPAWN],scale:asset.defaultScale,rotationY:0}];
}
