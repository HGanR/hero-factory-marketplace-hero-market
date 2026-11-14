export type WalkInput={forward:number;strafe:number};
/** A second finger may hold a movement button while this pointer looks around. */
export function attachTouchLook(canvas:HTMLCanvasElement,onLook:(dx:number,dy:number)=>void){
 let pointer:number|null=null,x=0,y=0;const previous=canvas.style.touchAction;canvas.style.touchAction='none';
 const down=(e:PointerEvent)=>{if(e.pointerType!=='touch'||pointer!==null)return;pointer=e.pointerId;x=e.clientX;y=e.clientY;canvas.setPointerCapture?.(pointer);};
 const move=(e:PointerEvent)=>{if(e.pointerId!==pointer)return;e.preventDefault();onLook(e.clientX-x,e.clientY-y);x=e.clientX;y=e.clientY;};
 const up=(e:PointerEvent)=>{if(e.pointerId===pointer)pointer=null;};
 const reset=()=>{pointer=null;};
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move,{passive:false});
 for(const name of ['pointerup','pointercancel','lostpointercapture'] as const)canvas.addEventListener(name,up);
 window.addEventListener('blur',reset);
 return()=>{canvas.style.touchAction=previous;canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);for(const name of ['pointerup','pointercancel','lostpointercapture'] as const)canvas.removeEventListener(name,up);window.removeEventListener('blur',reset);reset();};
}
