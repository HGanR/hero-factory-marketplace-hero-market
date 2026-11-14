'use client';
import {useCallback,useEffect,useState} from 'react';
import {validateLayout,type GreenLayout} from '@/lib/troo-world/green-terrain-layout';

type SavedTown = {layout:GreenLayout;revision:number;preview?:boolean};
/** Refresh data without removing the mounted renderer or losing its camera. */
export function useSavedTownLayout(readOnly:boolean,onLoaded:(town:SavedTown)=>void){
 const [ready,setReady]=useState(false),[error,setError]=useState('');
 const [reload,setReload]=useState(0);
 const retry=useCallback(()=>setReload(v=>v+1),[]);
 useEffect(()=>{
  const controller=new AbortController();
  setError('');
  void(async()=>{try{
   const response=await fetch('/api/troo-world/green-terrain-layout',{cache:'no-store',signal:controller.signal});
   const data=await response.json();
   if(controller.signal.aborted)return;
   if(!response.ok||!data.ok)throw new Error(data.error||'Saved town could not be loaded');
   if(data.missing){
    if(readOnly)throw new Error('No Green Terrain layout has been saved for Troo Town yet.');
    setReady(true);return;
   }
   const layout=validateLayout(data.layout);
   if(!Number.isSafeInteger(data.revision)||data.revision<0)throw new Error('Invalid saved town revision');
   onLoaded({layout,revision:data.revision,...(data.preview?{preview:true}:{})});
   setReady(true);
  }catch(reason){
   if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Town layout could not be loaded');
  }})();
  return()=>controller.abort();
 },[readOnly,reload,onLoaded]);
 useEffect(()=>{
  if(!readOnly)return;
  const refresh=()=>{if(!document.hidden)retry();};
  window.addEventListener('focus',refresh);
  return()=>window.removeEventListener('focus',refresh);
 },[readOnly,retry]);
 return{ready,error,retry};
}

