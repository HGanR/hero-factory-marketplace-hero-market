import jwt from 'jsonwebtoken';
import { createHmac, randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';
import { createPublicClient, http, parseAbi, decodeEventLog, verifyMessage } from 'viem';
import { polygon } from 'viem/chains';
import { mysql2ConnectionOptionsFromUrl } from '../db/mysql2-connection-options';
import { CheckoutError, address, amountUnits, CHAIN, TOKEN, TREASURY, paymentId, walletMessage, validateReceipt, type Order } from './policy';
const abi = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)']);
const rpc = createPublicClient({cacheTime:0,chain:polygon,transport:http(process.env.POLYGON_RPC_URL || 'https://polygon-bor-rpc.publicnode.com',{timeout:12000,retryCount:1})});
function secret() { const s=process.env.JWT_SECRET; if(!s || s.length<32) throw new CheckoutError('Checkout signing is not configured.'); return createHmac('sha256',s).update('troothhurtz/world-asset-checkout/v1').digest('hex'); }
async function connection() { if(!process.env.DATABASE_URL)throw new CheckoutError('Checkout database is unavailable.');const options=mysql2ConnectionOptionsFromUrl(process.env.DATABASE_URL);return typeof options === "string" ? mysql.createConnection(options) : mysql.createConnection(options); }
export async function prepareOrder(userId:number, assetId:string, walletInput:unknown) {
  const wallet=address(walletInput); const db=await connection();
  try {
    const [members]:any=await db.execute('SELECT id FROM marketplace_users WHERE id=? AND isActive=1 AND isApproved=1',[userId]);
    if(!members.length)throw new CheckoutError('An approved active member account is required.');
    const [assets]:any=await db.execute('SELECT id, name, tokenPrice, supplyLimit FROM world_library_assets WHERE id=? AND status=? AND isActive=1 AND isPlatformOnly=0',[assetId,'published']);
    const asset=assets[0]; if(!asset)throw new CheckoutError('Asset is unavailable.');
    const [owned]:any=await db.execute('SELECT id FROM user_world_assets WHERE userId=? AND assetId=? LIMIT 1',[userId,assetId]);
    if(owned.length)return {alreadyOwned:true,success:true,ownershipId:owned[0].id};
    const amount=amountUnits(asset.tokenPrice);if(BigInt(amount)<=0n)throw new CheckoutError('Use the free asset action for this asset.');
    // Do not collect irreversible funds for scarce inventory without a reservation service.
    if(asset.supplyLimit!=null)throw new CheckoutError('Paid limited-supply assets are not available for checkout yet. No payment requested.');
    if(await rpc.getChainId()!==CHAIN)throw new CheckoutError('Polygon verification is unavailable.');
    const decimals=await rpc.readContract({address:TOKEN as `0x${string}`,abi:parseAbi(['function decimals() view returns (uint8)']),functionName:'decimals'});
    if(decimals!==18)throw new CheckoutError('TROO contract decimals do not match checkout configuration. No payment requested.');
    const issuedBlock=(await rpc.getBlockNumber()).toString();const now=Math.floor(Date.now()/1000);
    const order:Order={kind:'world-troo-v1',userId,assetId,wallet,amount,price:String(asset.tokenPrice),issuedBlock,deadline:now+1800,nonce:randomUUID(),iat:now};
    const orderToken=jwt.sign(order,secret(),{algorithm:'HS256',audience:'world-asset-checkout',issuer:'troothhurtz.app'});
    return {orderToken,message:walletMessage(order),order,assetName:asset.name,chainId:CHAIN,token:TOKEN,treasury:TREASURY};
  } finally {await db.end();}
}
export async function verifyPayment(userId:number, assetId:string, body:any) {
  if(typeof body.orderToken!=='string'||body.orderToken.length>5000||typeof body.signature!=='string'||body.signature.length>1024)throw new CheckoutError('A signed checkout order is required.');
  const order=jwt.verify(body.orderToken,secret(),{algorithms:['HS256'],audience:'world-asset-checkout',issuer:'troothhurtz.app'}) as Order;
  if(order.kind!=='world-troo-v1'||order.userId!==userId||order.assetId!==assetId||!/^\d+$/.test(order.amount)||BigInt(order.amount)<=0n)throw new CheckoutError('Checkout order does not match this member and asset.');
  paymentId(body.txRef);
  if(!await verifyMessage({address:address(order.wallet) as `0x${string}`,message:walletMessage(order),signature:body.signature as `0x${string}`}))throw new CheckoutError('Wallet signature could not be verified.');
  if(await rpc.getChainId()!==CHAIN)throw new CheckoutError('Polygon verification is unavailable.');
  const hash=body.txRef.toLowerCase() as `0x${string}`;
  const [receipt,transaction,latest]=await Promise.all([rpc.getTransactionReceipt({hash}),rpc.getTransaction({hash}),rpc.getBlockNumber()]);
  const block=await rpc.getBlock({blockNumber:receipt.blockNumber});
  const transfers:{from:string;to:string;value:bigint}[]=[];
  for(const log of receipt.logs) {
    if(log.address.toLowerCase()!==TOKEN)continue;
    try {const e=decodeEventLog({abi,data:log.data,topics:log.topics});if(e.eventName==='Transfer')transfers.push(e.args);}catch{}
  }
  validateReceipt(order,receipt,transaction,block,latest,transfers);
  return {order,id:paymentId(hash),hash};
}
// Dedicated connection: never interleave a purchase transaction with the shared app connection.
export async function fulfillAsset(userId:number,assetId:string,body:any) {
  const paid=body.orderToken ? await verifyPayment(userId,assetId,body) : null;
  const db=await connection();
  try {
    await db.beginTransaction();
    const [members]:any=await db.execute('SELECT id FROM marketplace_users WHERE id=? AND isActive=1 AND isApproved=1',[userId]);
    if(!members.length)throw new CheckoutError('An approved active member account is required.');
    const [assets]:any=await db.execute('SELECT * FROM world_library_assets WHERE id=? FOR UPDATE',[assetId]);
    const asset=assets[0];if(!asset)throw new CheckoutError('Asset not found.');
    const [owned]:any=await db.execute('SELECT id FROM user_world_assets WHERE userId=? AND assetId=? LIMIT 1',[userId,assetId]);
    if(owned.length){await db.rollback();return {success:true,alreadyOwned:true,ownershipId:owned[0].id};}
    if(!paid && BigInt(amountUnits(asset.tokenPrice))>0n)throw new CheckoutError('Verified TROO payment is required.');
    if(!paid && (asset.status!=='published'||!asset.isActive||asset.isPlatformOnly))throw new CheckoutError('Asset is unavailable.');
    if(paid) {
      const [used]:any=await db.execute('SELECT id FROM user_world_assets WHERE LOWER(purchaseTx)=? LIMIT 1',[paid.hash]);
      if(used.length)throw new CheckoutError('This payment has already been used.');
      // A signed unlimited-inventory quote is honored even if price/listing changes after payment.
    } else if(asset.supplyLimit!=null) {
      const [counts]:any=await db.execute('SELECT COUNT(*) AS total FROM user_world_assets WHERE assetId=?',[assetId]);
      if(Number(counts[0].total)>=Number(asset.supplyLimit))throw new CheckoutError('Asset sold out.');
    }
    const id=paid?.id??randomUUID();
    await db.execute('INSERT INTO user_world_assets (id,userId,assetId,licenseScope,purchaseTx) VALUES (?,?,?,?,?)',[id,userId,assetId,'all_worlds_owned',paid?.hash??null]);
    await db.commit();return {success:true,alreadyOwned:false,ownershipId:id,assetId};
  } catch(error) {await db.rollback();throw error;} finally {await db.end();}
}
