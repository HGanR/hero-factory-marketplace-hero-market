'use client';
import {useEffect,useState} from 'react';
import * as THREE from 'three';
/** Circular, camera-facing image card. Owns its texture; late/failed image loads are harmless. */
export default function ProfilePortrait({position,url,host=false,speaking=false}:{position:[number,number,number];url?:string;host?:boolean;speaking?:boolean}){
 const[texture,setTexture]=useState<THREE.CanvasTexture|null>(null);
 useEffect(()=>{let alive=true,owned:THREE.CanvasTexture|undefined;const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');if(!c)return;
  const draw=(image?:HTMLImageElement)=>{c.clearRect(0,0,256,256);c.fillStyle=host?'#f4c66c':'#23d6f2';c.beginPath();c.arc(128,128,126,0,Math.PI*2);c.fill();c.save();c.beginPath();c.arc(128,128,116,0,Math.PI*2);c.clip();c.fillStyle='#102a40';c.fillRect(0,0,256,256);
   if(image){const side=Math.min(image.naturalWidth,image.naturalHeight);c.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,12,12,232,232);}else{c.fillStyle='#bdddea';c.beginPath();c.arc(128,94,32,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(128,191,60,49,0,0,Math.PI*2);c.fill();}c.restore();
   owned?.dispose();owned=new THREE.CanvasTexture(canvas);owned.colorSpace=THREE.SRGBColorSpace;owned.userData.profileImage=!!image;if(alive)setTexture(owned);else owned.dispose();};
  draw();const image=new Image();image.decoding='async';image.referrerPolicy='no-referrer';image.onload=()=>{if(alive)draw(image)};
  if(url?.startsWith('/api/troo-world/presence/portrait?ref='))image.src=url;
  return()=>{alive=false;image.onload=null;image.onerror=null;image.removeAttribute('src');owned?.dispose()};
 },[url,host]);
 return <sprite position={[position[0],position[1]+1.1,position[2]]} scale={speaking?[1.12,1.12,1]:[1,1,1]} name={host?'Host_Profile_Portrait':'Attendee_Profile_Portrait'}><spriteMaterial map={texture} transparent toneMapped={false} depthWrite={false}/></sprite>;
}
