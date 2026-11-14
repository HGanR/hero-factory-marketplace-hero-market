'use client';
import type {useTownPresence} from './useTownPresence';
import {stageSpeaker} from '@/lib/troo-world/presence-model';
type Presence=ReturnType<typeof useTownPresence>;
export default function TownVoicePanel({value,active}:{value:Presence;active:boolean}){
 if(!active)return null;const me=value.identity,selected=value.selectedPeer,invitation=me?.invitation&&me.invitation.expiresAt>Date.now()?me.invitation:null;
 return <><style>{'@media(max-width:600px){.town-voice-panel{bottom:145px!important;max-height:42dvh!important;max-width:245px!important}}'}</style><section className="town-voice-panel" aria-label="Avatar and nearby voice" style={{position:'absolute',right:12,bottom:18,zIndex:130,maxWidth:290,maxHeight:'65dvh',overflowY:'auto',padding:12,borderRadius:12,background:'#071b2def',border:'1px solid #42c6e5',color:'white',font:'13px system-ui'}}>
 <strong>{me?.role==='host'?'Host · stadium profile image':'Stadium profile & nearby voice'}</strong>
 {!value.profile&&!value.connected&&<p>Sign in to use your avatar and nearby chat.</p>}
 {value.profile?.setupRequired&&<p>Avatar and seating storage needs setup.</p>}
 {value.profile?.portraitUrl&&<img src={value.profile.portraitUrl} alt="Your stadium profile image" width={54} height={54} style={{display:'block',borderRadius:'50%',objectFit:'cover',marginTop:8}}/>}
 {value.profile?.portraitStatus==='missing'&&<p>Add your image in your mobile Profile. It will appear here when you re-enter.</p>}
 {value.profile?.portraitStatus==='unavailable'&&<p>Your mobile profile image is temporarily unavailable. A neutral icon is shown.</p>}
 {value.profile&&!value.profile.voiceConfigured&&<p>Voice server is not configured yet.</p>}
 {value.profile?.voiceConfigured&&!value.connected&&<button disabled={value.busy} onClick={()=>void value.join()}>{value.busy?'Connecting…':'Join nearby chat'}</button>}
 {invitation&&<section role="alertdialog" aria-label="Invitation to speak"><p>The host invited you to speak. Would you like to move to the stage microphone? Choosing Yes also asks to enable your microphone.</p><button disabled={value.floorBusy} onClick={()=>void value.speakerAction('accept')}>Yes, I would like to speak</button> <button disabled={value.floorBusy} onClick={()=>void value.speakerAction('decline')}>No, stay seated</button></section>}
 {me?.floorRole==='speaker'&&<p role="status">Your speaking turn · you are at the stage microphone.</p>}
 {me?.role==='host'&&me.floorRole==='audience'&&<p role="status">You are seated while your guest speaks. Select their image to end the turn and return to the microphone.</p>}
 {me?.role==='host'&&selected&&<section aria-label="Selected attendee controls"><p>Selected {selected.floorRole==='speaker'?'guest speaker':'attendee'}</p>{selected.floorRole==='speaker'?<button disabled={value.floorBusy} onClick={()=>void value.speakerAction('end',selected)}>End speaking turn</button>:selected.invitation?<button disabled={value.floorBusy} onClick={()=>void value.speakerAction('cancel-invite',selected)}>Cancel speaking invitation</button>:<button disabled={value.floorBusy} onClick={()=>void value.speakerAction('invite',selected)}>Invite to speak</button>}</section>}
 {value.connected&&<><p>{me&&stageSpeaker(me)?'Your stage microphone reaches the audience.':'Conversations fade with distance.'} Microphone {value.mic?'on':'muted'}.</p><button onClick={()=>void value.microphone()}>{value.mic?'Mute microphone':'Enable microphone'}</button> <button onClick={value.enableAudio}>Enable audio</button> <button onClick={value.leave}>Disconnect voice</button>{value.peers.slice(0,16).map((p,i)=><div key={p.identity}>{me?.role==='host'&&p.role==='attendee'?<button aria-label={'Select attendee '+(i+1)} onClick={()=>value.selectPeer(p.identity)}>{p.portraitUrl&&<img src={p.portraitUrl} alt="" width={30} height={30} style={{borderRadius:'50%',verticalAlign:'middle'}}/>} {p.floorRole==='speaker'?'Guest speaker':'Attendee '+(i+1)}</button>:p.role==='host'?'Host':'Visitor'}{p.speaking?' · speaking':''} <button onClick={()=>value.mute(p.identity)}>Mute / unmute</button></div>)}</>}
 {value.error&&<p role="alert">{value.error}</p>}
 </section></>;
}
