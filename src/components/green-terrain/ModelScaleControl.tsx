'use client';
/** Same 5%–2000% uniform scale range as the stadium; saved in the town layout. */
export default function ModelScaleControl({label,value,resetValue=1,onChange}:{label:string;value:number;resetValue?:number;onChange:(scale:number)=>void}){
 const change=(value:string)=>{const scale=Number(value);if(Number.isFinite(scale)&&scale>=.05&&scale<=20)onChange(scale);};
 return <fieldset style={{border:'1px solid #36526b',borderRadius:8,padding:9,marginTop:10}}>
  <legend>{label} size</legend><span>{Math.round(value*100)}%</span>
  <input aria-label={`${label} size slider`} type="range" min={.05} max={20} step={.05} value={value} onChange={e=>change(e.target.value)} style={{width:'100%',accentColor:'#65bfff'}}/>
  <label>Scale <input aria-label={`${label} scale`} type="number" min={.05} max={20} step={.05} value={value} onChange={e=>change(e.target.value)} style={{width:80}}/></label>{' '}
  <button type="button" onClick={()=>onChange(resetValue)}>Reset {label} size</button>
 </fieldset>;
}
