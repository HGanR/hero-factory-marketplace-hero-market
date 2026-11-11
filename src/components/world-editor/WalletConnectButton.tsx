"use client";
import { useEffect, useRef, useState } from 'react';
import { useConnect, useAccount, useDisconnect, useSwitchChain, useReadContract } from 'wagmi';
import { formatUnits, parseAbi } from 'viem';
import { polygon } from 'wagmi/chains';
const token='0xa7927231898293377ce676cfc9bbd551cb845695';
const button={padding:'10px 14px',background:'#102f42',border:'1px solid #26d9ff',borderRadius:8,color:'#e0faff',cursor:'pointer'};
export function WalletConnectButton() {
  const {connectAsync,connectors,isPending}=useConnect();
  const {isConnected,address,chainId}=useAccount();
  const {disconnect}=useDisconnect();const {switchChainAsync}=useSwitchChain();
  const [error,setError]=useState('');const dialog=useRef<HTMLDialogElement>(null);
  const balance=useReadContract({address:token,abi:parseAbi(['function balanceOf(address) view returns (uint256)']),functionName:'balanceOf',args:address?[address]:undefined,chainId:137,query:{enabled:!!address,refetchInterval:20000}});
  useEffect(()=>{if(new URLSearchParams(window.location.search).get('wallet')==='connect'&&!isConnected)dialog.current?.showModal();},[isConnected]);
  async function connect(connector:(typeof connectors)[number]) {
    setError('');if(connector.id==='walletConnect')dialog.current?.close();try {await connectAsync({connector,chainId:polygon.id});dialog.current?.close();}catch{setError('Wallet connection was not completed. Try again or choose another wallet.');}
  }
  return <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
    {isConnected&&address?<>
      <span style={{fontSize:12,color:'#d6f6ff'}}>{address.slice(0,6)}…{address.slice(-4)}<br/>{balance.isError?'TROO balance unavailable':balance.data!==undefined?formatUnits(balance.data,18)+' TROO':'Checking TROO…'}</span>
      {chainId!==137&&<button style={button} onClick={()=>switchChainAsync({chainId:137}).catch(()=>setError('Please switch your wallet to Polygon.'))}>Switch to Polygon</button>}
      <button style={button} onClick={()=>disconnect()}>Disconnect</button>
    </>:<button style={button} onClick={()=>dialog.current?.showModal()}>Connect Wallet</button>}
    {error&&<span role="alert" style={{color:'#ffb8b8',fontSize:12}}>{error}</span>}
    <dialog ref={dialog} style={{background:'#071b29',color:'#e0faff',border:'1px solid #26d9ff',borderRadius:16,padding:24,width:'min(420px,90vw)'}}>
      <h2>Connect your wallet</h2>{error&&<p role="alert" style={{color:"#ffb8b8"}}>{error}</p>}<p>Choose an installed wallet, or WalletConnect to open a wallet app on your phone.</p>
      <p>Purchases use TROO on Polygon. Your member sign-in remains separate.</p>
      <div style={{display:'grid',gap:12}}>{connectors.map(c=><button key={c.uid} style={button} disabled={isPending} onClick={()=>connect(c)}>{c.id==='walletConnect'?'WalletConnect · mobile wallets & QR':c.name}</button>)}</div>
      <p style={{fontSize:12}}>MetaMask and Phantom can connect when their Polygon/EVM provider is available. Never enter a seed phrase here.</p>
      <button style={button} onClick={()=>dialog.current?.close()}>Close</button>
    </dialog>
  </div>;
}
