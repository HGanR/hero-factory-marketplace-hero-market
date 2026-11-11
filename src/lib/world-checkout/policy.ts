import { createHash } from 'node:crypto';
export class CheckoutError extends Error {}
export const CHAIN = 137;
export const TOKEN = '0xa7927231898293377ce676cfc9bbd551cb845695';
export const TREASURY = '0x5c8b7c050d7e83e01a278be24d578a4daf3e17ef';
export const DECIMALS = 18;
export const CONFIRMATIONS = 32;
export type Order = { kind: 'world-troo-v1'; userId: number; assetId: string; wallet: string; amount: string; price: string; issuedBlock: string; deadline: number; nonce: string; iat: number };
export function address(value: unknown): string {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value) || /^0x0{40}$/i.test(value)) throw new CheckoutError('A valid Polygon wallet is required.');
  return value.toLowerCase();
}
export function amountUnits(value: unknown): string {
  const s = String(value);
  if (!/^(0|[1-9][0-9]{0,14})(\.[0-9]{1,18})?$/.test(s)) throw new CheckoutError('Asset price is invalid.');
  const [whole, fraction=''] = s.split('.');
  return (BigInt(whole)*10n**18n+BigInt(fraction.padEnd(18,'0'))).toString();
}
export function paymentId(hash: string): string {
  if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new CheckoutError('A valid transaction hash is required.');
  const h=createHash('sha256').update(CHAIN+':'+hash.toLowerCase()).digest('hex');
  return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20,32);
}
export function walletMessage(o: Order): string {
  return ['TROOTHHURTZ World Explorer purchase verification', 'Domain: troothhurtz.app', 'Member: '+o.userId, 'Asset: '+o.assetId,
    'Wallet: '+o.wallet, 'Network: Polygon (137)', 'Token: '+TOKEN, 'Treasury: '+TREASURY, 'Price: '+o.price+' TROO',
    'Order: '+o.nonce, 'Pay before: '+new Date(o.deadline*1000).toISOString(),
    'This signature verifies your wallet for this purchase. It does not transfer tokens or grant token approval.'].join('\n');
}
export function validateReceipt(o: Order, receipt: any, transaction: any, block: any, latest: bigint, transfers: {from:string;to:string;value:bigint}[]) {
  if (receipt.status !== 'success' || receipt.blockNumber == null) throw new CheckoutError('Payment has not succeeded.');
  if (receipt.blockNumber <= BigInt(o.issuedBlock) || BigInt(block.timestamp)>BigInt(o.deadline)) throw new CheckoutError('Payment is outside this order window. Contact support with the transaction hash.');
  if (latest-receipt.blockNumber+1n < BigInt(CONFIRMATIONS)) throw new CheckoutError('Payment is confirming. Retry verification; do not pay again.');
  if (address(transaction.from)!==o.wallet || address(transaction.to)!==TOKEN) throw new CheckoutError('Payment wallet or token does not match this order.');
  if (transfers.length!==1 || address(transfers[0].from)!==o.wallet || address(transfers[0].to)!==TREASURY || transfers[0].value!==BigInt(o.amount)) throw new CheckoutError('Payment recipient or TROO amount does not match this order.');
}
