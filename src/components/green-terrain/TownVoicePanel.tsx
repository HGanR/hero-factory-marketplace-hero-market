'use client';
import type {useTownPresence} from './useTownPresence';
type Presence=ReturnType<typeof useTownPresence>;
export default function TownVoicePanel({value,active}:{value:Presence;active:boolean}){if(!active)return null;return <section aria-label="Avatar and nearby voice" style={{position:'absolute',right:12,bottom:18,zIndex:130,maxWidth:290,padding:12,borderRadius:12,background:'#071b2def',border:'1px solid #42c6e5',color:'white',font:'13px system-ui'}}>
 <strong>{value.identity?.role==='host'?'Host · stadium profile image':'Stadium profile & nearby voice'}</strong>
 {!value.profile&&!value.connected&&<p>Sign in to use your avatar and nearby chat.</p>}
 {value.profile?.setupRequired&&<p>Avatar and seating storage needs setup.</p>}
 {value.profile?.portraitUrl&&<img src={value.profile.portraitUrl} alt="Your stadium profile image" width={54} height={54} style={{display:'block',borderRadius:'50%',objectFit:'cover',marginTop:8}}/>}
 {value.profile?.portraitStatus==='missing'&&<p>Add your image in your mobile Profile. It will appear here when you re-enter.</p>}
 {value.profile?.portraitStatus==='unavailable'&&<p>Your mobile profile image is temporarily unavailable. A neutral icon is shown.</p>}
 {value.profile&&!value.profile.voiceConfigured&&<p>Voice server is not configured yet.</p>}
 {value.profile?.voiceConfigured&&!value.connected&&<button disabled={value.busy} onClick={()=>void value.join()}>{value.busy?'Connecting…':'Join nearby chat'}</button>}
 {value.connected&&<><p>{value.identity?.role==='host'?'Your stage microphone reaches the audience.':'Conversations fade with distance.'} Microphone {value.mic?'on':'muted'}.</p><button onClick={()=>void value.microphone()}>{value.mic?'Mute microphone':'Enable microphone'}</button> <button onClick={value.enableAudio}>Enable audio</button> <button onClick={value.leave}>Disconnect voice</button>{value.peers.slice(0,8).map(p=><div key={p.identity}>{p.role==='host'?'Host':'Visitor'}{p.speaking?' · speaking':''} <button onClick={()=>value.mute(p.identity)}>Mute / unmute</button></div>)}</>}
 {value.error&&<p role="alert">{value.error}</p>}
 </section>}
