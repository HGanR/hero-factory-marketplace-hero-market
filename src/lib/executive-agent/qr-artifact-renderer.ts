import QRCode from 'qrcode';
import { PNG } from 'pngjs';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { createHash,randomUUID } from 'node:crypto';
import { gzipSync,gunzipSync } from 'node:zlib';
import { GenerateQrInputSchema,qrArtifactPrefix } from './qr-artifact-contract';

export const qrMemoryId=(id:string)=>createHash('sha256').update('qr-artifact:'+id).digest('hex').slice(0,32);
export const qrHash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
export const QR_TEXT_LIMIT=60_000,QR_RAW_LIMIT=1_000_000;
const fits=(value:string)=>{if(Buffer.byteLength(value)>QR_TEXT_LIMIT)throw Error('QR exceeds existing TEXT artifact budget. No files saved.');};

export async function decodeQrFile(bytes:Buffer,format:'png'|'svg',expected:string){
  const pixels=format==='png'?PNG.sync.read(bytes):await sharp(bytes,{limitInputPixels:2048*2048}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const width='info' in pixels?pixels.info.width:pixels.width;
  const height='info' in pixels?pixels.info.height:pixels.height;
  const data=pixels.data;
  if(width>2048||height>2048)throw Error('QR decode budget exceeded.');
  const decoded=jsQR(new Uint8ClampedArray(data),width,height,{inversionAttempts:'dontInvert'});
  if(!decoded||decoded.data!==expected)throw Error('QR decode did not match the intended URL. No artifact saved.');
  return true;
}

/** One matrix, two files, independently rasterized/decoded before persistence. */
export async function renderQrArtifact(raw:unknown,assetId:string,approvalId:string){
  const input=GenerateQrInputSchema.parse(raw);
  const token=input.uniqueMode?randomUUID():null;
  let finalUrl=input.url;
  if(token){const url=new URL(input.url);url.searchParams.set('qrid',token);finalUrl=url.href;}
  if(finalUrl.length>2200)throw Error('QR target exceeds the encoded URL budget.');
  const matrix=QRCode.create(finalUrl,{errorCorrectionLevel:input.ecc}).modules;
  const scale=Math.floor(input.sizePx/(matrix.size+2*input.quietZone));
  if(scale<2)throw Error('QR is too dense at this size. Request a larger image.');
  const margin=Math.floor((input.sizePx-matrix.size*scale)/2);
  const png=new PNG({width:input.sizePx,height:input.sizePx});png.data.fill(255);
  const rects:string[]=[];
  for(let y=0;y<matrix.size;y++)for(let x=0;x<matrix.size;x++)if(matrix.get(y,x)){
    const left=margin+x*scale,top=margin+y*scale;
    rects.push(`<rect x="${left}" y="${top}" width="${scale}" height="${scale}"/>`);
    for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
      const i=((top+dy)*input.sizePx+left+dx)*4;png.data[i]=png.data[i+1]=png.data[i+2]=0;
    }
  }
  // No supplied strings, external resources, links, metadata, scripts or fonts in SVG.
  const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${input.sizePx}" height="${input.sizePx}" viewBox="0 0 ${input.sizePx} ${input.sizePx}"><rect width="100%" height="100%" fill="#ffffff"/><g fill="#000000">${rects.join('')}</g></svg>`);
  const files={png:PNG.sync.write(png),svg};
  for(const format of ['png','svg'] as const)await decodeQrFile(files[format],format,finalUrl);
  const pointer=(format:'png'|'svg')=>({pointer:qrArtifactPrefix(assetId)+format,bytes:files[format].length,sha256:qrHash(files[format])});
  const receipt={kind:'qr_private_artifact_v1',approvalId,qrAssetId:assetId,clientId:input.clientId,workspaceId:input.workspaceId,
    name:input.name,url:finalUrl,requestedUrl:input.url,token,uniqueMode:input.uniqueMode,ecc:input.ecc,moduleShape:input.moduleShape,sizePx:input.sizePx,
    png:pointer('png'),svg:pointer('svg'),decode:{png:true,svg:true,decodedUrl:finalUrl},
    scanSafety:{score:scale>=4?100:80,warnings:scale<4?['Dense QR: test with intended scanner and print size.']:[]},
    qualityStatus:'decode_verified_scan_review_required',publication:'private_workspace_only',targetFetched:false,
    limitations:['Black square modules on white only. Styled variants are refused, not silently substituted.','Decoded link only: destination content, availability, safety and ownership are not verified.','No tracking analytics are implemented by appending qrid.','Revalidate security before any future service fetches the destination URL.']};
  const rawFiles=JSON.stringify({png:files.png.toString('base64'),svg:files.svg.toString('base64')});
  if(Buffer.byteLength(rawFiles)>QR_RAW_LIMIT)throw Error('QR raw artifact budget exceeded.');
  const record=JSON.stringify({receipt,packed:gzipSync(rawFiles).toString('base64')});fits(record);fits(JSON.stringify(receipt));
  return {receipt,record};
}

export function readQrArtifact(record:string){
  fits(record);
  const data=JSON.parse(record);
  if(data.receipt?.kind!=='qr_private_artifact_v1'||typeof data.packed!=='string')throw Error('Invalid QR record');
  const unpacked=JSON.parse(gunzipSync(Buffer.from(data.packed,'base64'),{maxOutputLength:QR_RAW_LIMIT}).toString('utf8'));
  const files={} as Record<'png'|'svg',Buffer>;
  for(const format of ['png','svg'] as const){
    if(typeof unpacked[format]!=='string')throw Error('QR file unavailable');
    files[format]=Buffer.from(unpacked[format],'base64');
    const meta=data.receipt[format];
    if(!meta||meta.bytes!==files[format].length||meta.sha256!==qrHash(files[format]))throw Error('QR integrity failure');
  }
  return {receipt:data.receipt,files};
}
