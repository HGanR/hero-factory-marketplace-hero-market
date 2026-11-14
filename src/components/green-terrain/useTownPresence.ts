'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Room,RoomEvent,Track,type Participant,type RemoteParticipant,type RemoteAudioTrack} from 'livekit-client';
import {decodePosePacket,parsePresenceMetadata,proximityGain,stageSpeaker,type PresenceCredentials,type PresenceIdentity,type PresencePose,type AvatarProfile} from '@/lib/troo-world/presence-model';
export type PeerAvatar=PresenceIdentity&{speaking:boolean};
export type EventConnection={room:Room;credentials:PresenceCredentials};
export const initialPose=():PresencePose=>({position:[0,0,0],yaw:0,mode:'standing',zone:'world'});
export async function presenceRequest(body:Record<string,unknown>){const r=await fetch('/api/troo-world/presence',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error||'Presence is unavailable');return data;}
export function useTownPresence(active:boolean,event:EventConnection|null){
 const[profile,setProfile]=useState<AvatarProfile|null>(null),[error,setError]=useState(''),[world,setWorld]=useState<EventConnection|null>(null),[connected,setConnected]=useState(false),[mic,setMic]=useState(false),[peers,setPeers]=useState<PeerAvatar[]>([]),[busy,setBusy]=useState(false),[identity,setIdentity]=useState<PresenceIdentity>(),[selected,setSelected]=useState<string|null>(null),[floorBusy,setFloorBusy]=useState(false);
 const joinVersion=useRef(0),identityRef=useRef<PresenceIdentity|undefined>(undefined),floorPending=useRef(false),current=useRef({active,accountKey:profile?.accountKey,event});current.current={active,accountKey:profile?.accountKey,event};
 const pose=useRef(initialPose()),muted=useRef(new Set<string>()),audio=useRef(new Set<HTMLMediaElement>());const connection=event??world,room=connection?.room;
 const applyIdentity=useCallback((next:PresenceIdentity)=>{const old=identityRef.current;if(old?.identity===next.identity&&(old.floorRevision??0)>(next.floorRevision??0))return;identityRef.current=next;setIdentity(next);},[]);
 const refresh=useCallback(async()=>{try{const r=await fetch('/api/troo-world/presence',{credentials:'same-origin',cache:'no-store'});if(!r.ok){setProfile(null);return;}setProfile(await r.json())}catch{setProfile(null)}},[]);
 useEffect(()=>{void refresh();const onFocus=()=>void refresh();window.addEventListener('focus',onFocus);return()=>window.removeEventListener('focus',onFocus)},[refresh]);
 useEffect(()=>{if(event?.credentials.accountKey&&event.credentials.accountKey!==profile?.accountKey)void event.room.disconnect();if(!active||event||!profile||world&&world.credentials.presence.identity!==profile.accountKey){joinVersion.current++;void world?.room.disconnect();setWorld(null)}},[active,event,profile?.accountKey]);
 useEffect(()=>()=>{joinVersion.current++},[]);
 const join=useCallback(async()=>{const version=++joinVersion.current,accountKey=current.current.accountKey;setBusy(true);setError('');let r:Room|undefined;try{const credentials=await presenceRequest({action:'join'}) as PresenceCredentials;r=new Room();await r.connect(credentials.serverUrl,credentials.token,{autoSubscribe:false});if(version!==joinVersion.current||!current.current.active||current.current.event||current.current.accountKey!==accountKey){await r.disconnect();return;}setWorld({room:r,credentials})}catch(e){void r?.disconnect();setError(e instanceof Error?e.message:'Could not join nearby chat')}finally{setBusy(false)}},[]);
 const claim=useCallback(async()=>{setBusy(true);setError('');try{await presenceRequest({action:'claim-jarvon'});await (current.current.event?.room??world?.room)?.disconnect();setWorld(null);await refresh()}catch(e){setError(e instanceof Error?e.message:'Avatar assignment failed')}finally{setBusy(false)}},[refresh,world]);
 const speakerAction=useCallback(async(action:string,target?:PeerAvatar)=>{
  if(!room||!event?.credentials.seatLeaseToken||floorPending.current)return false;floorPending.current=true;if(action!=='sync'){setFloorBusy(true);setError('');}
  try{const r=await fetch('/api/troo-world/stadium/speaker',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,seatToken:event.credentials.seatLeaseToken,...(target?{target:target.identity,turnId:target.turnId,invitationId:target.invitation?.id}:{invitationId:identityRef.current?.invitation?.id})})});const data=await r.json();if(!r.ok)throw Error(data.error||'Speaker controls are unavailable');const next=parsePresenceMetadata(JSON.stringify(data.presence),room.localParticipant.identity);if(!next)throw Error('The speaker state could not be verified');applyIdentity(next);
   if(action==='accept'){try{await room.startAudio();await room.localParticipant.setMicrophoneEnabled(true,{echoCancellation:true,noiseSuppression:true});setMic(true)}catch{setError('You are at the microphone. Enable microphone permission to speak.');setMic(false)}}return true;
  }catch(e){if(action!=='sync')setError(e instanceof Error?e.message:'Speaker controls are unavailable');return false;}finally{floorPending.current=false;setFloorBusy(false)}
 },[room,event,applyIdentity]);
 useEffect(()=>{
  if(!room||!connection){setConnected(false);setMic(false);setPeers([]);setIdentity(undefined);identityRef.current=undefined;setSelected(null);return;}
  let alive=true,seq=0;setConnected(true);setMic(false);applyIdentity(parsePresenceMetadata(room.localParticipant.metadata,room.localParticipant.identity)??connection.credentials.presence);
  const poses=new Map<string,{pose:PresencePose;seq:number;time:number}>(),metadata=new Map<string,PresenceIdentity>();
  const known=(p:RemoteParticipant)=>{const next=parsePresenceMetadata(p.metadata,p.identity),old=metadata.get(p.identity);if(next&&(!old||(next.floorRevision??0)>=(old.floorRevision??0))){metadata.set(p.identity,next);return next;}return old??null;};
  const subscribed=(track:Track)=>{if(track.kind!==Track.Kind.Audio)return;const t=track as RemoteAudioTrack;t.setVolume(0);const el=t.attach();el.autoplay=true;el.dataset.trooVoice='true';document.body.appendChild(el);audio.current.add(el);};
  const unsubscribed=(track:Track)=>track.detach().forEach(el=>{audio.current.delete(el);el.remove()});
  const receive=(bytes:Uint8Array,p?:RemoteParticipant)=>{if(!p)return;const data=known(p);if(!data||!(data.role==='visitor'||data.role==='host'&&stageSpeaker(data)))return;const next=decodePosePacket(bytes,poses.get(p.identity)?.seq??-1);if(next&&(data.role==='visitor'||next.pose.zone===data.pose.zone))poses.set(p.identity,{...next,time:Date.now()});};
  const disconnected=()=>{if(alive){setConnected(false);setMic(false);setPeers([]);setWorld(null)}};
  const changed=(_previous:string|undefined,p:Participant)=>{if(p.identity!==room.localParticipant.identity)return;const next=parsePresenceMetadata(p.metadata,p.identity);if(!next)return;const prior=identityRef.current;applyIdentity(next);if(prior&&stageSpeaker(prior)&&next.floorRole==='audience')void room.localParticipant.setMicrophoneEnabled(false).then(()=>{if(alive)setMic(false)});};
  const micChanged=()=>{if(alive)setMic(room.localParticipant.isMicrophoneEnabled)};
  room.on(RoomEvent.TrackSubscribed,subscribed).on(RoomEvent.TrackUnsubscribed,unsubscribed).on(RoomEvent.DataReceived,receive).on(RoomEvent.Disconnected,disconnected).on(RoomEvent.ParticipantMetadataChanged,changed).on(RoomEvent.TrackMuted,micChanged).on(RoomEvent.TrackUnmuted,micChanged);
  const tick=()=>{
   const list:PeerAvatar[]=[],candidates:Array<{p:RemoteParticipant;gain:number;broadcast:boolean}>=[];
   room.remoteParticipants.forEach(p=>{const data=known(p);if(!data)return;const packet=poses.get(p.identity),moves=data.role==='visitor'||data.role==='host'&&stageSpeaker(data);const current=moves?(packet&&Date.now()-packet.time<3000?packet.pose:data.role==='host'?data.pose:null):data.pose;if(!current)return;
    const broadcast=stageSpeaker(data),gain=muted.current.has(p.identity)?0:proximityGain(pose.current,current,broadcast);candidates.push({p,gain,broadcast});if(current.zone===pose.current.zone)list.push({...data,pose:current,speaking:p.isSpeaking});
   });
   candidates.sort((a,b)=>Number(b.broadcast)-Number(a.broadcast)||b.gain-a.gain);const allowed=new Set(candidates.filter(c=>c.gain>0).slice(0,12).map(c=>c.p.identity));
   room.remoteParticipants.forEach(p=>{const gain=candidates.find(c=>c.p===p)?.gain??0,hear=allowed.has(p.identity);p.setVolume(hear?gain:0);p.audioTrackPublications.forEach(pub=>{if(pub.isSubscribed!==hear)pub.setSubscribed(hear)});});
   const me=identityRef.current;if(me&&(me.role==='visitor'||me.role==='host'&&stageSpeaker(me))){const packet={v:1,seq:++seq,pose:pose.current};void room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(packet)),{reliable:false,topic:'troo-pose-v1'}).catch(()=>{});}if(alive)setPeers(list);
  };
  const departed=(p:RemoteParticipant)=>{poses.delete(p.identity);metadata.delete(p.identity);muted.current.delete(p.identity);if(event)void speakerAction('sync');};room.on(RoomEvent.ParticipantDisconnected,departed);
  const timer=setInterval(tick,200);tick();return()=>{alive=false;clearInterval(timer);room.off(RoomEvent.ParticipantDisconnected,departed).off(RoomEvent.TrackSubscribed,subscribed).off(RoomEvent.TrackUnsubscribed,unsubscribed).off(RoomEvent.DataReceived,receive).off(RoomEvent.Disconnected,disconnected).off(RoomEvent.ParticipantMetadataChanged,changed).off(RoomEvent.TrackMuted,micChanged).off(RoomEvent.TrackUnmuted,micChanged);audio.current.forEach(el=>el.remove());audio.current.clear();poses.clear();};
 },[room,connection,applyIdentity,speakerAction,event]);
 useEffect(()=>{if(!event)return;void speakerAction('sync');if(event.credentials.presence.role!=='host')return;const timer=setInterval(()=>void speakerAction('sync'),5000);return()=>clearInterval(timer)},[event,speakerAction]);
 useEffect(()=>()=>{void world?.room.disconnect()},[world]);
 const microphone=async()=>{if(!room)return;setError('');try{await room.startAudio();await room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled,{echoCancellation:true,noiseSuppression:true});setMic(room.localParticipant.isMicrophoneEnabled)}catch{setError('Microphone permission was not granted. You can still listen.');setMic(false)}};
 const leave=()=>{joinVersion.current++;void room?.localParticipant.setMicrophoneEnabled(false);void room?.disconnect();setWorld(null);setMic(false)};
 const enableAudio=()=>{void room?.startAudio().catch(()=>setError('Use the browser audio permission to hear nearby people.'))};
 return{profile,error,peers,pose,connected,mic,busy,join,claim,microphone,leave,enableAudio,identity,room,selectedPeer:peers.find(p=>p.identity===selected),selectPeer:(id:string)=>setSelected(id),floorBusy,speakerAction,mute:(id:string)=>{muted.current.has(id)?muted.current.delete(id):muted.current.add(id);}};
}
