import type {Texture,TextureLoader} from 'three';

/** Own successful, failed and late image loads for one mounted building. */
export function loadTownTexture(loader:TextureLoader,url:string,onLoaded:(texture:Texture)=>void){
 let active=true,failed=false;
 const disposed=new WeakSet<Texture>();
 const dispose=(texture:Texture)=>{if(!disposed.has(texture)){disposed.add(texture);texture.dispose();}};
 let requested:Texture|undefined;
 requested=loader.load(url,texture=>{
  if(active&&!failed)onLoaded(texture);else dispose(texture);
 },undefined,()=>{
  failed=true;
  if(requested)dispose(requested);
 });
 if(failed)dispose(requested);
 return()=>{active=false;dispose(requested!);};
}
