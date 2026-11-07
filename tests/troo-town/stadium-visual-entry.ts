import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import Stadium from '../../src/components/green-terrain/StadiumElyseum';
const state=window as any;
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,850);renderer.setPixelRatio(1);renderer.setClearColor('#8ecae6');document.body.style.margin='0';document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.add(new THREE.AmbientLight(0xffffff,1.4));const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(60,100,70);scene.add(sun);
const camera=new THREE.PerspectiveCamera(55,1200/850,.1,800);camera.position.set(125,95,155);camera.lookAt(0,15,0);
function children(node:any):any[]{return [node?.props?.children].flat(4).filter(Boolean);}
function object(node:any):THREE.Object3D {
 if(!node||typeof node!=='object')return new THREE.Group();const p=node.props??{};let out:THREE.Object3D;
 if(node.type==='primitive')out=p.object;
 else if(node.type==='mesh'){
  const g=children(node).find(n=>String(n.type).endsWith('Geometry')),m=children(node).find(n=>String(n.type).endsWith('Material'));
  const geometry=g?new ({circleGeometry:THREE.CircleGeometry,ringGeometry:THREE.RingGeometry,cylinderGeometry:THREE.CylinderGeometry,torusGeometry:THREE.TorusGeometry} as any)[g.type](...(g.props.args??[])):new THREE.BufferGeometry();
  const material=new (m?.type==='meshBasicMaterial'?THREE.MeshBasicMaterial:THREE.MeshStandardMaterial)(m?.props??{});out=new THREE.Mesh(geometry,material);
 }else out=new THREE.Group();
 if(p.name)out.name=p.name;if(p.position)out.position.fromArray(p.position);if(p.rotation)out.rotation.fromArray(p.rotation);if(p.scale)typeof p.scale==='number'?out.scale.setScalar(p.scale):out.scale.fromArray(p.scale);
 if(p.ref)p.ref.current=out;if(p.renderOrder)out.renderOrder=p.renderOrder;
 for(const child of children(node))if(!String(child.type).endsWith('Geometry')&&!String(child.type).endsWith('Material'))out.add(object(child));return out;
}
const raw=await fetch('/stadium.glb').then(r=>r.arrayBuffer());const gltf=await new GLTFLoader().parseAsync(raw,'');state.__asset=gltf.scene;const model=object(Stadium({position:[0,0,0],scale:1}));scene.add(model);
state.__stadium={ready:true,renderer,scene,camera,model,setView:(side:string)=>{if(side==='street')camera.position.set(120,37,120);else if(side==='opposite')camera.position.set(-125,95,-155);else camera.position.set(125,95,155);camera.lookAt(0,18,0);},get band(){return model.children.find((g:any)=>g.children.some((m:any)=>m.geometry?.type==='CylinderGeometry'))?.children[0];}};
const start=performance.now();function render(){const t=(performance.now()-start)/1000;for(const frame of state.__frames??[])frame({clock:{getElapsedTime:()=>t}});renderer.render(scene,camera);requestAnimationFrame(render);}render();
