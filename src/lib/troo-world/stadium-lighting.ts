import type {Object3D,Light} from 'three';
/** Ambient/hemisphere/directional lights affect the entire scene, even inside a building group. */
export function setStadiumInteriorLighting(stadium:Object3D,inside:boolean){
 stadium.traverse(object=>{const light=object as Light&{isAmbientLight?:boolean;isHemisphereLight?:boolean;isDirectionalLight?:boolean};
  if(!light.isLight||!(light.isAmbientLight||light.isHemisphereLight||light.isDirectionalLight))return;
  if(light.userData.stadiumInteriorIntensity===undefined)light.userData.stadiumInteriorIntensity=light.intensity;
  light.intensity=inside?light.userData.stadiumInteriorIntensity:0;
 });
}
