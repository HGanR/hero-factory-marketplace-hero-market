'use client';
import {useEffect,useRef,useState} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import type {StadiumMedia} from '@/lib/troo-world/stadium-events';
import type {ScreenFit} from '@/lib/troo-world/stadium-display-layout';
import {drawScreenMedia} from './stadium-display-textures';
export function useStadiumScreenMedia(media:StadiumMedia|null|undefined,fit:ScreenFit){
 const[texture,setTexture]=useState<THREE.CanvasTexture|null>(null),[needsPlay,setNeedsPlay]=useState(false),[error,setError]=useState('');
 const frame=useRef<(()=>void)|null>(null),player=useRef<HTMLVideoElement|null>(null),tick=useRef(0);
 useFrame((_,delta)=>{tick.current+=delta;if(tick.current>=1/24){tick.current=0;frame.current?.()}});
 useEffect(()=>{
  setTexture(null);setNeedsPlay(false);setError('');if(!media)return;let active=true;
  const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=512;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#07182d';ctx.fillRect(0,0,canvas.width,canvas.height);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.flipY=false;tex.minFilter=THREE.LinearFilter;tex.generateMipmaps=false;tex.userData={stadiumDisplay:'main',mediaKind:media.kind,fit};
  const fail=()=>{if(active)setError('The stadium screen media could not be played.');};
  const draw=(source:CanvasImageSource,w:number,h:number)=>{if(!active||!w||!h)return;try{drawScreenMedia(ctx,source,w,h,fit);tex.needsUpdate=true;}catch{fail();}};
  let image:HTMLImageElement|undefined,video:HTMLVideoElement|undefined,videoFrame:number|undefined;
  const visibility=()=>{if(!video)return;if(document.hidden)video.pause();else void video.play().catch(()=>{if(active)setNeedsPlay(true)})};
  if(media.kind==='image'){image=new Image();image.crossOrigin='anonymous';image.onload=()=>{if(!active)return;draw(image!,image!.naturalWidth,image!.naturalHeight);setTexture(tex)};image.onerror=fail;image.src=media.url;}
  else{video=document.createElement('video');video.crossOrigin='anonymous';video.muted=true;video.playsInline=true;video.loop=true;video.preload='auto';player.current=video;
   video.onloadeddata=()=>{if(!active)return;draw(video!,video!.videoWidth,video!.videoHeight);setTexture(tex);void video!.play().catch(()=>{if(active)setNeedsPlay(true)})};video.onerror=fail;video.onplaying=()=>{if(active)setNeedsPlay(false)};video.src=media.url;
   const update=()=>{if(video!.readyState>=2&&!document.hidden){draw(video!,video!.videoWidth,video!.videoHeight);tex.userData.frameTime=video!.currentTime;}};
   if(video.requestVideoFrameCallback){const next=()=>{if(!active)return;update();videoFrame=video!.requestVideoFrameCallback(next)};videoFrame=video.requestVideoFrameCallback(next);}else frame.current=update;document.addEventListener('visibilitychange',visibility);video.load();
  }
  return()=>{active=false;frame.current=null;player.current=null;document.removeEventListener('visibilitychange',visibility);if(image){image.onload=null;image.onerror=null;image.removeAttribute('src');}if(video){if(videoFrame!==undefined)video.cancelVideoFrameCallback(videoFrame);video.onloadeddata=null;video.onplaying=null;video.onerror=null;video.pause();video.removeAttribute('src');video.load();}tex.dispose();};
 },[media?.kind,media?.url,fit]);
 return{texture,needsPlay,error,play:()=>{void player.current?.play().catch(()=>setNeedsPlay(true))}};
}
