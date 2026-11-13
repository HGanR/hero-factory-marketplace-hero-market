'use client';
import type {AirportDestination} from '@/lib/troo-world/green-terrain-layout';

/** The visitor boards a route by following its curated destination link. */
export default function AirportDepartures({destinations}:{destinations:AirportDestination[]}){
 return <section aria-label="Flights to member worlds">
  <h3>Departures</h3>
  <p>Choose a destination and board your flight to another world.</p>
  {destinations.length===0?<p>No destinations are scheduled yet.</p>:<ul style={{listStyle:'none',padding:0,display:'grid',gap:8}}>
   {destinations.map(route=><li key={route.id}><a href={route.url} aria-label={`Fly to ${route.name}`} style={{display:'block',padding:'12px 14px',background:'#153b57',border:'1px solid #65bfff',borderRadius:9,color:'white',textDecoration:'none',fontWeight:600}}>✈ {route.name} <span aria-hidden="true">→</span></a></li>)}
  </ul>}
 </section>;
}
