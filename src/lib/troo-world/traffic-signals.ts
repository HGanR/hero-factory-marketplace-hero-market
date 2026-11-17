/** One shared UTC clock for buses, signals and pedestrian crossings. */
export const TRAFFIC_EPOCH=Date.UTC(2026,10,17)/1000;
export const SIGNAL_PERIOD=136;
export const STOP_LINE=9;
export type TrafficAxis='north-south'|'east-west';
export const trafficTime=()=>Math.max(0,Date.now()/1000-TRAFFIC_EPOCH);
export function signalState(time:number){
 const phase=((time%SIGNAL_PERIOD)+SIGNAL_PERIOD)%SIGNAL_PERIOD;
 return{phase,northSouth:phase<45?'green':phase<48?'yellow':'red',eastWest:phase>=50&&phase<95?'green':phase>=95&&phase<98?'yellow':'red',walk:phase>=100&&phase<120} as const;
}
/** Admit only if the entire vehicle can clear before its green ends. */
export function nextGreenEntry(axis:TrafficAxis,arrival:number,clearance:number){
 const start=axis==='north-south'?0:50,end=start+45;
 if(clearance>45)return Infinity;
 let cycle=Math.floor(arrival/SIGNAL_PERIOD),at=arrival-cycle*SIGNAL_PERIOD;
 if(at<start)return cycle*SIGNAL_PERIOD+start;
 if(at<=end-clearance)return arrival;
 return(cycle+1)*SIGNAL_PERIOD+start;
}
export function crossingPose(side:number,index:number,time:number){
 const cycle=Math.floor(time/SIGNAL_PERIOD),phase=((time%SIGNAL_PERIOD)+SIGNAL_PERIOD)%SIGNAL_PERIOD,reverse=(cycle+index)%2!==0;
 const progress=Math.max(0,Math.min(1,(phase-100-(index%4)*.7)/(14.4/.9))),from=reverse?7.2:-7.2,along=from+(reverse?-14.4:14.4)*progress;
 const position:[number,number,number]=side<2?[along,.44,side===0?-6.6:6.6]:[side===2?-6.6:6.6,.44,along];
 return{position,yaw:side<2?(reverse?-Math.PI/2:Math.PI/2):(reverse?Math.PI:0),walking:progress>0&&progress<1};
}
