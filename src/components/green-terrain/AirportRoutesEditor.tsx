'use client';
import {useState,type FormEvent} from 'react';
import {validateDestinations,type AirportDestination} from '@/lib/troo-world/green-terrain-layout';

export default function AirportRoutesEditor({destinations,onChange}:{destinations:AirportDestination[];onChange:(routes:AirportDestination[])=>void}){
 const [editingId,setEditingId]=useState<string|null>(null),[name,setName]=useState(''),[url,setUrl]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const reset=()=>{setEditingId(null);setName('');setUrl('');setError('');};
 function save(event:FormEvent){
  event.preventDefault();
  try{
   const entry={id:editingId??crypto.randomUUID(),name,url};
   const next=validateDestinations(editingId?destinations.map(r=>r.id===editingId?entry:r):[...destinations,entry]);
   onChange(next);reset();setNotice('Destination updated in this draft. Save World Layout to publish.');
  }catch(error){setError(error instanceof Error?error.message:'Unable to save destination.');}
 }
 return <section aria-label="Airport flight routes">
  <p>You choose which member worlds appear in Departures. Visitors see the destination name as a link. Save World Layout publishes this list.</p>
  <ul style={{paddingLeft:18}}>{destinations.map(route=><li key={route.id} style={{marginBottom:10}}>
   <strong>{route.name}</strong><br/><small style={{overflowWrap:'anywhere'}}>{route.url}</small><br/>
   <button type="button" aria-label={`Edit ${route.name}`} onClick={()=>{setEditingId(route.id);setName(route.name);setUrl(route.url);setError('');setNotice('');}}>Edit</button>{' '}
   <button type="button" aria-label={`Remove ${route.name}`} onClick={()=>{onChange(destinations.filter(r=>r.id!==route.id));if(editingId===route.id)reset();setNotice('Destination removed from this draft. Save World Layout to publish.');}}>Remove</button>
  </li>)}</ul>
  <form onSubmit={save}>
   <label style={{display:'block'}}>Destination name<input aria-label="Destination name" maxLength={80} required value={name} placeholder="ABC" onChange={e=>setName(e.target.value)}/></label>
   <label style={{display:'block'}}>Member world URL<input aria-label="Member world URL" maxLength={1500} required value={url} placeholder="https://member-world.example" onChange={e=>setUrl(e.target.value)}/></label>
   <button type="submit">{editingId?'Update destination':'Add destination'}</button>{editingId&&<button type="button" onClick={reset}>Cancel editing</button>}
  </form>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </section>;
}
