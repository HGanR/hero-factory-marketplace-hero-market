'use client';
import {useEffect,useRef,useState} from 'react';
import {Room,RoomEvent,Track} from 'livekit-client';
import {useAccount,useConnect,useSignMessage,useSwitchChain,type Connector} from 'wagmi';
import type {StadiumEvent} from '@/lib/troo-world/stadium-events';
type Credentials={token:string;serverUrl:string;endsAt:string;title:string;isHost:boolean};
async function admission(body:Record<string,unknown>){const response=await fetch('/api/troo-world/stadium/admission',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw Error(data.error||'Admission failed');return data;}
/** Credentials remain in memory. No generic room-token route is used. */
export default function StadiumAdmission({event,operator=false,onAdmitted,onClose}:{event:StadiumEvent;operator?:boolean;onAdmitted:()=>void;onClose:()=>void}){
 const {address,chainId,connector:connectedConnector}=useAccount();
 const {connectAsync,connectors}=useConnect();const {signMessageAsync}=useSignMessage();const {switchChainAsync}=useSwitchChain();
 const[error,setError]=useState(''),[busy,setBusy]=useState(false),[credentials,setCredentials]=useState<Credentials|null>(null),[connected,setConnected]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null);
 const admittedCallback=useRef(onAdmitted);admittedCallback.current=onAdmitted;
 useEffect(()=>{const d=dialog.current;if(!d)return;d.close();if(connected)d.show();else d.showModal();return()=>d.close();},[connected]);
 const media=useRef<HTMLDivElement>(null),roomRef=useRef<Room|null>(null);
 const verifiedWallet=useRef<string|null>(null);
 useEffect(()=>{if(verifiedWallet.current&&(address?.toLowerCase()!==verifiedWallet.current||chainId!==137)){void roomRef.current?.disconnect();setCredentials(null);setConnected(false);verifiedWallet.current=null;setError('Wallet changed. Verify admission again.');}},[address,chainId]);
 useEffect(()=>{const timer=setInterval(()=>{if(Date.now()>=Date.parse(event.endsAt)){void roomRef.current?.disconnect();setCredentials(null);setError('This event has ended.');}},1000);return()=>clearInterval(timer)},[event.endsAt]);
 useEffect(()=>{
  if(!credentials)return;
  const room=new Room();roomRef.current=room;let alive=true;

  room.on(RoomEvent.TrackSubscribed,track=>{if(track.kind===Track.Kind.Audio||track.kind===Track.Kind.Video){const el=track.attach();el.setAttribute('controls','');el.style.maxWidth='100%';media.current?.appendChild(el)}});
  room.on(RoomEvent.TrackUnsubscribed,track=>track.detach().forEach(el=>el.remove()));
  room.on(RoomEvent.Disconnected,()=>{if(alive){setConnected(false);setCredentials(null);}});
  void room.connect(credentials.serverUrl,credentials.token).then(async()=>{if(!alive)return;setConnected(true);admittedCallback.current();if(credentials.isHost){try{await room.localParticipant.setMicrophoneEnabled(true);await room.localParticipant.setCameraEnabled(true)}catch{setError('Connected as host. Allow microphone and camera permissions to broadcast.')}}}).catch(()=>{if(alive){setError('Could not connect to the event. It may be full or unavailable.');setCredentials(null)}});
  return()=>{alive=false;room.removeAllListeners();void room.disconnect();roomRef.current=null;media.current?.replaceChildren();};
 },[credentials]);
 const enter=async(host=false,connector?:Connector)=>{setBusy(true);setError('');if(host)verifiedWallet.current=null;try{
  let proof:Record<string,unknown>={};
  if(event.paid&&!host){
   const active=connector??connectedConnector;if(!active)throw Error('Choose a wallet to continue.');
   const accounts=connector?(await connectAsync({connector:active,chainId:137})).accounts:await active.getAccounts();
   const wallet=accounts[0];if(!wallet)throw Error('No wallet account was selected');
   if(await active.getChainId()!==137)await switchChainAsync({chainId:137});
   const challenge=await admission({action:'challenge',eventId:event.id,wallet});
   const signature=await signMessageAsync({account:wallet,message:challenge.message as string,connector:active});
   const current=await active.getAccounts();
   if(current[0]?.toLowerCase()!==wallet.toLowerCase()||await active.getChainId()!==137)throw Error('Wallet changed. Please try again');
   verifiedWallet.current=wallet.toLowerCase();
   proof={id:challenge.id,signature};
  }
  setCredentials(await admission({action:host?'host':'join',eventId:event.id,...proof}));
 }catch(e){setError(e instanceof Error?e.message:'Admission was not granted')}finally{setBusy(false)}};
 return <dialog ref={dialog} onCancel={onClose} aria-label="Stadium event admission" style={{margin:0,left:"auto",position:'fixed',right:20,top:90,zIndex:250,width:'min(420px,90vw)',maxHeight:'80vh',overflow:'auto',background:'#07192c',color:'white',border:'1px solid #65bfff',borderRadius:14,padding:20}}>
  <button type="button" onClick={onClose} style={{float:'right'}}>Close</button><h2>{event.title}</h2>
  <p>{connected?'You are connected to the event.':event.paid?'Connect your wallet and sign to verify your NFT ticket on Polygon. No transaction or purchase is requested.':'Join this free event. No wallet needed.'}</p>
  {!credentials&&event.paid&&!address&&<div style={{display:'grid',gap:8}}>{connectors.map(c=><button type="button" key={c.uid} disabled={busy} onClick={()=>void enter(false,c)}>{busy?'Verifying…':c.id==='walletConnect'?'WalletConnect · mobile wallets & QR':c.name}</button>)}{connectors.length===0&&<p>No wallet connector is available. Reload the page or enable your EVM wallet.</p>}</div>}
  {!credentials&&(!event.paid||address)&&<button type="button" disabled={busy} onClick={()=>void enter()}>{busy?'Verifying admission…':event.paid?'Connect wallet & enter':'Enter free event'}</button>}
  {operator&&!credentials&&<button type="button" disabled={busy} onClick={()=>void enter(true)}>Join as administrator host</button>}
  {connected&&<button type="button" onClick={()=>void roomRef.current?.startAudio().catch(()=>setError("Allow browser audio to hear the event."))}>Enable event audio</button>}
  <div ref={media}/>{error&&<p role="alert">{error}</p>}
 </dialog>;
}
