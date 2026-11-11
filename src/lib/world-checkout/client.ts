import { BrowserProvider, Contract } from 'ethers';
const TOKEN='0xa7927231898293377ce676cfc9bbd551cb845695';
const TREASURY='0x5c8b7c050d7e83e01a278be24d578a4daf3e17ef';
const KEY='troo-world-checkout-v1:';
async function api(path:string,body:any) {
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),45000);
  try {
    const r=await fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await r.json();if(!r.ok)throw new Error(data.error||'Checkout unavailable.');return data;
  } finally {clearTimeout(timer);}
}
async function purchaseUnlocked(assetId:string,connector:any,expectedWallet:string,notify:(s:string)=>void) {
  if(!connector)throw new Error('Connect a Polygon wallet first.');
  // Always use the chosen connector, including WalletConnect; never window.ethereum.
  const provider=new BrowserProvider(await connector.getProvider());
  if(Number((await provider.getNetwork()).chainId)!==137)throw new Error('Switch your connected wallet to Polygon first.');
  const signer=await provider.getSigner();const wallet=(await signer.getAddress()).toLowerCase();
  if(wallet!==expectedWallet.toLowerCase())throw new Error('Wallet changed. Reconnect before purchasing.');
  const key=KEY+assetId+':'+wallet;
  let saved:any;try {saved=JSON.parse(localStorage.getItem(key)||'null');}catch {throw new Error('Local purchase recovery is unavailable. Enable browser storage before paying.');}
  if(saved) {
    if(!saved.txRef)throw new Error('A previous payment may still be pending. Use Recover payment with its transaction hash; do not pay again.');
    notify('Verifying your saved payment. No new transfer will be requested.');
    const result=await api('/api/world-assets/'+encodeURIComponent(assetId)+'/purchase',saved);
    localStorage.removeItem(key);return result;
  }
  notify('Checking your member account and the current price…');
  const quote=await api('/api/world-assets/checkout',{assetId,wallet});if(quote.alreadyOwned)return quote;
  if(quote.chainId!==137||quote.token!==TOKEN||quote.treasury!==TREASURY||quote.order.wallet!==wallet||!/^\d+$/.test(quote.order.amount))throw new Error('Checkout configuration mismatch. No payment requested.');
  if(!window.confirm('Purchase '+quote.assetName+' for '+quote.order.price+' TROO on Polygon? Network gas is additional.'))throw new Error('Purchase cancelled.');
  notify('Verify this purchase in your wallet. This signature does not transfer funds.');
  const signature=await signer.signMessage(quote.message);
  const token=new Contract(TOKEN,['function balanceOf(address) view returns(uint256)','function transfer(address,uint256) returns(bool)'],signer);
  const value=BigInt(quote.order.amount);
  if(await token.balanceOf(wallet)<value)throw new Error('Insufficient TROO balance on Polygon.');
  const gas=await token.transfer.estimateGas(TREASURY,value);const fee=await provider.getFeeData();
  if(!fee.maxFeePerGas&&!fee.gasPrice)throw new Error('Network gas estimate unavailable.');
  if(await provider.getBalance(wallet)<gas*(fee.maxFeePerGas||fee.gasPrice!)*120n/100n)throw new Error('Insufficient POL for network gas.');
  if(Math.floor(Date.now()/1000)>=quote.order.deadline-60)throw new Error('Quote expired. Start again; no payment was sent.');
  if((await signer.getAddress()).toLowerCase()!==wallet||Number((await provider.getNetwork()).chainId)!==137)throw new Error('Wallet or network changed.');
  saved={orderToken:quote.orderToken,signature,txRef:null};
  // Persist before sending. An uncertain wallet/RPC response must never trigger an automatic second transfer.
  localStorage.setItem(key,JSON.stringify(saved));
  notify('Approve the TROO transfer in your wallet. Keep this page open.');
  let tx;
  try {tx=await token.transfer(TREASURY,value);}catch(e:any){if(e.code==='ACTION_REJECTED')localStorage.removeItem(key);throw new Error(e.code==='ACTION_REJECTED'?'Payment rejected; no purchase completed.':'Payment submission is uncertain. Check wallet activity and use Recover payment; do not pay again.');}
  saved.txRef=tx.hash;localStorage.setItem(key,JSON.stringify(saved));
  notify('Payment submitted: '+tx.hash+'. Waiting for confirmations; you may use Recover payment later.');
  try {await tx.wait(32,150000);}catch {throw new Error('Payment is still pending or changed. Use Recover payment with the confirmed hash; do not pay again.');}
  const result=await api('/api/world-assets/'+encodeURIComponent(assetId)+'/purchase',saved);
  localStorage.removeItem(key);return result;
}
async function recoverUnlocked(assetId:string,wallet:string,hash:string) {
  if(!/^0x[0-9a-fA-F]{64}$/.test(hash))throw new Error('Enter the full Polygon transaction hash.');
  const key=KEY+assetId+':'+wallet.toLowerCase();const saved=JSON.parse(localStorage.getItem(key)||'null');
  if(!saved)throw new Error('No saved order in this browser. Contact support with your transaction hash; do not pay again.');
  saved.txRef=hash;localStorage.setItem(key,JSON.stringify(saved));
  const result=await api('/api/world-assets/'+encodeURIComponent(assetId)+'/purchase',saved);localStorage.removeItem(key);return result;
}

// An origin-wide Web Lock prevents two tabs from submitting transfers concurrently.
// Unsupported browsers refuse payments rather than relying on a racy storage flag.
async function exclusive<T>(wallet:string, work:()=>Promise<T>):Promise<T> {
  if(!navigator.locks)throw new Error('Secure checkout requires a browser with Web Locks. Open this site in an up-to-date Safari or Chrome browser.');
  return navigator.locks.request('troo-checkout:'+wallet.toLowerCase(),{ifAvailable:true},async lock=>{
    if(!lock)throw new Error('Another checkout is open for this wallet. Finish it before retrying.');
    return work();
  });
}
export function purchaseWithWallet(assetId:string,connector:any,wallet:string,notify:(s:string)=>void) {
  return exclusive(wallet,()=>purchaseUnlocked(assetId,connector,wallet,notify));
}
export function recoverPurchase(assetId:string,wallet:string,hash:string) {
  return exclusive(wallet,()=>recoverUnlocked(assetId,wallet,hash));
}
