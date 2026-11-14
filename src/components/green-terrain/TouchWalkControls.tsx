'use client';
import {useEffect,useRef,type RefObject} from 'react';
import type {WalkInput} from '@/lib/troo-world/touch-navigation';
const directions=[{key:'forward',name:'Move forward',icon:'↑',row:1,column:2,forward:1,strafe:0},{key:'left',name:'Move left',icon:'←',row:2,column:1,forward:0,strafe:-1},{key:'back',name:'Move backward',icon:'↓',row:2,column:2,forward:-1,strafe:0},{key:'right',name:'Move right',icon:'→',row:2,column:3,forward:0,strafe:1}];
export default function TouchWalkControls({input,active}:{input:RefObject<WalkInput>;active:boolean}){
 const held=useRef(new Map<string,{forward:number;strafe:number}>());
 const update=()=>{let forward=0,strafe=0;for(const value of held.current.values()){forward+=value.forward;strafe+=value.strafe;}const length=Math.max(1,Math.hypot(forward,strafe));input.current.forward=forward/length;input.current.strafe=strafe/length;};
 useEffect(()=>{const clear=()=>{held.current.clear();input.current.forward=0;input.current.strafe=0};clear();window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);return()=>{clear();window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',clear)}},[active,input]);
 if(!active)return null;
 return <nav aria-label="Walk around controls" style={{position:'absolute',left:12,bottom:'max(18px, env(safe-area-inset-bottom))',zIndex:30,display:'grid',gridTemplateColumns:'repeat(3,44px)',gridTemplateRows:'repeat(2,44px)',gap:5,pointerEvents:'auto'}}>
  {directions.map(direction=><button key={direction.key} type="button" aria-label={direction.name} onPointerDown={e=>{e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);held.current.set(String(e.pointerId),direction);update()}} onPointerUp={e=>{held.current.delete(String(e.pointerId));update()}} onPointerCancel={e=>{held.current.delete(String(e.pointerId));update()}} onLostPointerCapture={e=>{held.current.delete(String(e.pointerId));update()}} onKeyDown={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();held.current.set(direction.key,direction);update()}}} onKeyUp={()=>{held.current.delete(direction.key);update()}} onBlur={()=>{held.current.delete(direction.key);update()}} style={{gridRow:direction.row,gridColumn:direction.column,borderRadius:12,border:'1px solid #6dcfff',background:'#08253de6',color:'white',fontSize:25,touchAction:'none',userSelect:'none'}}>{direction.icon}</button>)}
  <span style={{gridColumn:'1 / 4',fontSize:11,color:'white',background:'#08253dcc',borderRadius:6,padding:4,textAlign:'center'}}>Drag the view to look around</span>
 </nav>;
}
