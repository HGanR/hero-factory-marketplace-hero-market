export type ScreenFit='cover'|'contain';
/** Source crop + destination rectangle; preserve aspect, never stretch artwork. */
export function fitScreenMedia(sw:number,sh:number,tw:number,th:number,fit:ScreenFit){
 if(![sw,sh,tw,th].every(n=>Number.isFinite(n)&&n>0))throw Error('Invalid media dimensions');
 if(fit==='contain'){const scale=Math.min(tw/sw,th/sh),width=sw*scale,height=sh*scale;return[0,0,sw,sh,(tw-width)/2,(th-height)/2,width,height] as const;}
 const scale=Math.max(tw/sw,th/sh),width=tw/scale,height=th/scale;return[(sw-width)/2,(sh-height)/2,width,height,0,0,tw,th] as const;
}
export function fitBillboardText(text:string,width:number,height:number,measure:(text:string,size:number)=>number){
 const wrap=(size:number)=>{const lines:string[]=[];for(const paragraph of text.split('\n')){let line='';for(const word of paragraph.split(/\s+/).filter(Boolean)){let rest=word;if(measure(rest,size)>width){if(line){lines.push(line);line='';}let part='';for(const letter of rest){if(part&&measure(part+letter,size)>width){lines.push(part);part='';}part+=letter;}rest=part;}
   if(line&&measure(line+' '+rest,size)>width){lines.push(line);line=rest;}else line+=(line?' ':'')+rest;
  }lines.push(line);}return lines;};
 let low=1,high=256;while(high-low>1){const mid=Math.floor((low+high)/2),lines=wrap(mid);if(lines.length*mid*1.12<=height&&lines.every(l=>measure(l,mid)<=width))low=mid;else high=mid;}
 return{fontSize:low,lineHeight:low*1.12,lines:wrap(low)};
}
