export type WalkInput={forward:number;strafe:number};
/** Drag the scene to look with touch or the primary mouse button. Pointer-lock look stays separate. */
export function attachTouchLook(canvas:HTMLCanvasElement,onLook:(dx:number,dy:number)=>void){
 let pointer:number|null=null,x=0,y=0;const previous=canvas.style.touchAction;canvas.style.touchAction='none';
 const down=(e:PointerEvent)=>{if(pointer!==null||canvas.ownerDocument.pointerLockElement===canvas)return;if(e.pointerType!=='touch'&&!(e.pointerType==='mouse'&&e.button===0))return;pointer=e.pointerId;x=e.clientX;y=e.clientY;canvas.setPointerCapture?.(pointer);};
 const move=(e:PointerEvent)=>{if(e.pointerId!==pointer)return;if(canvas.ownerDocument.pointerLockElement===canvas||(e.pointerType==='mouse'&&(e.buttons&1)===0)){pointer=null;return;}e.preventDefault();onLook(e.clientX-x,e.clientY-y);x=e.clientX;y=e.clientY;};
 const up=(e:PointerEvent)=>{if(e.pointerId===pointer)pointer=null;};
 const reset=()=>{pointer=null;};
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move,{passive:false});
 for(const name of ['pointerup','pointercancel','lostpointercapture'] as const)canvas.addEventListener(name,up);
 window.addEventListener('blur',reset);
 return()=>{canvas.style.touchAction=previous;canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);for(const name of ['pointerup','pointercancel','lostpointercapture'] as const)canvas.removeEventListener(name,up);window.removeEventListener('blur',reset);reset();};
}
