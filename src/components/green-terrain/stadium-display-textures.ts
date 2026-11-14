import * as THREE from 'three';
import {fitBillboardText,fitScreenMedia,type ScreenFit} from '@/lib/troo-world/stadium-display-layout';
let fontLoad:Promise<void>|undefined;
export function loadStadiumImpactFont(){
 if(!fontLoad)fontLoad=(async()=>{const font=new FontFace('StadiumImpact','local("Impact"), url("/fonts/stadium/Anton-Regular.ttf")');await font.load();document.fonts.add(font)})().catch(()=>{});
 return fontLoad;
}
export function billboardTexture(text:string,aspect:number){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=Math.round(1024/aspect);const ctx=canvas.getContext('2d')!;
 ctx.fillStyle='#07182d';ctx.fillRect(0,0,canvas.width,canvas.height);const pad=32;
 const fit=fitBillboardText(text,canvas.width-pad*2,canvas.height-pad*2,(line,size)=>{ctx.font=`${size}px StadiumImpact, Impact, "Arial Narrow", sans-serif`;return ctx.measureText(line).width});
 ctx.font=`${fit.fontSize}px StadiumImpact, Impact, "Arial Narrow", sans-serif`;ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';const top=(canvas.height-fit.lines.length*fit.lineHeight)/2;
 fit.lines.forEach((line,i)=>ctx.fillText(line,canvas.width/2,top+(i+.5)*fit.lineHeight));
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;texture.userData={stadiumDisplay:'billboard',font:'Impact',layout:fit};return texture;
}
export function drawScreenMedia(ctx:CanvasRenderingContext2D,source:CanvasImageSource,width:number,height:number,fit:ScreenFit){const canvas=ctx.canvas;ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);const [sx,sy,sw,sh,dx,dy,dw,dh]=fitScreenMedia(width,height,canvas.width,canvas.height,fit);ctx.drawImage(source,sx,sy,sw,sh,dx,dy,dw,dh);}
