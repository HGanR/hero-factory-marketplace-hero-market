'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Room,RoomEvent,Track,type RemoteParticipant,type RemoteAudioTrack} from 'livekit-client';
import {decodePosePacket,parsePresenceMetadata,proximityGain,type PresenceCredentials,type PresenceIdentity,type PresencePose,type AvatarProfile} from '@/lib/troo-world/presence-model';
export type PeerAvatar=PresenceIdentity&{speaking:boolean};
export type EventConnection={room:Room;credentials:PresenceCredentials};
export const initialPose=():PresencePose=>({position:[0,0,0],yaw:0,mode:'standing',zone:'world'});
export async function presenceRequest(body:Record<string,unknown>){const r=await fetch('/api/troo-world/presence',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error||'Presence is unavailable');return data;}
export function useTownPresence(active:boolean,event:EventConnection|null){
 const[profile,setProfile]=useState<AvatarProfile|null>(null),[error,setError]=useState(''),[world,setWorld]=useState<EventConnection|null>(null),[connected,setConnected]=useState(false),[mic,setMic]=useState(false),[peers,setPeers]=useState<PeerAvatar[]>([]),[busy,setBusy]=useState(false);
 const joinVersion=useRef(0),current=useRef({active,accountKey:profile?.accountKey,event});current.current={active,accountKey:profile?.accountKey,event};
 const pose=useRef(initialPose()),muted=useRef(new Set<string>()),audio=useRef(new Set<HTMLMediaElement>());const connection=event??world,room=connection?.room;
 const refresh=useCallback(async()=>{try{const r=await fetch('/api/troo-world/presence',{credentials:'same-origin',cache:'no-store'});if(!r.ok){setProfile(null);return;}setProfile(await r.json())}catch{setProfile(null)}},[]);
 useEffect(()=>{void refresh();const onFocus=()=>void refresh();window.addEventListener('focus',onFocus);return()=>window.removeEventListener('focus',onFocus)},[refresh]);
 useEffect(()=>{if(event?.credentials.accountKey&&event.credentials.accountKey!==profile?.accountKey)void event.room.disconnect();
  if(!active||event||!profile||world&&world.credentials.presence.identity!==profile.accountKey){joinVersion.current++;void world?.room.disconnect();setWorld(null)}},[active,event,profile?.accountKey]);
 useEffect(()=>()=>{joinVersion.current++},[]);
 const join=useCallback(async()=>{const version=++joinVersion.current,accountKey=current.current.accountKey;setBusy(true);setError('');let r:Room|undefined;try{const credentials=await presenceRequest({action:'join'}) as PresenceCredentials;r=new Room();await r.connect(credentials.serverUrl,credentials.token,{autoSubscribe:false});if(version!==joinVersion.current||!current.current.active||current.current.event||current.current.accountKey!==accountKey){await r.disconnect();return;}setWorld({room:r,credentials})}catch(e){void r?.disconnect();setError(e instanceof Error?e.message:'Could not join nearby chat')}finally{setBusy(false)}},[]);
 const claim=useCallback(async()=>{setBusy(true);setError('');try{await presenceRequest({action:'claim-jarvon'});await (current.current.event?.room??world?.room)?.disconnect();setWorld(null);await refresh()}catch(e){setError(e instanceof Error?e.message:'Avatar assignment failed')}finally{setBusy(false)}},[refresh,world]);
 useEffect(()=>{
  if(!room||!connection){setConnected(false);setMic(false);setPeers([]);return;}
  let alive=true,seq=0;setConnected(true);setMic(false);const poses=new Map<string,{pose:PresencePose;seq:number;time:number}>();
  const known=(p:RemoteParticipant)=>parsePresenceMetadata(p.metadata,p.identity);
  const subscribed=(track:Track)=>{if(track.kind!==Track.Kind.Audio)return;const t=track as RemoteAudioTrack;t.setVolume(0);const el=t.attach();el.autoplay=true;el.dataset.trooVoice='true';document.body.appendChild(el);audio.current.add(el);};
  const unsubscribed=(track:Track)=>track.detach().forEach(el=>{audio.current.delete(el);el.remove()});
  const receive=(bytes:Uint8Array,p?:RemoteParticipant)=>{if(!p)return;const identity=known(p);if(!identity||identity.role!=='visitor')return;const next=decodePosePacket(bytes,poses.get(p.identity)?.seq??-1);if(next)poses.set(p.identity,{...next,time:Date.now()});};
  const disconnected=()=>{if(alive){setConnected(false);setMic(false);setPeers([]);setWorld(null)}};
  room.on(RoomEvent.TrackSubscribed,subscribed);room.on(RoomEvent.TrackUnsubscribed,unsubscribed);room.on(RoomEvent.DataReceived,receive);room.on(RoomEvent.Disconnected,disconnected);
  const tick=()=>{
   const list:PeerAvatar[]=[];const candidates:Array<{p:RemoteParticipant;gain:number;host:boolean}>=[];
   room.remoteParticipants.forEach(p=>{const data=known(p);if(!data)return;const packet=poses.get(p.identity);const current=data.role==='visitor'?(packet&&Date.now()-packet.time<3000?packet.pose:null):data.pose;if(!current)return;
    const gain=muted.current.has(p.identity)?0:proximityGain(pose.current,current,data.role==='host');candidates.push({p,gain,host:data.role==='host'});if(current.zone===pose.current.zone)list.push({...data,pose:current,speaking:p.isSpeaking});
   });
   candidates.sort((a,b)=>Number(b.host)-Number(a.host)||b.gain-a.gain);const allowed=new Set(candidates.filter(c=>c.gain>0).slice(0,12).map(c=>c.p.identity));
   room.remoteParticipants.forEach(p=>{const gain=candidates.find(c=>c.p===p)?.gain??0;const hear=allowed.has(p.identity);p.setVolume(hear?gain:0);p.audioTrackPublications.forEach(pub=>{if(pub.isSubscribed!==hear)pub.setSubscribed(hear)});});
   if(connection.credentials.presence.role==='visitor'){const packet={v:1,seq:++seq,pose:pose.current};void room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(packet)),{reliable:false,topic:'troo-pose-v1'}).catch(()=>{});}
   if(alive)setPeers(list);
  };
  const departed=(p:RemoteParticipant)=>{poses.delete(p.identity);muted.current.delete(p.identity)};room.on(RoomEvent.ParticipantDisconnected,departed);
  const timer=setInterval(tick,200);tick();return()=>{alive=false;clearInterval(timer);room.off(RoomEvent.ParticipantDisconnected,departed);room.off(RoomEvent.TrackSubscribed,subscribed);room.off(RoomEvent.TrackUnsubscribed,unsubscribed);room.off(RoomEvent.DataReceived,receive);room.off(RoomEvent.Disconnected,disconnected);audio.current.forEach(el=>el.remove());audio.current.clear();poses.clear();};
 },[room,connection]);
 useEffect(()=>()=>{void world?.room.disconnect()},[world]);
 const microphone=async()=>{if(!room)return;setError('');try{await room.startAudio();await room.localParticipant.setMicrophoneEnabled(!mic,{echoCancellation:true,noiseSuppression:true});setMic(!mic)}catch{setError('Microphone permission was not granted. You can still listen.');setMic(false)}};
 const leave=()=>{joinVersion.current++;void room?.localParticipant.setMicrophoneEnabled(false);void room?.disconnect();setWorld(null);setMic(false)};
 const enableAudio=()=>{void room?.startAudio().catch(()=>setError('Use the browser audio permission to hear nearby people.'))};
 return{profile,error,peers,pose,connected,mic,busy,join,claim,microphone,leave,enableAudio,mute:(id:string)=>{muted.current.has(id)?muted.current.delete(id):muted.current.add(id);},identity:connection?.credentials.presence,room};
}
