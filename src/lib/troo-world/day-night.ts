/** A shared town clock: every visitor sees the same New York day/night phase. */
export const TOWN_TIME_ZONE='America/New_York';
const formatter=new Intl.DateTimeFormat('en-US',{timeZone:TOWN_TIME_ZONE,hourCycle:'h23',hour:'2-digit',minute:'2-digit',second:'2-digit'});
export function townDaylight(date=new Date()){
 const parts=formatter.formatToParts(date);const part=(name:string)=>Number(parts.find(p=>p.type===name)?.value??0);
 const hour=part('hour')+part('minute')/60+part('second')/3600,angle=(hour-6)*Math.PI/12;
 const altitude=Math.sin(angle),t=Math.max(0,Math.min(1,(altitude+.12)/.35)),daylight=t*t*(3-2*t);
 return{hour,daylight,twilight:Math.max(0,1-Math.abs(altitude)/.28),sun:[Math.cos(angle)*160,altitude*160,-70] as [number,number,number]};
}
/** Outdoor night light is reduced while daytime and stadium interior levels stay stable. */
export function townLightLevels(daylight:number,interior=false){
 if(interior)return{ambient:.24,directional:.25,hemisphere:.18};
 const d=Math.max(0,Math.min(1,daylight));return{ambient:.24+d*.36,directional:.18+d*1.62,hemisphere:.18+d*.32};
}
