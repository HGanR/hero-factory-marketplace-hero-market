"use client";
import {useCallback,useEffect,useState} from 'react';
import {WalletConnectButton} from './WalletConnectButton';
import {OwnedAssetLibrary,type OwnedAsset} from './OwnedAssetLibrary';
export default function AccountAssetLibrary(){
 const [assets,setAssets]=useState<OwnedAsset[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [selected,setSelected]=useState<string|null>(null);
 const load=useCallback(async()=>{setLoading(true);try{const r=await fetch('/api/world-assets/me',{cache:'no-store'});if(!r.ok)throw new Error('Sign in to load your asset inventory.');const data=await r.json();setAssets(data.assets??[]);setError('')}catch(e){setError(e instanceof Error?e.message:'Inventory unavailable')}finally{setLoading(false)}},[]);
 useEffect(()=>{void load()},[load]);
 return <section style={{padding:20,border:'1px solid #376080',borderRadius:12,marginBottom:24,color:'#e0f4ff'}}><h2>My asset library</h2><WalletConnectButton/><p>Purchased assets stay in your account. Open one of your worlds below, select Edit, then choose the asset to place it. Select the placed storefront and open Interior library to furnish it.</p>{error?<p role="alert">{error}</p>:<OwnedAssetLibrary embedded assets={assets} selectedAssetId={selected} onSelectAsset={setSelected} loading={loading} onAssetPurchased={load}/>}{selected&&<p>{assets.find(a=>a.id===selected)?.name}: open a world below to place and furnish it.</p>}</section>;
}
